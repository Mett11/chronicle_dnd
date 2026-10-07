import { CalendarMonth } from '../types';

/**
 * Normalizes text for robust comparison:
 * - standardizes all single quotes/apostrophes (straight and curly)
 * - removes brackets/parentheses
 * - trims and collapses spaces
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035']/g, "'")
    .replace(/[()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ParsedLoreDate {
  startDay: number;
  endDay?: number;
  monthName: string;
  monthIndex: number;
  endMonthName?: string;
  endMonthIndex?: number;
  year: number;
  endYear?: number;
  hasExplicitYear?: boolean;
  formatted: string;
  isCrossMonth?: boolean;
}

/**
 * Parses free text or structured lore date into standardized metadata.
 * Supports single day, same-month ranges, and cross-month (and cross-year) ranges.
 */
export function parseLoreDateString(
  dateStr: string | undefined,
  months: CalendarMonth[],
  fallbackYear = 1492,
  fallbackSuffix = 'CV'
): ParsedLoreDate | null {
  if (!dateStr || !dateStr.trim()) return null;

  const norm = normalizeText(dateStr);

  // 1. Identify all explicit years in text (numbers > 31 or numbers followed by era/suffix)
  const yearMatches: { year: number; rawText: string }[] = [];
  const suffixMatch = norm.match(/\b(\d{1,4})\b\s*(?:[i|v|x]+\s*era|era|cv|dr|dc|ac|bce|ce)\b/i);
  if (suffixMatch) {
    const y = parseInt(suffixMatch[1], 10);
    if (!isNaN(y)) {
      yearMatches.push({ year: y, rawText: suffixMatch[1] });
    }
  }

  const allNumbers = Array.from(norm.matchAll(/\b(\d{1,4})\b/g));
  for (const nm of allNumbers) {
    const y = parseInt(nm[1], 10);
    if (!isNaN(y) && y > 31) {
      if (!yearMatches.some((ym) => ym.year === y)) {
        yearMatches.push({ year: y, rawText: nm[1] });
      }
    }
  }

  const hasExplicitYear = yearMatches.length > 0;
  let parsedStartYear = hasExplicitYear ? yearMatches[0].year : fallbackYear;
  let parsedEndYear: number | undefined = yearMatches.length >= 2 ? yearMatches[1].year : undefined;

  // Remove the years from the text so they don't collide with day numbers
  let textWithoutYear = norm;
  for (const ym of yearMatches) {
    textWithoutYear = textWithoutYear.replace(new RegExp(`\\b${ym.rawText}\\b`, 'g'), ' ');
  }

  // 2. Identify month occurrences and their positions
  interface MonthMatch {
    monthIndex: number;
    month: CalendarMonth;
    pos: number;
    matchedLength: number;
  }

  const foundMonths: MonthMatch[] = [];

  for (let i = 0; i < months.length; i++) {
    const m = months[i];
    const mFullName = normalizeText(m.name);
    const mMainName = normalizeText(m.name.split('(')[0]);
    const mSubtitle = m.name.includes('(') ? normalizeText(m.name.split('(')[1]) : '';

    const candidates = [
      mFullName,
      mMainName,
      mSubtitle,
      `mese ${i + 1}`,
      `mese #${i + 1}`,
    ].filter((c) => c && c.length >= 3);

    for (const cand of candidates) {
      let searchPos = 0;
      while (searchPos < norm.length) {
        const foundPos = norm.indexOf(cand, searchPos);
        if (foundPos === -1) break;

        // Check word boundary
        const before = foundPos > 0 ? norm[foundPos - 1] : ' ';
        const after = foundPos + cand.length < norm.length ? norm[foundPos + cand.length] : ' ';
        const isBoundary = /[\s,.\-_/\\al]/.test(before) || before === ' ';

        if (isBoundary) {
          // Avoid duplicate insertion for overlapping month matches
          const alreadyMatched = foundMonths.some(
            (fm) => Math.abs(fm.pos - foundPos) < 4
          );
          if (!alreadyMatched) {
            foundMonths.push({
              monthIndex: i,
              month: m,
              pos: foundPos,
              matchedLength: cand.length,
            });
          }
        }
        searchPos = foundPos + cand.length;
      }
    }
  }

  // Sort found months by occurrence order in text
  foundMonths.sort((a, b) => a.pos - b.pos);

  // Cross-month range detected
  if (foundMonths.length >= 2) {
    const m1 = foundMonths[0];
    const m2 = foundMonths[1];

    // Extract day associated with month 1 (looking before month 1)
    const textBeforeM1 = textWithoutYear.substring(0, m1.pos);
    const dayMatches1 = Array.from(textBeforeM1.matchAll(/\b([1-9]|[12]\d|3[0-2])\b/g));
    const startDay = dayMatches1.length > 0 ? parseInt(dayMatches1[dayMatches1.length - 1][1], 10) : 1;

    // Extract day associated with month 2 (looking between month 1 and month 2)
    const textBetween = textWithoutYear.substring(m1.pos + m1.matchedLength, m2.pos);
    const dayMatches2 = Array.from(textBetween.matchAll(/\b([1-9]|[12]\d|3[0-2])\b/g));
    const endDay = dayMatches2.length > 0 ? parseInt(dayMatches2[dayMatches2.length - 1][1], 10) : 1;

    const formatted = formatLoreDate(
      startDay,
      endDay,
      m1.month.name,
      parsedStartYear,
      fallbackSuffix,
      m2.month.name,
      parsedEndYear
    );

    return {
      startDay,
      endDay,
      monthName: m1.month.name,
      monthIndex: m1.monthIndex,
      endMonthName: m2.month.name,
      endMonthIndex: m2.monthIndex,
      year: parsedStartYear,
      endYear: parsedEndYear,
      hasExplicitYear,
      formatted,
      isCrossMonth: true,
    };
  }

  // Single month (either single day or same-month range)
  let foundMonthIndex = -1;
  let foundMonth = months[0];

  if (foundMonths.length === 1) {
    foundMonthIndex = foundMonths[0].monthIndex;
    foundMonth = foundMonths[0].month;
  } else {
    // Check numeric slash format like "15/2" or "28/1 - 3/2"
    const crossSlashMatch = norm.match(/(\d{1,2})\s*[/.-]\s*(\d{1,2})\s*(?:-|–|—|\.\.|al)\s*(\d{1,2})\s*[/.-]\s*(\d{1,2})/);
    if (crossSlashMatch) {
      const sDay = parseInt(crossSlashMatch[1], 10);
      const sMNum = parseInt(crossSlashMatch[2], 10);
      const eDay = parseInt(crossSlashMatch[3], 10);
      const eMNum = parseInt(crossSlashMatch[4], 10);

      if (sMNum >= 1 && sMNum <= months.length && eMNum >= 1 && eMNum <= months.length) {
        const sm = months[sMNum - 1];
        const em = months[eMNum - 1];
        const formatted = formatLoreDate(sDay, eDay, sm.name, parsedStartYear, fallbackSuffix, em.name, parsedEndYear);
        return {
          startDay: sDay,
          endDay: eDay,
          monthName: sm.name,
          monthIndex: sMNum - 1,
          endMonthName: em.name,
          endMonthIndex: eMNum - 1,
          year: parsedStartYear,
          endYear: parsedEndYear,
          hasExplicitYear,
          formatted,
          isCrossMonth: true,
        };
      }
    }

    const singleSlashMatch = norm.match(/(\d{1,2})\s*[/.-]\s*(\d{1,2})/);
    if (singleSlashMatch) {
      const d = parseInt(singleSlashMatch[1], 10);
      const mNum = parseInt(singleSlashMatch[2], 10);
      if (mNum >= 1 && mNum <= months.length) {
        foundMonthIndex = mNum - 1;
        foundMonth = months[foundMonthIndex];
      }
    }
  }

  if (foundMonthIndex === -1) {
    return null;
  }

  // 3. Identify Day / Day Range for single month
  let startDay: number | undefined;
  let endDay: number | undefined;

  // Check ranges like "15-18", "15 - 18", "15..18", "dal 15 al 18"
  const rangeMatch = textWithoutYear.match(/(\d{1,2})\s*(?:-|–|—|\.\.|al|fino al)\s*(\d{1,2})/);
  if (rangeMatch) {
    const s = parseInt(rangeMatch[1], 10);
    const e = parseInt(rangeMatch[2], 10);
    if (!isNaN(s) && !isNaN(e) && s >= 1 && s <= (foundMonth?.days || 32)) {
      startDay = s;
      endDay = e >= s ? e : undefined;
    }
  }

  // Check single day like "giorno 15", "il 15", "15 alturiak", "15"
  if (startDay === undefined) {
    const singleMatch = textWithoutYear.match(/(?:giorno|giorni|il|del)?\s*\b([1-9]|[12]\d|3[0-2])\b/);
    if (singleMatch) {
      const d = parseInt(singleMatch[1], 10);
      if (!isNaN(d) && d >= 1 && d <= (foundMonth?.days || 32)) {
        startDay = d;
      }
    }
  }

  if (startDay === undefined) {
    startDay = 1;
  }

  const formatted = formatLoreDate(
    startDay,
    endDay,
    foundMonth.name,
    parsedStartYear,
    fallbackSuffix
  );

  return {
    startDay,
    endDay,
    monthName: foundMonth.name,
    monthIndex: foundMonthIndex,
    year: parsedStartYear,
    hasExplicitYear,
    formatted,
    isCrossMonth: false,
  };
}

