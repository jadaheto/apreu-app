import { Test } from '@nestjs/testing';
import { Role } from '../../../../shared/domain/role.js';
import { GetStudentFinancialSummaryUseCase } from '../../application/get-student-financial-summary.use-case.js';
import { GetStudentIdCardUseCase } from '../../application/get-student-id-card.use-case.js';
import { IssueCertificateUseCase } from '../../application/issue-certificate.use-case.js';
import { ListStudentCertificatesUseCase } from '../../application/list-student-certificates.use-case.js';
import { RequestCertificateUseCase } from '../../application/request-certificate.use-case.js';
import { VerifyStudentQrUseCase } from '../../application/verify-student-qr.use-case.js';
import { actorOf } from '../../testing/students-test-kit.js';
import { StudentDocumentsController } from './student-documents.controller.js';

const mock = () => ({ execute: vi.fn().mockResolvedValue({}) });

describe('StudentDocumentsController', () => {
  const idCard = mock();
  const verify = mock();
  const finance = mock();
  const list = mock();
  const issue = mock();
  const request = mock();
  const actor = actorOf(5, Role.PARENT);
  let controller: StudentDocumentsController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [StudentDocumentsController],
      providers: [
        { provide: GetStudentIdCardUseCase, useValue: idCard },
        { provide: VerifyStudentQrUseCase, useValue: verify },
        { provide: GetStudentFinancialSummaryUseCase, useValue: finance },
        { provide: ListStudentCertificatesUseCase, useValue: list },
        { provide: IssueCertificateUseCase, useValue: issue },
        { provide: RequestCertificateUseCase, useValue: request },
      ],
    }).compile();
    controller = moduleRef.get(StudentDocumentsController);
  });

  it('passes the actor to every ownership-checked use case', async () => {
    await controller.card(actor, 3);
    await controller.finance(actor, 3);
    await controller.certificates(actor, 3);
    for (const useCase of [idCard, finance, list]) {
      expect(useCase.execute).toHaveBeenCalledWith({ actor, studentId: 3 });
    }
  });

  it('verifies QR codes, issues and requests certificates', async () => {
    await controller.verify(actor, { rawQr: 'APREU1|x' });
    expect(verify.execute).toHaveBeenCalledWith({ actor, rawQr: 'APREU1|x' });
    await controller.issue(actor, 3, { notes: 'n' });
    expect(issue.execute).toHaveBeenCalledWith({
      actor,
      studentId: 3,
      type: undefined,
      notes: 'n',
    });
    await controller.request(actor, 3, { type: 'certificado_estudiantil' });
    expect(request.execute).toHaveBeenCalledWith({
      actor,
      studentId: 3,
      type: 'certificado_estudiantil',
      notes: undefined,
    });
  });
});
