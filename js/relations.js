// relations.js
// 親子關係整理、父母規則

// ---------- 關係整理與父母規則 ----------
function normalizeRelations() {
  const byId = {};
  state.persons.forEach(p => {
    byId[p.id] = p;
    if (!Array.isArray(p.parentIds)) p.parentIds = [];
    if (!Array.isArray(p.childIds)) p.childIds = [];
    if (!Array.isArray(p.spouseIds)) p.spouseIds = [];
    if (!Array.isArray(p.spouseRelations)) p.spouseRelations = [];
  });

  state.persons.forEach(p => {
    p.parentIds = p.parentIds.filter(id => byId[id]);
    p.childIds = p.childIds.filter(id => byId[id]);
  });

  state.persons.forEach(p => {
    p.parentIds.forEach(pid => {
      const parent = byId[pid];
      if (parent && !parent.childIds.includes(p.id)) parent.childIds.push(p.id);
    });
    p.childIds.forEach(cid => {
      const child = byId[cid];
      if (child && !child.parentIds.includes(p.id)) child.parentIds.push(p.id);
    });
  });
}




function linkParentChild(parent, child, opts) {
  const o = opts || {};
  if (!parent || !child) return false;

  const parents = (child.parentIds || []).map(id => state.persons.find(p => p.id === id)).filter(Boolean);
  const sameFam = parents.find(pp =>
    pp.id !== parent.id &&
    pp.familyId &&
    parent.familyId &&
    pp.familyId === parent.familyId
  );
  if (sameFam && !o.ignoreRule) {
    if (!o.silent) {
      advisorSay(`依家主規則，父母需來自不同家族。「${child.name}」已有一位來自「${getFamilyNameById(sameFam.familyId)}」的父母，此次連結未建立。`);
    }
    return false;
  }

  if (!child.parentIds.includes(parent.id)) child.parentIds.push(parent.id);
  if (!parent.childIds.includes(child.id)) parent.childIds.push(child.id);
  return true;
}

