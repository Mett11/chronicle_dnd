const fs = require('fs');
let content = fs.readFileSync('src/pages/Entities.tsx', 'utf8');

content = content.replace(
  "  const [newAssigneeId, setNewAssigneeId] = useState<string>(player?._id || '');",
  "  const [newAssigneeId, setNewAssigneeId] = useState<string>(player?._id || '');\n  const [newSharedWithDm, setNewSharedWithDm] = useState<boolean>(false);"
);

content = content.replace(
  "    setNewAssigneeId(ent.assigneePlayerId || player?._id || '');",
  "    setNewAssigneeId(ent.assigneePlayerId || player?._id || '');\n    setNewSharedWithDm(!!ent.sharedWithDm);"
);

content = content.replace(
  "    setNewAssigneeId(player?._id || '');",
  "    setNewAssigneeId(player?._id || '');\n    setNewSharedWithDm(false);"
);

// updateEntity
content = content.replace(
  "        assigneePlayerId: formType === 'quest' && newQuestScope === 'personal' ? newAssigneeId : undefined,",
  "        assigneePlayerId: formType === 'quest' && newQuestScope === 'personal' ? newAssigneeId : undefined,\n        sharedWithDm: formType === 'quest' && newQuestScope === 'personal' ? newSharedWithDm : undefined,"
);

// addEntity
content = content.replace(
  "        assigneePlayerId: formType === 'quest' && newQuestScope === 'personal' ? newAssigneeId : undefined,",
  "        assigneePlayerId: formType === 'quest' && newQuestScope === 'personal' ? newAssigneeId : undefined,\n        sharedWithDm: formType === 'quest' && newQuestScope === 'personal' ? newSharedWithDm : undefined,"
);

// UI additions
const targetUI = `                        </select>
                      </div>
                    )}
                  </div>`;
const replacementUI = `                        </select>
                      </div>
                    )}
                    {formType === 'quest' && newQuestScope === 'personal' && !player?.isDm && (
                      <label className="flex items-center gap-2 cursor-pointer mt-3 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg hover:bg-amber-500/20 transition-colors">
                        <input
                          type="checkbox"
                          checked={newSharedWithDm}
                          onChange={(e) => setNewSharedWithDm(e.target.checked)}
                          className="rounded-[2px] border-amber-500/50 text-amber-600 focus:ring-0"
                        />
                        <span className="font-medium">Condividi visibilità con il Master</span>
                      </label>
                    )}
                  </div>`;
content = content.replace(targetUI, replacementUI);

fs.writeFileSync('src/pages/Entities.tsx', content);
