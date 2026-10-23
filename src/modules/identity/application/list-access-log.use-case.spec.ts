import { ListAccessLogUseCase } from './list-access-log.use-case.js';

describe('ListAccessLogUseCase', () => {
  const page = { page: 2, limit: 10 };
  const empty = { items: [], total: 0, ...page };

  it('delegates the filters to the query port', async () => {
    const search = vi.fn().mockResolvedValue(empty);
    const criteria = { module: 'auth', allowed: false, from: '2026-01-01', to: '2026-01-31' };
    await expect(new ListAccessLogUseCase({ search }).execute({ criteria, page })).resolves.toBe(empty);
    expect(search).toHaveBeenCalledWith(criteria, page);
  });

  it('rejects inverted date ranges', async () => {
    const useCase = new ListAccessLogUseCase({ search: vi.fn() });
    await expect(useCase.execute({ criteria: { from: '2026-02-01', to: '2026-01-01' }, page })).rejects.toMatchObject({
      code: 'INVERTED_DATES',
    });
  });
});
