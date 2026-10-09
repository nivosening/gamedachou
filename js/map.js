// map.js
// 世界地圖系統 — 樹狀主軸:區域 → 展開 → 底下有「據點」與「家族」兩塊,
// 都可在區域內新增/編輯。刪除未開放(避免誤刪影響家族成員)。
// 依賴:constants.js / state.js / utils.js / storage.js

// ---------- DOM 參照 ----------
const regionListEl = document.getElementById("regionList");
const modalEl      = document.getElementById("mapModal");
const modalTitleEl = document.getElementById("modalTitle");
const modalBodyEl  = document.getElementById("modalBody");

// ---------- 展開狀態(切換 render 不收起已展開的節點)----------
// 區域 key:   "region:<id>"
// 據點 key:   "terr:<regionId>:<territoryName>"
// 未指定 key: "terr:<regionId>:__none__"
const _mapExpanded = new Set();

// ---------- 共用小工具 ----------
function escHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 顯示家族名(含郡望):從 notes 首段抓「XX{姓}氏」→「{姓}氏({郡名})」;
// 抽不到時只顯示「{姓}氏」(無括號)。
// 不依賴 utils.js — 直接內嵌,避免 utils.js 未更新時郡望顯示不出來。
function famDisplay(f) {
  if (!f) return "";
  const fallback = `${f.name}氏`;
  if (!f.notes) return fallback;
  const firstSeg = f.notes.split(/[。，,.]/)[0] || "";
  const re = new RegExp(`^\\s*(.{1,3})${f.name}氏`);
  const m = firstSeg.match(re);
  if (!m) return fallback;
  const county = (m[1] || "").trim();
  return county ? `${f.name}氏（${county}）` : fallback;
}

// ---------- 主渲染 ----------
// 結構:區域 → (未指定據點家族)+(各據點) → 據點展開顯示駐留家族(含郡望)
function renderList() {
  regionListEl.innerHTML = "";
  const regions = state.regions || [];

  if (!regions.length) {
    regionListEl.innerHTML = `<p class="map-empty">尚無任何區域。請先新增區域。</p>`;
    return;
  }

  regions.forEach(region => {
    const territories   = (state.territoryOptions || []).filter(t => t.regionId === region.id);
    const familiesInReg = (state.families || []).filter(f => f.regionId === region.id);
    const regionKey     = `region:${region.id}`;
    const isOpen        = _mapExpanded.has(regionKey);

    const details = document.createElement("details");
    details.className = "map-region";
    if (isOpen) details.open = true;

    // --- 分組家族:未指定 + 各據點 ---
    const unassigned = familiesInReg.filter(f => !f.territory);
    const byTerr = new Map();
    territories.forEach(t => byTerr.set(t.name, []));
    familiesInReg.forEach(f => {
      if (f.territory && byTerr.has(f.territory)) byTerr.get(f.territory).push(f);
    });

    // --- 渲染巢狀的據點塊(帶家族)---
    const renderTerrBlock = (terrName, famList, regionId) => {
      const terrKey  = `terr:${regionId}:${terrName || "__none__"}`;
      const terrOpen = _mapExpanded.has(terrKey);
      const isUnassigned = !terrName;
      const title = isUnassigned ? "未指定據點" : terrName;
      const editBtn = isUnassigned
        ? ""
        : `<button class="btn-tiny" data-act="edit-territory" data-region="${regionId}" data-tname="${escHtml(terrName)}">編輯據點</button>`;

      return `
        <details class="map-terr" data-key="${escHtml(terrKey)}" ${terrOpen ? "open" : ""}>
          <summary>
            ${escHtml(title)}
            <span class="map-terr-meta">（${famList.length} 家族）</span>
          </summary>
          <div class="map-terr-body">
            ${editBtn ? `<div style="margin-bottom:6px;">${editBtn}</div>` : ""}
            ${famList.length
              ? famList.map(f => `
                  <div class="map-item-row">
                    <div class="map-item-main">
                      <span class="name">${escHtml(famDisplay(f))}</span>
                      ${f.origin ? `<span class="meta">${escHtml(f.origin)}</span>` : ""}
                    </div>
                    <button class="btn-tiny" data-act="edit-family" data-id="${f.id}">編輯</button>
                  </div>
                `).join("")
              : `<div class="map-empty">${isUnassigned ? "本區沒有未指定據點的家族。" : "此據點暫無駐留家族。"}</div>`
            }
          </div>
        </details>
      `;
    };

    // 「未指定據點」只在真有未指定家族時才出現
    const unassignedBlock = unassigned.length ? renderTerrBlock("", unassigned, region.id) : "";
    const terrBlocks = territories.map(t => renderTerrBlock(t.name, byTerr.get(t.name) || [], region.id)).join("");

    details.innerHTML = `
      <summary>
        ${escHtml(region.name)}
        <span class="map-region-desc">${escHtml(region.desc || "")} ｜ 據點 ${territories.length}｜家族 ${familiesInReg.length}</span>
      </summary>
      <div class="map-region-body">
        <div class="map-section-label" style="margin-bottom:10px;">
          <button class="btn-tiny" data-act="edit-region" data-id="${region.id}">編輯區域</button>
          <button class="btn-add-inline" data-act="add-territory" data-region="${region.id}">＋ 新增據點</button>
          <button class="btn-add-inline" data-act="add-family" data-region="${region.id}">＋ 新增家族</button>
        </div>

        ${unassignedBlock}
        ${terrBlocks}
        ${!unassignedBlock && !terrBlocks ? `<div class="map-empty">本區暫無據點。先新增一個據點,或在新增家族時留空據點。</div>` : ""}
      </div>
    `;

    // 區域層:記住展開狀態
    details.addEventListener("toggle", () => {
      if (details.open) _mapExpanded.add(regionKey);
      else _mapExpanded.delete(regionKey);
    });

    // 據點層:記住展開狀態(每個 .map-terr 都綁)
    details.querySelectorAll("details.map-terr").forEach(d => {
      d.addEventListener("toggle", () => {
        const k = d.dataset.key;
        if (!k) return;
        if (d.open) _mapExpanded.add(k);
        else _mapExpanded.delete(k);
      });
    });

    regionListEl.appendChild(details);
  });

  // 事件委派:所有 action 按鈕
  regionListEl.querySelectorAll("[data-act]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      // 阻止 click 冒泡去觸發 details toggle
      e.preventDefault();
      const act = btn.dataset.act;
      if      (act === "edit-region")    openRegionModal(btn.dataset.id);
      else if (act === "add-territory")  openTerritoryModal(btn.dataset.region, null);
      else if (act === "edit-territory") openTerritoryModal(btn.dataset.region, btn.dataset.tname);
      else if (act === "add-family")     openFamilyModal(btn.dataset.region, null);
      else if (act === "edit-family")    openFamilyModal(null, Number(btn.dataset.id));
    });
  });
}

