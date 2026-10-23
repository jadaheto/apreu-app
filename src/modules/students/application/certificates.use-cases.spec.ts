import { ForbiddenError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import { actorOf, createStudentsKit, type StudentsKit } from '../testing/students-test-kit.js';
import { ApproveCertificateUseCase } from './approve-certificate.use-case.js';
import { CancelCertificateUseCase } from './cancel-certificate.use-case.js';
import { GetCertificateDocumentUseCase } from './get-certificate-document.use-case.js';
import { RenderCertificatePdfUseCase } from './render-certificate-pdf.use-case.js';
import { CERTIFICATE_ISSUED, type PaymentRegisteredPayload } from './integration-events.js';
import { IssueCertificateUseCase } from './issue-certificate.use-case.js';
import { IssueCertificatesOnPaymentUseCase } from './issue-certificates-on-payment.use-case.js';
import { ListStudentCertificatesUseCase } from './list-student-certificates.use-case.js';
import { RequestCertificateUseCase } from './request-certificate.use-case.js';
import { VerifyCertificateUseCase } from './verify-certificate.use-case.js';

describe('certificate use cases', () => {
  let kit: StudentsKit;
  const admin = actorOf(1, Role.ADMIN);
  const owner = actorOf(60, Role.STUDENT);

  const payment = (override: Partial<PaymentRegisteredPayload> = {}): PaymentRegisteredPayload => ({
    paymentId: 500,
    receiptNumber: 'RC-0500',
    studentId: 1,
    totalAmount: 15000,
    method: 'efectivo',
    paidAt: '2026-03-15T10:00:00-05:00',
    appliedCharges: [
      {
        studentChargeId: 9,
        conceptId: 3,
        conceptName: 'Certificado de estudio',
        amount: 15000,
      },
    ],
    ...override,
  });

  beforeEach(() => {
    kit = createStudentsKit();
  });

  describe('IssueCertificatesOnPaymentUseCase', () => {
    const handler = (kit: StudentsKit) =>
      new IssueCertificatesOnPaymentUseCase(kit.students, kit.certificates, kit.concepts, kit.issuer);

    it('issues an approved certificate linked to the payment (bug B22) and publishes the event', async () => {
      const student = await kit.addStudent();
      const issued = await handler(kit).execute(payment({ studentId: student.id as number }));

      expect(issued).toBe(1);
      const [certificate] = kit.certificates.store.all();
      expect(certificate).toMatchObject({
        status: 'approved',
        paymentId: 500,
        createdBy: null,
        verificationCode: 'verif-code-1',
      });
      expect(certificate.snapshot).toMatchObject({
        studentName: 'Sofía Gómez',
        gradeName: 'Quinto',
        academicYear: 2026,
      });
      expect(kit.events.published[0]).toMatchObject({
        name: CERTIFICATE_ISSUED,
        payload: {
          certificateId: certificate.id,
          studentId: student.id,
          paymentId: 500,
          verificationCode: 'verif-code-1',
        },
      });
    });

    it('recognizes certificate concepts by catalog category and is idempotent', async () => {
      const student = await kit.addStudent();
      kit.concepts.certificateIds = [8];
      const event = payment({
        studentId: student.id as number,
        appliedCharges: [
          {
            studentChargeId: 1,
            conceptId: 8,
            conceptName: 'Constancia',
            amount: 1,
          },
          {
            studentChargeId: 2,
            conceptId: 4,
            conceptName: 'Pensión',
            amount: 1,
          },
        ],
      });
      await expect(handler(kit).execute(event)).resolves.toBe(1);
      await expect(handler(kit).execute(event)).resolves.toBe(0);
      expect(kit.certificates.store.all()).toHaveLength(1);
    });

    it('ignores payments without certificate concepts or of unknown students', async () => {
      await expect(
        handler(kit).execute(
          payment({
            appliedCharges: [
              {
                studentChargeId: 1,
                conceptId: 2,
                conceptName: 'Pensión',
                amount: 1,
              },
            ],
          }),
        ),
      ).resolves.toBe(0);
      await expect(handler(kit).execute(payment({ studentId: 404 }))).resolves.toBe(0);
      expect(kit.certificates.store.all()).toHaveLength(0);
    });
  });

  it('issues manually as admin', async () => {
    const student = await kit.addStudent();
    const view = await new IssueCertificateUseCase(kit.students, kit.issuer).execute({
      actor: admin,
      studentId: student.id as number,
      notes: 'Para beca',
    });
    expect(view).toMatchObject({
      status: 'approved',
      notes: 'Para beca',
      verificationCode: 'verif-code-1',
      issuedAt: kit.clock.now(),
    });
    await expect(
      new IssueCertificateUseCase(kit.students, kit.issuer).execute({
        actor: admin,
        studentId: 404,
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lets owners request, admins approve or cancel', async () => {
    const student = await kit.addStudent();
    student.linkUser(owner.userId);
    const request = new RequestCertificateUseCase(kit.access, kit.certificates, kit.clock);
    const pending = await request.execute({
      actor: owner,
      studentId: student.id as number,
    });
    expect(pending).toMatchObject({
      status: 'pending',
      verificationCode: null,
    });
    await expect(request.execute({ actor: owner, studentId: student.id as number })).rejects.toMatchObject({
      code: 'CERTIFICATE_REQUEST_PENDING',
    });
    await expect(
      request.execute({
        actor: actorOf(61, Role.STUDENT),
        studentId: student.id as number,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    const approved = await new ApproveCertificateUseCase(kit.certificates, kit.students, kit.issuer).execute(
      pending.id,
    );
    expect(approved).toMatchObject({
      status: 'approved',
      verificationCode: 'verif-code-1',
    });
    expect(kit.events.published).toHaveLength(1);

    const cancelled = await new CancelCertificateUseCase(kit.certificates).execute({
      certificateId: pending.id,
      reason: 'Error',
    });
    expect(cancelled).toMatchObject({
      status: 'cancelled',
      verificationCode: null,
    });
  });

  it('fails approving or cancelling unknown certificates', async () => {
    await expect(
      new ApproveCertificateUseCase(kit.certificates, kit.students, kit.issuer).execute(1),
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      new CancelCertificateUseCase(kit.certificates).execute({
        certificateId: 1,
        reason: 'x',
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('lists certificates to owners only (IDOR of student/certificate.php)', async () => {
    const student = await kit.addStudent();
    student.linkUser(owner.userId);
    await kit.issuer.issue(student, { createdBy: 1 });
    const list = new ListStudentCertificatesUseCase(kit.access, kit.certificates);
    await expect(list.execute({ actor: owner, studentId: student.id as number })).resolves.toHaveLength(1);
    await expect(
      list.execute({
        actor: actorOf(5, Role.HR),
        studentId: student.id as number,
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('renders the printable document of valid certificates only', async () => {
    const student = await kit.addStudent();
    student.linkUser(owner.userId);
    const certificate = await kit.issuer.issue(student, { createdBy: 1 });
    const document = new GetCertificateDocumentUseCase(kit.certificates, kit.settings, kit.access);

    const view = await document.execute({
      actor: owner,
      certificateId: certificate.id as number,
    });
    expect(view.institution).toMatchObject({
      name: 'Colegio Demo',
      rectorName: 'Ana Rectora',
    });
    expect(view.text.paragraphs[0]).toContain('Sofía Gómez');
    expect(view.text.issuedOn).toBe('15 de marzo de 2026');

    certificate.cancel('Error');
    await expect(
      document.execute({
        actor: admin,
        certificateId: certificate.id as number,
      }),
    ).rejects.toMatchObject({
      code: 'CERTIFICATE_NOT_AVAILABLE',
    });
    await expect(document.execute({ actor: admin, certificateId: 404 })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('renders the PDF through the certificate renderer with the same access rules', async () => {
    const student = await kit.addStudent();
    student.linkUser(owner.userId);
    const certificate = await kit.issuer.issue(student, { createdBy: 1 });
    const renderer = {
      render: vi
        .fn()
        .mockResolvedValue({ fileName: 'c.pdf', contentType: 'application/pdf', content: Buffer.from('') }),
    };
    const useCase = new RenderCertificatePdfUseCase(
      new GetCertificateDocumentUseCase(kit.certificates, kit.settings, kit.access),
      renderer,
    );
    await expect(useCase.execute({ actor: owner, certificateId: certificate.id as number })).resolves.toMatchObject({
      fileName: 'c.pdf',
    });
    expect(renderer.render.mock.calls[0][0].text.paragraphs[0]).toContain('Sofía Gómez');
    await expect(
      useCase.execute({ actor: actorOf(99, Role.STUDENT), certificateId: certificate.id as number }),
    ).rejects.toBeDefined();
    expect(renderer.render).toHaveBeenCalledTimes(1);
  });

  it('verifies a certificate publicly with minimized personal data', async () => {
    const student = await kit.addStudent({ documentNumber: '1101814264' });
    const certificate = await kit.issuer.issue(student, { createdBy: 1 });
    const verify = new VerifyCertificateUseCase(kit.certificates, kit.settings);

    await expect(verify.execute('verif-code-1')).resolves.toMatchObject({
      valid: true,
      schoolName: 'Colegio Demo',
      studentName: 'Sofía Gómez',
      document: 'T.I. ******4264',
      academicYear: 2026,
    });
    certificate.cancel('Anulado');
    await expect(verify.execute('verif-code-1')).resolves.toMatchObject({
      valid: false,
      status: 'cancelled',
    });
    await expect(verify.execute('nope')).rejects.toBeInstanceOf(NotFoundError);
  });
});