/**
 * Format a lore date into a human readable standard campaign string.
 * Supports cross-month and cross-year formatting.
 */
export function formatLoreDate(
  startDay: number,
  endDay: number | undefined,
  monthName: string,
  year: number,
  yearSuffix = 'CV',
  endMonthName?: string,
  endYear?: number
): string {
  const isCrossMonth = Boolean(endMonthName && endMonthName.toLowerCase() !== monthName.toLowerCase());
  const isCrossYear = Boolean(endYear && endYear !== year);

  if (isCrossMonth || isCrossYear) {
    const targetEndMonth = endMonthName || monthName;
    const targetEndYear = endYear || year;

    if (isCrossYear) {
      return `Dal ${startDay} ${monthName} ${year} al ${endDay || 1} ${targetEndMonth} ${targetEndYear} ${yearSuffix}`;
    }
    return `Dal ${startDay} ${monthName} al ${endDay || 1} ${targetEndMonth}, ${year} ${yearSuffix}`;
  }

  if (endDay !== undefined && endDay > startDay) {
    return `Giorni ${startDay}-${endDay} di ${monthName}, ${year} ${yearSuffix}`;
  }
  return `Giorno ${startDay} di ${monthName}, ${year} ${yearSuffix}`;
}

/**
 * Determines whether an entity (session, event, or memory) matches a specific calendar day & month.
 * Fully supports multi-month and multi-day spans.
 */
