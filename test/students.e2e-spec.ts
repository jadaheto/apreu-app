import { createE2eApp, DIRECTOR, type E2eContext, todayInBogota, uniqueSuffix } from './support/e2e-app.js';
import { DATE_ONLY, NEW_PASSWORD } from './support/fixtures.js';
import { asBuffer, isPdf } from './support/http.js';
import { DEMO_CLASSROOM_ID, enrollStudent, type EnrolledStudent, uniqueDocument } from './support/students.js';

describe('students (E2E)', () => {
  let ctx: E2eContext;
  let director: string;
  let nunez: EnrolledStudent;
  const surname = `Núñez ${uniqueSuffix()}`;

  beforeAll(async () => {
    ctx = await createE2eApp();
    director = await ctx.login(DIRECTOR.email, DIRECTOR.password);
  });
  afterAll(() => ctx?.close());

  describe('enrollment', () => {
    it('enrolls a student with a new guardian and portal accounts; dates round-trip as YYYY-MM-DD', async () => {
      nunez = await enrollStudent(ctx, director, { firstName: 'José Andrés', lastName: surname, portal: true });
      const student = nunez.body.student;
      expect(student.code).toMatch(/^AL\d{4}\d{4}$/);
      expect(student.birthDate).toBe('2015-04-20');
      expect(student.enrollmentDate).toMatch(DATE_ONLY);
      expect(student.enrollmentDate).toBe(todayInBogota());
      expect(student.placement).toMatchObject({ classroomId: DEMO_CLASSROOM_ID, gradeName: 'Sexto' });
      expect(nunez.body.guardianReused).toBe(false);
      expect(nunez.accounts.map((a) => a.holder).sort()).toEqual(['guardian', 'student']);
    });

    it('assigns consecutive codes', async () => {
      const next = await enrollStudent(ctx, director, { withGuardian: false });
      const number = (code: string) => Number(code.slice(-4));
      expect(next.code.slice(0, 6)).toBe(nunez.code.slice(0, 6));
      expect(number(next.code)).toBe(number(nunez.code) + 1);
    });

    it('rejects a duplicated document', async () => {
      const document = uniqueDocument();
      const payload = {
        student: { firstName: 'Dup', lastName: 'Licado', documentType: 'TI', documentNumber: document },
        createPortalAccounts: false,
      };
      expect((await ctx.api(director).post('/api/students').send(payload)).status).toBe(201);
      expect((await ctx.api(director).post('/api/students').send(payload)).status).toBe(409);
    });

    it('treats passport numbers that differ only in case as the same document', async () => {
      const passport = `AB${uniqueDocument()}X`;
      const payload = (documentNumber: string) => ({
        student: { firstName: 'Pasaporte', lastName: 'Mayúsculas', documentType: 'PP', documentNumber },
        createPortalAccounts: false,
      });
      expect((await ctx.api(director).post('/api/students').send(payload(passport))).status).toBe(201);
      const duplicate = await ctx
        .api(director)
        .post('/api/students')
        .send(payload(` ${passport.toLowerCase()} `));
      expect(duplicate.status).toBe(409);
    });
  });

  it('a guardian document differing only in case is the same guardian', async () => {
    const document = `CE${uniqueDocument()}AB`;
    const guardian = (documentNumber: string) => ({
      documentType: 'ce',
      documentNumber,
      firstName: 'Acudiente',
      lastName: 'Extranjero',
    });
    expect((await ctx.api(director).post('/api/guardians').send(guardian(document))).status).toBe(201);
    expect((await ctx.api(director).post('/api/guardians').send(guardian(document.toLowerCase()))).status).toBe(409);
  });

  describe('directory and record', () => {
    it('finds "Núñez" searching "nunez" (no accents, no case)', async () => {
      for (const term of ['nunez', 'NUÑEZ', 'jose andres nunez']) {
        const res = await ctx.api(director).get(`/api/students?search=${encodeURIComponent(term)}&limit=50`);
        expect(res.status).toBe(200);
        expect(res.body.items.map((s: { id: number }) => s.id)).toContain(nunez.id);
      }
    });

    it('finds by code in lower case', async () => {
      const res = await ctx.api(director).get(`/api/students?search=${nunez.code.toLowerCase()}`);
      expect(res.body.items.map((s: { id: number }) => s.id)).toContain(nunez.id);
    });

    it('returns the 360 record', async () => {
      const res = await ctx.api(director).get(`/api/students/${nunez.id}`);
      expect(res.status).toBe(200);
      expect(JSON.stringify(res.body)).toContain(surname);
    });

    it('denies the directory to a teacher-less role (parent) with 403', async () => {
      const guardianAccount = nunez.accounts.find((a) => a.holder === 'guardian')!;
      const token = await ctx.login(guardianAccount.email!, guardianAccount.temporaryPassword!);
      await ctx
        .api(token)
        .patch('/api/auth/password')
        .send({ currentPassword: guardianAccount.temporaryPassword, newPassword: NEW_PASSWORD })
        .expect(204);
      expect((await ctx.api(token).get('/api/students')).status).toBe(403);
      const portal = await ctx.api(token).get('/api/portal/context');
      expect(portal.status).toBe(200);
      expect(JSON.stringify(portal.body)).toContain(String(nunez.id));
      parentToken = token;
    });
  });

  let parentToken: string;

  describe('certificates', () => {
    let certificateId: number;
    let code: string;

    it('the guardian requests a certificate (pending)', async () => {
      const res = await ctx
        .api(parentToken)
        .post(`/api/students/${nunez.id}/certificate-requests`)
        .send({ notes: 'Para el banco' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ status: 'pending', verificationCode: null });
      certificateId = res.body.id;
      const again = await ctx.api(parentToken).post(`/api/students/${nunez.id}/certificate-requests`).send({});
      expect(again.status).toBe(422);
    });

    it('the guardian cannot approve it', async () => {
      expect((await ctx.api(parentToken).post(`/api/certificates/${certificateId}/approve`)).status).toBe(403);
    });

    it('the office approves it and it gets a verification code', async () => {
      const res = await ctx.api(director).post(`/api/certificates/${certificateId}/approve`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('approved');
      expect(res.body.verificationCode).toEqual(expect.any(String));
      code = res.body.verificationCode;
    });

    it('renders the PDF', async () => {
      const res = await ctx.api(parentToken).get(`/api/certificates/${certificateId}/pdf`).buffer(true).parse(asBuffer);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(isPdf(res.body)).toBe(true);
    });

    it('verifies it publicly (no token) with the document masked', async () => {
      const res = await ctx.api().get(`/api/public/certificates/verify/${code}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ valid: true, status: 'approved', gradeName: 'Sexto' });
      expect(res.body.studentName).toContain('Núñez');
      expect(res.body.document).toMatch(/\*+\d{4}$/);
      expect((await ctx.api().get('/api/public/certificates/verify/NO-EXISTE-123')).status).toBe(404);
      // Surrounding spaces are ignored; the base64url code itself stays case-sensitive (ADR-0008).
      expect((await ctx.api().get(`/api/public/certificates/verify/${encodeURIComponent(` ${code} `)}`)).status).toBe(
        200,
      );
      if (code.toLowerCase() !== code) {
        expect((await ctx.api().get(`/api/public/certificates/verify/${code.toLowerCase()}`)).status).toBe(404);
      }
    });

    it('lists the certificate for the student', async () => {
      const res = await ctx.api(parentToken).get(`/api/students/${nunez.id}/certificates`);
      expect(res.status).toBe(200);
      const list = Array.isArray(res.body) ? res.body : res.body.items;
      expect(list.map((c: { id: number }) => c.id)).toContain(certificateId);
    });
  });

  describe('incidents', () => {
    let incidentId: number;

    it('creates, reviews and lists an incident', async () => {
      const created = await ctx
        .api(director)
        .post('/api/incidents')
        .send({ type: 'incapacidad', priority: 'high', title: 'Incapacidad médica', studentId: nunez.id });
      expect(created.status).toBe(201);
      expect(created.body.status).toBe('pending');
      incidentId = created.body.id;

      const reviewed = await ctx
        .api(director)
        .post(`/api/incidents/${incidentId}/review`)
        .send({ action: 'approved', notes: 'Se verificó.' });
      expect(reviewed.status).toBe(200);
      expect(reviewed.body.status).toBe('approved');

      const list = await ctx.api(director).get('/api/incidents?limit=100');
      expect(list.status).toBe(200);
      expect(list.body.items.map((i: { id: number }) => i.id)).toContain(incidentId);
      expect((await ctx.api(director).get('/api/incidents/kpis')).status).toBe(200);
      expect((await ctx.api(director).get(`/api/incidents/${incidentId}`)).body.reviewNotes).toBe('Se verificó.');
    });

    it('the guardian sees the incidents of the student in the portal', async () => {
      const res = await ctx.api(parentToken).get(`/api/portal/students/${nunez.id}/incidents`);
      expect(res.status).toBe(200);
    });
  });
});
