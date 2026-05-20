// dazhou.js
// ============================================================
// 大周名位卷宗模組
// ------------------------------------------------------------
// state.positions 只存職銜骨架(category/system/position/rank/quota/note)
// 席位上的「誰在這裡」由 state.persons[].appointments 反推:
//   appointment = { positionId, slotIndex, startYear, endYear, note }
//   endYear === null → 現任
//
// 派任邏輯為共用 API,大周頁與 tome 人物詳情頁都會呼叫
// ============================================================

// ---------- 共用反查 API ----------

/** 取得某職銜目前在任者,回傳 [{person, appt}] */
function getOccupantsOfPosition(positionId) {
  const list = [];
  state.persons.forEach(p => {
    if (!Array.isArray(p.appointments)) return;
    p.appointments.forEach(a => {
      if (a.positionId === positionId && !a.endYear) {
        list.push({ person: p, appt: a });
      }
    });
  });
  list.sort((a, b) => (a.appt.slotIndex ?? 999) - (b.appt.slotIndex ?? 999));
  return list;
}

/** 取得某職銜的歷任(已卸任)紀錄 */
function getHistoryOfPosition(positionId) {
  const list = [];
  state.persons.forEach(p => {
    if (!Array.isArray(p.appointments)) return;
    p.appointments.forEach(a => {
      if (a.positionId === positionId && a.endYear) {
        list.push({ person: p, appt: a });
      }
    });
  });
  list.sort((a, b) => (a.appt.endYear || 0) - (b.appt.endYear || 0));
  return list;
}

/** 取得某人目前現任的所有職位 */
function getActiveAppointments(personId) {
  const p = state.persons.find(x => x.id === personId);
  if (!p || !Array.isArray(p.appointments)) return [];
  return p.appointments.filter(a => !a.endYear);
}

/** 派任:把某人放到某職位的指定席位(slotIndex 不指定就找下一個空位) */
function appointPerson(personId, positionId, slotIndex = null, note = "") {
  const p = state.persons.find(x => x.id === Number(personId));
  if (!p) { alert("人物不存在"); return false; }

  const pos = state.positions.find(x => x.id === positionId);
  if (!pos) { alert("職銜不存在"); return false; }

  if (!Array.isArray(p.appointments)) p.appointments = [];

  // 處理 slotIndex
  if (slotIndex === null || slotIndex === undefined || slotIndex === "") {
    const occupied = new Set(
      getOccupantsOfPosition(positionId).map(o => o.appt.slotIndex)
    );
    let i = 0;
    while (occupied.has(i)) i++;
    slotIndex = i;
  } else {
    slotIndex = Number(slotIndex);
  }

  // 同職位若已有定員上限,不允許超額
  if (pos.quota > 0 && slotIndex >= pos.quota) {
    alert("此職銜定員已滿,無法再派任。如需擴編請先編輯職銜定員。");
    return false;
  }

  // 同職銜同 slot 已被別人佔 → 詢問
  const conflict = state.persons.find(x =>
    x.id !== p.id &&
    (x.appointments || []).some(a =>
      a.positionId === positionId &&
      a.slotIndex === slotIndex &&
      !a.endYear
    )
  );
  if (conflict) {
    if (!confirm(`此席位目前由「${conflict.name}」佔據,是否仍要派任(將自動卸任前任)?`)) {
      return false;
    }
    dismissPerson(conflict.id, positionId, slotIndex);
  }

  // 此人若已在此職位的此 slot 現任,不重複寫
  const exists = p.appointments.find(a =>
    a.positionId === positionId && a.slotIndex === slotIndex && !a.endYear
  );
  if (exists) return true;

  p.appointments.push({
    positionId,
    slotIndex,
    startYear: state.gameYear || INITIAL_YEAR,
    endYear: null,
    note: note || ""
  });

  saveState();
  return true;
}

/** 卸任:把某人的某筆現任紀錄標記 endYear */
function dismissPerson(personId, positionId, slotIndex = null) {
  const p = state.persons.find(x => x.id === Number(personId));
  if (!p) return false;
  const targets = (p.appointments || []).filter(a =>
    a.positionId === positionId &&
    !a.endYear &&
    (slotIndex === null || slotIndex === undefined || a.slotIndex === Number(slotIndex))
  );
  if (!targets.length) return false;
  targets.forEach(a => { a.endYear = state.gameYear || INITIAL_YEAR; });
  saveState();
  return true;
}

