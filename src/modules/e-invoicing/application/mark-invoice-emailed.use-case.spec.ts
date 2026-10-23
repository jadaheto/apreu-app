import { InMemoryElectronicDocumentRepository } from '../testing/in-memory-repositories.js';
import { MarkInvoiceEmailedUseCase } from './mark-invoice-emailed.use-case.js';

describe('MarkInvoiceEmailedUseCase', () => {
  const payload = (dianInvoiceId: number) => ({
    dianInvoiceId,
    number: 'FE1',
    to: 'a@b.co',
    sentAt: '2026-03-01T10:00:00.000Z',
  });

  it('flags existing documents as e-mailed', async () => {
    const documents = new InMemoryElectronicDocumentRepository();
    vi.spyOn(documents, 'findById').mockResolvedValue({ id: 7 } as never);
    await new MarkInvoiceEmailedUseCase(documents).execute(payload(7));
    expect(documents.emailed.get(7)).toEqual(new Date('2026-03-01T10:00:00.000Z'));
  });

  it('ignores unknown documents', async () => {
    const documents = new InMemoryElectronicDocumentRepository();
    vi.spyOn(documents, 'findById').mockResolvedValue(null);
    await new MarkInvoiceEmailedUseCase(documents).execute(payload(99));
    expect(documents.emailed.size).toBe(0);
  });
});
