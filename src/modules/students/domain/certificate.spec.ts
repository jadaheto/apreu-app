import { Certificate, type CertificateSnapshot } from './certificate.js';

const snapshot: CertificateSnapshot = {
  studentName: 'Sofía Gómez',
  studentCode: 'AL20260001',
  documentType: 'TI',
  documentNumber: '1101',
  gradeName: 'Quinto',
  classroomName: 'A',
  academicYear: 2026,
  studentStatus: 'active',
  enrollmentDate: '2026-01-20',
};
const at = new Date('2026-03-15T15:00:00Z');

describe('Certificate', () => {
  it('is issued approved with snapshot and verification code', () => {
    const certificate = Certificate.issue({
      studentId: 1,
      createdBy: 2,
      paymentId: 5,
      verificationCode: 'abc',
      snapshot,
      issuedAt: at,
    });
    expect(certificate).toMatchObject({
      type: 'certificado_estudiantil',
      status: 'approved',
      paymentId: 5,
      createdAt: at,
      isValid: true,
      verificationCode: 'abc',
    });
    expect(certificate.snapshot).toEqual(snapshot);
  });

  it('requires a verification code and a known type', () => {
    expect(() =>
      Certificate.issue({
        studentId: 1,
        createdBy: 2,
        verificationCode: '',
        snapshot,
        issuedAt: at,
      }),
    ).toThrow(expect.objectContaining({ code: 'REQUIRED_FIELD' }));
    expect(() =>
      Certificate.request({
        studentId: 1,
        requestedBy: 2,
        type: 'beca' as never,
        requestedAt: at,
      }),
    ).toThrow(expect.objectContaining({ code: 'INVALID_OPTION' }));
  });

  it('turns a pending request into an approved certificate once', () => {
    const certificate = Certificate.request({
      studentId: 1,
      requestedBy: 2,
      notes: 'Para el ICBF',
      requestedAt: at,
    });
    expect(certificate).toMatchObject({
      status: 'pending',
      isValid: false,
      verificationCode: null,
      snapshot: null,
    });
    certificate.approve('xyz', snapshot);
    expect(certificate).toMatchObject({
      status: 'approved',
      verificationCode: 'xyz',
      isValid: true,
    });
    expect(() => certificate.approve('other', snapshot)).toThrow(
      expect.objectContaining({ code: 'CERTIFICATE_NOT_PENDING' }),
    );
  });

  it('is cancelled with a reason kept in the notes', () => {
    const certificate = Certificate.request({
      studentId: 1,
      requestedBy: 2,
      notes: 'Solicitud',
      requestedAt: at,
    });
    expect(() => certificate.cancel(' ')).toThrow(expect.objectContaining({ code: 'REQUIRED_FIELD' }));
    certificate.cancel('Duplicado');
    expect(certificate).toMatchObject({
      status: 'cancelled',
      notes: 'Solicitud\nAnulado: Duplicado',
      isValid: false,
    });
    expect(() => certificate.cancel('Otra vez')).toThrow(
      expect.objectContaining({ code: 'CERTIFICATE_ALREADY_CANCELLED' }),
    );
  });
});
