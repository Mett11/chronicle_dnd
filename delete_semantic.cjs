const fs = require('fs');

let content = fs.readFileSync('src/pages/Search.tsx', 'utf8');

// 1. Remove SearchMode type
content = content.replace(/type SearchMode = 'filters' \| 'semantic';\n/, '');

// 2. Remove semanticScore and semanticReason from SearchResultItem
content = content.replace(/  semanticScore\?: number;\n  semanticReason\?: string;\n/, '');

// 3. Remove searchMode state
content = content.replace(/  \/\/ Search Mode: 'filters' \(Full-text with rich filters\) vs 'semantic' \(AI-powered semantic search & Q&A\)\n  const \[searchMode, setSearchMode\] = useState<SearchMode>\('filters'\);\n/, '');

// 4. Remove Semantic AI Search State variables
content = content.replace(/  \/\/ Semantic AI Search State\n  const \[semanticQuery, setSemanticQuery\] = useState\(''\);\n  const \[isSemanticLoading, setIsSemanticLoading\] = useState\(false\);\n  const \[semanticSummary, setSemanticSummary\] = useState<string \| null>\(null\);\n  const \[semanticResults, setSemanticResults\] = useState<SearchResultItem\[\]>\(\[\]\);\n  const \[semanticError, setSemanticError\] = useState<string \| null>\(null\);\n  const \[semanticModelUsed, setSemanticModelUsed\] = useState<string \| null>\(null\);\n/, '');

// 5. Remove executeLocalSemanticSearch and handlePerformSemanticSearch (lines 730 to 860ish)
const startIdx = content.indexOf('  // Trigger Local Semantic Search Fallback');
const endIdx = content.indexOf('  const getTypeIcon =');
if (startIdx !== -1 && endIdx !== -1) {
    content = content.slice(0, startIdx) + content.slice(endIdx);
}

// 6. Remove semantic references from Search UI header text
content = content.replace(/Esplora l'intero diario, le sessioni e il Codex con filtri temporali sulla lore, PG e intelligenza semantica./, "Esplora l'intero diario, le sessioni e il Codex con filtri temporali sulla lore e sui personaggi.");

// 7. Remove Mode Switch buttons (the div after title)
const modeSwitchStart = content.indexOf('        {/* Mode Switch: Standard Full-Text with Filters vs AI Semantic Search */}');
const modeSwitchEnd = content.indexOf('      {/* ========================================================================= */}');
if (modeSwitchStart !== -1 && modeSwitchEnd !== -1) {
    content = content.slice(0, modeSwitchStart) + content.slice(modeSwitchEnd);
}

// 8. Remove the '{searchMode === 'filters' && (' wrapper and its closing ')}' 
// First, find and replace the start of MODE 1 wrapper
content = content.replace(/      \{\/\* ========================================================================= \*\/\}\n      \{\/\* MODE 1: ADVANCED FULL-TEXT SEARCH WITH EXTENSIVE LORE & PG FILTERS \*\/\}\n      \{\/\* ========================================================================= \*\/\}\n      \{searchMode === 'filters' && \(\n/, '');

// 9. Remove MODE 2 and everything after until the end of the component
const mode2Start = content.indexOf('      {/* ========================================================================= */}\n      {/* MODE 2: AI SEMANTIC SEARCH & NATURAL LANGUAGE Q&A */}');
// we need to remove from the closing brace of MODE 1 to the end of the component (except for `    </div>\n  );\n}`)
const componentEnd = '    </div>\n  );\n}';
if (mode2Start !== -1) {
    // We also want to remove the `      )}\n` just before mode2Start.
    const sliceEnd = content.lastIndexOf('      )}\n', mode2Start);
    if (sliceEnd !== -1) {
        content = content.slice(0, sliceEnd) + componentEnd + '\n';
    } else {
        content = content.slice(0, mode2Start) + componentEnd + '\n';
    }
}

fs.writeFileSync('src/pages/Search.tsx', content);