export function matchesLoreDayAndMonth(
  item: {
    loreDate?: string;
    loreStartDay?: number;
    loreEndDay?: number;
    loreMonth?: string;
    loreEndMonth?: string;
    loreYear?: number;
    loreEndYear?: number;
  },
  targetDay: number,
  targetMonth: CalendarMonth,
  targetMonthIndex: number,
  allMonths: CalendarMonth[],
  targetYear?: number
): boolean {
  if (!targetMonth) return false;

  // Year verification: if targetYear is specified, verify that the item's explicit year matches targetYear
  if (targetYear !== undefined) {
    let itemStartYear: number | undefined = item.loreYear;
    let itemEndYear: number | undefined = item.loreEndYear;

    if (item.loreDate && item.loreDate.trim()) {
      const parsed = parseLoreDateString(item.loreDate, allMonths);
      if (parsed && parsed.hasExplicitYear) {
        itemStartYear = parsed.year;
        itemEndYear = parsed.endYear || parsed.year;
      }
    }

    if (itemStartYear !== undefined) {
      const maxYear = itemEndYear !== undefined ? itemEndYear : itemStartYear;
      if (targetYear < itemStartYear || targetYear > maxYear) {
        return false;
      }
    }
  }

  const targetMonthFullName = normalizeText(targetMonth.name);
  const targetMonthMainName = normalizeText(targetMonth.name.split('(')[0]);
  const targetMonthSubtitle = targetMonth.name.includes('(')
    ? normalizeText(targetMonth.name.split('(')[1])
    : '';

  const checkMonthMatch = (mInput: string | undefined, month: CalendarMonth, mIdx: number) => {
    if (!mInput) return false;
    const norm = normalizeText(mInput);
    const mFullName = normalizeText(month.name);
    const mMain = normalizeText(month.name.split('(')[0]);
    const mSub = month.name.includes('(') ? normalizeText(month.name.split('(')[1]) : '';

    return (
      norm === mFullName ||
      norm === month.id?.toLowerCase() ||
      (mMain && (norm === mMain || norm.includes(mMain) || mMain.includes(norm))) ||
      (mSub && (norm === mSub || norm.includes(mSub) || mSub.includes(norm))) ||
      norm === String(mIdx) ||
      norm === String(mIdx + 1) ||
      norm.includes(`mese ${mIdx + 1}`) ||
      norm.includes(`mese #${mIdx + 1}`)
    );
  };

  const isTargetMonth = (mInput: string | undefined) => {
    return checkMonthMatch(mInput, targetMonth, targetMonthIndex);
  };

  // 1. Text-based Lore Date Match (Highest accuracy for human-readable dates like "Giorno 22 di Operam")
  if (item.loreDate && item.loreDate.trim()) {
    const parsed = parseLoreDateString(item.loreDate, allMonths);
    if (parsed) {
      if (parsed.isCrossMonth && parsed.endMonthIndex !== undefined) {
        const startMonthMatches = parsed.monthIndex === targetMonthIndex;
        const endMonthMatches = parsed.endMonthIndex === targetMonthIndex;

        if (startMonthMatches) return targetDay >= parsed.startDay;
        if (endMonthMatches) return targetDay <= (parsed.endDay || 32);

        if (parsed.monthIndex < parsed.endMonthIndex) {
          if (targetMonthIndex > parsed.monthIndex && targetMonthIndex < parsed.endMonthIndex) return true;
        } else if (parsed.monthIndex > parsed.endMonthIndex) {
          if (targetMonthIndex > parsed.monthIndex || targetMonthIndex < parsed.endMonthIndex) return true;
        }
        return false;
      }

      // Single month match
      const monthMatches =
        parsed.monthIndex === targetMonthIndex ||
        checkMonthMatch(parsed.monthName, targetMonth, targetMonthIndex);

      if (!monthMatches) return false; // Strictly restrict to the matched month!

      if (parsed.endDay && parsed.endDay >= parsed.startDay) {
        return targetDay >= parsed.startDay && targetDay <= parsed.endDay;
      }
      return parsed.startDay === targetDay;
    }
  }

  // 2. Structured Properties Match
  if (item.loreMonth || item.loreStartDay !== undefined) {
    if (!item.loreMonth) {
      // If loreMonth is completely omitted and text didn't match, do not repeat across all months
      return false;
    }

    const startMonthMatches = isTargetMonth(item.loreMonth);
    const endMonthMatches = item.loreEndMonth ? isTargetMonth(item.loreEndMonth) : startMonthMatches;

    const sMonthIdx = allMonths.findIndex((m, idx) => checkMonthMatch(item.loreMonth, m, idx));
    const eMonthIdx = item.loreEndMonth
      ? allMonths.findIndex((m, idx) => checkMonthMatch(item.loreEndMonth, m, idx))
      : sMonthIdx;

    if (sMonthIdx !== -1 && eMonthIdx !== -1 && sMonthIdx !== eMonthIdx) {
      if (startMonthMatches) {
        return item.loreStartDay !== undefined ? targetDay >= item.loreStartDay : true;
      }
      if (endMonthMatches) {
        return item.loreEndDay !== undefined ? targetDay <= item.loreEndDay : true;
      }
      if (sMonthIdx < eMonthIdx && targetMonthIndex > sMonthIdx && targetMonthIndex < eMonthIdx) return true;
      if (sMonthIdx > eMonthIdx && (targetMonthIndex > sMonthIdx || targetMonthIndex < eMonthIdx)) return true;
    } else if (startMonthMatches) {
      if (item.loreStartDay !== undefined) {
        if (item.loreEndDay !== undefined && item.loreEndDay >= item.loreStartDay) {
          return targetDay >= item.loreStartDay && targetDay <= item.loreEndDay;
        }
        return item.loreStartDay === targetDay;
      }
      return true;
    }
  }

  return false;
}

