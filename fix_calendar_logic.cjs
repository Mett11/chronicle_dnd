const fs = require('fs');
let code = fs.readFileSync('src/pages/Calendar.tsx', 'utf8');

const targetLogic = code.match(/const matchesDayAndMonth = \([\s\S]*?return false;\n  \};/);
if (targetLogic) {
  const newLogic = `const matchesDayAndMonth = (
    dateStr: string | undefined,
    startDay: number | undefined,
    endDay: number | undefined,
    monthName: string | undefined,
    targetDay: number,
    targetMonthName: string
  ): boolean => {
    if (!targetMonthName) return false;
    const normTargetMonth = targetMonthName.toLowerCase().trim();
    const baseTargetMonth = normTargetMonth.split('(')[0].trim();

    // 1. Evaluate explicit overrides in free text
    if (dateStr) {
      const normDate = dateStr.toLowerCase();
      
      const containsTargetMonth = normDate.includes(baseTargetMonth) || normDate.includes(normTargetMonth);
      const inheritedMatchesTargetMonth = monthName && monthName.toLowerCase().trim() === normTargetMonth;

      const rangeMatch = normDate.match(/(\\d{1,2})\\s*[-–—]\\s*(\\d{1,2})/);
      const singleMatch = normDate.match(new RegExp(\`\\\\b0?\${targetDay}\\\\b\`));
      const hasAnyNumber = /\\d{1,2}/.test(normDate);
      
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
  };`;

  code = code.replace(targetLogic[0], newLogic);
  fs.writeFileSync('src/pages/Calendar.tsx', code);
  console.log("Success");
} else {
  console.log("Failed to find target");
}