// ---------- 工具 ----------
function _dzEsc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function positionQuotaLabel(p) {
  return p.quota > 0 ? String(p.quota) : "不限";
}

function positionVacancy(p) {
  const occ = getOccupantsOfPosition(p.id).length;
  if (p.quota === 0) return 0;
  return Math.max(0, p.quota - occ);
}

function positionSlotCount(p) {
  const occ = getOccupantsOfPosition(p.id);
  if (p.quota > 0) return Math.max(p.quota, occ.length);
  return occ.length;
}

/** 取得人物在某職位的人類友善描述(供 tome 人物頁顯示用) */
function describePositionFor(positionId) {
  const pos = state.positions.find(x => x.id === positionId);
  if (!pos) return "(已撤銷的職位)";
  const sys = pos.system && pos.system !== pos.position ? `${pos.system}・` : "";
  return `${sys}${pos.position}`;
}

// ============================================================
// 以下為 dazhou.html 頁面渲染與互動
// 用 document.getElementById("dazhouSections") 存在與否判斷是否在大周頁
// ============================================================

const dazhouUI = {
  currentCategory: "全部",
  search: "",
  openIds: new Set(),
  editingPositionId: null
};

// ---------- 統計列 ----------
function renderDazhouStats() {
  const box = document.getElementById("dazhouStats");
  if (!box) return;

  const totalPositions = state.positions.length;
  let totalQuota = 0;
  let totalFilled = 0;
  state.positions.forEach(p => {
    if (p.quota > 0) totalQuota += p.quota;
    totalFilled += getOccupantsOfPosition(p.id).length;
  });
  const totalVacant = state.positions.filter(p => getOccupantsOfPosition(p.id).length === 0).length;

  box.innerHTML = `
    <div class="dz-stat-card">
      <div class="dz-stat-label">職銜總數</div>
      <div class="dz-stat-num">${totalPositions}</div>
    </div>
    <div class="dz-stat-card">
      <div class="dz-stat-label">固定定員</div>
      <div class="dz-stat-num">${totalQuota}</div>
    </div>
    <div class="dz-stat-card">
      <div class="dz-stat-label">已派人物</div>
      <div class="dz-stat-num">${totalFilled}</div>
    </div>
    <div class="dz-stat-card">
      <div class="dz-stat-label">無人在任</div>
      <div class="dz-stat-num">${totalVacant}</div>
    </div>
  `;
}

// ---------- 分類導覽 ----------
function renderDazhouNav() {
  const nav = document.getElementById("dazhouNav");
  if (!nav) return;
  const presentCats = POSITION_CATEGORIES.filter(c =>
    state.positions.some(p => p.category === c)
  );
  const cats = ["全部", ...presentCats];
  nav.innerHTML = cats.map(c => {
    const active = c === dazhouUI.currentCategory ? "active" : "";
    return `<button class="dz-nav-btn ${active}" data-cat="${_dzEsc(c)}">${_dzEsc(c)}</button>`;
  }).join("");
  nav.querySelectorAll(".dz-nav-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      dazhouUI.currentCategory = btn.dataset.cat;
      renderDazhouAll();
    });
  });
}

