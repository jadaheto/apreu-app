import { createE2eApp, DIRECTOR, type E2eContext, todayInBogota, uniqueSuffix } from './support/e2e-app.js';
import { DATE_ONLY, DEMO_TEACHER_USER_ID, takeOverUser } from './support/fixtures.js';
import { asBuffer, expectStatus, isPdf } from './support/http.js';
import { withTenantDb } from './support/e2e-databases.js';
import { DEMO_CLASSROOM_ID } from './support/students.js';

/** Demo data: Laura (1) and Tomás (2) in 6A, subject Matemáticas (1). */
const LAURA = 1;
const TOMAS = 2;
const MATH = 1;

describe('academic (E2E)', () => {
  let ctx: E2eContext;
  let director: string;
  let periodId: number;
  let teacher: string;

  beforeAll(async () => {
    ctx = await createE2eApp();
    director = await ctx.login(DIRECTOR.email, DIRECTOR.password);
    teacher = (await takeOverUser(ctx, director, DEMO_TEACHER_USER_ID)).token;
  });
  afterAll(() => ctx?.close());

  it('creates a period whose dates come back as YYYY-MM-DD', async () => {
    const res = await ctx
      .api(director)
      .post('/api/academic/periods')
      .send({
        name: `Periodo E2E ${uniqueSuffix()}`,
        startDate: '2026-06-01',
        endDate: '2026-08-15',
        academicYear: 2026,
      });
    expectStatus(res, 201);
    // At most one open period per year: the new one starts closed and is reopened (closing "Periodo 1").
    expect(res.body).toMatchObject({ startDate: '2026-06-01', endDate: '2026-08-15', status: 'closed' });
    periodId = res.body.id;
    const reopened = await ctx.api(director).post(`/api/academic/periods/${periodId}/reopen`);
    expectStatus(reopened, 200, 201);
    expect(reopened.body.status).toBe('open');

    const list = await ctx.api(director).get('/api/academic/periods?year=2026');
    expectStatus(list, 200);
    const periods = Array.isArray(list.body) ? list.body : list.body.items;
    const created = periods.find((p: { id: number }) => p.id === periodId);
    expect(created.startDate).toMatch(DATE_ONLY);
  });

  it('the teacher sees their assignments', async () => {
    const res = await ctx.api(teacher).get('/api/academic/me/assignments');
    expectStatus(res, 200);
    expect(JSON.stringify(res.body)).toContain('Matemáticas');
  });

  it('the teacher saves the grade sheet and the final grade is computed (60/30/10)', async () => {
    const saved = await ctx
      .api(teacher)
      .put('/api/academic/grade-sheets')
      .send({
        classroomId: DEMO_CLASSROOM_ID,
        subjectId: MATH,
        periodId,
        entries: [
          { studentId: LAURA, cognitive: 4.5, procedural: 4, attitudinal: 5, observations: 'Excelente' },
          { studentId: TOMAS, cognitive: 2, procedural: 3, attitudinal: 4 },
        ],
      });
    expectStatus(saved, 200);

    const sheet = await ctx
      .api(director)
      .get(`/api/academic/grade-sheets?classroomId=${DEMO_CLASSROOM_ID}&subjectId=${MATH}&periodId=${periodId}`);
    expectStatus(sheet, 200);
    const text = JSON.stringify(sheet.body);
    expect(text).toContain('4.4');
    expect(text).toContain('Excelente');

    const grades = await ctx.api(director).get(`/api/academic/students/${LAURA}/grades?periodId=${periodId}`);
    expectStatus(grades, 200);
    expect(JSON.stringify(grades.body)).toContain('4.4');
  });

  it('rejects grades out of the 0–5 scale', async () => {
    const res = await ctx
      .api(director)
      .put('/api/academic/grade-sheets')
      .send({
        classroomId: DEMO_CLASSROOM_ID,
        subjectId: MATH,
        periodId,
        entries: [{ studentId: LAURA, cognitive: 7 }],
      });
    expectStatus(res, 400, 422);
  });

  it('the teacher takes the roll call of the day; reported by date and by month', async () => {
    const today = todayInBogota();
    const res = await ctx
      .api(teacher)
      .post('/api/academic/attendance/manual')
      .send({
        classroomId: DEMO_CLASSROOM_ID,
        subjectId: MATH,
        date: today,
        entries: [
          { studentId: LAURA, status: 'present' },
          { studentId: TOMAS, status: 'late' },
        ],
      });
    expectStatus(res, 201);

    const daily = await ctx
      .api(director)
      .get(`/api/academic/attendance?date=${today}&classroomId=${DEMO_CLASSROOM_ID}`);
    expectStatus(daily, 200);
    expect(JSON.stringify(daily.body)).toContain('late');

    // `time` is the school-local (Bogotá) wall clock, not UTC.
    const stored = await withTenantDb((db) =>
      db.query(
        'SELECT attendance_date::text AS date, attendance_time::text AS time FROM attendance_records WHERE student_id = $1 AND attendance_date = $2',
        [TOMAS, today],
      ),
    );
    expect(stored.rows[0].date).toBe(today);
    const bogotaNow = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date());
    const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
    expect(Math.abs(minutes(stored.rows[0].time) - minutes(bogotaNow))).toBeLessThanOrEqual(2);
    expect(JSON.stringify(daily.body)).toContain(stored.rows[0].time.slice(0, 5));

    const monthly = await ctx
      .api(director)
      .get(`/api/academic/students/${TOMAS}/attendance?month=${today.slice(0, 7)}`);
    expectStatus(monthly, 200);
    expect(JSON.stringify(monthly.body)).toContain(today);
  });

  it('rejects attendance in the future (school date in Bogotá)', async () => {
    const res = await ctx
      .api(teacher)
      .post('/api/academic/attendance/manual')
      .send({
        classroomId: DEMO_CLASSROOM_ID,
        subjectId: MATH,
        date: '2099-01-01',
        entries: [{ studentId: LAURA, status: 'present' }],
      });
    expectStatus(res, 422);
    expect(res.body.code).toBe('FUTURE_DATE');
  });

  it('a teacher cannot manage periods (403)', async () => {
    expectStatus(await ctx.api(teacher).post(`/api/academic/periods/${periodId}/close`), 403);
  });

  it('closes the period, generates the report cards and downloads the PDF', async () => {
    const closed = await ctx.api(director).post(`/api/academic/periods/${periodId}/close`);
    expectStatus(closed, 200, 201);
    expect(closed.body.status).toBe('closed');

    const locked = await ctx
      .api(director)
      .put('/api/academic/grade-sheets')
      .send({
        classroomId: DEMO_CLASSROOM_ID,
        subjectId: MATH,
        periodId,
        entries: [{ studentId: LAURA, cognitive: 1 }],
      });
    expectStatus(locked, 422);

    const generated = await ctx.api(director).post(`/api/academic/periods/${periodId}/report-cards`);
    expectStatus(generated, 200);

    const card = await ctx.api(director).get(`/api/academic/report-cards/${LAURA}/${periodId}`);
    expectStatus(card, 200);

    const pdf = await ctx
      .api(director)
      .get(`/api/academic/report-cards/${LAURA}/${periodId}/pdf`)
      .buffer(true)
      .parse(asBuffer);
    expectStatus(pdf, 200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
    expect(isPdf(pdf.body)).toBe(true);

    const history = await ctx.api(director).get(`/api/academic/students/${LAURA}/report-cards`);
    expectStatus(history, 200);
  });
});
