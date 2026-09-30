const fs = require('fs');
let code = fs.readFileSync('src/pages/Calendar.tsx', 'utf8');

const targetStr = `  // Helper to check if an in-lore date matches a specific day and month
  const matchesDayAndMonth = (
    dateStr: string | undefined,
    startDay: number | undefined,
    endDay: number | undefined,
    monthName: string | undefined,
    targetDay: number,
    targetMonthName: string
  ): boolean => {
    if (!targetMonthName) return false;
    const normTargetMonth = targetMonthName.toLowerCase().trim();`;

const newStr = `  // Helper to check if an in-lore date matches a specific day and month
  const matchesDayAndMonth = (
    dateStr: string | undefined,
    startDay: number | undefined,
    endDay: number | undefined,
    monthName: string | undefined,
    targetDay: number,
    targetMonthName: string
  ): boolean => {
    if (!targetMonthName) return false;
    const normTargetMonth = targetMonthName.toLowerCase().trim();
    const baseTargetMonth = normTargetMonth.split('(')[0].trim();`;

code = code.replace(targetStr, newStr);

const includesStr = `    // 2. Free text lore date string matching
    if (dateStr) {
      const normDate = dateStr.toLowerCase();
      if (normDate.includes(normTargetMonth)) {`;

const newIncludesStr = `    // 2. Free text lore date string matching
    if (dateStr) {
      const normDate = dateStr.toLowerCase();
      if (normDate.includes(baseTargetMonth) || normDate.includes(normTargetMonth)) {`;

code = code.replace(includesStr, newIncludesStr);

// Also we should fix the `loreMeta` wipe bug in `Sessions.tsx`!
// Let's do Calendar first.
fs.writeFileSync('src/pages/Calendar.tsx', code);
