// render-person.js
// 人物詳情渲染、刪除家族/人物、領養子女 UI
// (renderPersonDetail 為 562 行的巨型函式, 本次重構不拆其內部)

// ============================================================
// 輕量版 pair flag 讀取邏輯(供主頁人物詳情使用)
// ============================================================
// 為什麼要重複寫一份?
//   - 真正的 pair flag 系統在 match.js,但 match.js 只在議親室載入
//   - 主頁要顯示人物詳情中的婚姻 flag,需要自己讀 state.pairScores
//   - state.pairScores 是 localStorage 共用的,所以資料拿得到
// ============================================================

/** 將兩個 id 排序後組合,與 match.js 的 pairKey 邏輯一致 */
function _pairKeyForRender(x, y) {
  return [x, y].sort((a, b) => a - b).join("__");
}

/**
 * 取出某對人物的有效 flag 名稱列表(已過濾失效的時效 flag)
 * @param {number} aId
 * @param {number} bId
 * @returns {string[]}  flag 名稱陣列。若無 pair 或無 flag,回傳空陣列
 */
function getPairFlagsForRender(aId, bId) {
  if (!state.pairScores) return [];
  const key = _pairKeyForRender(aId, bId);
  const pd = state.pairScores[key];
  if (!pd || !pd.flags || !pd.flags.length) return [];
  const currentYear = state.gameYear || 0;
  return pd.flags
    .filter(f => {
      if (f.duration == null) return true;          // 永久 flag
      return (currentYear - f.year) < f.duration;   // 仍在時效內
    })
    .map(f => f.name);
}

