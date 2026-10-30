export function parseFortalezaDateTime(
  date: string,
  time: string,
): string | null {
  const d = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(date.trim());
  const t = /^(\d{2}):(\d{2})$/.exec(time.trim());
  if (!d || !t) return null;
  const [, dd, mm, yyyy] = d,
    [, hh, min] = t;
  if (
    +yyyy < 2020 ||
    +yyyy > 2100 ||
    +mm < 1 ||
    +mm > 12 ||
    +hh > 23 ||
    +min > 59
  )
    return null;
  const calendar = new Date(Date.UTC(+yyyy, +mm - 1, +dd));
  if (calendar.getUTCDate() !== +dd || calendar.getUTCMonth() !== +mm - 1)
    return null;
  return new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00-03:00`).toISOString();
}
