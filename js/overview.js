// overview.js
// 出身、區域、據點的一覽顯示與行內編輯

// ---------- 出身／區域／據點一覽 ----------
function renderOptionOverview() {
  const box = $("optionOverview");
  if (!box) return;
  let html = "";

  // 出身列表（可點擊修改）
  let originHtml = "";
  if (state.originOptions && state.originOptions.length) {
    originHtml = state.originOptions.map((name, idx) => 
      `<span class="option-edit" data-opt-type="origin" data-origin-index="${idx}">${name}</span>`
    ).join("、 ");
  } else {
    originHtml = "尚無出身紀錄。";
  }
  html += `<div class="detail-section">
    <div class="detail-label">家族出身列表</div>
    <div class="detail-value">${originHtml}</div>
  </div>`;

  // 區域列表（可點擊修改名稱）
  let regionHtml = "";
  if (state.regions && state.regions.length) {
    regionHtml = state.regions.map(r =>
      `<span class="option-edit" data-opt-type="region" data-region-id="${r.id}">${r.name}</span>`
    ).join("、 ");
  } else {
    regionHtml = "尚無區域資料。";
  }
  html += `<div class="detail-section">
    <div class="detail-label">世界區域列表</div>
    <div class="detail-value">${regionHtml}</div>
  </div>`;

  // 據點列表，依區域分組（可點擊修改名稱）
  const byRegion = {};
  (state.territoryOptions || []).forEach(t => {
    const key = t.regionId || "未指定區域";
    if (!byRegion[key]) byRegion[key] = [];
    byRegion[key].push(t);
  });

  html += `<div class="detail-section">
    <div class="detail-label">據點／領地列表</div>
  `;

  Object.keys(byRegion).forEach(key => {
    const rName = key === "未指定區域" ? key : (getRegionName(key) || key);
    const terrHtml = byRegion[key].map(t =>
      `<span class="option-edit" data-opt-type="territory" data-territory-name="${t.name}" data-region-id="${t.regionId || ""}">${t.name}</span>`
    ).join("、 ");
    html += `<div class="detail-value">${rName}：${terrHtml}</div>`;
  });

  html += `</div>`;
  box.innerHTML = html;
}

// 點擊出身／區域／據點文字以修改名稱
function handleOptionEditClick(target) {
  if (!target || !target.classList.contains("option-edit")) return;
  const type = target.dataset.optType;
  if (!type) return;
  const oldName = (target.textContent || "").trim();
  if (!oldName) return;

  const labelMap = {
    origin: "出身名稱",
    region: "區域名稱",
    territory: "據點／領地名稱"
  };
  const label = labelMap[type] || "名稱";
  const newName = prompt(`請輸入新的${label}：`, oldName);
  if (!newName) return;
  const trimmed = newName.trim();
  if (!trimmed || trimmed === oldName) return;

  if (type === "origin") {
    const idx = (state.originOptions || []).indexOf(oldName);
    if (idx >= 0) {
      state.originOptions[idx] = trimmed;
      (state.families || []).forEach(f => {
        if (f.origin === oldName) f.origin = trimmed;
      });
    }
  } else if (type === "region") {
    const id = target.dataset.regionId;
    const r = (state.regions || []).find(x => x.id === id);
    if (r) {
      r.name = trimmed;
    }
  } else if (type === "territory") {
    const terrName = target.dataset.territoryName || oldName;
    const terr = (state.territoryOptions || []).find(t => t.name === terrName);
    if (terr) {
      terr.name = trimmed;
      (state.families || []).forEach(f => {
        if (f.territory === terrName) f.territory = trimmed;
      });
      (state.persons || []).forEach(p => {
        if (p.residence === terrName) p.residence = trimmed;
      });
    }
  }

  // 重新整理相關下拉選單與畫面
  if (typeof renderOptionSelects === "function") renderOptionSelects();
  if (typeof renderOptionOverview === "function") renderOptionOverview();
  if (typeof renderFamilyList === "function") renderFamilyList();
  if (typeof renderPersonList === "function") renderPersonList();
  if (typeof renderRegions === "function") renderRegions();
  if (typeof saveState === "function") saveState();
  if (typeof advisorSay === "function") {
    advisorSay(`已更新${label}：「${oldName}」→「${trimmed}」。`);
  }
}
