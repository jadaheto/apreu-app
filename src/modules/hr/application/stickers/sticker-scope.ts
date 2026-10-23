import type { AuthenticatedActor } from '../../../../shared/application/authenticated-actor.js';
import type { StickerScope } from '../../domain/stickers/employee-sticker.repository.js';
import type { CurrentEmployeeResolver } from '../current-employee.resolver.js';
import { isHrManager } from '../hr-access.js';

/** `null` (everything) for admin/HR; otherwise own stickers and those the actor created. */
export const stickerScopeFor = async (
  actor: AuthenticatedActor,
  currentEmployee: CurrentEmployeeResolver,
): Promise<StickerScope | null> => {
  if (isHrManager(actor)) return null;
  const own = await currentEmployee.find(actor);
  return { employeeId: (own?.id as number | undefined) ?? null, userId: actor.userId };
};
