import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { CollectionFile } from './collection-file.js';
import { FixedWidth } from './fixed-width.js';
import { PayrollDisbursementFile } from './payroll-disbursement-file.js';

describe('FixedWidth', () => {
  it('normalizes to upper-case ASCII and truncates text by characters (bugs B31/B32)', () => {
    expect(FixedWidth.normalize('Ñandú Peña-López')).toBe('NANDU PENA LOPEZ');
    expect(FixedWidth.text('José Ángel Muñoz Rodríguez de la Torre', 10)).toBe('JOSE ANGEL');
    expect(FixedWidth.text('Ana', 5)).toBe('ANA  ');
  });

  it('pads numbers with zeros and never truncates them', () => {
    expect(FixedWidth.number(1234.6, 6, 'v')).toBe('001235');
    expect(FixedWidth.number('900.123.456-7', 10, 'nit')).toBe('9001234567');
    expect(() => FixedWidth.number('12345', 4, 'cuenta')).toThrow(
      expect.objectContaining({ code: 'BANK_FILE_FIELD_OVERFLOW' }),
    );
    expect(() => FixedWidth.code('ABCDEF', 5, 'doc')).toThrow(
      expect.objectContaining({ code: 'BANK_FILE_FIELD_OVERFLOW' }),
    );
  });
});

describe('PayrollDisbursementFile', () => {
  const content = PayrollDisbursementFile.build({
    nit: '900123456',
    date: '2026-03-31',
    entries: [
      {
        documentNumber: '1012',
        fullName: 'María Gómez',
        bankAccount: '123-456',
        accountType: 'ahorros',
        netSalary: 1500000.4,
      },
      {
        documentNumber: '2023',
        fullName: 'Pedro Ruiz',
        bankAccount: '789',
        accountType: 'corriente',
        netSalary: 2000000.6,
      },
    ],
  });
  const lines = content.split('\r\n');

  it('writes header, details and control with the documented lengths', () => {
    expect(lines).toHaveLength(5);
    expect(lines[4]).toBe('');
    expect(lines[0]).toBe('10900123456PAGO NOMINA             22020260331');
    expect(lines[0]).toHaveLength(46);
    expect(lines[1]).toHaveLength(72);
    expect(lines[1]).toBe('61012           MARIA GOMEZ                   00000000012345610001500000');
    expect(lines[2].charAt(61)).toBe('2');
    expect(lines[3]).toBe('8000002000000003500001');
    expect(lines[3]).toHaveLength(22);
  });

  it('requires a bank account for every employee', () => {
    expect(() =>
      PayrollDisbursementFile.build({
        nit: '1',
        date: '2026-03-31',
        entries: [{ documentNumber: '1', fullName: 'Sin Cuenta', bankAccount: null, accountType: null, netSalary: 1 }],
      }),
    ).toThrow(expect.objectContaining({ code: 'EMPLOYEE_WITHOUT_BANK_ACCOUNT' }));
  });
});

describe('CollectionFile', () => {
  it('writes the documented layout with whole-peso totals (bug B30)', () => {
    const lines = CollectionFile.build({
      nit: '900123456',
      date: '2026-03-05',
      entries: [
        { reference: '1012345678', amount: Money.of(350000.5) },
        { reference: '42', amount: Money.of(100000) },
      ],
    }).split('\r\n');
    expect(lines[0]).toBe('010900123456RECAUDO MES    ');
    expect(lines[0]).toHaveLength(27);
    expect(lines[1]).toBe('0200000000001012345678000000003500012026030500' + '00');
    expect(lines[1]).toHaveLength(48);
    expect(lines[3]).toBe('03000000002000000000000450001');
    expect(lines[3]).toHaveLength(29);
  });
});
