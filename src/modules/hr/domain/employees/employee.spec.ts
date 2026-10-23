import { Money } from '../../../../shared/domain/value-objects/money.vo.js';
import { Role } from '../../../../shared/domain/role.js';
import { roleForEmployeeType } from './employee-catalogs.js';
import { validEmployeeData } from '../../testing/fixtures.js';
import { Employee, type EmployeeData } from './employee.js';

describe('Employee', () => {
  it('creates an active employee with normalized data and defaults', () => {
    const employee = Employee.create('EMP0001', validEmployeeData());
    expect(employee).toMatchObject({
      fullName: 'Ana Pérez',
      status: 'active',
      arlRiskClass: 1,
      accountType: 'ahorros',
    });
    expect(employee.email?.toString()).toBe('ana@colegio.edu.co');
    expect(employee.baseSalary.amount).toBe(2_500_000);
    expect(employee.recurringDeductions.libranza.isZero()).toBe(true);
    expect(employee.hasPortalAccess).toBe(true);
  });

  it.each([
    [{ firstName: '' }, 'REQUIRED_FIELD'],
    [{ documentNumber: '12 34' }, 'INVALID_DOCUMENT'],
    [{ baseSalary: 0 }, 'INVALID_SALARY'],
    [{ employeeType: 'servicio' }, 'INVALID_OPTION'],
    [{ email: 'no-es-correo' }, 'INVALID_EMAIL'],
    [{ hireDate: '2024-02-30' }, 'INVALID_DATE'],
    [{ birthDate: '2025-01-01', hireDate: '2024-01-01' }, 'INVALID_HIRE_DATE'],
    [{ fixedEmbargo: -5 }, 'NEGATIVE_VALUE'],
    [{ arlRiskClass: 6 }, 'INVALID_OPTION'],
    [{ bankAccount: 'ABC' }, 'INVALID_BANK_ACCOUNT'],
  ])('rejects invalid data %o', (override, code) => {
    expect(() => Employee.create('EMP0001', validEmployeeData(override as Partial<EmployeeData>))).toThrow(
      expect.objectContaining({ code }),
    );
  });

  it('never marks contractors as integral salary', () => {
    const employee = Employee.create('EMP1', validEmployeeData({ contractType: 'prestacion', integralSalary: true }));
    expect(employee.integralSalary).toBe(false);
    expect(employee.isContractor).toBe(true);
  });

  it('lets the employee change only contact data', () => {
    const employee = Employee.create('EMP1', validEmployeeData({ fixedLibranza: 100_000, bankAccount: '123' }));
    employee.updateContactInfo({ phone: '3001234567', address: 'Calle 1', email: '' });
    expect(employee).toMatchObject({ phone: '3001234567', address: 'Calle 1', email: null, bankAccount: '123' });
    expect(employee.recurringDeductions.libranza.amount).toBe(100_000);
  });

  it('follows the status machine', () => {
    const employee = Employee.create('EMP1', validEmployeeData());
    employee.changeStatus('on_leave');
    expect(employee.hasPortalAccess).toBe(true);
    expect(() => employee.changeStatus('suspended')).toThrow(
      expect.objectContaining({ code: 'INVALID_STATUS_TRANSITION' }),
    );
    employee.changeStatus('active');
    employee.changeStatus('suspended');
    expect(employee.hasPortalAccess).toBe(false);
    expect(() => employee.changeStatus('retired')).toThrow(/retiro con fecha/);
  });

  it('retires logically with date and reason', () => {
    const employee = Employee.create('EMP1', validEmployeeData());
    expect(() => employee.retire('2020-01-01', 'Renuncia')).toThrow(
      expect.objectContaining({ code: 'INVALID_RETIREMENT_DATE' }),
    );
    expect(() => employee.retire('2026-03-10', ' ')).toThrow(expect.objectContaining({ code: 'REQUIRED_FIELD' }));
    employee.retire('2026-03-10', 'Renuncia voluntaria');
    expect(employee).toMatchObject({
      status: 'retired',
      retirementDate: '2026-03-10',
      retirementReason: 'Renuncia voluntaria',
    });
    expect(() => employee.retire('2026-03-11', 'x')).toThrow(expect.objectContaining({ code: 'ALREADY_RETIRED' }));
    expect(() => employee.changeStatus('active')).toThrow(
      expect.objectContaining({ code: 'INVALID_STATUS_TRANSITION' }),
    );
  });

  describe('payrollWindow', () => {
    it('covers the whole period for active employees hired before it', () => {
      const employee = Employee.create('EMP1', validEmployeeData());
      expect(employee.payrollWindow('2026-03-01', '2026-03-31')).toEqual({ from: '2026-03-01', to: '2026-03-31' });
    });

    it('starts at the hire date and ends at the retirement date', () => {
      const employee = Employee.create('EMP1', validEmployeeData({ hireDate: '2026-03-10' }));
      employee.retire('2026-03-20', 'Fin de contrato');
      expect(employee.payrollWindow('2026-03-01', '2026-03-31')).toEqual({ from: '2026-03-10', to: '2026-03-20' });
      expect(employee.payrollWindow('2026-04-01', '2026-04-30')).toBeNull();
    });

    it('includes employees on leave and excludes contractors, suspended and future hires', () => {
      const onLeave = Employee.create('EMP1', validEmployeeData());
      onLeave.changeStatus('on_leave');
      expect(onLeave.payrollWindow('2026-03-01', '2026-03-31')).not.toBeNull();

      const contractor = Employee.create('EMP2', validEmployeeData({ contractType: 'prestacion' }));
      expect(contractor.payrollWindow('2026-03-01', '2026-03-31')).toBeNull();

      const suspended = Employee.create('EMP3', validEmployeeData());
      suspended.changeStatus('suspended');
      expect(suspended.payrollWindow('2026-03-01', '2026-03-31')).toBeNull();

      const future = Employee.create('EMP4', validEmployeeData({ hireDate: '2026-04-02' }));
      expect(future.payrollWindow('2026-03-01', '2026-03-31')).toBeNull();
    });
  });

  it('derives portal roles from the employee type without ever granting admin', () => {
    expect(roleForEmployeeType('docente')).toBe(Role.TEACHER);
    for (const type of ['administrativo', 'directivo', 'servicios', 'otro'] as const) {
      expect(roleForEmployeeType(type)).toBe(Role.EMPLOYEE);
    }
  });
});

describe('Employee integral salary', () => {
  it('requires at least 13 minimum wages', () => {
    const minimumWage = Money.of(1_750_905);
    const low = Employee.create('EMP1', validEmployeeData({ baseSalary: 20_000_000, integralSalary: true }));
    expect(() => low.assertIntegralSalaryMinimum(minimumWage)).toThrow(
      expect.objectContaining({ code: 'INTEGRAL_SALARY_TOO_LOW' }),
    );
    const ok = Employee.create('EMP1', validEmployeeData({ baseSalary: 23_000_000, integralSalary: true }));
    expect(() => ok.assertIntegralSalaryMinimum(minimumWage)).not.toThrow();
  });
});