function renderPersonDetail() {
  const box = $("personDetail");
  box.innerHTML = "";
  if (!state.selectedPersonId) {
    box.innerHTML = '<p class="hint">請從家族詳情中的成員列表點選一人。</p>';
    return;
  }
  const p = state.persons.find(x => x.id === state.selectedPersonId);
  if (!p) {
    box.innerHTML = '<p class="hint">人物資料錯誤。</p>';
    return;
  }

  const fam = state.families.find(x => x.id === p.familyId);
  const title = document.createElement("h2");
  title.className = "detail-title";
  title.textContent = p.name + (p.deceased ? " 【已逝】" : "");
  box.appendChild(title);

  const info = document.createElement("div");
  info.className = "detail-section";
  const age = getAge(p);
  const ageText = age != null ? age + " 歲" : "年齡未記";
  const gen = computeGeneration(p.id);

  let expectedText = "";
  if (p.deathYear != null) {
    const lifeAge = p.birthYear != null ? (p.deathYear - p.birthYear) : null;
    expectedText = `預計卒於星曆 ${p.deathYear} 年`;
    if (lifeAge != null) expectedText += `（約享年 ${lifeAge} 歲）`;
    if (p.deceased) expectedText = `已於星曆 ${p.deathYear} 年辭世`;
  } else {
    expectedText = "未記載預期壽命";
  }

  info.innerHTML = `
    <div class="detail-label">身分／代數</div>
    <div class="detail-value">${p.role || "未標註"}｜${fam ? fam.name : "未歸宗族"}｜第 ${gen} 代成員</div>
    <div class="detail-label">出生年份／年齡</div>
    <div class="detail-value">${p.birthYear != null ? "星曆 " + p.birthYear + " 年" : "未記載"}｜${ageText}</div>
    <div class="detail-label">性別／身分／家族</div>
    <div class="detail-value">${p.gender || "未記載"}｜${p.role || "未標註"}｜${fam ? fam.name : "未歸宗族"}</div>
    <div class="detail-label">職業／住所</div>
    <div class="detail-value">${p.occupation || "未記載"}｜${p.residence || "未記載"}</div>
    <div class="detail-label">預期壽命</div>
    <div class="detail-value">${expectedText}</div>
  `;
  box.appendChild(info);

  // ===== v6:備註(可檢視 / 編輯) =====
  const notes = document.createElement("div");
  notes.className = "detail-section";
  notes.id = "personNotesSection";
  notes.innerHTML = `
    <div class="detail-label">
      備註
      <button id="editNotesBtn" class="btn btn-small btn-inline-edit" type="button">編輯備註</button>
    </div>
    <div id="personNotesView" class="detail-value">${p.notes ? escapeHtml(p.notes) : '<span class="hint">尚無備註。</span>'}</div>
    <div id="personNotesEdit" class="hidden">
      <textarea id="personNotesInput" class="notes-textarea" rows="4" placeholder="可記下此人物的性格、命格、關鍵事件、家族決議⋯⋯"></textarea>
      <div class="notes-edit-actions">
        <button id="saveNotesBtn" class="btn btn-small btn-primary" type="button">儲存</button>
        <button id="cancelNotesBtn" class="btn btn-small" type="button">取消</button>
      </div>
    </div>
  `;
  box.appendChild(notes);

  // 綁定事件(備註編輯)
  const notesView = notes.querySelector("#personNotesView");
  const notesEdit = notes.querySelector("#personNotesEdit");
  const notesInput = notes.querySelector("#personNotesInput");
  const editBtn = notes.querySelector("#editNotesBtn");
  const saveBtn = notes.querySelector("#saveNotesBtn");
  const cancelBtn = notes.querySelector("#cancelNotesBtn");

  editBtn.addEventListener("click", () => {
    notesInput.value = p.notes || "";
    notesView.classList.add("hidden");
    editBtn.classList.add("hidden");
    notesEdit.classList.remove("hidden");
    notesInput.focus();
  });
  cancelBtn.addEventListener("click", () => {
    notesEdit.classList.add("hidden");
    notesView.classList.remove("hidden");
    editBtn.classList.remove("hidden");
  });
  saveBtn.addEventListener("click", () => {
    const newNotes = notesInput.value.trim();
    p.notes = newNotes;
    saveState();
    renderPersonDetail();
    advisorSay(`已更新「${p.name}」的備註。`);
  });
  // ===== 備註結束 =====

  // ====================================================================
  // 配偶列表的取得邏輯
  // ====================================================================
  // 從 spouseRelations 直接展開,而非僅依賴 spouseIds。
  // 這樣才能顯示完整婚配歷史:
  //   - 現役配偶(spouseIds 中,且非 dissolved/離異)
  //   - 已解約/破局(訂婚後撤回,dissolved=true)
  //   - 已離異(成婚後解除,matchStage="已離異")
  //   - 已逝(配偶過世)
  //
  // 排序規則:
  //   1. 現役配偶排前
  //   2. 歷史紀錄(已解約/已離異)排後
  //   3. 同層內依結婚/訂婚年份升序
  //
  // helper:判斷此關係是否為「現役」
  // ====================================================================
  function _isActiveRelation(rel, pSpouseIds) {
    if (rel.dissolved) return false;                  // 破局/解約
    if (rel.matchStage === "已離異") return false;     // 已離異
    if (rel.matchStage === "已喪偶") return false;     // 已喪偶
    if (rel.endYear != null) return false;            // 有結束年份(離異或喪偶)
    return (pSpouseIds || []).includes(rel.id);       // 必須在現役清單中
  }

  const allRelations = (p.spouseRelations || []);
  const spouses = allRelations
    .map(rel => {
      const sp = state.persons.find(x => x.id === rel.id);
      return sp ? { sp, rel } : null;
    })
    .filter(Boolean)
    .sort((a, b) => {
      // 歷史紀錄排到最後
      const aActive = _isActiveRelation(a.rel, p.spouseIds);
      const bActive = _isActiveRelation(b.rel, p.spouseIds);
      if (aActive !== bActive) return aActive ? -1 : 1;
      // 主配偶優先
      const isMainA = (a.rel.type === "婚配" || a.rel.type === "正妻" || a.rel.type === "夫") ? 0 : 1;
      const isMainB = (b.rel.type === "婚配" || b.rel.type === "正妻" || b.rel.type === "夫") ? 0 : 1;
      if (isMainA !== isMainB) return isMainA - isMainB;
      // 同級依結婚/訂婚年份升序
      const yrA = a.rel.marryYear ?? a.rel.betrothalYear ?? 99999;
      const yrB = b.rel.marryYear ?? b.rel.betrothalYear ?? 99999;
      return yrA - yrB;
    })
    .map(item => item.sp);   // 把外殼還原成 person 物件(後續邏輯仍是讀 sp)
  const parents = (p.parentIds || []).map(id => state.persons.find(x => x.id === id)).filter(Boolean);

  const children = (p.childIds || [])
    .map(id => state.persons.find(x => x.id === id))
    .filter(Boolean)
    
    .sort((a, b) => {
        const ageA = getAge(a) ?? -999;
        const ageB = getAge(b) ?? -999;
        return ageB - ageA;
    });


  const rel = document.createElement("div");
  rel.className = "detail-section";

  // 一行一筆,名字可點擊跳轉
  // ----- 修改說明 -----
  // 為解約/破局者增加顯眼標記與原因,讓玩家能清楚看見此對曾結但未成的關係。
  // dissolved 紀錄包含:dissolveYear、dissolveStage、dissolveAction、dissolvedBy、dissolveReason
  // ------------------
  const spText = spouses.length ? spouses.map(sp => {
    const ag = getAge(sp);
    let metaParts = [];
    const sr = p.spouseRelations.find(r => r.id === sp.id);
    if (sr) {
      let s = sr.type;
      if (sr.marryYear != null) s += `，星曆 ${sr.marryYear} 年結婚`;
      else if (sr.betrothalYear != null) s += `，星曆 ${sr.betrothalYear} 年訂婚`;
      else if (sr.year != null) s += `，星曆 ${sr.year} 年結婚`;
      metaParts.push(s);
    }
    if (ag != null) metaParts.push(`${ag} 歲`);
    if (sp.familyId) {
      const spFam = state.families.find(x => x.id === sp.familyId);
      if (spFam) metaParts.push(`${spFam.name}`);
    }
    if (sp.deceased) metaParts.push("已逝");
    const meta = metaParts.length ? ` <span class="relation-meta">（${metaParts.join("｜")}）</span>` : "";

    // ----- v6+:這段婚姻的「過往痕跡」(flag) -----
    // 注意:flag 是「這對夫妻」的關係屬性,所以掛在配偶下方,而非人物本身
    const flagNames = getPairFlagsForRender(p.id, sp.id);
    const flagsHtml = flagNames.length ? `
      <div class="relation-flags">
        ${flagNames.map(name => `<span class="pair-flag-chip">${name}</span>`).join("")}
      </div>
    ` : "";

    // ====================================================================
    // 「歷史紀錄」標記與淡化顯示
    // ====================================================================
    // 兩種「歷史」紀錄合併處理:
    //   - 破局/解約 (sr.dissolved):訂婚後撤回,有 dissolveAction/dissolveStage 等詳情
    //   - 已離異   (sr.matchStage === "已離異"):成婚後解除,有 endYear/endReason
    // 兩者都用淡化色標記,並各自顯示對應的詳細資訊。
    // ====================================================================
    let dissolvedNote = "";
    let isHistorical = false;   // 是否為歷史紀錄(影響 CSS class)

    if (sr && sr.dissolved) {
      // 破局/解約
      isHistorical = true;
      const dissolveActionLabels = {
        "breakOldPromise":   "翻案改議／悔婚",
        "rejectByRite":      "禮法駁回",
        "rejectByHousehold": "後宅駁回",
        "breakWedding":      "婚事告吹"
      };
      const actionLabel = dissolveActionLabels[sr.dissolveAction] || "解約";
      const stageLabel  = sr.dissolveStage || "";
      const byLabel     = sr.dissolvedBy ? `（由${sr.dissolvedBy}提出）` : "";
      const reasonLabel = sr.dissolveReason ? `緣由:${sr.dissolveReason}` : "";
      const parts = [
        `星曆 ${sr.dissolveYear} 年${stageLabel ? `於「${stageLabel}」` : ""}${actionLabel}`,
        byLabel,
        reasonLabel
      ].filter(Boolean);
      dissolvedNote = `<div class="relation-dissolve-note">⚠ 已解約 ・ ${parts.join(" ・ ")}</div>`;
    } else if (sr && sr.matchStage === "已離異") {
      // 已離異(成婚後解除)
      isHistorical = true;
      const endYearLabel = sr.endYear != null ? `星曆 ${sr.endYear} 年離異` : "離異";
      const reasonLabel  = sr.endReason && sr.endReason !== "離異" ? `緣由:${sr.endReason}` : "";
      const parts = [endYearLabel, reasonLabel].filter(Boolean);
      dissolvedNote = `<div class="relation-dissolve-note">⚠ 已離異 ・ ${parts.join(" ・ ")}</div>`;
    } else if (sr && sr.matchStage === "已喪偶") {
      // 已喪偶(配偶過世)
      isHistorical = true;
      const endYearLabel = sr.endYear != null ? `星曆 ${sr.endYear} 年喪偶` : "喪偶";
      dissolvedNote = `<div class="relation-dissolve-note">⚠ ${endYearLabel}</div>`;
    }

    return `<div class="relation-item${isHistorical ? " relation-dissolved" : ""}"><a href="#" class="person-link" onclick="goToPerson(${sp.id});return false;">${sp.name}</a>${meta}${flagsHtml}${dissolvedNote}</div>`;
  }).join("") : '<div class="relation-empty">尚無婚配記錄。</div>';

  const paText = parents.length ? parents.map(pa => {
    const ag = getAge(pa);
    let label = pa.gender === "男" ? "父" : (pa.gender === "女" ? "母" : "父／母");
    let metaParts = [];
    if (ag != null) metaParts.push(`${ag} 歲`);
    if (pa.birthYear != null && p.birthYear != null) {
      const ageAtBirth = p.birthYear - pa.birthYear;
      if (!isNaN(ageAtBirth)) metaParts.push(`生育時 ${ageAtBirth} 歲`);
    }
    if (pa.deceased) metaParts.push("已逝");
    const meta = metaParts.length ? ` <span class="relation-meta">（${metaParts.join("｜")}）</span>` : "";
    return `<div class="relation-item"><span class="relation-label">${label}</span><a href="#" class="person-link" onclick="goToPerson(${pa.id});return false;">${pa.name}</a>${meta}</div>`;
  }).join("") : '<div class="relation-empty">生父／母未記。</div>';

  const chText = children.length ? children.map(ch => {
    const chAge = getAge(ch);
    let label = ch.gender === "男" ? "子" : (ch.gender === "女" ? "女" : "子女");
    let metaParts = [];
    if (chAge != null) metaParts.push(`${chAge} 歲`);
    if (p.birthYear != null && ch.birthYear != null) {
      const ageAtBirth = ch.birthYear - p.birthYear;
      if (!isNaN(ageAtBirth)) metaParts.push(`生育時 ${ageAtBirth} 歲`);
    }
    if (ch.deceased) metaParts.push("已逝");
    const meta = metaParts.length ? ` <span class="relation-meta">（${metaParts.join("｜")}）</span>` : "";
    return `<div class="relation-item"><span class="relation-label">${label}</span><a href="#" class="person-link" onclick="goToPerson(${ch.id});return false;">${ch.name}</a>${meta}</div>`;
  }).join("") : '<div class="relation-empty">尚無子女記錄。</div>';


  rel.innerHTML = `
    <div class="detail-label">配偶（婚配）</div>
    <div class="detail-value relation-list">${spText}</div>
    <div class="detail-label">父母（血親／繼親／養親）</div>
    <div class="detail-value relation-list">${paText}</div>
    <div class="detail-label">子女（血親／繼親／養親）</div>
    <div class="detail-value relation-list">${chText}</div>
  `;
  box.appendChild(rel);

  // ============================================================
  // v7+:名位卷宗 — 任職區塊
  // ============================================================
  if (typeof getActiveAppointments === "function") {
    const apptBox = document.createElement("div");
    apptBox.className = "detail-section";

    const active = getActiveAppointments(p.id);
    const all = Array.isArray(p.appointments) ? p.appointments : [];
    // history 保留原始 index,以便刪除時精準定位到 p.appointments 中的那一筆
    const history = all
      .map((a, i) => ({ a, origIdx: i }))
      .filter(x => x.a.endYear);

    let html = `<h3 class="section-title">名位 / 任職</h3>`;

    if (active.length === 0 && history.length === 0) {
      html += `<p class="hint">此人未曾擔任任何職位。</p>`;
    } else {
      if (active.length) {
        html += `<div class="detail-value"><strong>現任</strong></div><ul class="appt-list">`;
        active.forEach(a => {
          html += `<li>
            <span class="appt-pos">${escapeHtml(describePositionFor(a.positionId))}</span>
            ${a.startYear ? `<span class="appt-year">就任於星曆 ${a.startYear} 年</span>` : ''}
            ${a.note ? `<span class="appt-note">— ${escapeHtml(a.note)}</span>` : ''}
            <button class="btn btn-small" data-appt-action="edit-start" data-pos="${a.positionId}" data-slot="${a.slotIndex ?? ''}">改就任年</button>
            <button class="btn btn-small" data-appt-action="dismiss" data-pos="${a.positionId}" data-slot="${a.slotIndex ?? ''}">卸任</button>
          </li>`;
        });
        html += `</ul>`;
      }
      if (history.length) {
        html += `<div class="detail-value" style="margin-top:.6rem;"><strong>歷任</strong></div><ul class="appt-list appt-list-history">`;
        history.forEach(({ a, origIdx }) => {
          html += `<li>
            <span class="appt-pos">${escapeHtml(describePositionFor(a.positionId))}</span>
            <span class="appt-year">${a.startYear || '?'} — ${a.endYear || '?'}</span>
            ${a.note ? `<span class="appt-note">— ${escapeHtml(a.note)}</span>` : ''}
            <button class="btn btn-small" data-appt-action="delete-history" data-history-idx="${origIdx}">刪除</button>
          </li>`;
        });
        html += `</ul>`;
      }
    }

    // 派任按鈕
    html += `<div style="margin-top:.6rem;">
      <button class="btn btn-small btn-primary" id="apptAppointBtn">派任至職位...</button>
      <a class="btn btn-small" href="dazhou.html" style="margin-left:.4rem;">開啟名位卷宗 →</a>
    </div>`;

    apptBox.innerHTML = html;
    box.appendChild(apptBox);

    // 綁定卸任按鈕
    apptBox.querySelectorAll("[data-appt-action='dismiss']").forEach(btn => {
      btn.addEventListener("click", () => {
        const posId = Number(btn.dataset.pos);
        const slot = btn.dataset.slot === "" ? null : Number(btn.dataset.slot);
        const desc = describePositionFor(posId);
        if (!confirm(`確定將「${p.name}」從「${desc}」卸任?`)) return;
        dismissPerson(p.id, posId, slot);
        renderPersonDetail();
      });
    });

    // 綁定「改就任年」按鈕:允許修改就任日期或留空(留空則不顯示)
    apptBox.querySelectorAll("[data-appt-action='edit-start']").forEach(btn => {
      btn.addEventListener("click", () => {
        const posId = Number(btn.dataset.pos);
        const slot = btn.dataset.slot === "" ? null : Number(btn.dataset.slot);
        // 找到對應的 appointment
        const appt = (p.appointments || []).find(a =>
          a.positionId === posId &&
          !a.endYear &&
          (slot === null || a.slotIndex === slot)
        );
        if (!appt) return;
        const desc = describePositionFor(posId);
        const input = prompt(
          `修改「${p.name}」就任「${desc}」的年份:\n(輸入數字為新年份,留空則不顯示就任日期)`,
          appt.startYear ?? ""
        );
        if (input === null) return;
        const trimmed = String(input).trim();
        if (trimmed === "") {
          appt.startYear = null;
        } else {
          const y = Number(trimmed);
          if (isNaN(y)) {
            alert("就任年份請輸入數字,或留空清除。");
            return;
          }
          appt.startYear = y;
        }
        saveState();
        renderPersonDetail();
      });
    });

    // 綁定「刪除歷任」按鈕:二次確認後從 p.appointments 移除該筆
    apptBox.querySelectorAll("[data-appt-action='delete-history']").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.historyIdx);
        const appt = (p.appointments || [])[idx];
        if (!appt) return;
        const desc = describePositionFor(appt.positionId);
        const yrLabel = `${appt.startYear || '?'} — ${appt.endYear || '?'}`;
        // 第一次確認
        if (!confirm(`確定刪除「${p.name}」的歷任紀錄?\n${desc}(${yrLabel})`)) return;
        // 第二次確認
        if (!confirm(`此操作無法復原,真的要刪除嗎?`)) return;
        p.appointments.splice(idx, 1);
        saveState();
        renderPersonDetail();
      });
    });

    // 綁定派任按鈕
    const appointBtn = apptBox.querySelector("#apptAppointBtn");
    if (appointBtn) {
      appointBtn.addEventListener("click", () => openPersonAppointDialog(p));
    }
  }

  // 動作區塊
  const actions = document.createElement("div");
  actions.className = "detail-section action-group";