// ---------- 主清單 ----------
function renderDazhouSections() {
  const box = document.getElementById("dazhouSections");
  if (!box) return;

  const kw = dazhouUI.search.trim().toLowerCase();

  let filtered = state.positions.filter(p => {
    if (dazhouUI.currentCategory !== "全部" && p.category !== dazhouUI.currentCategory) return false;
    if (!kw) return true;
    const hit = [p.category, p.system, p.position, p.rank, p.note]
      .some(s => (s || "").toLowerCase().includes(kw));
    if (hit) return true;
    const occ = getOccupantsOfPosition(p.id);
    return occ.some(o => (o.person.name || "").toLowerCase().includes(kw));
  });

  // 排序:依 sortKey 升序(沒設 sortKey 的排在最後,以 id 作 tie-breaker 保持穩定)
  // 新增職銜時若沒指定 sortKey,會給一個比現有最大值 +1 的值,自動往後排。
  function _posSortVal(p) {
    return (typeof p.sortKey === "number") ? p.sortKey : Number.POSITIVE_INFINITY;
  }
  filtered.sort((a, b) => {
    const sa = _posSortVal(a), sb = _posSortVal(b);
    if (sa !== sb) return sa - sb;
    return a.id - b.id;
  });

  const grouped = {};
  filtered.forEach(p => {
    (grouped[p.category] = grouped[p.category] || []).push(p);
  });

  if (!Object.keys(grouped).length) {
    box.innerHTML = `<div class="dz-empty">無符合條件的職銜。</div>`;
    return;
  }

  box.innerHTML = POSITION_CATEGORIES
    .filter(c => grouped[c])
    .map(cat => {
      const arr = grouped[cat];
      const totalVac = arr.filter(p => getOccupantsOfPosition(p.id).length === 0).length;

      // 在 category 內,依 system 子分組;群組順序由「該群組第一個職銜的 sortKey」決定
      // (因為 arr 已經是 sortKey 排序後的結果,所以按出現順序記下群組即可)。
      // 沒有 system 的職銜歸到 _none_,平鋪顯示(不加子標題)。
      const sysOrder = [];     // 出現順序的 system key 陣列
      const sysBuckets = {};   // sysKey -> position[]
      arr.forEach(p => {
        const key = p.system ? p.system : "_none_";
        if (!sysBuckets[key]) {
          sysBuckets[key] = [];
          sysOrder.push(key);
        }
        sysBuckets[key].push(p);
      });

      const groupsHtml = sysOrder.map(sysKey => {
        const list = sysBuckets[sysKey];
        const cardsHtml = list.map(positionCardHtml).join("");
        if (sysKey === "_none_") {
          // 平鋪,不加子標題
          return `<div class="dz-position-list">${cardsHtml}</div>`;
        }
        return `
          <div class="dz-subgroup">
            <div class="dz-subgroup-head">${_dzEsc(sysKey)}</div>
            <div class="dz-position-list">${cardsHtml}</div>
          </div>
        `;
      }).join("");

      return `
        <section class="dz-section">
          <div class="dz-section-head">
            <div class="dz-section-title">${_dzEsc(cat)}卷</div>
            <div class="dz-section-meta">${arr.length} 個職銜・無人在任 ${totalVac}</div>
          </div>
          ${groupsHtml}
        </section>
      `;
    }).join("");

  // 綁定卡片事件
  box.querySelectorAll("[data-dz-action]").forEach(el => {
    el.addEventListener("click", e => {
      e.stopPropagation();
      const action = el.dataset.dzAction;
      const posId = el.dataset.posId ? Number(el.dataset.posId) : null;
      const personId = el.dataset.personId ? Number(el.dataset.personId) : null;
      const slot = el.dataset.slot != null && el.dataset.slot !== "" ? Number(el.dataset.slot) : null;
      handleDazhouAction(action, { posId, personId, slot });
    });
  });
  box.querySelectorAll(".dz-position-summary").forEach(el => {
    el.addEventListener("click", () => {
      const card = el.closest("[data-position-id]");
      const posId = Number(card.dataset.positionId);
      if (dazhouUI.openIds.has(posId)) dazhouUI.openIds.delete(posId);
      else dazhouUI.openIds.add(posId);
      renderDazhouSections();
    });
  });
}

