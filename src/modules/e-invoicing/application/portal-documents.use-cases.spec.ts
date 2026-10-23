import type { AuthenticatedActor } from '../../../shared/application/authenticated-actor.js';
import { ForbiddenError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { Role } from '../../../shared/domain/role.js';
import { FakeInvoicePdfRenderer, InMemoryPortalStudentLinks } from '../testing/fakes.js';
import { resolution, signedInvoice } from '../testing/fixtures.js';
import { createHarness, type Harness } from '../testing/harness.js';
import { GetPortalDocumentArtifactUseCase } from './get-portal-document-artifact.use-case.js';
import { ListPortalStudentDocumentsUseCase } from './list-portal-student-documents.use-case.js';
import { PortalStudentAccess } from './portal-student-access.js';

const actor = (role: Role, userId = 7): AuthenticatedActor => ({
  userId,
  role,
  email: 'acudiente@demo.co',
  name: 'Acudiente',
  tenant: 'demo',
});
const page = { page: 1, limit: 10 };

describe('e-invoicing portal use cases', () => {
  let h: Harness;
  let links: InMemoryPortalStudentLinks;
  let pdf: FakeInvoicePdfRenderer;
  let list: ListPortalStudentDocumentsUseCase;
  let artifact: GetPortalDocumentArtifactUseCase;
  let accepted: number;
  let pending: number;
  let foreign: number;

  const save = async (number: string, sourcePaymentId: number | null, submit: boolean) => {
    const consecutive = Number(number.slice(4));
    const document = signedInvoice({ reserved: { prefix: 'SETP', consecutive, cycle: 0, number }, sourcePaymentId });
    await h.documents.save(document);
    if (submit) await h.submitter.submit(document);
    return document.id as number;
  };

  beforeEach(async () => {
    h = createHarness({ resolutions: [resolution(), resolution({ docType: 'fv', environment: '1' })] });
    links = new InMemoryPortalStudentLinks();
    links.links.set(7, [3]);
    links.payments.set(3, [100, 101]);
    links.payments.set(4, [200]);
    pdf = new FakeInvoicePdfRenderer();
    const access = new PortalStudentAccess(links);
    list = new ListPortalStudentDocumentsUseCase(h.documents, access);
    artifact = new GetPortalDocumentArtifactUseCase(h.documents, h.configs, h.resolutions, pdf, h.submitter, access);

    accepted = await save('SETP990000001', 100, true);
    pending = await save('SETP990000002', 101, false);
    foreign = await save('SETP990000003', 200, true);
    await save('SETP990000004', null, true);
  });

  it('lists only the documents of the student payments, newest first, with the available files', async () => {
    const result = await list.execute({ actor: actor(Role.PARENT), studentId: 3, page });
    expect(result).toMatchObject({ total: 2, page: 1, limit: 10 });
    expect(result.items).toEqual([
      expect.objectContaining({ id: pending, number: 'SETP990000002', status: 'signed', artifacts: [] }),
      {
        id: accepted,
        documentType: 'fv',
        documentTypeName: 'Factura electrónica de venta',
        number: 'SETP990000001',
        prefix: 'SETP',
        issueDate: '2026-03-15',
        totalAmount: 350000,
        status: 'accepted',
        cufe: 'cufe-1',
        artifacts: ['pdf', 'xml'],
      },
    ]);
  });

  it('returns an empty page when the student has no payments', async () => {
    links.links.set(7, [3, 5]);
    await expect(list.execute({ actor: actor(Role.STUDENT), studentId: 5, page })).resolves.toMatchObject({
      items: [],
      total: 0,
    });
  });

  it('rejects students not linked to the user and non-portal roles', async () => {
    await expect(list.execute({ actor: actor(Role.PARENT), studentId: 4, page })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    links.links.set(9, [3]);
    await expect(list.execute({ actor: actor(Role.TEACHER, 9), studentId: 3, page })).rejects.toBeInstanceOf(
      ForbiddenError,
    );
    await expect(
      artifact.execute({ actor: actor(Role.PARENT), studentId: 4, documentId: foreign, artifact: 'pdf' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('renders the PDF with the issuer and the resolution that authorized the number', async () => {
    const file = await artifact.execute({
      actor: actor(Role.PARENT),
      studentId: 3,
      documentId: accepted,
      artifact: 'pdf',
    });
    expect(file).toMatchObject({ fileName: 'SETP990000001.pdf', contentType: 'application/pdf' });
    expect(pdf.inputs[0].document.id).toBe(accepted);
    expect(pdf.inputs[0].issuer.nit).toBe('900123456');
    expect(pdf.inputs[0].resolution).toMatchObject({ resolutionNumber: '18760000001', environment: '2' });
  });

  it('serves the AttachedDocument as XML', async () => {
    const file = await artifact.execute({
      actor: actor(Role.PARENT),
      studentId: 3,
      documentId: accepted,
      artifact: 'xml',
    });
    expect(file).toMatchObject({ fileName: 'ad-SETP990000001.xml', contentType: 'application/xml; charset=utf-8' });
    expect(file.content.toString()).toContain('<AttachedDocument>');
  });

  it('hides documents of other students and refuses files of documents not validated yet', async () => {
    const request = (documentId: number) =>
      artifact.execute({ actor: actor(Role.PARENT), studentId: 3, documentId, artifact: 'pdf' });
    await expect(request(foreign)).rejects.toBeInstanceOf(NotFoundError);
    await expect(request(999)).rejects.toBeInstanceOf(NotFoundError);
    await expect(request(pending)).rejects.toMatchObject({ code: 'ARTIFACT_UNAVAILABLE' });
    expect(pdf.inputs).toHaveLength(0);
  });
});
