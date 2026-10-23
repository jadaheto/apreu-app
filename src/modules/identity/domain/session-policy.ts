/**
 * Session rules. The legacy `auth_check.php` destroyed the session after
 * 7200 s without activity. With stateless JWT (ADR-0005) the frontend tracks
 * inactivity with this value and keeps an active session alive through
 * `POST /auth/refresh`; an idle client simply lets its token expire.
 */
export const SESSION_IDLE_TIMEOUT_SECONDS = 7200;