function positionCardHtml(p) {
  const isOpen = dazhouUI.openIds.has(p.id);
  const occ = getOccupantsOfPosition(p.id);
  const slotCount = positionSlotCount(p);
  const occupantNames = occ.map(o => _dzEsc(o.person.name)).join("、");
  const statusClass = (occ.length === 0) ? "empty"
                    : (p.quota > 0 && occ.length >= p.quota) ? "full"
                    : "partial";
  const statusLabel = (occ.length === 0) ? "空缺"
                    : (p.quota > 0 && occ.length >= p.quota) ? "在任"
                    : "部分在任";

  return `
    <article class="dz-position-card ${isOpen ? 'open' : ''}" data-position-id="${p.id}">
      <div class="dz-position-summary">
        <div class="dz-ps-cat">${_dzEsc(p.category)}</div>
        <div class="dz-ps-main">
          <span class="dz-ps-position">${_dzEsc(p.position)}</span>
          ${p.system ? `<span class="dz-ps-system">${_dzEsc(p.system)}</span>` : ''}
          ${p.rank ? `<span class="dz-ps-rank">${_dzEsc(p.rank)}</span>` : ''}
          ${occupantNames ? `<span class="dz-ps-occupants">▪ ${occupantNames}</span>` : ''}
        </div>
        <div class="dz-ps-status">
          <span class="dz-pill dz-pill-${statusClass}">${statusLabel}</span>
          <span class="dz-ps-quota">${occ.length}/${positionQuotaLabel(p)}</span>
        </div>
      </div>
      ${isOpen ? renderSlots(p, slotCount, occ) : ''}
    </article>
  `;
}

function renderSlots(p, slotCount, occ) {
  const byIdx = new Map();
  occ.forEach(o => byIdx.set(o.appt.slotIndex, o));

  const slots = [];
  const total = Math.max(slotCount, 1);
  for (let i = 0; i < total; i++) {
    slots.push(slotHtml(p, i, byIdx.get(i)));
  }

  const addSlotBtn = p.quota === 0
    ? `<button class="dz-btn dz-btn-add" data-dz-action="appoint" data-pos-id="${p.id}">＋指派新席位</button>`
    : '';

  return `
    <div class="dz-position-details">
      <div class="dz-detail-actions">
        <button class="dz-btn dz-btn-sm" data-dz-action="move-up" data-pos-id="${p.id}">▲ 上移</button>
        <button class="dz-btn dz-btn-sm" data-dz-action="move-down" data-pos-id="${p.id}">▼ 下移</button>
        <button class="dz-btn dz-btn-sm" data-dz-action="edit-pos" data-pos-id="${p.id}">編輯職銜</button>
        <button class="dz-btn dz-btn-sm dz-btn-danger" data-dz-action="delete-pos" data-pos-id="${p.id}">刪除職銜</button>
      </div>
      ${p.note ? `<div class="dz-details-note">${_dzEsc(p.note)}</div>` : ''}
      <div class="dz-slot-list">
        ${slots.join("")}
      </div>
      ${addSlotBtn}
    </div>
  `;
}

function slotHtml(p, idx, occupant) {
  if (!occupant) {
    return `
      <div class="dz-slot dz-slot-empty">
        <div class="dz-slot-label">第 ${idx + 1} 席</div>
        <div class="dz-slot-name">— 空缺 —</div>
        <button class="dz-btn dz-btn-sm dz-btn-primary"
                data-dz-action="appoint"
                data-pos-id="${p.id}"
                data-slot="${idx}">指派人物</button>
      </div>
    `;
  }
  const person = occupant.person;
  const appt = occupant.appt;
  const fam = state.families.find(f => f.id === person.familyId);
  const age = typeof getAge === "function" ? getAge(person) : null;

  return `
    <div class="dz-slot dz-slot-filled ${person.deceased ? 'dz-slot-deceased' : ''}">
      <div class="dz-slot-label">第 ${idx + 1} 席</div>
      <div class="dz-slot-main">
        <a class="dz-slot-name"
           href="javascript:void(0)"
           data-dz-action="jump-person"
           data-person-id="${person.id}">
          ${_dzEsc(person.name)}${person.deceased ? '【已逝】' : ''}
        </a>
        <div class="dz-slot-meta">
          ${fam ? _dzEsc(fam.name) : '未歸宗族'}
          ｜${age != null && age !== "" ? age + ' 歲' : '年齡未記'}
          ｜${_dzEsc(person.gender || '—')}
          ${appt.startYear ? `｜任於星曆 ${appt.startYear} 年` : ''}
        </div>
        ${appt.note ? `<div class="dz-slot-note">${_dzEsc(appt.note)}</div>` : ''}
        ${person.notes ? `<div class="dz-slot-note dz-slot-note-person">${_dzEsc(person.notes)}</div>` : ''}
      </div>
      <div class="dz-slot-actions">
        <button class="dz-btn dz-btn-sm"
                data-dz-action="appoint"
                data-pos-id="${p.id}"
                data-slot="${idx}"
                data-person-id="${person.id}">換人</button>
        <button class="dz-btn dz-btn-sm dz-btn-danger"
                data-dz-action="dismiss"
                data-pos-id="${p.id}"
                data-slot="${idx}"
                data-person-id="${person.id}">卸任</button>
      </div>
    </div>
  `;
}

