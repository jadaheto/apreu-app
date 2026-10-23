import { Test } from '@nestjs/testing';
import { Role } from '../../../../shared/domain/role.js';
import { IS_PUBLIC_KEY } from '../../../../shared/infrastructure/http/decorators/public.decorator.js';
import { ApproveCertificateUseCase } from '../../application/approve-certificate.use-case.js';
import { CancelCertificateUseCase } from '../../application/cancel-certificate.use-case.js';
import { GetCertificateDocumentUseCase } from '../../application/get-certificate-document.use-case.js';
import { RenderCertificatePdfUseCase } from '../../application/render-certificate-pdf.use-case.js';
import { VerifyCertificateUseCase } from '../../application/verify-certificate.use-case.js';
import { actorOf } from '../../testing/students-test-kit.js';
import { CertificatesController, PublicCertificatesController } from './certificates.controller.js';

const mock = () => ({ execute: vi.fn().mockResolvedValue({}) });

describe('CertificatesController', () => {
  const approve = mock();
  const cancel = mock();
  const document = mock();
  const verify = mock();
  const pdf = {
    execute: vi
      .fn()
      .mockResolvedValue({ fileName: 'c.pdf', contentType: 'application/pdf', content: Buffer.from('%PDF') }),
  };
  let controller: CertificatesController;
  let publicController: PublicCertificatesController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CertificatesController, PublicCertificatesController],
      providers: [
        { provide: ApproveCertificateUseCase, useValue: approve },
        { provide: CancelCertificateUseCase, useValue: cancel },
        { provide: GetCertificateDocumentUseCase, useValue: document },
        { provide: VerifyCertificateUseCase, useValue: verify },
        { provide: RenderCertificatePdfUseCase, useValue: pdf },
      ],
    }).compile();
    controller = moduleRef.get(CertificatesController);
    publicController = moduleRef.get(PublicCertificatesController);
  });

  it('approves, cancels and renders certificates', async () => {
    const actor = actorOf(1, Role.STUDENT);
    await controller.approve(9);
    expect(approve.execute).toHaveBeenCalledWith(9);
    await controller.cancel(9, { reason: 'Error' });
    expect(cancel.execute).toHaveBeenCalledWith({
      certificateId: 9,
      reason: 'Error',
    });
    await controller.document(actor, 9);
    expect(document.execute).toHaveBeenCalledWith({ actor, certificateId: 9 });
    const file = await controller.pdf(actor, 9);
    expect(pdf.execute).toHaveBeenCalledWith({ actor, certificateId: 9 });
    expect(file.getHeaders()).toMatchObject({ type: 'application/pdf', disposition: 'inline; filename="c.pdf"' });
  });

  it('verifies publicly', async () => {
    await publicController.verify('abc');
    expect(verify.execute).toHaveBeenCalledWith('abc');
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, PublicCertificatesController.prototype.verify)).toBe(true);
  });
});
