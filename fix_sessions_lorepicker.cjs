const fs = require('fs');
let code = fs.readFileSync('src/pages/Sessions.tsx', 'utf8');

const target = `<LoreDatePicker
                value={loreDate}
                onChange={(formatted, meta) => {
                  setLoreDate(formatted);
                  setLoreMeta(meta);
                }}
              />`;

const replacement = `<LoreDatePicker
                value={loreDate}
                initialMeta={loreMeta}
                onChange={(formatted, meta) => {
                  setLoreDate(formatted);
                  setLoreMeta(meta);
                }}
              />`;

code = code.replace(target, replacement);

fs.writeFileSync('src/pages/Sessions.tsx', code);
