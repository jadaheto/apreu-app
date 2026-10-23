/**
 * Colombia (America/Bogota) is UTC-5 all year (no daylight saving), so local
 * date/time is derived by shifting UTC five hours. DIAN requires the literal
 * offset `-05:00` in `IssueTime` and in the XAdES `SigningTime`.
 */
const OFFSET_MS = 5 * 60 * 60 * 1000;

export interface BogotaDateTime {
  /** `YYYY-MM-DD` */
  date: string;
  /** `HH:MM:SS-05:00` */
  time: string;
}

const shifted = (instant: Date): string => new Date(instant.getTime() - OFFSET_MS).toISOString();

/** Issue date and time of a document in Bogotá. */
export function toBogota(instant: Date): BogotaDateTime {
  const iso = shifted(instant);
  return { date: iso.slice(0, 10), time: `${iso.slice(11, 19)}-05:00` };
}

/** `YYYY-MM-DDTHH:MM:SS.mmm-05:00` (XAdES SigningTime). */
export function toBogotaTimestamp(instant: Date): string {
  return `${shifted(instant).slice(0, 23)}-05:00`;
}
