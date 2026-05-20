// render-list.js
// 家族列表渲染、家族詳情渲染、姓氏筆畫排序、世代計算

// ---------- 列表與詳情 ----------

function getStroke(ch) {
  return STROKE_TABLE[ch] ?? 99;
}

function renderFamilies() {
  const list = $("familyList");
  list.innerHTML = "";

  // ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
  // ★ 搜尋欄位（若存在則讀取）
  // ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
  const keyword = $("familySearch")?.value.trim() || "";

  // ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
  // ★ 未歸宗族區塊
  // ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
  const noFamMembers = state.persons.filter(p => !p.familyId);
  const divNoFam = document.createElement("div");
  divNoFam.className = "list-item" + (state.selectedFamilyId === "noFamily" ? " active" : "");
  
  divNoFam.innerHTML = `
    <div class="list-main">
      <div class="list-title">未歸宗族</div>
      <div class="list-sub">共 ${noFamMembers.length} 人</div>
    </div>
    <div class="badge">無隸屬家族</div>
  `;

  divNoFam.addEventListener("click", () => {
    state.selectedFamilyId = "noFamily";
    state.selectedPersonId = null;
    renderFamilies();
    renderFamilyDetail();
    renderPersonDetail();
    advisorSay("已開啟「未歸宗族」名錄。");
  });

  list.appendChild(divNoFam);

  // ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
  // ★ 若沒有家族
  // ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
  if (!state.families.length) {
    const div = document.createElement("div");
    div.className = "list-item";
    div.innerHTML = `
      <div class="list-main">
        <div class="list-title">尚無正式家族</div>
        <div class="list-sub">請先建立家族。</div>
      </div>`;
    list.appendChild(div);
    return;
  }

  // ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
  // ★ 家族資料（加入搜尋 + 筆畫排序）
  // ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
  let fams = [...state.families];

  // 搜尋
  if (keyword) {
    fams = fams.filter(f => f.name.includes(keyword));
  }

  // 筆畫排序（先筆畫、再字典順）
  fams.sort((a, b) => {
    const sa = getStroke(a.name[0]);
    const sb = getStroke(b.name[0]);
    if (sa !== sb) return sa - sb;
    return a.name.localeCompare(b.name, "zh-Hant");
  });

  // ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
  // ★ 依筆畫分組（折疊群組）
  // ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
  const groups = {};
  fams.forEach(f => {
    const s = getStroke(f.name[0]);
    if (!groups[s]) groups[s] = [];
    groups[s].push(f);
  });

  Object.keys(groups)
    .sort((a, b) => Number(a) - Number(b))
    .forEach(stroke => {

      const famList = groups[stroke];

      // 群組標題（可折疊）
      const title = document.createElement("div");

      title.className = "list-item";
      title.style.fontWeight = "bold";
      title.style.cursor = "pointer";
      title.innerHTML = `
        <div class="list-main">
          <div class="list-title">【${stroke} 畫】 (${famList.length} 家族)</div>
        </div>
      `;

      // 群組內容
      const groupBox = document.createElement("div");
     
      // ★ 預設為「折疊」
      groupBox.style.display = "none";

      groupBox.id = "strokeGroup-" + stroke;
      groupBox.style.marginLeft = "10px";
      groupBox.style.marginBottom = "6px";

      if (keyword) {
    groupBox.style.display = "block";
}

      // 點擊折疊
      title.addEventListener("click", () => {
        groupBox.style.display = groupBox.style.display === "none" ? "block" : "none";
      });

      list.appendChild(title);

      // ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
      // ★ 群組內的家族項目
      // ＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝＝
      famList.forEach(f => {
        const members = state.persons.filter(p => p.familyId === f.id);
        const alive = members.filter(p => !p.deceased).length;
        const dead = members.filter(p => p.deceased).length;

        const div = document.createElement("div");
        div.className = "list-item" + (state.selectedFamilyId === f.id ? " active" : "");

        const main = document.createElement("div");
        main.className = "list-main";

        const t = document.createElement("div");
        t.className = "list-title";
        // 從備註首句抽郡望(如「琅琊王氏」),抽不到退回「姓+氏」
        // 規則:只看 notes 的第一段(到第一個句點/逗點為止),抓「XX{姓}氏」
        let title = `${f.name}氏`;
        if (f.notes) {
          const firstSeg = f.notes.split(/[。，,.]/)[0] || "";
          // 配對:任意 1-3 字 + 本族姓氏 + 氏,且要出現在首段開頭(允許前面有空白)
          const re = new RegExp(`^\\s*(.{1,3}${f.name}氏)`);
          const m = firstSeg.match(re);
          if (m) title = m[1];
        }
        t.textContent = title;

        const s = document.createElement("div");
        s.className = "list-sub";
        s.textContent = `成員 ${members.length}（在世 ${alive}／已逝 ${dead}）`;

        main.appendChild(t);
        main.appendChild(s);

        const badge = document.createElement("div");
        badge.className = "badge";
        badge.textContent = f.territory || "據點未定";

        div.appendChild(main);
        div.appendChild(badge);

        div.addEventListener("click", () => {
          state.selectedFamilyId = f.id;
          state.selectedPersonId = null;
          renderFamilies();
          renderFamilyDetail();
          renderPersonDetail();
          advisorSay(`已開啟「${f.name}」族譜。`);
        });

        groupBox.appendChild(div);
      });

      list.appendChild(groupBox);
    });
}


