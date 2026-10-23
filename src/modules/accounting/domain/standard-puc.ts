import type { AccountType } from './account-type.js';

export interface StandardAccount {
  code: string;
  name: string;
  type: AccountType;
  isTransactional: boolean;
  parentCode: string | null;
}

const account = (
  code: string,
  name: string,
  type: AccountType,
  isTransactional: boolean,
  parentCode: string | null,
): StandardAccount => ({ code, name, type, isTransactional, parentCode });

/**
 * Simplified Colombian PUC for schools (legacy `accounting/api/seed_puc.php`).
 * Ordered so every parent precedes its children.
 *
 * Fixes bug 14: `24080501 IVA por Pagar` hung directly from `24`; the
 * summary account `2408` is added as its parent. `2370` is added to receive
 * payroll deductions of automatic payroll entries and `2805` the unapplied
 * surplus of cashier payments (advances), see `DEFAULT_POSTING_RULES`.
 */
export const STANDARD_PUC: readonly StandardAccount[] = [
  account('1', 'ACTIVOS', 'activo', false, null),
  account('11', 'Efectivo y Equivalentes', 'activo', false, '1'),
  account('1105', 'Caja', 'activo', false, '11'),
  account('110505', 'Caja General', 'activo', true, '1105'),
  account('1110', 'Bancos', 'activo', false, '11'),
  account('111005', 'Cuenta Corriente', 'activo', true, '1110'),
  account('111010', 'Cuenta de Ahorros', 'activo', true, '1110'),
  account('13', 'Cuentas por Cobrar', 'activo', false, '1'),
  account('1305', 'Deudores Clientes', 'activo', true, '13'),
  account('14', 'Inventarios', 'activo', false, '1'),
  account('1455', 'Mercancías no fabricadas por la empresa', 'activo', true, '14'),
  account('15', 'Propiedades Planta y Equipo', 'activo', false, '1'),
  account('1524', 'Equipo de Oficina', 'activo', true, '15'),
  account('2', 'PASIVOS', 'pasivo', false, null),
  account('21', 'Obligaciones Financieras', 'pasivo', false, '2'),
  account('2105', 'Bancos Nacionales', 'pasivo', true, '21'),
  account('22', 'Proveedores', 'pasivo', false, '2'),
  account('2205', 'Proveedores Nacionales', 'pasivo', true, '22'),
  account('23', 'Cuentas por Pagar', 'pasivo', false, '2'),
  account('2335', 'Costos y Gastos por Pagar', 'pasivo', true, '23'),
  account('2370', 'Retenciones y Aportes de Nómina', 'pasivo', true, '23'),
  account('24', 'Impuestos por Pagar', 'pasivo', false, '2'),
  account('2404', 'Impuesto de Renta y Complementarios', 'pasivo', true, '24'),
  account('2408', 'Impuesto sobre las Ventas por Pagar', 'pasivo', false, '24'),
  account('24080501', 'IVA por Pagar', 'pasivo', true, '2408'),
  account('25', 'Obligaciones Laborales', 'pasivo', false, '2'),
  account('2505', 'Salarios por Pagar', 'pasivo', true, '25'),
  account('2510', 'Cesantías Consolidadas', 'pasivo', true, '25'),
  account('2515', 'Intereses Cesantías', 'pasivo', true, '25'),
  account('2520', 'Prima de Servicios', 'pasivo', true, '25'),
  account('2525', 'Vacaciones', 'pasivo', true, '25'),
  account('2530', 'Prestaciones Extralegales', 'pasivo', true, '25'),
  account('28', 'Otros Pasivos', 'pasivo', false, '2'),
  account('2805', 'Anticipos y Avances Recibidos', 'pasivo', true, '28'),
  account('3', 'PATRIMONIO', 'patrimonio', false, null),
  account('31', 'Capital Social', 'patrimonio', false, '3'),
  account('3105', 'Capital Suscrito y Pagado', 'patrimonio', true, '31'),
  account('33', 'Reservas', 'patrimonio', false, '3'),
  account('3305', 'Reserva Legal', 'patrimonio', true, '33'),
  account('36', 'Resultados del Ejercicio', 'patrimonio', false, '3'),
  account('3605', 'Utilidad del Ejercicio', 'patrimonio', true, '36'),
  account('3610', 'Pérdida del Ejercicio', 'patrimonio', true, '36'),
  account('4', 'INGRESOS', 'ingreso', false, null),
  account('41', 'Ingresos Operacionales', 'ingreso', false, '4'),
  account('4135', 'Servicios Educativos', 'ingreso', false, '41'),
  account('413501', 'Matrículas', 'ingreso', true, '4135'),
  account('413502', 'Pensiones', 'ingreso', true, '4135'),
  account('413503', 'Certificados y Constancias', 'ingreso', true, '4135'),
  account('413510', 'Transporte Escolar', 'ingreso', true, '4135'),
  account('42', 'Ingresos No Operacionales', 'ingreso', false, '4'),
  account('4210', 'Intereses y Rendimientos', 'ingreso', true, '42'),
  account('5', 'GASTOS', 'gasto', false, null),
  account('51', 'Gastos de Administración', 'gasto', false, '5'),
  account('5105', 'Gastos de Personal', 'gasto', false, '51'),
  account('510506', 'Sueldos', 'gasto', true, '5105'),
  account('510509', 'Transporte y Auxilio', 'gasto', true, '5105'),
  account('510520', 'Prima de Servicios', 'gasto', true, '5105'),
  account('510530', 'Cesantías', 'gasto', true, '5105'),
  account('5115', 'Arrendamientos', 'gasto', true, '51'),
  account('5120', 'Servicios Públicos', 'gasto', true, '51'),
  account('5125', 'Servicios de Aseo y Vigilancia', 'gasto', true, '51'),
  account('5130', 'Mantenimiento y Reparaciones', 'gasto', true, '51'),
  account('5135', 'Papelería y Útiles de Oficina', 'gasto', true, '51'),
  account('5145', 'Impuestos y Tasas', 'gasto', true, '51'),
  account('5195', 'Gastos Diversos', 'gasto', true, '51'),
  account('53', 'Gastos Financieros', 'gasto', false, '5'),
  account('5305', 'Intereses Bancarios', 'gasto', true, '53'),
  account('5315', 'Comisiones Bancarias', 'gasto', true, '53'),
];
