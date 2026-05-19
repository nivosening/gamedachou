// options.js
// 各種選項(出身、區域、據點、身分、職業、住所)的渲染與新增

// ---------- 選項渲染 ----------
function renderRegionSelects() {
  const regionSelects = ["familyRegion","quickRegion","eventRegion"];
  regionSelects.forEach(id => {
    const sel = $(id);
    if (!sel) return;
    sel.innerHTML = "";
    const opt0 = document.createElement("option");
    if (id === "eventRegion") {
      opt0.value = "";
      opt0.textContent = "不限區域";
    } else {
      opt0.value = "";
      opt0.textContent = "未指定";
    }
    sel.appendChild(opt0);
    state.regions.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = r.name;
      sel.appendChild(opt);
    });
  });
}

function renderOptionSelects(){

  // HYBRID: update datalists (keep for robustness, but prefer select updates below)
  const roleList = document.getElementById("roleList");
  if(roleList){
    roleList.innerHTML = state.roleOptions.map(o=>`<option value="${o}"></option>`).join("");
  }
  const occList = document.getElementById("occList");
  if(occList){
    occList.innerHTML = state.occOptions.map(o=>`<option value="${o}"></option>`).join("");
  }
  const resList = document.getElementById("resList");
  if(resList){
    resList.innerHTML = state.resOptions.map(o=>`<option value="${o}"></option>`).join("");
  }

  const originSel = $("familyOrigin");
  const quickOriginSel = $("quickOrigin");
  const terrSel = $("familyTerritory");
  const quickTerrSel = $("quickTerritory");
  const occSel = $("personOcc");
  const resSel = $("personRes");
  
  // Update the personRole select/input
  const roleSel = $("personRole");
  if(roleSel){
    roleSel.innerHTML = "";
    const ro0 = document.createElement("option");
    ro0.value = ""; ro0.textContent = "未標註";
    roleSel.appendChild(ro0);
    state.roleOptions.forEach(o => {
      const opt = document.createElement("option");
      opt.value = o; opt.textContent = o;
      roleSel.appendChild(opt);
    });
  }

  originSel.innerHTML = "";
  quickOriginSel.innerHTML = "";
  const o0 = document.createElement("option");
  o0.value = "";
  o0.textContent = "未指定";
  originSel.appendChild(o0);
  const o1 = document.createElement("option");
  o1.value = "";
  o1.textContent = "（留白）";
  quickOriginSel.appendChild(o1);
  state.originOptions.forEach(o => {
    const a = document.createElement("option");
    a.value = o; a.textContent = o;
    originSel.appendChild(a);
    const b = document.createElement("option");
    b.value = o; b.textContent = o;
    quickOriginSel.appendChild(b);
  });

  // v6+:家族門第下拉
  const standingSel = $("familyStanding");
  if (standingSel) {
    standingSel.innerHTML = "";
    DEFAULT_STANDINGS.forEach(s => {
      const opt = document.createElement("option");
      opt.value = s; opt.textContent = s;
      standingSel.appendChild(opt);
    });
    standingSel.value = "尋常人家";  // 預設
  }

  terrSel.innerHTML = "";
  quickTerrSel.innerHTML = "";
  const t0 = document.createElement("option");
  t0.value = "";
  t0.textContent = "未定";
  terrSel.appendChild(t0);
  const t1 = document.createElement("option");
  t1.value = "";
  t1.textContent = "（留白）";
  quickTerrSel.appendChild(t1);
  state.territoryOptions.forEach(t => {
    const a = document.createElement("option");
    a.value = t.name; a.textContent = `${t.name}（${getRegionName(t.regionId) || "區域未定"}）`;
    terrSel.appendChild(a);
    const b = document.createElement("option");
    b.value = t.name; b.textContent = `${t.name}（${getRegionName(t.regionId) || "區域未定"}）`;
    quickTerrSel.appendChild(b);
  });

  occSel.innerHTML = "";
  const oc0 = document.createElement("option");
  oc0.value = ""; oc0.textContent = "未記載";
  occSel.appendChild(oc0);
  state.occOptions.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o; opt.textContent = o;
    occSel.appendChild(opt);
  });

  resSel.innerHTML = "";
  const r0 = document.createElement("option");
  r0.value = ""; r0.textContent = "未記載";
  resSel.appendChild(r0);
  state.resOptions.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o; opt.textContent = o;
    resSel.appendChild(opt);
  });

  renderAdvisorLocationSelect();
  renderOptionOverview();
}

function addOrigin(value) {
  const v = (value || "").trim();
  if (!v) return;
  if (!state.originOptions.includes(v)) {
    state.originOptions.push(v);
    saveState();
    renderOptionSelects();
    advisorSay(`已將「${v}」加入家族出身選項。`);
  }
}

function addRole(value) {
  const v = (value || "").trim();
  if (!v) return;
  if (!state.roleOptions.includes(v)) {
    state.roleOptions.push(v);
    saveState();
    renderOptionSelects();
    advisorSay(`已將「${v}」加入人物身分選項。`);
  }
}

function addOcc(value) {
  const v = (value || "").trim();
  if (!v) return;
  if (!state.occOptions.includes(v)) {
    state.occOptions.push(v);
    saveState();
    renderOptionSelects();
    advisorSay(`已將「${v}」加入人物職業選項。`);
  }
}

function addRes(value) {
  const v = (value || "").trim();
  if (!v) return;
  if (!state.resOptions.includes(v)) {
    state.resOptions.push(v);
    saveState();
    renderOptionSelects();
    advisorSay(`已將「${v}」加入人物居所選項。`);
  }
}

function addTerritory(value, regionId) {
  const v = (value || "").trim();
  if (!v) return;
  const rId = regionId || "";
  if (!rId) {
    alert("請先選擇區域，再新增據點。");
    return;
  }
  const result = ensureTerritoryForRegion(v, rId);
  if (result === null) return;
  saveState();
  renderOptionSelects();
  advisorSay(`已在「${getRegionName(rId) || rId}」下新增據點「${v}」。`);
}

function renderAdvisorLocationSelect() {
  const sel = $("advisorLocation");
  sel.innerHTML = "";
  const def = document.createElement("option");
  def.value = "";
  def.textContent = "選擇地點／區域";
  sel.appendChild(def);
  const set = new Set();
  state.regions.forEach(r => set.add(r.name));
  state.territoryOptions.forEach(t => set.add(t.name));
  state.resOptions.forEach(r => set.add(r));
  state.families.forEach(f => {
    if (f.territory) set.add(f.territory);
    if (f.name) set.add(f.name);
  });
  state.persons.forEach(p => {
    if (p.residence) set.add(p.residence);
  });
  Array.from(set).forEach(loc => {
    const opt = document.createElement("option");
    opt.value = loc;
    opt.textContent = loc;
    sel.appendChild(opt);
  });
}

