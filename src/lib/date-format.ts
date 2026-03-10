const displayDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const parseAsLocalDate = (value: string): Date | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const displayMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (displayMatch) {
    const [, day, month, year] = displayMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const isoDateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const formatDisplayDate = (value?: string | Date | null) => {
  if (!value) {
    return "";
  }

  const parsed = value instanceof Date ? value : parseAsLocalDate(value);
  if (!parsed) {
    return "";
  }

  return displayDateFormatter.format(parsed);
};

export const parseDisplayDateToIso = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const parsed = parseAsLocalDate(value);
  return parsed ? parsed.toISOString() : null;
};

export const isDisplayDate = (value: string) => /^\d{2}\/\d{2}\/\d{4}$/.test(value.trim());