import { Inject, Injectable } from '@nestjs/common';
import type { UseCase } from '../../../shared/application/use-case.js';
import { BusinessRuleViolationError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { JOURNAL_ENTRY_REPOSITORY, type JournalEntryRepository } from '../domain/journal-entry.repository.js';

/** Deletes a draft entry. Posted entries are never deleted: they are voided or reversed (RN-JE-10). */
@Injectable()
export class DeleteDraftJournalEntryUseCase implements UseCase<number, void> {
  constructor(@Inject(JOURNAL_ENTRY_REPOSITORY) private readonly entries: JournalEntryRepository) {}

  async execute(id: number): Promise<void> {
    const entry = await this.entries.findById(id);
    if (!entry) throw new NotFoundError('Asiento contable', id);
    if (entry.status !== 'draft') {
      throw new BusinessRuleViolationError(
        'Sólo se pueden eliminar asientos en borrador; anule o revierta los contabilizados.',
        'ENTRY_NOT_DRAFT',
      );
    }
    await this.entries.delete(id);
  }
}