// --- 修改出生年份 ---
const editBirthBtn = document.createElement("button");
editBirthBtn.className = "btn btn-small";
editBirthBtn.textContent = "修改出生年份";
editBirthBtn.addEventListener("click", () => {
  const input = prompt(`請輸入「${p.name}」的新出生年份：`, p.birthYear ?? "");
  if (input === null) return;
  const y = Number(input);
  if (isNaN(y)) {
    alert("請輸入正確的數字年份。");
    return;
  }

  p.birthYear = y;

  // 若有死亡年份，自動檢查
  if (p.deathYear && p.deathYear <= state.gameYear) p.deceased = true;
  else p.deceased = false;

  saveState();
  renderPersonDetail();
  renderFamilyDetail();
  advisorSay(`已將「${p.name}」的出生年份更新為星曆 ${y} 年。`);
});
actions.appendChild(editBirthBtn);


  // --- 修改姓名按鈕
  const renameBtn = document.createElement("button");
  renameBtn.className = "btn btn-small";
  renameBtn.textContent = "修改姓名";
  renameBtn.addEventListener("click", () => {
    const newName = prompt("請輸入新的姓名：", p.name);
    if (newName && newName.trim() && newName.trim() !== p.name) {
      p.name = newName.trim();
      saveState();
      renderPersonDetail();
      renderFamilyDetail();
      advisorSay(`已將「${p.name}」改名為「${p.name}」。`);
    }
  });

  // --- 修改屬性按鈕 (新增功能)
  const editAttrBtn = document.createElement("button");
  editAttrBtn.className = "btn btn-small";
  editAttrBtn.textContent = "修改職業/住所/身分";
  editAttrBtn.addEventListener("click", () => {
    // 建立臨時修改 UI
    const promptBox = document.createElement("div");
    promptBox.style.padding = "10px";
    promptBox.style.border = "1px solid #ccc";
    promptBox.style.marginBottom = "10px";
    promptBox.innerHTML = `
      <p>修改人物屬性：</p>
      <label>職業：<select id="editOccSel" value="${p.occupation || ''}"></select></label><br>
      <label>居所：<select id="editResSel" value="${p.residence || ''}"></select></label><br>
      <label>身分：<select id="editRoleSel" value="${p.role || ''}"></select></label><br>
    `;
    
    // 填充下拉選單
    function populateSelect(id, options, currentValue) {
      const sel = promptBox.querySelector(`#${id}`);
      if (!sel) return;
      sel.innerHTML = "";
      const opt0 = document.createElement("option");
      opt0.value = ""; opt0.textContent = "未記載/未標註"; sel.appendChild(opt0);
      options.forEach(o => {
        const opt = document.createElement("option");
        opt.value = o; opt.textContent = o;
        sel.appendChild(opt);
      });
      sel.value = currentValue;
    }
    
    populateSelect("editOccSel", state.occOptions, p.occupation);
    populateSelect("editResSel", state.resOptions, p.residence);
    populateSelect("editRoleSel", state.roleOptions, p.role);

    const saveEditBtn = document.createElement("button");
    saveEditBtn.className = "btn btn-small";
    saveEditBtn.textContent = "確認修改";
    saveEditBtn.onclick = () => {
      const newOcc = promptBox.querySelector("#editOccSel").value;
      const newRes = promptBox.querySelector("#editResSel").value;
      const newRole = promptBox.querySelector("#editRoleSel").value;

      p.occupation = newOcc;
      p.residence = newRes;
      p.role = newRole;
      
      saveState();
      renderPersonDetail();
      renderFamilyDetail();
      advisorSay(`已更新「${p.name}」的職業/住所/身分。`);
      promptBox.remove();
    };

    const cancelEditBtn = document.createElement("button");
    cancelEditBtn.className = "btn btn-small";
    cancelEditBtn.textContent = "取消";
    cancelEditBtn.onclick = () => promptBox.remove();

    promptBox.appendChild(saveEditBtn);
    promptBox.appendChild(cancelEditBtn);
    
    actions.parentNode.insertBefore(promptBox, actions);
  });

  // --- 解除婚約按鈕 (新增功能)
  const divorceBtn = document.createElement("button");
  divorceBtn.className = "btn btn-small btn-warning";
  divorceBtn.textContent = "解除婚約";
  divorceBtn.addEventListener("click", () => {
      // ----- 修正(v6+) -----
      // 只列「現役配偶」可解約,不列已解約/已離異的歷史紀錄。
      // 用 _isActiveRelation 判斷(在 spouses 取得邏輯處已定義)。
      // -------------------
      const activeSpouses = spouses.filter(sp => {
        const rel = p.spouseRelations.find(r => r.id === sp.id);
        return rel && _isActiveRelation(rel, p.spouseIds);
      });
      if (!activeSpouses.length) {
          advisorSay(`「${p.name}」目前沒有現役婚配,無法解除。`);
          return;
      }
      
      const promptBox = document.createElement("div");
      promptBox.style.padding = "10px";
      promptBox.style.border = "1px solid #ccc";
      promptBox.style.marginBottom = "10px";
      promptBox.innerHTML = `
          <p>請選擇要解除婚約的配偶:</p>
          <label>配偶:<select id="divorceSpouseSel"></select></label><br>
      `;

      const sel = promptBox.querySelector("#divorceSpouseSel");
      activeSpouses.forEach(sp => {
          const opt = document.createElement("option");
          opt.value = String(sp.id);
          const rel = p.spouseRelations.find(r => r.id === sp.id)?.type || '婚配';
          opt.textContent = `${sp.name}（${rel}）`;
          sel.appendChild(opt);
      });

      const confirmDivorceBtn = document.createElement("button");
      confirmDivorceBtn.className = "btn btn-small btn-danger";
      confirmDivorceBtn.textContent = "確認解除";
      confirmDivorceBtn.onclick = () => {
          const spouseId = Number(sel.value);
          const spouse = state.persons.find(x => x.id === spouseId);
          if (!spouse) return;

          // v6:不再直接刪除 spouseRelations,改成標記離異狀態,
          // 這樣家族詳情的聯姻紀錄仍能呈現這樁親事的存在與結局。
          const yr = state.gameYear;
          const relP = (p.spouseRelations || []).find(r => r.id === spouseId);
          const relS = (spouse.spouseRelations || []).find(r => r.id === p.id);
          if (relP) {
            relP.endYear = yr;
            relP.endReason = "離異";
            relP.matchStage = "已離異";
          }
          if (relS) {
            relS.endYear = yr;
            relS.endReason = "離異";
            relS.matchStage = "已離異";
          }
          // 從現役配偶清單移除(spouseIds 代表「現任」),
          // 但 spouseRelations 仍保留作為歷史紀錄。
          p.spouseIds = (p.spouseIds || []).filter(id => id !== spouseId);
          spouse.spouseIds = (spouse.spouseIds || []).filter(id => id !== p.id);

          saveState();
          renderPersonDetail();
          renderFamilyDetail();
          advisorSay(`已解除「${p.name}」與「${spouse.name}」的婚約,紀錄留作族譜參考。`);
          promptBox.remove();
      };

      const cancelDivorceBtn = document.createElement("button");
      cancelDivorceBtn.className = "btn btn-small";
      cancelDivorceBtn.textContent = "取消";
      cancelDivorceBtn.onclick = () => promptBox.remove();

      promptBox.appendChild(confirmDivorceBtn);
      promptBox.appendChild(cancelDivorceBtn);

      actions.parentNode.insertBefore(promptBox, actions);
  });

  // --- 修改結婚年份／名分 (議親室搬過來) ---
  const editMarriageBtn = document.createElement("button");
  editMarriageBtn.className = "btn btn-small";
  editMarriageBtn.textContent = "修改結婚年份/名分";
  editMarriageBtn.addEventListener("click", () => {
    if (!spouses.length) {
      advisorSay(`「${p.name}」目前沒有婚配記錄,無法修改。`);
      return;
    }

    const promptBox = document.createElement("div");
    promptBox.style.padding = "10px";
    promptBox.style.border = "1px solid #ccc";
    promptBox.style.marginBottom = "10px";
    promptBox.style.background = "#fef9ed";
    promptBox.style.borderRadius = "6px";

    // 名分可選項
    // 「婚配」為正妻/夫的標準名分(與 match.js 一致),放第一位作為預設。
    // 「訂婚」為特殊狀態,放最後。
    const TYPES = ["婚配", "平妻", "繼室", "妾", "入贅", "訂婚"];

    promptBox.innerHTML = `
      <p style="margin:0 0 8px;"><strong>修改「${p.name}」的婚姻紀錄</strong></p>
      <label>配偶：<select id="emSpouseSel"></select></label><br>
      <label style="display:inline-block;margin-top:6px;">結婚年份:<input id="emYearInput" type="number" style="width:90px;" /></label>
      <label style="display:inline-block;margin-left:10px;">名分/類型:<select id="emTypeSel"></select></label><br>
      <p style="font-size:11px;color:#8b7355;margin:6px 0 0;">提示:會同步更新雙方紀錄。若名分改為「入贅」,日後新增的子嗣會自動歸到母方家族。</p>
    `;

    const spSel = promptBox.querySelector("#emSpouseSel");
    const yearInput = promptBox.querySelector("#emYearInput");
    const typeSel = promptBox.querySelector("#emTypeSel");

    // 填充配偶選單
    // 顯示規則:有年份就顯示「星曆 X 年」,沒有年份就只顯示名分,
    // 不再硬寫「未成婚」(避免婚配無年份時被誤標)。
    spouses.forEach(sp => {
      const rel = p.spouseRelations.find(r => r.id === sp.id);
      // 結婚年份相容舊資料:優先讀 marryYear,fallback 到 year
      const yr = rel?.marryYear ?? rel?.year;
      const type = rel?.type || "未記";
      const yearPart = yr ? `・星曆 ${yr} 年` : "";
      const opt = document.createElement("option");
      opt.value = String(sp.id);
      opt.textContent = `${sp.name}(${type}${yearPart})`;
      spSel.appendChild(opt);
    });

    // 填充名分選單
    TYPES.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t;
      opt.textContent = t;
      typeSel.appendChild(opt);
    });

    // 切換配偶時自動帶入該段現有資料
    function fillFromSelected() {
      const sId = Number(spSel.value);
      const rel = p.spouseRelations.find(r => r.id === sId);
      if (rel) {
        // 結婚年份相容舊資料:優先讀 marryYear,fallback 到 year
        yearInput.value = rel.marryYear ?? rel.year ?? "";
        typeSel.value = TYPES.includes(rel.type) ? rel.type : "婚配";
      }
    }
    fillFromSelected();
    spSel.addEventListener("change", fillFromSelected);

    const confirmBtn = document.createElement("button");
    confirmBtn.className = "btn btn-small btn-primary";
    confirmBtn.textContent = "確認修改";
    confirmBtn.style.marginTop = "8px";
    confirmBtn.onclick = () => {
      const spouseId = Number(spSel.value);
      const spouse = state.persons.find(x => x.id === spouseId);
      if (!spouse) return;

      const newYearRaw = yearInput.value.trim();
      const newType = typeSel.value;

      const rA = p.spouseRelations.find(r => r.id === spouseId);
      const rB = spouse.spouseRelations.find(r => r.id === p.id);

      const changes = [];

      if (newYearRaw !== "") {
        const yr = Number(newYearRaw);
        if (isNaN(yr)) {
          alert("結婚年份請輸入數字。");
          return;
        }
        if (rA) { rA.marryYear = yr; delete rA.year; }
        if (rB) { rB.marryYear = yr; delete rB.year; }
        // 若有 marryYear 則 matchStage 自動設為已婚
        if (rA) rA.matchStage = "已婚";
        if (rB) rB.matchStage = "已婚";
        changes.push(`結婚年份改為星曆 ${yr} 年`);
      } else {
        // 留空 = 解除已婚標記,改為未成婚(訂婚狀態)
        if (rA) { rA.marryYear = null; rA.matchStage = "已定親"; delete rA.year; }
        if (rB) { rB.marryYear = null; rB.matchStage = "已定親"; delete rB.year; }
        changes.push("結婚年份留空(視為未成婚/訂婚狀態)");
      }

      if (newType) {
        if (rA) rA.type = newType;
        if (rB) rB.type = newType;
        changes.push(`名分改為「${newType}」`);
      }

      saveState();
      renderPersonDetail();
      renderFamilyDetail();
      advisorSay(`已修改「${p.name}」與「${spouse.name}」的婚姻紀錄:${changes.join(",")}。`);
      promptBox.remove();
    };

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn btn-small";
    cancelBtn.textContent = "取消";
    cancelBtn.style.marginTop = "8px";
    cancelBtn.style.marginLeft = "6px";
    cancelBtn.onclick = () => promptBox.remove();

    promptBox.appendChild(confirmBtn);
    promptBox.appendChild(cancelBtn);

    actions.parentNode.insertBefore(promptBox, actions);
  });