// v6 修正：代數應依「同家族內」的血脈推算。
// 過去版本以 max(所有父母) + 1 計算,
// 但若其中一位父母是從外姓嫁/娶入(沒有 familyId 或 familyId 與本人不同),
// 就會把對方在「他/她原生家族」的代數帶進來,
// 造成例如:本家第二代之子卻被算成第四代之類的錯誤。
//
// 新規則:
//   - 沒有 parentIds                                → 第 1 代
//   - 只取與本人 familyId 相同的父母來推導         → 取其中最大代數 + 1
//   - 若 parentIds 全為外姓(本人是入贅/嫁入者之子,
//     而那一支血脈不屬於本家族)                    → 視為第 1 代(本家族中該支的開端)
//   - 本人沒有 familyId(未歸宗族)時退回舊行為,
//     仍取 max(所有父母) + 1。
function computeGeneration(id, memo = {}) {
  if (memo[id] != null) return memo[id];
  const p = state.persons.find(x => x.id === id);
  if (!p) {
    memo[id] = 1;
    return 1;
  }
  if (!p.parentIds || !p.parentIds.length) {
    memo[id] = 1;
    return 1;
  }

  // 取父母人物物件,過濾已不存在者
  const parentObjs = p.parentIds
    .map(pid => state.persons.find(x => x.id === pid))
    .filter(Boolean);

  if (!parentObjs.length) {
    memo[id] = 1;
    return 1;
  }

  // 未歸宗族者:沿用舊邏輯,看所有父母
  if (!p.familyId) {
    let maxGen = 0;
    parentObjs.forEach(par => {
      const g = computeGeneration(par.id, memo);
      if (g > maxGen) maxGen = g;
    });
    memo[id] = maxGen + 1;
    return memo[id];
  }

  // 已歸宗族:只取同家族的父母
  const sameFamilyParents = parentObjs.filter(par => par.familyId === p.familyId);

  if (!sameFamilyParents.length) {
    // 父母都不在本家族(本人是被收養或嫁/娶入而生的後代,血脈起點在本家族)
    memo[id] = 1;
    return 1;
  }

  let maxGen = 0;
  sameFamilyParents.forEach(par => {
    const g = computeGeneration(par.id, memo);
    if (g > maxGen) maxGen = g;
  });
  memo[id] = maxGen + 1;
  return memo[id];
}

