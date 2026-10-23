import { CreateBillingConceptUseCase } from '../../application/create-billing-concept.use-case.js';
import { ListBillingConceptsUseCase } from '../../application/list-billing-concepts.use-case.js';
import { SetBillingConceptActiveUseCase } from '../../application/set-billing-concept-active.use-case.js';
import { UpdateBillingConceptUseCase } from '../../application/update-billing-concept.use-case.js';
import { BillingConceptsController } from './billing-concepts.controller.js';
import { controllerWithMocks } from '../../testing/controller-testing.js';

describe('BillingConceptsController', () => {
  it('delegates every endpoint to its use case', async () => {
    const { controller, mock } = await controllerWithMocks(BillingConceptsController, [
      ListBillingConceptsUseCase,
      CreateBillingConceptUseCase,
      UpdateBillingConceptUseCase,
      SetBillingConceptActiveUseCase,
    ]);
    const dto = { name: 'Pensión', amount: 1 };
    await controller.list({ active: true });
    await controller.create(dto);
    await controller.update(3, dto);
    await controller.toggle(3, { active: false });
    expect(mock(ListBillingConceptsUseCase)).toHaveBeenCalledWith({ active: true });
    expect(mock(CreateBillingConceptUseCase)).toHaveBeenCalledWith(dto);
    expect(mock(UpdateBillingConceptUseCase)).toHaveBeenCalledWith({ id: 3, ...dto });
    expect(mock(SetBillingConceptActiveUseCase)).toHaveBeenCalledWith({ id: 3, active: false });
  });
});
