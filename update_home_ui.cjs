const fs = require('fs');
let content = fs.readFileSync('src/pages/Home.tsx', 'utf8');

const targetStr = `                      <label className="flex items-center gap-2 cursor-pointer text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-[2px] hover:bg-cyan-500/20 transition-colors">
                        <input
                          type="checkbox"
                          checked={formAskDm}
                          onChange={(e) => setFormAskDm(e.target.checked)}
                          className="rounded-[2px] border-cyan-500/50 text-cyan-600 focus:ring-0"
                        />
                        <HelpCircle size={13} className="text-cyan-400 shrink-0" />
                        <span className="font-medium">Invia al DM (Richiedi Chiarimento)</span>
                      </label>
                    )}`;

const replacement = `                      <label className="flex items-center gap-2 cursor-pointer text-xs text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-[2px] hover:bg-cyan-500/20 transition-colors">
                        <input
                          type="checkbox"
                          checked={formAskDm}
                          onChange={(e) => setFormAskDm(e.target.checked)}
                          className="rounded-[2px] border-cyan-500/50 text-cyan-600 focus:ring-0"
                        />
                        <HelpCircle size={13} className="text-cyan-400 shrink-0" />
                        <span className="font-medium">Invia al DM (Richiedi Chiarimento)</span>
                      </label>
                    )}
                    
                    {!player?.isDm && formVisibility === 'personal' && (
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-[2px] hover:bg-amber-500/20 transition-colors">
                        <input
                          type="checkbox"
                          checked={formDmOnly}
                          onChange={(e) => setFormDmOnly(e.target.checked)}
                          className="rounded-[2px] border-amber-500/50 text-amber-600 focus:ring-0"
                        />
                        <Lock size={13} className="text-amber-400 shrink-0" />
                        <span className="font-medium">Condividi lettura col Master</span>
                      </label>
                    )}`;

content = content.replaceAll(targetStr, replacement);
fs.writeFileSync('src/pages/Home.tsx', content);
