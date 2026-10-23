import { ChangeThirdPartyStatusUseCase } from '../../application/change-third-party-status.use-case.js';
import { CreateThirdPartyUseCase } from '../../application/create-third-party.use-case.js';
import { DeleteThirdPartyUseCase } from '../../application/delete-third-party.use-case.js';
import { ListThirdPartiesUseCase } from '../../application/list-third-parties.use-case.js';
import { UpdateThirdPartyUseCase } from '../../application/update-third-party.use-case.js';
import { buildController } from '../../testing/controller-harness.js';
import { ListThirdPartiesQueryDto, type ThirdPartyDto } from './dto/third-party.dto.js';
import { ThirdPartiesController } from './third-parties.controller.js';

describe('ThirdPartiesController', () => {
  it('delegates each endpoint to its use case', async () => {
    const { controller, mock } = await buildController(ThirdPartiesController, [
      ListThirdPartiesUseCase,
      CreateThirdPartyUseCase,
      UpdateThirdPartyUseCase,
      ChangeThirdPartyStatusUseCase,
      DeleteThirdPartyUseCase,
    ]);
    const query = Object.assign(new ListThirdPartiesQueryDto(), { search: 'ana', isActive: true, page: 2, limit: 5 });
    await controller.list(query);
    expect(mock(ListThirdPartiesUseCase).execute).toHaveBeenCalledWith({
      search: 'ana',
      isActive: true,
      page: { page: 2, limit: 5 },
    });
    const dto: ThirdPartyDto = { documentType: 'CC', documentNumber: '1', name: 'Ana' };
    await controller.create(dto);
    expect(mock(CreateThirdPartyUseCase).execute).toHaveBeenCalledWith(dto);
    await controller.update(3, dto);
    expect(mock(UpdateThirdPartyUseCase).execute).toHaveBeenCalledWith({ id: 3, ...dto });
    await controller.deactivate(3);
    await controller.activate(3);
    expect(mock(ChangeThirdPartyStatusUseCase).execute.mock.calls).toEqual([
      [{ id: 3, active: false }],
      [{ id: 3, active: true }],
    ]);
    await controller.remove(3);
    expect(mock(DeleteThirdPartyUseCase).execute).toHaveBeenCalledWith(3);
  });
});