// ---------- Modal 控制 ----------
function openModal(title, bodyHtml, onSave) {
  modalTitleEl.textContent = title;
  modalBodyEl.innerHTML = bodyHtml;
  modalEl.classList.remove("hidden");
  // 重新綁一次按鈕
  document.getElementById("modalCancelBtn").onclick = closeModal;
  document.getElementById("modalSaveBtn").onclick   = () => {
    try { onSave(); } catch (err) { alert(err.message || String(err)); }
  };
}
function closeModal() {
  modalEl.classList.add("hidden");
  modalBodyEl.innerHTML = "";
}

// ---------- 區域:新增/編輯 ----------
function openRegionModal(regionId) {
  const r = regionId ? state.regions.find(x => x.id === regionId) : null;
  const isEdit = !!r;

  openModal(
    isEdit ? "編輯區域" : "新增區域",
    `
      <label>名稱
        <input type="text" id="fld-region-name" value="${escHtml(r ? r.name : "")}" />
      </label>
      <label>描述
        <textarea id="fld-region-desc" rows="3">${escHtml(r ? r.desc : "")}</textarea>
      </label>
    `,
    () => {
      const name = document.getElementById("fld-region-name").value.trim();
      const desc = document.getElementById("fld-region-desc").value.trim();
      if (!name) throw new Error("區域名稱不能為空。");

      if (isEdit) {
        r.name = name;
        r.desc = desc;
      } else {
        state.regions.push({ id: "r" + Date.now(), name, desc });
      }
      saveState();
      closeModal();
      renderList();
    }
  );
}

// ---------- 據點:新增/編輯 ----------
// 編輯時用 (regionId, oldName) 定位 — 因為 territory 沒 id,靠 name+regionId 當 key
function openTerritoryModal(regionId, oldName) {
  const t = oldName
    ? (state.territoryOptions || []).find(x => x.regionId === regionId && x.name === oldName)
    : null;
  const isEdit = !!t;
  const regions = state.regions || [];

  openModal(
    isEdit ? `編輯據點：${oldName}` : "新增據點",
    `
      <label>名稱
        <input type="text" id="fld-terr-name" value="${escHtml(t ? t.name : "")}" />
      </label>
      <label>所屬區域
        <select id="fld-terr-region">
          ${regions.map(r =>
            `<option value="${escHtml(r.id)}" ${r.id === regionId ? "selected" : ""}>${escHtml(r.name)}</option>`
          ).join("")}
        </select>
      </label>
      ${isEdit
        ? `<p class="hint" style="color:#8a7656; font-size:0.85em;">改名後,所有以此據點為主據點的家族會自動連動更新。</p>`
        : ""}
    `,
    () => {
      const newName   = document.getElementById("fld-terr-name").value.trim();
      const newRegion = document.getElementById("fld-terr-region").value;
      if (!newName) throw new Error("據點名稱不能為空。");
      if (!newRegion) throw new Error("必須指定所屬區域。");

      if (isEdit) {
        const oldNameSaved = t.name;
        const oldRegion    = t.regionId;
        t.name     = newName;
        t.regionId = newRegion;
        // 連動更新受影響的家族 territory 欄位
        // (territory 是字串而不是 id,改名就必須掃一遍 family)
        if (oldNameSaved !== newName) {
          (state.families || []).forEach(f => {
            if (f.territory === oldNameSaved && f.regionId === oldRegion) {
              f.territory = newName;
            }
          });
        }
      } else {
        // 新增前檢查同區同名
        const dup = (state.territoryOptions || []).find(
          x => x.regionId === newRegion && x.name === newName
        );
        if (dup) throw new Error("此區域已存在同名據點。");
        state.territoryOptions.push({ name: newName, regionId: newRegion });
      }

      saveState();
      closeModal();
      renderList();
    }
  );
}

