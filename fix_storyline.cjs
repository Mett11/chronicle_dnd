const fs = require('fs');
let content = fs.readFileSync('src/pages/Storyline.tsx', 'utf8');

if (!content.includes('useAuth')) {
    content = content.replace("import { useState, useMemo, useEffect, useRef } from 'react';", "import { useState, useMemo, useEffect, useRef } from 'react';\nimport { useAuth } from '../components/AuthProvider';");
}

content = content.replace("export function Storyline() {", "export function Storyline() {\n  const { player } = useAuth();");

const targetStr = `  const entityMap = useMemo(() => {
    const map = new Map<string, Entity>();
    entities.forEach((e) => map.set(e._id, e));
    return map;
  }, [entities]);`;

const replacement = `  const entityMap = useMemo(() => {
    const map = new Map<string, Entity>();
    entities.forEach((e) => {
      // Privacy filter
      if (e.type === 'quest' && e.questScope === 'personal') {
        if (e.assigneePlayerId !== player?._id && !(e.sharedWithDm && player?.isDm)) {
          return; // Skip adding this to the map
        }
      }
      map.set(e._id, e);
    });
    return map;
  }, [entities, player]);`;

content = content.replace(targetStr, replacement);
fs.writeFileSync('src/pages/Storyline.tsx', content);