// ---------- 卡片動作分派 ----------
function handleDazhouAction(action, { posId, personId, slot }) {
  switch (action) {
    case "edit-pos":
      openPositionForm(state.positions.find(p => p.id === posId));
      break;
    case "delete-pos":
      deleteDazhouPosition(posId);
      break;
    case "appoint":
      openAppointDialog(posId, slot, personId);
      break;
    case "dismiss":
      dismissAndRender(personId, posId, slot);
      break;
    case "jump-person":
      jumpToPerson(personId);
      break;
    case "move-up":
      movePositionInOrder(posId, -1);
      break;
    case "move-down":
      movePositionInOrder(posId, +1);
      break;
  }
}

// ---------- 順序調整 ----------
// dir = -1 上移、+1 下移
// 規則:
//   - 只在同 category + 同 system(含「無 system」)範圍內互換
//   - 互換的是 sortKey 值;若兩者都沒 sortKey,先依目前出現順序補齊 sortKey 再交換
function movePositionInOrder(posId, dir) {
  const target = state.positions.find(p => p.id === posId);
  if (!target) return;

  // 先確保所有同 category 內職銜都有 sortKey,沒有的依出現順序補上,
  // 數值取目前最大值往後遞增,避免動到既有順序。
  const sameCat = state.positions.filter(p => p.category === target.category);
  let maxKey = -Infinity;
  sameCat.forEach(p => {
    if (typeof p.sortKey === "number" && p.sortKey > maxKey) maxKey = p.sortKey;
  });
  if (maxKey === -Infinity) maxKey = 0;
  sameCat.forEach(p => {
    if (typeof p.sortKey !== "number") {
      maxKey += 1;
      p.sortKey = maxKey;
    }
  });

  // 同 category + 同 system(含「皆無」當作一組)的鄰居,按 sortKey 排序
  const sysKey = target.system || "";
  const peers = sameCat
    .filter(p => (p.system || "") === sysKey)
    .sort((a, b) => a.sortKey - b.sortKey);

  const idx = peers.findIndex(p => p.id === posId);
  if (idx < 0) return;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= peers.length) return; // 已在邊界

  const other = peers[newIdx];
  // 交換 sortKey
  const tmp = target.sortKey;
  target.sortKey = other.sortKey;
  other.sortKey = tmp;

  saveState();
  renderDazhouSections();
}

// ---------- 跳轉回 tome ----------
function jumpToPerson(personId) {
  localStorage.setItem("dazhou_jumpToPerson", String(personId));
  window.location = "index.html";
}

