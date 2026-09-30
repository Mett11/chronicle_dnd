const matchesDayAndMonth = (
    dateStr,
    startDay,
    endDay,
    monthName,
    targetDay,
    targetMonthName
  ) => {
    if (!targetMonthName) return false;
    const normTargetMonth = targetMonthName.toLowerCase().trim();
    const baseTargetMonth = normTargetMonth.split('(')[0].trim();

    // 1. Explicit month & day range matching (from Session structured data)
    if (monthName && monthName.toLowerCase().trim() === normTargetMonth) {
      if (startDay !== undefined && endDay !== undefined) {
        if (targetDay >= startDay && targetDay <= endDay) return true;
      } else if (startDay !== undefined && startDay === targetDay) {
        return true;
      }
    }

    // 2. Free text lore date string matching
    if (dateStr) {
      const normDate = dateStr.toLowerCase();
      if (normDate.includes(baseTargetMonth) || normDate.includes(normTargetMonth)) {
        // Match day range: e.g. "14-16"
        const rangeMatch = normDate.match(/(\d{1,2})\s*[-–—]\s*(\d{1,2})/);
        if (rangeMatch) {
          const s = parseInt(rangeMatch[1]);
          const e = parseInt(rangeMatch[2]);
          if (!isNaN(s) && !isNaN(e) && targetDay >= s && targetDay <= e) {
            return true;
          }
        }

        // Match standalone day number (e.g., "15", "05", "giorno 15")
        // Use word boundary but also allow leading zero
        const singleMatch = normDate.match(new RegExp(`\\b0?${targetDay}\\b`));
        if (singleMatch) {
          return true;
        }

        // If lore date only names the month without ANY number, assign to day 1 as month overview
        if (!normDate.match(/\d{1,2}/) && targetDay === 1) {
          return true;
        }
      }
    }

    return false;
  };

console.log(matchesDayAndMonth("15 di alturiak", 15, undefined, "Alturiak (Artiglio d'Inverno)", 15, "Alturiak (Artiglio d'Inverno)")); // expected true
console.log(matchesDayAndMonth("15 di alturiak", undefined, undefined, undefined, 15, "Alturiak (Artiglio d'Inverno)")); // expected true

