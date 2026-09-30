const fs = require('fs');
let code = fs.readFileSync('src/components/Layout.tsx', 'utf8');

const regexToReplace = /<>\n          \{React\.cloneElement\(content as React\.ReactElement, \{\n            children: \(\n              <>\n                <div className=\{`p-2\.5 rounded-2xl transition-all duration-300 \$\{routeActive \? 'bg-white\/15 text-white shadow-sm shadow-inner scale-110' : 'text-white\/60 hover:bg-white\/5 hover:text-white hover:scale-110'\}`\}>\n                  <Icon size=\{20\} strokeWidth=\{routeActive \? 2\.5 : 2\} \/>\n                <\/div>\n                <span className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-\[10px\] font-bold px-2 py-1 rounded-md pointer-events-none whitespace-nowrap shadow-lg border border-\[#222\]">\n                  \{label\}\n                <\/span>\n              <\/>\n            \)\n          \}\)\}\n          \{routeActive && <div className="absolute -bottom-1\.5 left-1\/2 -translate-x-1\/2 w-1 h-1 rounded-full bg-white shadow-\[0_0_8px_#fff\]" \/>\}\n        <\/>/m;

// Just render the content manually based on routeActive instead of `cloneElement` with children on a div...
const replacement = `<>
          <div className="flex flex-col items-center gap-1 group relative">
            <div className={\`p-2.5 rounded-2xl transition-all duration-300 \${routeActive ? 'bg-white/15 text-white shadow-sm shadow-inner scale-110' : 'text-white/60 hover:bg-white/5 hover:text-white hover:scale-110'}\`}>
              <Icon size={20} strokeWidth={routeActive ? 2.5 : 2} />
            </div>
            <span className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] font-bold px-2 py-1 rounded-md pointer-events-none whitespace-nowrap shadow-lg border border-[#222]">
              {label}
            </span>
          </div>
          {routeActive && <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-white shadow-[0_0_8px_#fff]" />}
        </>`;

code = code.replace(regexToReplace, replacement);

fs.writeFileSync('src/components/Layout.tsx', code);