// ---------- 家族:新增/編輯 ----------
// 最小集:姓氏 / 區域 / 據點 / 備註(出身、門第不在地圖頁管)
function openFamilyModal(regionId, familyId) {
  const f = familyId ? (state.families || []).find(x => x.id === familyId) : null;
  const isEdit = !!f;
  const curRegion = isEdit ? f.regionId : regionId;
  const regions = state.regions || [];

  // 區域選單
  const regionOptHtml = regions.map(r =>
    `<option value="${escHtml(r.id)}" ${r.id === curRegion ? "selected" : ""}>${escHtml(r.name)}</option>`
  ).join("");

  // 據點選單(依選中的區域篩,此處先給一個初始集合,待 change 事件改)
  const terrOptHtml = buildTerritoryOptions(curRegion, isEdit ? f.territory : "");

  openModal(
    isEdit ? `編輯家族：${famDisplay(f)}` : "新增家族",
    `
      <label>姓氏
        <input type="text" id="fld-fam-name" value="${escHtml(f ? f.name : "")}" />
      </label>
      <label>所屬區域
        <select id="fld-fam-region">${regionOptHtml}</select>
      </label>
      <label>主要據點／領地
        <select id="fld-fam-territory">${terrOptHtml}</select>
      </label>
      <label>備註（首句寫「XX姓氏」會自動顯示為郡望）
        <textarea id="fld-fam-notes" rows="4">${escHtml(f ? (f.notes || "") : "")}</textarea>
      </label>
      ${isEdit
        ? `<p class="hint" style="color:#8a7656; font-size:0.85em;">注意:改姓氏不會連動更改成員姓名,出身／門第請回首頁補。</p>`
        : `<p class="hint" style="color:#8a7656; font-size:0.85em;">新增後,出身／門第請回首頁的「家族詳情」補。</p>`}
    `,
    () => {
      const name     = document.getElementById("fld-fam-name").value.trim();
      const regionId = document.getElementById("fld-fam-region").value;
      const territory = document.getElementById("fld-fam-territory").value;
      const notes    = document.getElementById("fld-fam-notes").value.trim();
      if (!name) throw new Error("姓氏不能為空。");
      if (!regionId) throw new Error("必須指定所屬區域。");

      if (isEdit) {
        f.name     = name;
        f.regionId = regionId;
        f.territory = territory || "";
        f.notes    = notes;
      } else {
        const newId = state.nextFamilyId || 1;
        state.families.push({
          id: newId,
          name,
          origin: "",            // 地圖頁不填,留首頁補
          regionId,
          territory: territory || "",
          notes,
          allies: [],
          standing: ""           // 地圖頁不填,留首頁補
        });
        state.nextFamilyId = newId + 1;
      }

      saveState();
      closeModal();
      renderList();
    }
  );

  // 讓「所屬區域」切換時,連動更新「據點」選單
  const regionSel = document.getElementById("fld-fam-region");
  const terrSel   = document.getElementById("fld-fam-territory");
  regionSel.addEventListener("change", () => {
    terrSel.innerHTML = buildTerritoryOptions(regionSel.value, "");
  });
}

function buildTerritoryOptions(regionId, selectedName) {
  const items = (state.territoryOptions || []).filter(t => t.regionId === regionId);
  const opts = [`<option value="">（不指定）</option>`];
  items.forEach(t => {
    opts.push(
      `<option value="${escHtml(t.name)}" ${t.name === selectedName ? "selected" : ""}>${escHtml(t.name)}</option>`
    );
  });
  return opts.join("");
}

// ---------- 頂層按鈕 ----------
document.getElementById("addRegionBtn").addEventListener("click", () => openRegionModal(null));

// 點 modal 背景關閉
modalEl.addEventListener("click", (e) => {
  if (e.target === modalEl) closeModal();
});

// ---------- 啟動 ----------
loadState();
renderList();
