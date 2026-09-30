const fs = require('fs');
let content = fs.readFileSync('src/pages/Calendar.tsx', 'utf8');

if (!content.includes('useAuth')) {
    content = content.replace("import { useState, useMemo, useEffect } from 'react';", "import { useState, useMemo, useEffect } from 'react';\nimport { useAuth } from '../components/AuthProvider';");
}

content = content.replace("export function CalendarPage() {", "export function CalendarPage() {\n  const { player } = useAuth();");

fs.writeFileSync('src/pages/Calendar.tsx', content);
