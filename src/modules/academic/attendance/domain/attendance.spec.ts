import { AttendanceRecord } from './attendance-record.js';
import { StudentQrPayload } from './student-qr-payload.js';

describe('AttendanceRecord', () => {
  const props = {
    studentId: 1,
    employeeId: 2,
    subjectId: 3,
    classroomId: 4,
    date: '2026-03-15',
    time: '10:00:00',
    status: 'present' as const,
    source: 'qr' as const,
  };

  it('registers and corrects the status manually', () => {
    const record = AttendanceRecord.register(props);
    expect(record.attended).toBe(true);
    record.changeStatus('absent', 9);
    expect(record).toMatchObject({ status: 'absent', employeeId: 9, source: 'manual', attended: false });
  });

  it.each([
    [{ date: '15/03/2026' }, 'INVALID_DATE'],
    [{ time: '25:00:00' }, 'INVALID_TIME'],
    [{ status: 'sick' as never }, 'INVALID_OPTION'],
  ])('rejects %o', (override, code) => {
    expect(() => AttendanceRecord.register({ ...props, ...override })).toThrow(expect.objectContaining({ code }));
  });
});

describe('StudentQrPayload', () => {
  it('parses the signed card format', () => {
    const payload = StudentQrPayload.parse(' APREU1|colegio-a|15|2026|abcdefghijklmnop_-12 ');
    expect(payload).toMatchObject({
      tenant: 'colegio-a',
      studentId: 15,
      academicYear: 2026,
      signature: 'abcdefghijklmnop_-12',
    });
    expect(payload.signedContent).toBe('APREU1|colegio-a|15|2026');
  });

  it.each([
    '20261101814264primariaT',
    'APREU2|colegio-a|15|2026|abcdefghijklmnop',
    'APREU1|Colegio A|15|2026|abcdefghijklmnop',
    'APREU1|colegio-a|0|2026|abcdefghijklmnop',
    'APREU1|colegio-a|15|26|abcdefghijklmnop',
    'APREU1|colegio-a|15|2026|short',
    'APREU1|colegio-a|15|2026|abcdefghijklmnop|extra',
    '',
  ])('rejects "%s" (the legacy unsigned format included)', (raw) => {
    expect(() => StudentQrPayload.parse(raw)).toThrow(expect.objectContaining({ code: 'INVALID_QR' }));
  });
});