// --- 修改父母 (v4:改為 modal 選擇式,不再輸入 ID) ---
const editParentsBtn = document.createElement("button");
editParentsBtn.className = "btn btn-small";
editParentsBtn.textContent = "修改父母";
editParentsBtn.addEventListener("click", () => {
  openEditParentsModal(p);
});
actions.appendChild(editParentsBtn);


// --- 為其增加父母
const fatherBtn = document.createElement("button");
fatherBtn.className = "btn btn-small";
fatherBtn.textContent = "為其添加父親";
fatherBtn.addEventListener("click", () => {
  enterParentMode(p.id, "男");
  window.location.hash = "addPerson";
});

actions.appendChild(fatherBtn);

const motherBtn = document.createElement("button");
motherBtn.className = "btn btn-small";
motherBtn.textContent = "為其添加母親";
motherBtn.addEventListener("click", () => {
  enterParentMode(p.id, "女");
  window.location.hash = "addPerson";
});

actions.appendChild(motherBtn);



  
  // --- 其他原有按鈕

  const childBtn = document.createElement("button");
  childBtn.className = "btn btn-small";
  childBtn.textContent = "為其添加子女";
  childBtn.addEventListener("click", () => {
    enterChildMode(p.id);
    window.location.hash = "addPerson";
  });

  const famSel = document.createElement("select");
  const opt0 = document.createElement("option");
  opt0.value = ""; opt0.textContent = "變更隸屬家族"; famSel.appendChild(opt0);
  const optNone = document.createElement("option");
  optNone.value = "none"; optNone.textContent = "未歸宗族"; famSel.appendChild(optNone);
  state.families.forEach(f => {
    const opt = document.createElement("option");
    opt.value = String(f.id);
    opt.textContent = (typeof getFamilyDisplayName === "function")
      ? getFamilyDisplayName(f)
      : f.name;
    famSel.appendChild(opt);
  });

  const famBtn = document.createElement("button");
  famBtn.className = "btn btn-small";
  famBtn.textContent = "套用";
  famBtn.addEventListener("click", () => {
    const v = famSel.value;
    if (!v) return;
    if (v === "none") {
      p.familyId = null;
      advisorSay(`已將「${p.name}」設為未歸宗族。`);
    } else {
      p.familyId = Number(v);
      const ff = state.families.find(x => x.id === p.familyId);
      advisorSay(`已將「${p.name}」改隸屬於「${ff ? ff.name : "未知家族"}」。`);
    }
    saveState();
    renderFamilies();
    renderFamilyDetail();
    renderPersonDetail();
  });

  const spouseFamSel = document.createElement("select");
  const sf0 = document.createElement("option");
  sf0.value = ""; sf0.textContent = "配偶所屬家族"; spouseFamSel.appendChild(sf0);
  state.families.forEach(f => {
    const opt = document.createElement("option");
    opt.value = String(f.id);
    opt.textContent = (typeof getFamilyDisplayName === "function")
      ? getFamilyDisplayName(f)
      : f.name;
    spouseFamSel.appendChild(opt);
  });

  const spouseSel = document.createElement("select");
  const ss0 = document.createElement("option");
  ss0.value = ""; ss0.textContent = "選擇配偶"; spouseSel.appendChild(ss0);

  function populateSpouseOptions(familyId) {
    spouseSel.innerHTML = "";
    spouseSel.appendChild(ss0);
    const persons = state.persons.filter(p => {
      if (p.id === state.selectedPersonId) return false;
      if (p.spouseIds.includes(state.selectedPersonId)) return false; // 排除已婚
      if (familyId) {
        return p.familyId === Number(familyId);
      }
      return true; // 如果沒有選擇家族，顯示所有人
    });
    persons.forEach(sp => {
      const opt = document.createElement("option");
      opt.value = String(sp.id);
      opt.textContent = `${sp.name}（${sp.gender || "性別未記"}，${getAge(sp) != null ? getAge(sp) + '歲' : '年齡未記'}）`;
      spouseSel.appendChild(opt);
    });
  }

  spouseFamSel.addEventListener("change", () => {
    populateSpouseOptions(spouseFamSel.value);
  });
  populateSpouseOptions(null);

  const relSel = document.createElement("select");
  const rs0 = document.createElement("option");
  rs0.value = ""; rs0.textContent = "選擇關係"; relSel.appendChild(rs0);
  SPOUSE_TYPES.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t; opt.textContent = t; relSel.appendChild(opt);
  });

  const spouseBtn = document.createElement("button");
  spouseBtn.className = "btn btn-small";
  spouseBtn.textContent = "結為連理";
  spouseBtn.addEventListener("click", () => {
    const spId = Number(spouseSel.value);
    const relType = relSel.value || "婚配";
    if (!spId) { advisorSay("請選擇一位配偶。"); return; }
    if (!relType) { advisorSay("請選擇一種關係類型。"); return; }
    const sp = state.persons.find(x => x.id === spId);
if (!sp) return;

// 取得結婚年份
let yearInput = prompt(`請輸入「${p.name}」與「${sp.name}」的結婚年份（可留空）`, state.gameYear);
let marryYear = null;
if (yearInput && !isNaN(Number(yearInput))) {
  marryYear = Number(yearInput);
}

// 建立 spouseIds
if (!p.spouseIds.includes(spId)) p.spouseIds.push(spId);
if (!sp.spouseIds.includes(p.id)) sp.spouseIds.push(p.id);

// 更新 spouseRelations
// 注意:欄位名稱統一用 marryYear(與議親室/修改對話框一致),
// 並依是否有結婚年份設定 matchStage。
const stage = marryYear != null ? "已婚" : "已定親";

let pRel = p.spouseRelations.find(r => r.id === spId);
if (!pRel) {
  pRel = { id: spId, type: relType, marryYear: marryYear, matchStage: stage };
  p.spouseRelations.push(pRel);
} else {
  pRel.type = relType;
  pRel.marryYear = marryYear;
  pRel.matchStage = stage;
}

let spRel = sp.spouseRelations.find(r => r.id === p.id);
if (!spRel) {
  spRel = { id: p.id, type: relType, marryYear: marryYear, matchStage: stage };
  sp.spouseRelations.push(spRel);
} else {
  spRel.type = relType;
  spRel.marryYear = marryYear;
  spRel.matchStage = stage;
}

saveState();
renderPersonDetail();
renderFamilyDetail();
advisorSay(`已為「${p.name}」與「${sp.name}」訂下婚約（${relType}），結婚年份：${marryYear ?? "未記載"}。`);
  });

  actions.appendChild(renameBtn);
  actions.appendChild(editAttrBtn); // 新增屬性修改按鈕
  actions.appendChild(divorceBtn);  // 新增離婚按鈕
  actions.appendChild(editMarriageBtn); // 修改結婚年份/名分
  actions.appendChild(childBtn);
  actions.appendChild(famSel);
  actions.appendChild(famBtn);
  actions.appendChild(spouseFamSel);
  actions.appendChild(spouseSel);
  actions.appendChild(relSel);
  actions.appendChild(spouseBtn);

  // 加入刪除按鈕
  const deleteBtn = document.createElement("button");
  deleteBtn.className = "btn btn-small btn-danger";
  deleteBtn.textContent = "刪除人物記錄";
  deleteBtn.addEventListener("click", () => {
    if (confirm(`確定要刪除人物「${p.name}」的記錄嗎？此操作不可逆。`)) {
        deletePerson(p.id);
    }
  });
  actions.appendChild(deleteBtn);
  
  box.appendChild(actions);
  
  // 領養子女 UI
  box.appendChild(renderAdoptChildUi(p));
}

