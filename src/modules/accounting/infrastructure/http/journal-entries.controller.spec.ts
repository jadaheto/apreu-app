import { CreateJournalEntryUseCase } from '../../application/create-journal-entry.use-case.js';
import { DeleteDraftJournalEntryUseCase } from '../../application/delete-draft-journal-entry.use-case.js';
import { GetJournalEntryUseCase } from '../../application/get-journal-entry.use-case.js';
import { ListJournalEntriesUseCase } from '../../application/list-journal-entries.use-case.js';
import { PostJournalEntryUseCase } from '../../application/post-journal-entry.use-case.js';
import { ReverseJournalEntryUseCase } from '../../application/reverse-journal-entry.use-case.js';
import { UpdateDraftJournalEntryUseCase } from '../../application/update-draft-journal-entry.use-case.js';
import { VoidJournalEntryUseCase } from '../../application/void-journal-entry.use-case.js';
import { ACCOUNTANT } from '../../testing/accounting-fixture.js';
import { buildController } from '../../testing/controller-harness.js';
import { ListJournalEntriesQueryDto } from './dto/journal-entry.dto.js';
import { JournalEntriesController } from './journal-entries.controller.js';

describe('JournalEntriesController', () => {
  it('delegates each endpoint to its use case with the actor', async () => {
    const { controller, mock } = await buildController(JournalEntriesController, [
      ListJournalEntriesUseCase,
      GetJournalEntryUseCase,
      CreateJournalEntryUseCase,
      UpdateDraftJournalEntryUseCase,
      DeleteDraftJournalEntryUseCase,
      PostJournalEntryUseCase,
      VoidJournalEntryUseCase,
      ReverseJournalEntryUseCase,
    ]);
    const query = Object.assign(new ListJournalEntriesQueryDto(), { from: '2026-03-01', type: 'RC', status: 'posted' });
    await controller.list(query);
    expect(mock(ListJournalEntriesUseCase).execute).toHaveBeenCalledWith({
      from: '2026-03-01',
      to: undefined,
      type: 'RC',
      status: 'posted',
      page: { page: 1, limit: 20 },
    });
    await controller.get(5);
    expect(mock(GetJournalEntryUseCase).execute).toHaveBeenCalledWith(5);
    const dto = { date: '2026-03-10', type: 'RC' as const, description: 'x', lines: [] };
    await controller.create(dto, ACCOUNTANT);
    expect(mock(CreateJournalEntryUseCase).execute).toHaveBeenCalledWith({ ...dto, actor: ACCOUNTANT });
    await controller.update(5, dto);
    expect(mock(UpdateDraftJournalEntryUseCase).execute).toHaveBeenCalledWith({ id: 5, ...dto });
    await controller.remove(5);
    expect(mock(DeleteDraftJournalEntryUseCase).execute).toHaveBeenCalledWith(5);
    await controller.post(5, ACCOUNTANT);
    expect(mock(PostJournalEntryUseCase).execute).toHaveBeenCalledWith({ id: 5, actor: ACCOUNTANT });
    await controller.void(5, { reason: 'Duplicado' }, ACCOUNTANT);
    expect(mock(VoidJournalEntryUseCase).execute).toHaveBeenCalledWith({
      id: 5,
      reason: 'Duplicado',
      actor: ACCOUNTANT,
    });
    await controller.reverse(5, { reason: 'Error', date: '2026-03-20' }, ACCOUNTANT);
    expect(mock(ReverseJournalEntryUseCase).execute).toHaveBeenCalledWith({
      id: 5,
      reason: 'Error',
      date: '2026-03-20',
      actor: ACCOUNTANT,
    });
  });
});
