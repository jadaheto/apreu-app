import { Incident, type IncidentStatus, type ReviewAction } from './incident.js';

const at = new Date('2026-03-15T15:00:00Z');
const open = () =>
  Incident.open({
    studentId: 3,
    requestedBy: 1,
    title: ' Incapacidad ',
    openedAt: at,
  });

const inStatus = (status: IncidentStatus): Incident => {
  const incident = open();
  const path: Record<IncidentStatus, ReviewAction[]> = {
    pending: [],
    in_review: ['in_review'],
    approved: ['approved'],
    rejected: ['rejected'],
    closed: ['approved', 'closed'],
  };
  for (const step of path[status]) incident.review(step, 2, null, at);
  return incident;
};

describe('Incident', () => {
  it('opens pending with defaults', () => {
    const incident = open();
    expect(incident).toMatchObject({
      type: 'otra',
      priority: 'medium',
      status: 'pending',
      title: 'Incapacidad',
      description: null,
      createdAt: at,
      isOpen: true,
    });
  });

  it.each([
    [{ type: 'academico' }, 'INVALID_OPTION'],
    [{ priority: 'urgent' }, 'INVALID_OPTION'],
    [{ title: '' }, 'REQUIRED_FIELD'],
    [{ title: 'x'.repeat(256) }, 'MAX_LENGTH'],
  ])('rejects %o (bug B19)', (override, code) => {
    expect(() =>
      Incident.open({
        studentId: null,
        requestedBy: 1,
        title: 'T',
        openedAt: at,
        ...(override as object),
      }),
    ).toThrow(expect.objectContaining({ code }));
  });

  it.each<[IncidentStatus, ReviewAction]>([
    ['pending', 'in_review'],
    ['pending', 'approved'],
    ['pending', 'rejected'],
    ['in_review', 'approved'],
    ['in_review', 'rejected'],
    ['approved', 'closed'],
    ['rejected', 'closed'],
  ])('allows %s → %s recording reviewer and notes', (from, action) => {
    const incident = inStatus(from);
    const later = new Date('2026-03-16T10:00:00Z');
    incident.review(action, 9, ' Revisado ', later);
    expect(incident).toMatchObject({
      status: action,
      reviewedBy: 9,
      reviewNotes: 'Revisado',
      updatedAt: later,
    });
  });

  it.each<[IncidentStatus, ReviewAction]>([
    ['pending', 'closed'],
    ['in_review', 'in_review'],
    ['approved', 'rejected'],
    ['rejected', 'approved'],
    ['closed', 'approved'],
    ['closed', 'in_review'],
  ])('rejects %s → %s (security S7)', (from, action) => {
    expect(() => inStatus(from).review(action, 9, null, at)).toThrow(
      expect.objectContaining({ code: 'INVALID_INCIDENT_TRANSITION' }),
    );
  });

  it('rejects unknown actions', () => {
    expect(() => open().review('pending' as never, 1, null, at)).toThrow(
      expect.objectContaining({ code: 'INVALID_OPTION' }),
    );
  });
});