// ---------- 派任對話框 ----------
function openAppointDialog(positionId, slotIndex, replacePersonId = null) {
  const dlg = document.getElementById("appointDialog");
  const pos = state.positions.find(p => p.id === positionId);
  if (!pos || !dlg) return;

  document.getElementById("apptPositionInfo").innerHTML = `
    <div class="dz-dlg-pos">
      <strong>${_dzEsc(pos.position)}</strong>
      <span>${_dzEsc(pos.system || '')}${pos.rank ? ' ｜ ' + _dzEsc(pos.rank) : ''}</span>
      <span>${slotIndex !== null && slotIndex !== undefined ? `第 ${slotIndex + 1} 席` : '新增席位'}</span>
    </div>
  `;

  const sel = document.getElementById("apptPersonSelect");
  sel.innerHTML = '<option value="">— 請選擇 —</option>';
  const living = state.persons.filter(p => !p.deceased);
  const dead = state.persons.filter(p => p.deceased);
  living.concat(dead).forEach(p => {
    const fam = state.families.find(f => f.id === p.familyId);
    const opt = document.createElement("option");
    opt.value = String(p.id);
    const famStr = fam ? `｜${fam.name}` : '';
    const deadStr = p.deceased ? '【已逝】' : '';
    opt.textContent = `${p.name}${deadStr}${famStr}`;
    sel.appendChild(opt);
  });

  document.getElementById("apptNote").value = "";

  // 搜尋過濾
  const searchBox = document.getElementById("apptSearchInput");
  if (searchBox) {
    searchBox.value = "";
    searchBox.oninput = () => {
      const q = searchBox.value.trim().toLowerCase();
      [...sel.options].forEach(opt => {
        if (!opt.value) { opt.hidden = false; return; }
        opt.hidden = q && !opt.textContent.toLowerCase().includes(q);
      });
    };
  }

  dlg.dataset.positionId = positionId;
  dlg.dataset.slotIndex = slotIndex === null || slotIndex === undefined ? "" : String(slotIndex);
  dlg.dataset.replacePersonId = replacePersonId || "";
  dlg.classList.remove("hidden");
}

function closeAppointDialog() {
  document.getElementById("appointDialog")?.classList.add("hidden");
}

function confirmAppoint() {
  const dlg = document.getElementById("appointDialog");
  const positionId = Number(dlg.dataset.positionId);
  const slotIndexRaw = dlg.dataset.slotIndex;
  const slotIndex = slotIndexRaw === "" ? null : Number(slotIndexRaw);
  const replaceId = dlg.dataset.replacePersonId ? Number(dlg.dataset.replacePersonId) : null;

  const personId = document.getElementById("apptPersonSelect").value;
  const note = document.getElementById("apptNote").value.trim();
  if (!personId) { alert("請選擇人物"); return; }

  if (replaceId && replaceId !== Number(personId)) {
    dismissPerson(replaceId, positionId, slotIndex);
  }

  const ok = appointPerson(personId, positionId, slotIndex, note);
  if (ok) {
    closeAppointDialog();
    renderDazhouAll();
  }
}

function dismissAndRender(personId, positionId, slotIndex) {
  const p = state.persons.find(x => x.id === personId);
  if (!p) return;
  if (!confirm(`確定卸任「${p.name}」於此職位?`)) return;
  dismissPerson(personId, positionId, slotIndex);
  renderDazhouAll();
}

// ---------- 編輯/新增/刪除職銜 ----------
function newDazhouPosition() {
  openPositionForm(null);
}

function openPositionForm(p) {
  const dlg = document.getElementById("positionFormDialog");
  if (!dlg) return;
  document.getElementById("pfCategory").value = p ? p.category : POSITION_CATEGORIES[0];
  document.getElementById("pfSystem").value = p ? (p.system || "") : "";
  document.getElementById("pfPosition").value = p ? p.position : "";
  document.getElementById("pfRank").value = p ? (p.rank || "") : "";
  document.getElementById("pfQuota").value = p ? p.quota : 1;
  document.getElementById("pfNote").value = p ? (p.note || "") : "";
  document.getElementById("pfTitle").textContent = p ? "編輯職銜" : "新增職銜";
  dlg.dataset.editingId = p ? String(p.id) : "";
  dlg.classList.remove("hidden");
}

function closePositionForm() {
  document.getElementById("positionFormDialog")?.classList.add("hidden");
}

function savePositionForm() {
  const dlg = document.getElementById("positionFormDialog");
  const editingId = dlg.dataset.editingId ? Number(dlg.dataset.editingId) : null;

  const data = {
    category: document.getElementById("pfCategory").value,
    system: document.getElementById("pfSystem").value.trim(),
    position: document.getElementById("pfPosition").value.trim(),
    rank: document.getElementById("pfRank").value.trim(),
    quota: Math.max(0, Number(document.getElementById("pfQuota").value) || 0),
    note: document.getElementById("pfNote").value.trim()
  };

  if (!data.position) { alert("請填寫職位/名分"); return; }

  if (editingId) {
    const pos = state.positions.find(x => x.id === editingId);
    if (pos) Object.assign(pos, data);
  } else {
    // 新增時自動指派 sortKey,使其排在同 category 的末尾,
    // 避免新職銜永遠落在「無 sortKey」的最後群組之內無法排序。
    let maxKey = 0;
    state.positions.forEach(p => {
      if (p.category === data.category && typeof p.sortKey === "number" && p.sortKey > maxKey) {
        maxKey = p.sortKey;
      }
    });
    state.positions.push({ id: state.nextPositionId++, sortKey: maxKey + 1, ...data });
  }
  saveState();
  closePositionForm();
  renderDazhouAll();
}

