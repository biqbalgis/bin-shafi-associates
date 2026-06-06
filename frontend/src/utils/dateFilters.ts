export type DateFilterValue = {
  day: string;
  month: string;
  year: string;
};

export type DateRange = {
  dateFrom?: string;
  dateTo?: string;
};

function formatDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function toIsoDate(year: number, monthIndex: number, day: number) {
  return `${year}-${formatDatePart(monthIndex + 1)}-${formatDatePart(day)}`;
}

export function buildDateRange(filters: DateFilterValue): DateRange {
  if (filters.day) {
    return { dateFrom: filters.day, dateTo: filters.day };
  }

  if (filters.month) {
    const [yearPart, monthPart] = filters.month.split("-").map(Number);
    if (!Number.isFinite(yearPart) || !Number.isFinite(monthPart)) {
      return {};
    }
    const start = new Date(yearPart, monthPart - 1, 1);
    const end = new Date(yearPart, monthPart, 0);
    return {
      dateFrom: toIsoDate(start.getFullYear(), start.getMonth(), start.getDate()),
      dateTo: toIsoDate(end.getFullYear(), end.getMonth(), end.getDate()),
    };
  }

  if (filters.year) {
    const yearPart = Number(filters.year);
    if (!Number.isFinite(yearPart)) {
      return {};
    }
    return {
      dateFrom: `${yearPart}-01-01`,
      dateTo: `${yearPart}-12-31`,
    };
  }

  return {};
}
