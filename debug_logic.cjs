function matchesDayAndMonth(
  dateStr,
  startDay,
  endDay,
  monthName,
  targetDay,
  targetMonthName
) {
  if (!targetMonthName) return false;
  const normTargetMonth = targetMonthName.toLowerCase().trim();
  const baseTargetMonth = normTargetMonth.split('(')[0].trim();

  // 1. Evaluate explicit overrides in free text
  if (dateStr) {
    const normDate = dateStr.toLowerCase();
    
    const containsTargetMonth = normDate.includes(baseTargetMonth) || normDate.includes(normTargetMonth);
    const inheritedMatchesTargetMonth = monthName && monthName.toLowerCase().trim() === normTargetMonth;

    const rangeMatch = normDate.match(/(\d{1,2})\s*[-–—]\s*(\d{1,2})/);
    const singleMatch = normDate.match(new RegExp(`\\b0?${targetDay}\\b`));
    const hasAnyNumber = /\d{1,2}/.test(normDate);
    
    if (hasAnyNumber) {
      if (containsTargetMonth || inheritedMatchesTargetMonth) {
        if (rangeMatch) {
          const s = parseInt(rangeMatch[1]);
          const e = parseInt(rangeMatch[2]);
          if (!isNaN(s) && !isNaN(e) && targetDay >= s && targetDay <= e) {
            return true;
          }
        }
        if (singleMatch) {
          return true;
        }
      }
      // Explicit number provided, but didn't match targetDay, or didn't match month. Override fallback.
      return false;
    }
    
    // Month mentioned without numbers = month overview
    if (containsTargetMonth && targetDay === 1) {
      return true;
    }
  }

  // 2. Fallback to inherited session structure
  if (monthName && monthName.toLowerCase().trim() === normTargetMonth) {
    if (startDay !== undefined && endDay !== undefined) {
      if (targetDay >= startDay && targetDay <= endDay) return true;
    } else if (startDay !== undefined && startDay === targetDay) {
      return true;
    }
  }

  return false;
}

console.log("Session on Day 15, Event says '16', Target 16:", matchesDayAndMonth("16", 15, undefined, "Alturiak", 16, "Alturiak")); // true
console.log("Session on Day 15, Event says '16', Target 15:", matchesDayAndMonth("16", 15, undefined, "Alturiak", 15, "Alturiak")); // false
console.log("Session on Day 15, Event says 'Notte', Target 15:", matchesDayAndMonth("Notte", 15, undefined, "Alturiak", 15, "Alturiak")); // true
console.log("Session on Day 15, Event says '14-16', Target 15:", matchesDayAndMonth("14-16", 15, undefined, "Alturiak", 15, "Alturiak")); // true
