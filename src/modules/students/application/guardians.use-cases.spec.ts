import { ConflictError, NotFoundError } from '../../../shared/domain/domain-error.js';
import { createStudentsKit, guardianDetails, type StudentsKit } from '../testing/students-test-kit.js';
import { CreateGuardianUseCase } from './create-guardian.use-case.js';
import { FindGuardianByDocumentUseCase } from './find-guardian-by-document.use-case.js';
import { GetGuardianUseCase } from './get-guardian.use-case.js';
import { UpdateGuardianUseCase } from './update-guardian.use-case.js';

describe('guardian use cases', () => {
  let kit: StudentsKit;
  beforeEach(() => {
    kit = createStudentsKit();
  });

  it('creates a guardian with a unique document', async () => {
    const create = new CreateGuardianUseCase(kit.guardians, kit.guardianViews);
    const view = await create.execute(guardianDetails());
    expect(view).toMatchObject({
      documentNumber: '52123456',
      fullName: 'Marta Ruiz',
      students: [],
      hasPortalAccount: false,
    });
    await expect(create.execute(guardianDetails({ firstName: 'Otra' }))).rejects.toBeInstanceOf(ConflictError);
  });

  it('finds a guardian by document with the linked siblings', async () => {
    const guardian = await kit.addGuardian();
    await kit.addStudent({ firstName: 'Ana' }, { guardianId: guardian.id });
    await kit.addStudent({ firstName: 'Beto' }, { guardianId: guardian.id });
    const find = new FindGuardianByDocumentUseCase(kit.guardians, kit.guardianViews);
    const view = await find.execute(' 52123456 ');
    expect(view.students.map((s) => s.fullName)).toEqual(['Ana Gómez', 'Beto Gómez']);
    await expect(find.execute('000')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('gets a guardian by id', async () => {
    const guardian = await kit.addGuardian();
    const get = new GetGuardianUseCase(kit.guardians, kit.guardianViews);
    await expect(get.execute(guardian.id as number)).resolves.toMatchObject({
      id: guardian.id,
    });
    await expect(get.execute(404)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('updates a guardian keeping the document unique', async () => {
    await kit.addGuardian({ documentNumber: 'OTHER' });
    const guardian = await kit.addGuardian();
    const update = new UpdateGuardianUseCase(kit.guardians, kit.guardianViews);
    await expect(
      update.execute({
        guardianId: guardian.id as number,
        details: guardianDetails({ mobile: '311' }),
      }),
    ).resolves.toMatchObject({ mobile: '311' });
    await expect(
      update.execute({
        guardianId: guardian.id as number,
        details: guardianDetails({ documentNumber: 'OTHER' }),
      }),
    ).rejects.toBeInstanceOf(ConflictError);
    await expect(update.execute({ guardianId: 404, details: guardianDetails() })).rejects.toBeInstanceOf(NotFoundError);
  });
});