function deleteFamily(familyId) {
    const f = state.families.find(x => x.id === familyId);
    if (!f) return;

    // 1. 移除所有成員對該家族的歸屬
    state.persons.forEach(p => {
        if (p.familyId === familyId) {
            p.familyId = null;
        }
    });

    // 2. 移除家族本身
    state.families = state.families.filter(x => x.id !== familyId);

    // 3. 更新選中的家族/人物
    if (state.selectedFamilyId === familyId) {
        state.selectedFamilyId = null;
    }
    if (state.persons.find(p => p.familyId === state.selectedFamilyId) === undefined) {
      state.selectedFamilyId = state.families.length ? state.families[0].id : null;
    }
    state.selectedPersonId = null;

    saveState();
    renderFamilies();
    renderFamilyDetail();
    renderPersonDetail();
    renderRegions();
    renderAdvisorLocationSelect();
    advisorSay(`已將「${f.name}」的家族記錄徹底刪除。`);
}

function deletePerson(personId) {
    const p = state.persons.find(x => x.id === personId);
    if (!p) return;

    // 1. 移除所有親屬關係
    state.persons.forEach(person => {
        // 移除父母關係
        person.parentIds = (person.parentIds || []).filter(id => id !== personId);
        // 移除子女關係
        person.childIds = (person.childIds || []).filter(id => id !== personId);
        // 移除配偶關係
        person.spouseIds = (person.spouseIds || []).filter(id => id !== personId);
        person.spouseRelations = (person.spouseRelations || []).filter(r => r.id !== personId);
    });

    // 2. 移除人物本身
    state.persons = state.persons.filter(x => x.id !== personId);

    // 3. 更新選中的人物
    const oldFamilyId = p.familyId;
    state.selectedPersonId = null;
    state.childModeParentId = null;
    
    // 如果舊家族仍有成員，保持家族選中
    const familyHasMembers = state.persons.some(mem => mem.familyId === oldFamilyId);
    if (!familyHasMembers) {
      state.selectedFamilyId = null;
    }

    saveState();
    renderFamilies();
    renderFamilyDetail();
    renderPersonDetail();
    renderAdvisorLocationSelect();
    advisorSay(`已將「${p.name}」的族人記錄徹底刪除。`);
}


