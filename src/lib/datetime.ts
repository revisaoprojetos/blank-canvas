// Centralized date/time helpers fixed to Brasília time (UTC-3, no DST).
// Use these everywhere instead of `new Date(...)` + toLocale* / date-fns format,
// so the whole app shows and parses datetimes consistently em horário de Brasília.

export const BRT_OFFSET_MINUTES = -180; // UTC-3

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function parseDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Returns a Date whose getUTC* fields equal the Brasília wall-clock of `value`. */
function toBrtFields(value: Date): Date {
  return new Date(value.getTime() + BRT_OFFSET_MINUTES * 60_000);
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Format an ISO/Date as Brasília time.
 * Supported patterns:
 *   - "dd/MM/yyyy HH:mm"   (default)
 *   - "dd/MM/yyyy"
 *   - "HH:mm"
 *   - "dd/MM/yyyy 'às' HH:mm"
 *   - "dd 'de' MMMM 'de' yyyy 'às' HH:mm"
 */
export function formatBrasilia(value: string | Date | null | undefined, pattern = "dd/MM/yyyy HH:mm"): string {
  const d = parseDate(value);
  if (!d) return "";
  const b = toBrtFields(d);
  const dd = pad(b.getUTCDate());
  const MM = pad(b.getUTCMonth() + 1);
  const yyyy = b.getUTCFullYear();
  const HH = pad(b.getUTCHours());
  const mm = pad(b.getUTCMinutes());
  const MMMM = MESES[b.getUTCMonth()];

  switch (pattern) {
    case "dd/MM/yyyy":
      return `${dd}/${MM}/${yyyy}`;
    case "HH:mm":
      return `${HH}:${mm}`;
    case "dd/MM/yyyy 'às' HH:mm":
      return `${dd}/${MM}/${yyyy} às ${HH}:${mm}`;
    case "dd 'de' MMMM 'de' yyyy 'às' HH:mm":
      return `${dd} de ${MMMM} de ${yyyy} às ${HH}:${mm}`;
    case "dd/MM/yyyy HH:mm":
    default:
      return `${dd}/${MM}/${yyyy} ${HH}:${mm}`;
  }
}

/** Convert an ISO/Date to value for <input type="datetime-local"> em horário de Brasília. */
export function toBrasiliaInput(value: string | Date | null | undefined): string {
  const d = parseDate(value);
  if (!d) return "";
  const b = toBrtFields(d);
  return `${b.getUTCFullYear()}-${pad(b.getUTCMonth() + 1)}-${pad(b.getUTCDate())}T${pad(b.getUTCHours())}:${pad(b.getUTCMinutes())}`;
}

/** Treat "YYYY-MM-DDTHH:mm" from a datetime-local input as Brasília time → UTC ISO. */
export function brasiliaInputToISO(localInput: string): string {
  const normalized = localInput.length === 16 ? `${localInput}:00` : localInput;
  return new Date(`${normalized}-03:00`).toISOString();
}

/** Compare a UTC ISO/Date with now — timezone-independent. */
export function isPast(value: string | Date | null | undefined): boolean {
  const d = parseDate(value);
  return d ? d.getTime() < Date.now() : false;
}
