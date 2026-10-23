import { NotFoundException, StreamableFile } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import { Role } from '../../../../shared/domain/role.js';
import { ROLES_KEY } from '../../../../shared/infrastructure/http/decorators/roles.decorator.js';
import { PaginationQueryDto } from '../../../../shared/infrastructure/http/dto/pagination-query.dto.js';
import { GetPortalDocumentArtifactUseCase } from '../../application/get-portal-document-artifact.use-case.js';
import { ListPortalStudentDocumentsUseCase } from '../../application/list-portal-student-documents.use-case.js';
import { PortalDocumentsController } from './portal-documents.controller.js';

describe('PortalDocumentsController', () => {
  const actor: AuthenticatedActor = { userId: 7, role: Role.PARENT, email: 'a@b.co', name: 'A', tenant: 'demo' };
  const list = { execute: vi.fn().mockResolvedValue({ items: [], total: 0, page: 2, limit: 5 }) };
  const artifact = {
    execute: vi
      .fn()
      .mockResolvedValue({ fileName: 'SETP1.pdf', contentType: 'application/pdf', content: Buffer.from('%PDF-') }),
  };
  let controller: PortalDocumentsController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PortalDocumentsController],
      providers: [
        { provide: ListPortalStudentDocumentsUseCase, useValue: list },
        { provide: GetPortalDocumentArtifactUseCase, useValue: artifact },
      ],
    }).compile();
    controller = moduleRef.get(PortalDocumentsController);
  });

  it('is reserved to students and guardians', () => {
    expect(Reflect.getMetadata(ROLES_KEY, PortalDocumentsController)).toEqual([Role.STUDENT, Role.PARENT]);
  });

  it('lists with the actor, the student and the page', async () => {
    const query = Object.assign(new PaginationQueryDto(), { page: 2, limit: 5 });
    await expect(controller.list(actor, 3, query)).resolves.toMatchObject({ page: 2, limit: 5 });
    expect(list.execute).toHaveBeenCalledWith({ actor, studentId: 3, page: { page: 2, limit: 5 } });
  });

  it('streams pdf/xml as private attachments and rejects other artifacts', async () => {
    const response = { setHeader: vi.fn() };
    await expect(controller.download(actor, 3, 15, 'pdf', response as never)).resolves.toBeInstanceOf(StreamableFile);
    expect(artifact.execute).toHaveBeenCalledWith({ actor, studentId: 3, documentId: 15, artifact: 'pdf' });
    expect(response.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="SETP1.pdf"');
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
    for (const kind of ['zip', 'application-response', 'attached-document']) {
      await expect(controller.download(actor, 3, 15, kind, response as never)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    }
  });
});