/**
 * Calculates a numerical sort value for any object with lore date metadata or loreDate string.
 * Format: Year * 10000 + MonthIndex * 100 + Day
 */
export function getLoreDateSortValue(
  item: {
    loreYear?: number;
    loreMonth?: string;
    loreStartDay?: number;
    loreDate?: string;
  },
  months: CalendarMonth[] = []
): number {
  if (!item) return 0;
  let year = item.loreYear;
  let monthIdx = 0;
  let day = item.loreStartDay || 1;

  if (year === undefined && item.loreDate) {
    const parsed = parseLoreDateString(item.loreDate, months);
    if (parsed) {
      year = parsed.year;
      monthIdx = parsed.monthIndex;
      day = parsed.startDay;
    }
  } else if (item.loreMonth && months.length > 0) {
    const norm = normalizeText(item.loreMonth);
    const foundIdx = months.findIndex(
      (m) =>
        normalizeText(m.name).includes(norm) ||
        norm.includes(normalizeText(m.name))
    );
    if (foundIdx !== -1) monthIdx = foundIdx;
  }

  const finalYear = year !== undefined ? year : 0;
  return finalYear * 10000 + (monthIdx + 1) * 100 + day;
}

/**
 * Sorts any array of items with lore dates in ascending chronological order.
 */
export function sortItemsByLoreDate<
  T extends {
    loreYear?: number;
    loreMonth?: string;
    loreStartDay?: number;
    loreDate?: string;
  }
>(items: T[], months: CalendarMonth[] = []): T[] {
  return [...items].sort(
    (a, b) => getLoreDateSortValue(a, months) - getLoreDateSortValue(b, months)
  );
}

