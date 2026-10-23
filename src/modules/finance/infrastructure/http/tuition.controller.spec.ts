import { GetTuitionScheduleUseCase } from '../../application/get-tuition-schedule.use-case.js';
import { SaveTuitionScheduleUseCase } from '../../application/save-tuition-schedule.use-case.js';
import { controllerWithMocks } from '../../testing/controller-testing.js';
import { TuitionController } from './tuition.controller.js';

describe('TuitionController', () => {
  it('reads and replaces the schedule of a year', async () => {
    const { controller, mock } = await controllerWithMocks(TuitionController, [
      GetTuitionScheduleUseCase,
      SaveTuitionScheduleUseCase,
    ]);
    await controller.get({ year: 2026 });
    await controller.save(2026, { rates: [{ gradeId: 1, amount: 5 }] });
    expect(mock(GetTuitionScheduleUseCase)).toHaveBeenCalledWith({ year: 2026 });
    expect(mock(SaveTuitionScheduleUseCase)).toHaveBeenCalledWith({
      academicYear: 2026,
      rates: [{ gradeId: 1, conceptId: null, amount: 5 }],
    });
  });
});