function renderFamilyDetail() {
  const box = $("familyDetail");
  box.innerHTML = "";
   // ================
  // 未歸宗族顯示
  // ================
  if (state.selectedFamilyId === "noFamily") {
    const box = $("familyDetail");
    box.innerHTML = "";

    const title = document.createElement("h2");
    title.className = "detail-title";
    title.textContent = "未歸宗族人物";
    box.appendChild(title);

    const list = state.persons.filter(p => !p.familyId);

    if (!list.length) {
      box.innerHTML += `<p class="hint">目前沒有未歸宗族的人。</p>`;
      return;
    }

    const memBlock = document.createElement("div");
    memBlock.className = "detail-section";
    memBlock.innerHTML = `
      <div class="detail-label">成員（點擊姓名查看人物資訊）</div>
      <div id="familyMembersList" class="detail-value member-list"></div>
    `;
    box.appendChild(memBlock);

    const memberList = $("familyMembersList");

    list.forEach(p => {
      const div = document.createElement("div");
      div.className = "member-item" + (state.selectedPersonId === p.id ? " active" : "") + (p.deceased ? " deceased" : "");
      const age = getAge(p);
      const ageText = age != null ? age + " 歲" : "年齡未記";

      // v7+:現任職位摘要
      let appointmentLine = "";
      if (typeof getActiveAppointments === "function") {
        const active = getActiveAppointments(p.id);
        if (active.length) {
          const positions = active
            .map(a => {
              const pos = state.positions.find(x => x.id === a.positionId);
              if (!pos) return null;
              return (pos.system && pos.system !== pos.position)
                ? `${pos.system}・${pos.position}`
                : pos.position;
            })
            .filter(Boolean);
          if (positions.length) {
            appointmentLine = `<span class="member-appt">任 ${positions.map(escapeHtml).join("、")}</span>`;
          }
        }
      }

      div.innerHTML = `
        <span class="member-name">${p.deceased ? "【已逝】" : ""}${p.name}</span>
        <span class="member-info">${ageText}</span>
        ${appointmentLine}
      `;
      div.addEventListener("click", () => {
        state.selectedPersonId = p.id;
        renderPersonDetail();
        renderFamilyDetail();
      });

      memberList.appendChild(div);
    });

    return;
  }

  const f = state.families.find(x => x.id === state.selectedFamilyId);
  if (!f) {
    box.innerHTML = '<p class="hint">家族資料錯誤。</p>';
    return;
  }

  const title = document.createElement("h2");
  title.className = "detail-title";
  title.textContent = f.name;
  box.appendChild(title);

  const info = document.createElement("div");
  info.className = "detail-section";
  info.innerHTML = `
    <div class="detail-label">家族出身／區域／據點</div>
    <div class="detail-value">${f.origin || "出身未明"}｜${getRegionName(f.regionId) || "區域未定"}｜${f.territory || "據點未定"}</div>
    <div class="detail-label" style="margin-top:8px;">家族門第</div>
    <div class="detail-value">${f.standing || "尋常人家"}</div>
  `;
  box.appendChild(info);

  // 編輯區域
  const edit = document.createElement("div");
  edit.className = "detail-section";
  const row = document.createElement("div");
  row.style.display = "flex";
  row.style.gap = "5px";

  // 出身選項
  const originSel = document.createElement("select");
  originSel.id = "editOriginSel";
  state.originOptions.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o; opt.textContent = o;
    originSel.appendChild(opt);
  });
  if (f.origin) originSel.value = f.origin;

  // 區域選項
  const regionSel = document.createElement("select");
  regionSel.id = "editRegionSel";
  const r0 = document.createElement("option");
  r0.value = ""; r0.textContent = "變更區域";
  regionSel.appendChild(r0);
  state.regions.forEach(r => {
    const opt = document.createElement("option");
    opt.value = r.id; opt.textContent = r.name;
    regionSel.appendChild(opt);
  });
  if (f.regionId) regionSel.value = f.regionId;

  // 據點選項
  const terrSel = document.createElement("select");
  terrSel.id = "editTerritorySel";
  const t0 = document.createElement("option");
  t0.value = ""; t0.textContent = "變更據點";
  terrSel.appendChild(t0);

  function populateTerritoryOptions() {
    terrSel.innerHTML = "";
    terrSel.appendChild(t0);
    const selectedRegion = regionSel.value;
    state.territoryOptions.forEach(t => {
      if (selectedRegion) {
        if (t.regionId !== selectedRegion) return;
        if (!t.regionId && t.name !== f.territory) return;
      }
      const opt = document.createElement("option");
      opt.value = t.name;
      opt.textContent = `${t.name}（${getRegionName(t.regionId) || "區域未定"}）`;
      terrSel.appendChild(opt);
    });
    if (f.territory) terrSel.value = f.territory;
  }
  populateTerritoryOptions();
  regionSel.addEventListener("change", populateTerritoryOptions);

  // v6+:門第下拉
  const standingSel = document.createElement("select");
  standingSel.id = "editStandingSel";
  DEFAULT_STANDINGS.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s; opt.textContent = s;
    standingSel.appendChild(opt);
  });
  standingSel.value = f.standing || "尋常人家";

  const saveBtn = document.createElement("button");
  saveBtn.className = "btn btn-small";
  saveBtn.textContent = "套用變更";
  saveBtn.addEventListener("click", () => {
    const newOrigin = originSel.value || "";
    const newRegionId = regionSel.value || "";
    const newTerrName = terrSel.value || "";
    if (newTerrName) {
      const terrResult = ensureTerritoryForRegion(newTerrName, newRegionId);
      if (terrResult === null) return;
      f.territory = terrResult;
    } else {
      f.territory = "";
    }
    f.origin = newOrigin;
    f.regionId = newRegionId;
    f.standing = standingSel.value;  // v6+
    saveState();
    renderFamilies();
    renderFamilyDetail();
    renderRegions();
    renderOptionOverview();
    renderAdvisorLocationSelect();
    advisorSay(`已更新「${f.name}」的出身／區域／據點／門第設定。`);
  });

  row.appendChild(originSel);
  row.appendChild(regionSel);
  row.appendChild(terrSel);
  row.appendChild(standingSel);
  row.appendChild(saveBtn);
  edit.appendChild(row);
  box.appendChild(edit);

  if (f.notes) {
    const notes = document.createElement("div");
    notes.className = "detail-section";
    notes.innerHTML = `
      <div class="detail-label">備註</div>
      <div class="detail-value">${f.notes}</div>
    `;
    box.appendChild(notes);
  }

  // ===== v6 新增:聯姻紀錄(以代數→對方家族分組,點開看細節) =====
  // 收集所有「至少一方屬於本家族」的婚姻關係,
  // 用 (minPersonId, maxPersonId) 為 key 去重(雙向 spouseRelations 會各記一筆)
  const familyMemberIds = new Set(
    state.persons.filter(p => p.familyId === f.id).map(p => p.id)
  );
  const marriageMap = new Map();
  state.persons.forEach(p => {
    if (!Array.isArray(p.spouseRelations)) return;
    p.spouseRelations.forEach(rel => {
      const otherId = rel.id;
      if (!familyMemberIds.has(p.id) && !familyMemberIds.has(otherId)) return;
      const key = p.id < otherId ? `${p.id}-${otherId}` : `${otherId}-${p.id}`;
      if (marriageMap.has(key)) {
        const existing = marriageMap.get(key);
        // 用較完整的那筆(有 marryYear / matchStage 的優先)
        const better = (rel.marryYear && !existing.rel.marryYear)
          || (rel.matchStage === "已婚" && existing.rel.matchStage !== "已婚")
          || (rel.endYear && !existing.rel.endYear);
        if (better) {
          marriageMap.set(key, { a: p, b: state.persons.find(x => x.id === otherId), rel });
        }
        return;
      }
      const otherPerson = state.persons.find(x => x.id === otherId);
      if (!otherPerson) return;
      marriageMap.set(key, { a: p, b: otherPerson, rel });
    });
  });

  // 整理每樁聯姻:把「本家族那位」放 inMember,另一位放 outMember
  const allMarriages = Array.from(marriageMap.values()).map(m => {
    let inMember = m.a, outMember = m.b;
    if (!familyMemberIds.has(inMember.id) && familyMemberIds.has(outMember.id)) {
      inMember = m.b;
      outMember = m.a;
    }
    const internal = familyMemberIds.has(inMember.id) && familyMemberIds.has(outMember.id);
    // 用本家族那位的代數作分組鍵
    const gen = computeGeneration(inMember.id);
    const outFamName = outMember.familyId
      ? (state.families.find(ff => ff.id === outMember.familyId)?.name || "未歸宗族")
      : "未歸宗族";
    const groupKey = internal ? "__internal__" : outFamName;
    return { inMember, outMember, rel: m.rel, internal, gen, groupKey, outFamName };
  });

  // 依代數分組,代數內再依對方家族分組
  const byGen = new Map();   // gen -> Map(groupKey -> [marriage,...])
  allMarriages.forEach(item => {
    if (!byGen.has(item.gen)) byGen.set(item.gen, new Map());
    const inner = byGen.get(item.gen);
    if (!inner.has(item.groupKey)) inner.set(item.groupKey, []);
    inner.get(item.groupKey).push(item);
  });

  const marrBlock = document.createElement("div");
  marrBlock.className = "detail-section";
  const marrLabel = document.createElement("div");
  marrLabel.className = "detail-label";
  marrLabel.textContent = `聯姻紀錄（共 ${allMarriages.length} 樁）`;
  marrBlock.appendChild(marrLabel);

  if (!allMarriages.length) {
    const empty = document.createElement("div");
    empty.className = "detail-value hint";
    empty.textContent = "尚無聯姻紀錄。";
    marrBlock.appendChild(empty);
  } else {
    const marrWrap = document.createElement("div");
    marrWrap.className = "detail-value marriage-summary-list";

    // 取得排序後的代數
    const sortedGens = Array.from(byGen.keys()).sort((a, b) => a - b);
    sortedGens.forEach(gen => {
      const genLine = document.createElement("div");
      genLine.className = "marriage-gen-line";

      const genLabel = document.createElement("span");
      genLabel.className = "marriage-gen-label";
      genLabel.textContent = `第 ${toChineseNumeral(gen)} 代：`;
      genLine.appendChild(genLabel);

      // 依「樁數多→少」、相同則家族名字排序
      const groups = Array.from(byGen.get(gen).entries())
        .sort((a, b) => {
          if (b[1].length !== a[1].length) return b[1].length - a[1].length;
          return a[0].localeCompare(b[0], "zh-Hant");
        });

      groups.forEach(([groupKey, items], idx) => {
        const isInternal = groupKey === "__internal__";
        const labelText = isInternal ? "族內" : groupKey;

        // 用 details 讓每組可點開
        const groupEl = document.createElement("details");
        groupEl.className = "marriage-group";

        const summary = document.createElement("summary");
        summary.className = "marriage-group-summary";
        const tagClass = isInternal ? "marriage-tag-internal" : "marriage-tag-external";
        summary.innerHTML = `
          <span class="marriage-tag ${tagClass}">${labelText}</span><span class="marriage-group-count">（${items.length} 樁）</span>
        `;
        groupEl.appendChild(summary);

        // 細節列表
        const detailWrap = document.createElement("div");
        detailWrap.className = "marriage-group-detail";

        // 依結婚年份排序
        const sortedItems = items.slice().sort((m1, m2) => {
          const y1 = m1.rel.marryYear ?? m1.rel.year ?? 99999;
          const y2 = m2.rel.marryYear ?? m2.rel.year ?? 99999;
          return y1 - y2;
        });

        sortedItems.forEach(m => {
          const item = document.createElement("div");
          item.className = "marriage-item";

          const typeLabel = (typeof displaySpouseType === "function")
            ? displaySpouseType(m.rel.type)
            : (m.rel.type || "婚配");
          const yr = m.rel.marryYear ?? m.rel.year ?? null;
          const yrText = yr != null ? `星曆 ${yr} 年成婚` : "成婚年份未記";

          // v6:推導婚姻當前狀態:已破局 / 已離異 / 已喪偶 / 已婚 / 議親中
          let statusText = "";
          let statusClass = "";
          if (m.rel.dissolved) {
            // v6+:破局
            const stageDesc = m.rel.dissolveStage === "婚期籌備" ? "婚前悔婚" : "定親後破局";
            const byDesc = m.rel.dissolvedBy === "雙方" ? "雙方協議"
                         : m.rel.dissolvedBy === "A方" ? `${m.inMember.name}提出`
                         : m.rel.dissolvedBy === "B方" ? `${m.outMember.name}提出`
                         : "";
            statusText = `${stageDesc}${byDesc ? "（" + byDesc + "）" : ""}${m.rel.dissolveYear ? "，星曆 " + m.rel.dissolveYear + " 年" : ""}`;
            statusClass = "marriage-status-dissolved";
          } else if (m.rel.endYear || m.rel.matchStage === "已離異") {
            statusText = m.rel.endYear ? `星曆 ${m.rel.endYear} 年離異` : "已離異";
            statusClass = "marriage-status-ended";
          } else if (m.rel.matchStage === "已喪偶") {
            statusText = "已喪偶";
            statusClass = "marriage-status-ended";
          } else if (m.inMember.deceased || m.outMember.deceased) {
            // 兩人有一方已逝且未明確標記離異 → 視為喪偶
            const lost = m.inMember.deceased ? m.inMember : m.outMember;
            const lostYr = lost.deathYear;
            statusText = lostYr != null ? `星曆 ${lostYr} 年喪偶` : "已喪偶";
            statusClass = "marriage-status-ended";
          } else if (m.rel.marryYear || m.rel.matchStage === "已婚") {
            // 仍在現役婚姻中,不另外顯示狀態
            statusText = "";
          } else if (m.rel.matchStage) {
            statusText = m.rel.matchStage;
            statusClass = "marriage-status-pending";
          }

          item.innerHTML = `
            <div class="marriage-line">
              <a href="#" class="person-link" onclick="goToPerson(${m.inMember.id});return false;">${m.inMember.name}</a><span class="marriage-link">　×　</span><a href="#" class="person-link" onclick="goToPerson(${m.outMember.id});return false;">${m.outMember.name}</a>
            </div>
            <div class="marriage-line marriage-line-meta">
              <span class="marriage-meta">${yrText}</span><span class="marriage-meta">｜${typeLabel}</span>${statusText ? `<span class="marriage-status ${statusClass}">${statusText}</span>` : ""}${m.rel.courtyard ? `<span class="marriage-meta">｜${escapeHtml(m.rel.courtyard)}</span>` : ""}
            </div>
          `;
          detailWrap.appendChild(item);
        });

        groupEl.appendChild(detailWrap);
        genLine.appendChild(groupEl);

        // 在組與組之間加分隔符
        if (idx < groups.length - 1) {
          const sep = document.createElement("span");
          sep.className = "marriage-group-sep";
          sep.textContent = "、";
          genLine.appendChild(sep);
        }
      });

      marrWrap.appendChild(genLine);
    });

    marrBlock.appendChild(marrWrap);
  }
  box.appendChild(marrBlock);
  // ===== 聯姻紀錄結束 =====

  const memBlock = document.createElement("div");
  memBlock.className = "detail-section";
  memBlock.innerHTML = `
    <div class="detail-label">家族成員（點擊姓名以查看詳情）</div>
    <div id="familyMembersList" class="detail-value member-list"></div>
  `;
  box.appendChild(memBlock);

  const memberList = $("familyMembersList");
  const members = state.persons.filter(p => p.familyId === f.id);
  members.sort((a,b) => {
    const aG = computeGeneration(a.id);
    const bG = computeGeneration(b.id);
    if (aG !== bG) return aG - bG;
    const aY = a.birthYear || 0;
    const bY = b.birthYear || 0;
    return aY - bY;
  });

  if (!members.length) {
    memberList.innerHTML = '<p class="hint">本家族尚無成員記錄。</p>';
  } else {
    let lastGen = null;   // v5:追蹤上一個成員的代數, 用來決定何時插入分組標題
    // 預先統計各代人數, 給標題右側顯示
    const genCount = {};
    members.forEach(m => {
      const g = computeGeneration(m.id);
      genCount[g] = (genCount[g] || 0) + 1;
    });

    members.forEach(p => {
      const gen = computeGeneration(p.id);

      // v5:代數變了 → 先插入分組標題
      if (gen !== lastGen) {
        const header = document.createElement("div");
        header.className = "generation-header";
        header.innerHTML = `
          <span class="generation-title">第 ${toChineseNumeral(gen)} 代</span>
          <span class="generation-rule"></span>
          <span class="generation-count">${genCount[gen]} 人</span>
        `;
        memberList.appendChild(header);
        lastGen = gen;
      }

      const isSelected = state.selectedPersonId === p.id;
      const detailsEl = document.createElement("details");
      detailsEl.className = "member-item" + (isSelected ? " active" : "") + (p.deceased ? " deceased" : "");
      if (isSelected) detailsEl.open = true;   // 預設只展開「選中」那位

      const age = getAge(p);
      const ageText = age != null ? age + " 歲" : "年齡未記";
      const deceasedText = p.deceased ? " 【已逝】" : "";
      const genderText = p.gender || "未記";
      const marriedText = p.spouseIds.length ? "已婚" : "未婚";

      // v7+:現任職位摘要
      let appointmentLine = "";
      if (typeof getActiveAppointments === "function") {
        const active = getActiveAppointments(p.id);
        if (active.length) {
          const positions = active
            .map(a => {
              const pos = state.positions.find(x => x.id === a.positionId);
              if (!pos) return null;
              // 顯示「系統・職位」如「內閣・內閣首輔」, 但若 system 與 position 相同就只顯示 position
              return (pos.system && pos.system !== pos.position)
                ? `${pos.system}・${pos.position}`
                : pos.position;
            })
            .filter(Boolean);
          if (positions.length) {
            appointmentLine = `<span class="member-appt">任 ${positions.map(escapeHtml).join("、")}</span>`;
          }
        }
      }

      // ---- summary (一行摘要) ----
      // v5:已有分組標題, summary 不再重複顯示「第 X 代」
      const summary = document.createElement("summary");
      summary.className = "member-summary";
      summary.innerHTML = `
        <span class="member-name">${p.name}${deceasedText}</span>
        <span class="member-info">
          ${p.role || "未標註"} | ${ageText} | ${genderText} | ${marriedText}
        </span>
        ${appointmentLine}
      `;
      // 點 summary 時除了原生展開外, 也選中此人
      summary.addEventListener("click", (ev) => {
        // 不阻止預設行為 (要讓 details 自己 toggle)
        state.selectedPersonId = p.id;
        state.selectedFamilyId = f.id;
        // 不立刻 rerender, 避免破壞 toggle 動畫;
        // 只更新人物詳情 + 輔佐官 log
        renderPersonDetail();
        advisorSay(`已開啟「${p.name}」的族人詳情。`);
      });
      detailsEl.appendChild(summary);

      // ---- 展開區:配偶、子女、父母 ----
      const body = document.createElement("div");
      body.className = "member-body";

      // 配偶 (不顯示代數)
      const spouses = (p.spouseIds || [])
        .map(id => state.persons.find(x => x.id === id))
        .filter(Boolean);
      const spHtml = spouses.length
        ? spouses.map(sp => {
            const ag = getAge(sp);
            const meta = [];
            const sr = (p.spouseRelations || []).find(r => r.id === sp.id && !r.dissolved);
            if (sr) {
              let s = sr.type;
              if (sr.marryYear != null) s += `,星曆 ${sr.marryYear} 年結婚`;
              else if (sr.year != null) s += `,星曆 ${sr.year} 年結婚`;
              meta.push(s);
            }
            if (ag != null) meta.push(`${ag} 歲`);
            if (sp.deceased) meta.push("已逝");
            const metaHtml = meta.length ? ` <span class="relation-meta">(${meta.join("|")})</span>` : "";
            return `<div class="relation-item"><a href="#" class="person-link" onclick="goToPerson(${sp.id});return false;">${sp.name}</a>${metaHtml}</div>`;
          }).join("")
        : '<div class="relation-empty">無</div>';

      // v6+:曾配(破局紀錄)
      const dissolvedRels = (p.spouseRelations || []).filter(r => r.dissolved);
      const exSpHtml = dissolvedRels.length
        ? dissolvedRels.map(r => {
            const ex = state.persons.find(x => x.id === r.id);
            if (!ex) return "";
            const meta = [];
            // 破局類型描述
            const stageDesc = r.dissolveStage === "婚期籌備" ? "婚前悔婚" : "定親後破局";
            meta.push(stageDesc);
            if (r.dissolveYear != null) meta.push(`星曆 ${r.dissolveYear} 年`);
            if (r.dissolvedBy) {
              const byDesc = r.dissolvedBy === "雙方" ? "雙方協議" :
                             r.dissolvedBy === "A方" ? `${p.name}提出` :
                             `${ex.name}提出`;
              meta.push(byDesc);
            }
            if (r.dissolveReason) meta.push(`緣由：${r.dissolveReason}`);
            const metaHtml = ` <span class="relation-meta ex-spouse-meta">(${meta.join("｜")})</span>`;
            return `<div class="relation-item ex-spouse-item"><a href="#" class="person-link" onclick="goToPerson(${ex.id});return false;">${ex.name}</a>${metaHtml}</div>`;
          }).filter(Boolean).join("")
        : "";

      // 子女
      const children = (p.childIds || [])
        .map(id => state.persons.find(x => x.id === id))
        .filter(Boolean)
        .sort((a, b) => (a.birthYear || 0) - (b.birthYear || 0));
      const chHtml = children.length
        ? children.map(ch => {
            const ag = getAge(ch);
            const label = ch.gender === "男" ? "子" : (ch.gender === "女" ? "女" : "子女");
            const meta = [];
            if (ag != null) meta.push(`${ag} 歲`);
            if (ch.deceased) meta.push("已逝");
            const metaHtml = meta.length ? ` <span class="relation-meta">(${meta.join("|")})</span>` : "";
            return `<div class="relation-item"><span class="relation-label">${label}</span><a href="#" class="person-link" onclick="goToPerson(${ch.id});return false;">${ch.name}</a>${metaHtml}</div>`;
          }).join("")
        : '<div class="relation-empty">無</div>';

      // 父母
      const parents = (p.parentIds || [])
        .map(id => state.persons.find(x => x.id === id))
        .filter(Boolean);
      const paHtml = parents.length
        ? parents.map(pa => {
            const ag = getAge(pa);
            const label = pa.gender === "男" ? "父" : (pa.gender === "女" ? "母" : "父/母");
            const meta = [];
            if (ag != null) meta.push(`${ag} 歲`);
            if (pa.deceased) meta.push("已逝");
            const metaHtml = meta.length ? ` <span class="relation-meta">(${meta.join("|")})</span>` : "";
            return `<div class="relation-item"><span class="relation-label">${label}</span><a href="#" class="person-link" onclick="goToPerson(${pa.id});return false;">${pa.name}</a>${metaHtml}</div>`;
          }).join("")
        : '<div class="relation-empty">無</div>';

      body.innerHTML = `
        <div class="member-relations">
          <div class="member-relations-label">配偶</div>
          <div class="member-relations-value">${spHtml}</div>
          ${exSpHtml ? `
            <div class="member-relations-label">曾配</div>
            <div class="member-relations-value">${exSpHtml}</div>
          ` : ""}
          <div class="member-relations-label">子女 (${children.length})</div>
          <div class="member-relations-value">${chHtml}</div>
          <div class="member-relations-label">父母</div>
          <div class="member-relations-value">${paHtml}</div>
        </div>
      `;
      detailsEl.appendChild(body);
      memberList.appendChild(detailsEl);
    });
  }

  const actionBlock = document.createElement("div");
  actionBlock.className = "detail-section";
  actionBlock.innerHTML = `
    <div class="detail-label">快速行動</div>
    <div class="detail-value">
      <button class="btn btn-small" onclick="state.selectedFamilyId=null;renderFamilies();renderFamilyDetail();advisorSay('已關閉家族詳情。');">關閉詳情</button>
      <button class="btn btn-small btn-danger" onclick="deleteFamily(${f.id});">刪除家族記錄</button>
    </div>
  `;
  box.appendChild(actionBlock);
}