function renderAdoptChildUi(person) {
  const box = document.createElement("div");
  box.className = "detail-section";

  let title = document.createElement("div");
  title.className = "detail-label";
  title.textContent = "領養子女";
  box.appendChild(title);

  // 1. 家族篩選 Select
  const famSel = document.createElement("select");
  const fam0 = document.createElement("option");
  fam0.value = ""; fam0.textContent = "選擇子女所屬家族（可不選）"; famSel.appendChild(fam0);
  state.families.forEach(f => {
      const opt = document.createElement("option");
      opt.value = String(f.id);
      opt.textContent = (typeof getFamilyDisplayName === "function")
        ? getFamilyDisplayName(f)
        : f.name;
      famSel.appendChild(opt);
  });
  box.appendChild(famSel);

  // 2. 子女選擇 Select
  let sel = document.createElement("select");
  sel.id = "adoptChildSelect";
  box.appendChild(sel);

  // 3. 填充子女選項的函數
  function populateChildOptions(familyId) {
      sel.innerHTML = "";
      const def = document.createElement("option");
      def.value = "";
      def.textContent = "選擇子女";
      sel.appendChild(def);

      const persons = state.persons.filter(p => {
          if (p.id === person.id) return false; // 排除自己
          if ((p.parentIds || []).includes(person.id)) return false; // 排除已是子女的
          
          let candidateFamilies = state.families.map(f => f.id);
          if (familyId) {
              candidateFamilies = [Number(familyId)]; // 依家族篩選
          }
          
          const isCandidate = candidateFamilies.includes(p.familyId) || (!familyId && p.familyId === null);
          
          return isCandidate;
      });

      persons.forEach(p => {
          let opt = document.createElement("option");
          opt.value = p.id;
          opt.textContent = `${p.name}（${p.gender || "性別未記"}，${getAge(p) != null ? getAge(p) + '歲' : '年齡未記'}）`;
          sel.appendChild(opt);
      });
  }

  // 4. 家族選擇變更事件
  famSel.addEventListener("change", () => {
      populateChildOptions(famSel.value);
  });

  // 初始填充
  populateChildOptions(null);

  let btn = document.createElement("button");
  btn.className = "btn btn-small";
  btn.textContent = "確認領養";

  btn.onclick = () => {
    let cid = Number(sel.value);
    if (!cid) { advisorSay("請選擇一位子女進行領養。"); return; }

    let child = state.persons.find(p => p.id === cid);
    if (!child) return;

    if (linkParentChild(person, child, {})) {
      saveState();
      renderPersonDetail();
      renderFamilyDetail();
      advisorSay(`「${person.name}」已領養「${child.name}」。`);
    }
  };

  box.appendChild(btn);
  return box;
}



