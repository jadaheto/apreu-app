import { LeaveRequest, type NewLeaveRequest } from './leave-request.js';

const input = (overrides: Partial<NewLeaveRequest> = {}): NewLeaveRequest => ({
  employeeId: 1,
  leaveType: 'vacaciones',
  startDate: '2026-04-06',
  endDate: '2026-04-10',
  reason: ' Vacaciones colectivas ',
  requestedBy: 10,
  ...overrides,
});
const at = new Date('2026-03-15T10:00:00-05:00');

describe('LeaveRequest', () => {
  it('starts pending and counts inclusive calendar days', () => {
    const leave = LeaveRequest.create(input());
    expect(leave).toMatchObject({ status: 'pending', reason: 'Vacaciones colectivas', days: 5, payTreatment: 'paid' });
  });

  it.each([
    [{ endDate: '2026-04-01' }, 'INVERTED_DATES'],
    [{ leaveType: 'fiesta' }, 'INVALID_OPTION'],
    [{ reason: '  ' }, 'REQUIRED_FIELD'],
    [{ startDate: '06/04/2026' }, 'INVALID_DATE'],
  ])('rejects %o', (override, code) => {
    expect(() => LeaveRequest.create(input(override as Partial<NewLeaveRequest>))).toThrow(
      expect.objectContaining({ code }),
    );
  });

  it('is approved or rejected only while pending', () => {
    const approved = LeaveRequest.create(input());
    approved.approve(20, at);
    expect(approved).toMatchObject({ status: 'approved', decidedBy: 20, decidedAt: at });
    expect(() => approved.reject(20, at, 'No')).toThrow(expect.objectContaining({ code: 'LEAVE_NOT_PENDING' }));

    const rejected = LeaveRequest.create(input());
    expect(() => rejected.reject(20, at, '')).toThrow(expect.objectContaining({ code: 'REQUIRED_FIELD' }));
    rejected.reject(20, at, 'Temporada de cierre');
    expect(rejected).toMatchObject({ status: 'rejected', decisionNote: 'Temporada de cierre' });
  });

  it('lets the employee cancel pending requests and HR cancel approved ones not yet finished', () => {
    const pending = LeaveRequest.create(input());
    pending.cancel(10, at, '2026-03-15', false);
    expect(pending.status).toBe('cancelled');

    const approved = LeaveRequest.create(input());
    approved.approve(20, at);
    expect(() => approved.cancel(10, at, '2026-03-15', false)).toThrow(
      expect.objectContaining({ code: 'LEAVE_NOT_CANCELLABLE' }),
    );
    expect(() => approved.cancel(20, at, '2026-04-11', true)).toThrow(
      expect.objectContaining({ code: 'LEAVE_NOT_CANCELLABLE' }),
    );
    approved.cancel(20, at, '2026-04-08', true);
    expect(approved.status).toBe('cancelled');
  });

  it('derives "taken" and overlaps', () => {
    const leave = LeaveRequest.create(input());
    leave.approve(20, at);
    expect(leave.isTaken('2026-04-10')).toBe(false);
    expect(leave.isTaken('2026-04-11')).toBe(true);
    expect(leave.overlaps('2026-04-10', '2026-04-20')).toBe(true);
    expect(leave.overlaps('2026-04-11', '2026-04-20')).toBe(false);
  });

  it('maps leave types to payroll treatments', () => {
    expect(LeaveRequest.create(input({ leaveType: 'licencia_medica' })).payTreatment).toBe('incapacity');
    expect(LeaveRequest.create(input({ leaveType: 'licencia_no_remunerada' })).payTreatment).toBe('unpaid');
    expect(LeaveRequest.create(input({ leaveType: 'comision' })).payTreatment).toBe('worked');
  });
});
