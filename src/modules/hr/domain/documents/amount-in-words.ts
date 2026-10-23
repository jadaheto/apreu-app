const UNITS = [
  'cero',
  'uno',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
  'veinte',
  'veintiuno',
  'veintidós',
  'veintitrés',
  'veinticuatro',
  'veinticinco',
  'veintiséis',
  'veintisiete',
  'veintiocho',
  'veintinueve',
];
const TENS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const HUNDREDS = [
  '',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos',
];

/** 0..999 in words; `apocopate` turns a trailing "uno" into "un" (before a noun). */
function belowThousand(n: number, apocopate: boolean): string {
  if (n === 100) return 'cien';
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(HUNDREDS[hundreds]);
  if (rest) {
    let words: string;
    if (rest < 30) words = UNITS[rest];
    else {
      const unit = rest % 10;
      words = TENS[Math.floor(rest / 10)] + (unit ? ` y ${UNITS[unit]}` : '');
    }
    if (apocopate) words = words.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un');
    parts.push(words);
  }
  return parts.join(' ');
}

/** Non-negative integer in Spanish words (up to 999.999.999.999). */
function integerInWords(n: number, apocopate: boolean): string {
  if (n === 0) return 'cero';
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const units = n % 1000;
  const parts: string[] = [];
  if (millions) {
    parts.push(millions === 1 ? 'un millón' : `${integerInWords(millions, true)} millones`);
  }
  if (thousands) parts.push(thousands === 1 ? 'mil' : `${belowThousand(thousands, true)} mil`);
  if (units) parts.push(belowThousand(units, apocopate));
  return parts.join(' ');
}

/**
 * Colombian peso amount in words for certificates, e.g. `1750905` →
 * "un millón setecientos cincuenta mil novecientos cinco pesos m/cte.".
 * Replaces the legacy `num_to_words_es()` that was missing or returned an
 * empty string (B-4, B-5). Cents are ignored (amounts are whole pesos).
 */
export const amountInWords = (amount: number): string => {
  const pesos = Math.floor(Math.abs(amount));
  const words = integerInWords(pesos, true);
  const exactMillions = pesos >= 1_000_000 && pesos % 1_000_000 === 0;
  return `${words}${exactMillions ? ' de' : ''} ${pesos === 1 ? 'peso' : 'pesos'} m/cte.`;
};