// ============================================================
// v4 新增:修改父母 modal (選人式, 不再輸入 ID)
// ============================================================

function openEditParentsModal(person) {
  // 先把同 ID 的舊 modal 清掉(避免重複開啟造成多個重疊)
  const old = document.getElementById("editParentsModal");
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.id = "editParentsModal";
  modal.className = "modal";

  // 現有父母(用來預設選中)
  const currentParents = (person.parentIds || [])
    .map(id => state.persons.find(x => x.id === id))
    .filter(Boolean);
  const currentFather = currentParents.find(pp => pp.gender === "男");
  const currentMother = currentParents.find(pp => pp.gender === "女");
  // 性別未記的父母,我們將其視為 currentOther
  const currentOther = currentParents.find(pp => pp.gender !== "男" && pp.gender !== "女");

  // 候選人:排除自己與自己的子孫(避免迴圈)
  const descendants = collectDescendants(person.id);
  const candidates = state.persons.filter(pp =>
    pp.id !== person.id && !descendants.has(pp.id)
  );

  function buildOptions(filterGender, currentId) {
    let opts = '<option value="">— 未指定 —</option>';
    candidates.forEach(pp => {
      if (filterGender && pp.gender !== filterGender && pp.gender !== "") return;
      const age = getAge(pp);
      const ageTxt = age != null ? `,${age} 歲` : "";
      const famName = pp.familyId
        ? (state.families.find(f => f.id === pp.familyId)?.name || "未歸宗族")
        : "未歸宗族";
      const dead = pp.deceased ? " 【已逝】" : "";
      const selected = pp.id === currentId ? ' selected' : '';
      opts += `<option value="${pp.id}"${selected}>${pp.name} (${famName}${ageTxt})${dead}</option>`;
    });
    return opts;
  }

  modal.innerHTML = `
    <div class="modal-content">
      <h3>修改「${person.name}」的父母</h3>
      <div class="modal-body">
        <div style="margin-bottom:12px;">
          <label>父親</label>
          <select id="editFatherSel">${buildOptions("男", currentFather ? currentFather.id : null)}</select>
        </div>
        <div style="margin-bottom:12px;">
          <label>母親</label>
          <select id="editMotherSel">${buildOptions("女", currentMother ? currentMother.id : null)}</select>
        </div>
        <div style="margin-bottom:8px;">
          <label>其他(性別未記)</label>
          <select id="editOtherSel">${buildOptions(null, currentOther ? currentOther.id : null)}</select>
          <div class="hint">若有第三方養親或性別未記者,可在此選擇。</div>
        </div>
      </div>
      <div class="card-footer">
        <button id="editParentsCancelBtn" class="btn">取消</button>
        <button id="editParentsConfirmBtn" class="btn btn-primary">確認</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("editParentsCancelBtn").addEventListener("click", () => modal.remove());
  document.getElementById("editParentsConfirmBtn").addEventListener("click", () => {
    const fId = document.getElementById("editFatherSel").value;
    const mId = document.getElementById("editMotherSel").value;
    const oId = document.getElementById("editOtherSel").value;
    const newParentIds = [fId, mId, oId]
      .filter(v => v !== "")
      .map(v => Number(v))
      .filter(v => !isNaN(v));
    // 去重(萬一同一人在多 select 被選到)
    const uniqueIds = [...new Set(newParentIds)];

    // 清掉舊父母的 childIds
    (person.parentIds || []).forEach(pidOld => {
      const oldP = findPerson(pidOld);
      if (oldP) {
        oldP.childIds = (oldP.childIds || []).filter(cid => cid !== person.id);
      }
    });
    person.parentIds = [];

    // 接上新父母
    uniqueIds.forEach(pid => {
      const pa = findPerson(pid);
      if (pa) {
        person.parentIds.push(pa.id);
        if (!pa.childIds.includes(person.id)) pa.childIds.push(person.id);
      }
    });

    normalizeRelations();
    saveState();
    renderPersonDetail();
    renderFamilyDetail();
    advisorSay(`已更新「${person.name}」的父母資料。`);
    modal.remove();
  });

  // 點背景關閉
  modal.addEventListener("click", (ev) => {
    if (ev.target === modal) modal.remove();
  });
}

// 收集某人的所有後代 ID (防止指定自己後代為父母)
function collectDescendants(rootId) {
  const result = new Set();
  const queue = [rootId];
  while (queue.length) {
    const curId = queue.shift();
    const cur = state.persons.find(x => x.id === curId);
    if (!cur) continue;
    (cur.childIds || []).forEach(cid => {
      if (!result.has(cid)) {
        result.add(cid);
        queue.push(cid);
      }
    });
  }
  return result;
}
