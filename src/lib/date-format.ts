process.env.TZ = 'UTC';

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
  if (!parsed || Number.isNaN(parsed.getTime())) {
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

export const formatLastUpdated = (value?: string | Date | null) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : parseAsLocalDate(value);
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  const day = parsed.getDate();
  const month = new Intl.DateTimeFormat("en-US", { month: "long" }).format(parsed);
  const year = parsed.getFullYear();
  return `${day} ${month}, ${year}`;
};

export const formatDateTimeGMT6 = (value?: string | Date | null): string => {
  if (!value) return '—';
  
  let dateToParse = value;
  if (typeof value === 'string' && !value.endsWith('Z') && !value.includes('+')) {
    dateToParse = value.replace(' ', 'T') + (value.includes('T') ? 'Z' : 'Z');
  }
  const date = typeof dateToParse === 'string' ? new Date(dateToParse) : dateToParse;
  
  if (!date || isNaN(date.getTime())) return '—';

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const parts = formatter.formatToParts(date);
  const day = parts.find(p => p.type === 'day')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const year = parts.find(p => p.type === 'year')?.value || '';
  const hour = parts.find(p => p.type === 'hour')?.value || '';
  const minute = parts.find(p => p.type === 'minute')?.value || '';
  const dayPeriod = parts.find(p => p.type === 'dayPeriod')?.value || ''; // AM/PM

  return `${day} ${month} ${year}, ${hour}:${minute} ${dayPeriod}`;
};

export const formatDateGMT6 = (value?: string | Date | null): string => {
  if (!value) return '—';
  
  let dateToParse = value;
  if (typeof value === 'string' && !value.endsWith('Z') && !value.includes('+')) {
    dateToParse = value.replace(' ', 'T') + (value.includes('T') ? 'Z' : 'Z');
  }
  const date = typeof dateToParse === 'string' ? new Date(dateToParse) : dateToParse;
  
  if (!date || isNaN(date.getTime())) return '—';

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const parts = formatter.formatToParts(date);
  const day = parts.find(p => p.type === 'day')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const year = parts.find(p => p.type === 'year')?.value || '';

  return `${day}/${month}/${year}`;
};

export const parseDbDate = (value?: string | Date | null): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  
  let dateToParse = value.trim();
  if (!dateToParse.endsWith('Z') && !dateToParse.includes('+')) {
    dateToParse = dateToParse.replace(' ', 'T');
    if (!dateToParse.includes('T')) {
      dateToParse += 'T00:00:00Z';
    } else if (!dateToParse.endsWith('Z')) {
      dateToParse += 'Z';
    }
  }
  const date = new Date(dateToParse);
  return isNaN(date.getTime()) ? null : date;
};

export const formatDateTextGMT6 = (value?: string | Date | null): string => {
  if (!value) return '—';
  
  let dateToParse = value;
  if (typeof value === 'string' && !value.endsWith('Z') && !value.includes('+')) {
    dateToParse = value.replace(' ', 'T') + (value.includes('T') ? 'Z' : 'Z');
  }
  const date = typeof dateToParse === 'string' ? new Date(dateToParse) : dateToParse;
  
  if (!date || isNaN(date.getTime())) return '—';

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  const parts = formatter.formatToParts(date);
  const day = parts.find(p => p.type === 'day')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const year = parts.find(p => p.type === 'year')?.value || '';

  return `${day} ${month} ${year}`;
};

export const formatDateInputGMT6 = (value?: string | Date | null): string => {
  if (!value) return '';
  
  let dateToParse = value;
  if (typeof value === 'string' && !value.endsWith('Z') && !value.includes('+')) {
    dateToParse = value.replace(' ', 'T') + (value.includes('T') ? 'Z' : 'Z');
  }
  const date = typeof dateToParse === 'string' ? new Date(dateToParse) : dateToParse;
  
  if (!date || isNaN(date.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(date);
  const day = parts.find(p => p.type === 'day')?.value || '';
  const month = parts.find(p => p.type === 'month')?.value || '';
  const year = parts.find(p => p.type === 'year')?.value || '';

  return `${year}-${month}-${day}`;
};

export const getExpiryDateGMT6 = (value?: string | Date | null): string => {
  if (!value) return '—';
  
  let dateToParse = value;
  if (typeof value === 'string' && !value.endsWith('Z') && !value.includes('+')) {
    dateToParse = value.replace(' ', 'T') + (value.includes('T') ? 'Z' : 'Z');
  }
  const date = typeof dateToParse === 'string' ? new Date(dateToParse) : dateToParse;
  
  if (!date || isNaN(date.getTime())) return '—';

  const expiryDate = new Date(date.getTime());
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);

  return formatDateTextGMT6(expiryDate);
};