function deleteDazhouPosition(positionId) {
  const p = state.positions.find(x => x.id === positionId);
  if (!p) return;
  const occ = getOccupantsOfPosition(positionId);
  const msg = occ.length
    ? `此職銜上有 ${occ.length} 名在任者,確定刪除?\n(刪除後相關任職紀錄會留在人物資料中,但會顯示「已撤銷的職位」)`
    : `確定刪除職銜「${p.position}」?`;
  if (!confirm(msg)) return;
  state.positions = state.positions.filter(x => x.id !== positionId);
  saveState();
  renderDazhouAll();
}

// ---------- 重置 ----------
function resetDazhouPositions() {
  if (!confirm("重置為預設職銜骨架?\n(已派任的人物資料不會被刪除,但新增/編輯/刪除過的職銜變更會消失)")) return;
  state.positions = buildDefaultPositions();
  state.nextPositionId = state.positions.length + 1;
  saveState();
  renderDazhouAll();
}

// ---------- 統一重繪 ----------
function renderDazhouAll() {
  renderDazhouStats();
  renderDazhouNav();
  renderDazhouSections();
}

// ---------- 初始化 ----------
function initDazhou() {
  loadState();

  // 雙保險:確保有預設職銜
  if (!Array.isArray(state.positions) || !state.positions.length) {
    state.positions = buildDefaultPositions();
    state.nextPositionId = state.positions.length + 1;
    saveState();
  }

  // 世界年份
  const yearEl = document.getElementById("dazhouYearDisplay");
  if (yearEl) yearEl.textContent = state.gameYear || INITIAL_YEAR;

  // 搜尋
  const searchInput = document.getElementById("dazhouSearch");
  if (searchInput) {
    searchInput.addEventListener("input", e => {
      dazhouUI.search = e.target.value;
      renderDazhouSections();
    });
  }

  // 工具列
  document.getElementById("btnNewPosition")?.addEventListener("click", newDazhouPosition);
  document.getElementById("btnResetPositions")?.addEventListener("click", resetDazhouPositions);

  // 派任對話框
  document.getElementById("btnApptCancel")?.addEventListener("click", closeAppointDialog);
  document.getElementById("btnApptConfirm")?.addEventListener("click", confirmAppoint);

  // 職銜表單
  document.getElementById("btnPfCancel")?.addEventListener("click", closePositionForm);
  document.getElementById("btnPfSave")?.addEventListener("click", savePositionForm);

  // 分類下拉
  const catSel = document.getElementById("pfCategory");
  if (catSel) {
    catSel.innerHTML = POSITION_CATEGORIES
      .map(c => `<option value="${_dzEsc(c)}">${_dzEsc(c)}</option>`).join("");
  }

  renderDazhouAll();
}

