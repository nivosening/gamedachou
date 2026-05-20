// render-regions.js
// 世界區域總覽渲染 — v6:每個區域可點擊展開,
// 展開後顯示「該區域內的據點 / 領地」以及「駐留於此的家族」,
// 點家族名可直接跳到家族詳情。

// ---------- 區域總覽 ----------
function renderRegions() {
  const box = $("regionOverview");
  if (!box) return;
  box.innerHTML = "";

  // 記住目前展開哪一區(避免每次 render 都收回)
  if (!state._expandedRegionIds) state._expandedRegionIds = new Set();
  const expanded = state._expandedRegionIds;

  state.regions.forEach(r => {
    const families = state.families.filter(f => f.regionId === r.id);
    const ids = families.map(f => f.id);
    const persons = state.persons.filter(p => ids.includes(p.familyId));
    const territories = (state.territoryOptions || []).filter(t => t.regionId === r.id);

    const isOpen = expanded.has(r.id);

    const details = document.createElement("details");
    details.className = "region-block region-block-collapsible";
    if (isOpen) details.open = true;

    // ---- summary 一行摘要 ----
    const summary = document.createElement("summary");
    summary.className = "region-summary";
    summary.innerHTML = `
      <div class="region-title">${r.name}</div>
      <div class="region-sub">${r.desc}</div>
      <div class="region-sub">據點 ${territories.length}｜家族 ${families.length}｜人口約 ${persons.length} 人</div>
    `;
    summary.addEventListener("click", () => {
      // toggle 在 click 後才生效, 用 setTimeout 等到 details.open 更新後
      setTimeout(() => {
        if (details.open) expanded.add(r.id);
        else expanded.delete(r.id);
      }, 0);
    });
    details.appendChild(summary);

    // ---- 展開內容 ----
    const body = document.createElement("div");
    body.className = "region-body";

    // 據點/領地清單
    const terrLabel = document.createElement("div");
    terrLabel.className = "region-section-label";
    terrLabel.textContent = "據點／領地";
    body.appendChild(terrLabel);

    if (territories.length) {
      const terrList = document.createElement("div");
      terrList.className = "region-territory-list";
      territories.forEach(t => {
        const span = document.createElement("span");
        span.className = "region-territory-tag";
        const tFamCount = families.filter(f => f.territory === t.name).length;
        span.textContent = tFamCount ? `${t.name}（${tFamCount} 家族）` : t.name;
        terrList.appendChild(span);
      });
      body.appendChild(terrList);
    } else {
      const empty = document.createElement("div");
      empty.className = "region-empty";
      empty.textContent = "本區域尚無記載據點。";
      body.appendChild(empty);
    }

    // 家族清單(可點選 → 跳到該家族詳情)
    const famLabel = document.createElement("div");
    famLabel.className = "region-section-label";
    famLabel.textContent = "駐留家族";
    body.appendChild(famLabel);

    if (families.length) {
      const famList = document.createElement("div");
      famList.className = "region-family-list";
      families.forEach(f => {
        const memberCount = state.persons.filter(p => p.familyId === f.id).length;
        const link = document.createElement("a");
        link.href = "#";
        link.className = "region-family-link";
        const terrText = f.territory ? `｜${f.territory}` : "";
        // v8:顯示郡望(若 render-list.js 已載入則使用共用函式,
        // 否則退回純「姓+氏」)
        const displayName = (typeof getFamilyDisplayName === "function")
          ? getFamilyDisplayName(f)
          : `${f.name}氏`;
        link.innerHTML = `
          <span class="region-family-name">${displayName}</span>
          <span class="region-family-meta">${f.origin || "出身未明"}${terrText}｜${memberCount} 人</span>
        `;
        link.addEventListener("click", (e) => {
          e.preventDefault();
          goToFamily(f.id);
        });
        famList.appendChild(link);
      });
      body.appendChild(famList);
    } else {
      const empty = document.createElement("div");
      empty.className = "region-empty";
      empty.textContent = "本區域尚無家族駐留。";
      body.appendChild(empty);
    }

    details.appendChild(body);
    box.appendChild(details);
  });
}

// 從區域面板跳到家族詳情
function goToFamily(familyId) {
  const f = state.families.find(x => x.id === familyId);
  if (!f) {
    if (typeof advisorSay === "function") advisorSay("此家族已不在宗族之書中。");
    return;
  }
  state.selectedFamilyId = f.id;
  state.selectedPersonId = null;
  if (typeof renderFamilies === "function") renderFamilies();
  if (typeof renderFamilyDetail === "function") renderFamilyDetail();
  if (typeof renderPersonDetail === "function") renderPersonDetail();
  const detailEl = document.getElementById("familyDetail");
  if (detailEl && detailEl.scrollIntoView) {
    detailEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  if (typeof advisorSay === "function") {
    const displayName = (typeof getFamilyDisplayName === "function")
      ? getFamilyDisplayName(f)
      : `${f.name}氏`;
    advisorSay(`已開啟「${displayName}」的家族詳情。`);
  }
}
