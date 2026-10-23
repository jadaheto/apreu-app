/** Web-service operations used to submit or query documents. */
export type DianOperation = 'SendBillSync' | 'SendTestSetAsync' | 'GetStatusZip';

/** Facts extracted from a DIAN web-service response (already unzipped/decoded by the gateway). */
export interface DianResponse {
  /** `StatusCode`: 00 processed, 66 NSU not found, 90 TrackId not found, 99 validation errors. */
  statusCode: string | null;
  statusDescription: string | null;
  isValid: boolean | null;
  /** `ErrorMessage` / `ErrorMessageList` entries ("Regla: FAD06, Rechazo: …"). */
  messages: string[];
  /** `XmlDocumentKey` (CUFE) or `ZipKey` (async). */
  trackId: string | null;
  /** Signed `ApplicationResponse` XML returned by the DIAN, when present. */
  applicationResponse: string | null;
  /** `ApplicationResponse/DocumentResponse/Response/ResponseCode`: 02 validated, 04 rejected. */
  applicationResponseCode: string | null;
}

export type SubmissionOutcome = 'accepted' | 'accepted_with_notices' | 'rejected' | 'processing';

export interface InterpretedResponse {
  outcome: SubmissionOutcome;
  /** Rules that rejected the document. */
  errors: string[];
  /** Informative rules ("Notificación") that do not reject the document. */
  notices: string[];
}

const PROCESSING_CODES = ['66', '90'];
const SUCCESS_CODES = ['00', '0'];
const NOTICE_PATTERN = /notificaci[oó]n/i;
const IN_PROGRESS_PATTERN = /en proceso/i;

/**
 * Classifies a DIAN response (fixes legacy `DianClient::parseResponse` /
 * `check_status.php`, which mixed web-service and ApplicationResponse codes
 * and marked "in progress" answers as rejected):
 * - `66`/`90` or "en proceso" → still processing (the document stays SUBMITTED).
 * - `00` with `IsValid != false`, or ApplicationResponse `02` → accepted;
 *   with notification rules → accepted with notices.
 * - `99`, `IsValid=false` or ApplicationResponse `04` → rejected.
 * - Async receipt (`ZipKey` without status) → processing.
 */
export function interpretDianResponse(response: DianResponse): InterpretedResponse {
  const notices = response.messages.filter((message) => NOTICE_PATTERN.test(message));
  const errors = response.messages.filter((message) => !NOTICE_PATTERN.test(message));
  const code = response.statusCode?.trim() || null;

  if (code && PROCESSING_CODES.includes(code)) return { outcome: 'processing', errors: [], notices };
  if (!code && response.statusDescription && IN_PROGRESS_PATTERN.test(response.statusDescription)) {
    return { outcome: 'processing', errors: [], notices };
  }

  const accepted =
    (code !== null && SUCCESS_CODES.includes(code) && response.isValid !== false) ||
    (code === null && response.applicationResponseCode === '02');
  if (accepted) {
    const allNotices = [...notices, ...errors];
    return { outcome: allNotices.length ? 'accepted_with_notices' : 'accepted', errors: [], notices: allNotices };
  }

  const rejected =
    code === '99' ||
    response.isValid === false ||
    response.applicationResponseCode === '04' ||
    (code !== null && errors.length > 0);
  if (rejected) {
    return {
      outcome: 'rejected',
      errors: errors.length ? errors : [response.statusDescription || `Documento rechazado (código ${code ?? 'N/D'}).`],
      notices,
    };
  }
  return { outcome: 'processing', errors: [], notices };
}
