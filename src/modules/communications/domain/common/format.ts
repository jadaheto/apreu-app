import { BusinessRuleViolationError } from '../../../../shared/domain/domain-error.js';

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Formats pesos without decimals as the legacy UI did: `$850.000`. */
export const formatCop = (amount: number): string =>
  `$${Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

/** `YYYY-MM-DD` → `DD/MM/YYYY`. */
export const formatDay = (day: string): string => {
  const match = DAY_PATTERN.exec(day);
  if (!match) throw new BusinessRuleViolationError(`Fecha inválida: "${day}".`, 'INVALID_DATE');
  return `${match[3]}/${match[2]}/${match[1]}`;
};

/** Validates a `YYYY-MM-DD` calendar day (rejects 2026-02-30). */
export const assertDay = (day: string, field: string): void => {
  const match = DAY_PATTERN.exec(day ?? '');
  const date = match ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])) : null;
  if (!match || !date || date.getUTCDate() !== +match[3] || date.getUTCMonth() !== +match[2] - 1) {
    throw new BusinessRuleViolationError(`El campo "${field}" debe ser una fecha AAAA-MM-DD válida.`, 'INVALID_DATE', {
      field,
    });
  }
};

/** Calendar day (`YYYY-MM-DD`) of an instant in Colombia's time zone. */
export const bogotaDay = (instant: Date): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant);