// ============================================================
// 提供給 tome 主頁人物詳情用的「派任至職位」對話框
// 用浮動 modal 形式(用 prompt 等簡單做法在多層職位下太難用)
// ============================================================
function openPersonAppointDialog(person) {
  // 已存在則先移除
  document.getElementById("personApptModal")?.remove();

  const modal = document.createElement("div");
  modal.id = "personApptModal";
  modal.className = "person-appt-modal";
  modal.innerHTML = `
    <div class="pam-bg"></div>
    <div class="pam-content">
      <div class="pam-title">將「${(person.name || "").replace(/</g,"&lt;")}」派任至職位</div>

      <label class="pam-label">分類
        <select class="pam-select" id="pamCategory">
          <option value="">— 全部 —</option>
          ${POSITION_CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join("")}
        </select>
      </label>

      <label class="pam-label">搜尋
        <input type="text" class="pam-input" id="pamSearch" placeholder="輸入職位名稱、系統、品級...">
      </label>

      <label class="pam-label">職位
        <select class="pam-select" id="pamPositionSel" size="10" style="min-height:220px"></select>
      </label>

      <label class="pam-label">任職備註(選填)
        <textarea class="pam-input" id="pamNote" rows="2" placeholder="如:外戚冊封、代理..."></textarea>
      </label>

      <div class="pam-actions">
        <button class="btn btn-small" id="pamCancel">取消</button>
        <button class="btn btn-small btn-primary" id="pamConfirm">確認派任</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // 確保 modal 樣式存在(在 tome 主頁時 style.css 沒有這些)
  if (!document.getElementById("pamStyles")) {
    const style = document.createElement("style");
    style.id = "pamStyles";
    style.textContent = `
      .person-appt-modal{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem;}
      .person-appt-modal .pam-bg{position:absolute;inset:0;background:rgba(0,0,0,.5);}
      .person-appt-modal .pam-content{position:relative;background:#f6efd9;border:2px solid #6b5530;padding:1.4rem;max-width:520px;width:100%;max-height:90vh;overflow-y:auto;font-family:"Noto Serif TC",serif;}
      .person-appt-modal .pam-title{font-size:1.2rem;color:#8b2a1f;margin-bottom:1rem;padding-bottom:.5rem;border-bottom:1px solid rgba(107,85,48,.3);letter-spacing:.15em;}
      .person-appt-modal .pam-label{display:block;margin-bottom:.7rem;font-size:.82rem;color:#6a5940;letter-spacing:.1em;}
      .person-appt-modal .pam-select,.person-appt-modal .pam-input{display:block;width:100%;margin-top:.2rem;padding:.45rem .6rem;border:1px solid rgba(107,85,48,.3);background:#ede3cc;font-family:inherit;font-size:.92rem;color:#1a1410;}
      .person-appt-modal .pam-actions{display:flex;gap:.5rem;justify-content:flex-end;margin-top:.8rem;padding-top:.7rem;border-top:1px solid rgba(107,85,48,.2);}
    `;
    document.head.appendChild(style);
  }

  function rebuildPositionList() {
    const cat = document.getElementById("pamCategory").value;
    const kw = document.getElementById("pamSearch").value.trim().toLowerCase();
    const sel = document.getElementById("pamPositionSel");
    sel.innerHTML = "";
    state.positions
      .filter(pos => !cat || pos.category === cat)
      .filter(pos => {
        if (!kw) return true;
        const hay = [pos.category, pos.system, pos.position, pos.rank].join(" ").toLowerCase();
        return hay.includes(kw);
      })
      .forEach(pos => {
        const opt = document.createElement("option");
        opt.value = String(pos.id);
        const occ = getOccupantsOfPosition(pos.id);
        const filledLabel = pos.quota > 0
          ? ` (${occ.length}/${pos.quota})`
          : ` (${occ.length}人在任)`;
        opt.textContent = `[${pos.category}] ${pos.system ? pos.system + ' · ' : ''}${pos.position}${pos.rank ? ' · ' + pos.rank : ''}${filledLabel}`;
        sel.appendChild(opt);
      });
  }

  rebuildPositionList();
  document.getElementById("pamCategory").addEventListener("change", rebuildPositionList);
  document.getElementById("pamSearch").addEventListener("input", rebuildPositionList);

  function close() { modal.remove(); }

  document.getElementById("pamCancel").addEventListener("click", close);
  modal.querySelector(".pam-bg").addEventListener("click", close);
  document.getElementById("pamConfirm").addEventListener("click", () => {
    const posId = Number(document.getElementById("pamPositionSel").value);
    const note = document.getElementById("pamNote").value.trim();
    if (!posId) { alert("請選擇職位"); return; }
    const ok = appointPerson(person.id, posId, null, note);
    if (ok) {
      close();
      if (typeof renderPersonDetail === "function") renderPersonDetail();
    }
  });
}

// 只在大周頁面才掛載 init
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("dazhouSections")) {
      initDazhou();
    }
  });
}

