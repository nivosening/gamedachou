// io.js
// 匯出存檔、讀取存檔、重置遊戲

// ---------- 匯出 / 匯入 / 重置 ----------
function exportGame() {
  // 直接從 localStorage 讀取最權威的資料，避免本分頁的 state 與其他分頁
  // (議親室 / 名位卷宗) 修改後的最新狀態不同步
  const raw = localStorage.getItem(STORAGE_KEY);
  let payload;
  if (raw) {
    try {
      // 先 parse 再 stringify 一次,確保格式整齊;若 parse 失敗就直接用原 raw
      payload = JSON.stringify(JSON.parse(raw), null, 2);
    } catch (e) {
      payload = raw;
    }
  } else {
    // localStorage 還沒寫入時,退回用當前 state
    payload = JSON.stringify(state, null, 2);
  }

  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "clan_game_save_" + Date.now() + ".json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  advisorSay("已為家主匯出一份宗族存檔。");
}

function importGame(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data = JSON.parse(e.target.result);
      loadStateFromData(data);
      init();
      advisorSay("已成功讀取宗族存檔。");
    } catch (err) {
      alert("讀取存檔失敗：" + err.message);
      console.error(err);
    }
  };
  reader.readAsText(file);
}

function loadStateFromData(data) {

  // 直接覆蓋 state
  state.regions = data.regions || [...DEFAULT_REGIONS];
  state.families = data.families || [];
  state.persons = data.persons || [];
  state.originOptions = data.originOptions || [...DEFAULT_ORIGINS];
  state.territoryOptions = data.territoryOptions || [...DEFAULT_TERRITORIES];
  state.occOptions = data.occOptions || [...DEFAULT_OCCS];
  state.resOptions = data.resOptions || [...DEFAULT_RES];
  state.roleOptions = data.roleOptions || [...DEFAULT_ROLES];

  state.nextFamilyId = data.nextFamilyId || 1;
  state.nextPersonId = data.nextPersonId || 1;
  state.selectedFamilyId = data.selectedFamilyId || null;
  state.selectedPersonId = data.selectedPersonId || null;
  state.childModeParentId = null;
  state.gameYear = data.gameYear || INITIAL_YEAR;

  // 人物關係補修（避免 parentIds, spouseIds 不存在）
  state.persons.forEach(p => {
    if (!Array.isArray(p.spouseIds)) p.spouseIds = [];
    if (!Array.isArray(p.spouseRelations)) p.spouseRelations = [];
    if (!Array.isArray(p.parentIds)) p.parentIds = [];
    if (!Array.isArray(p.childIds)) p.childIds = [];
    if (p.deceased == null) p.deceased = false;
    if (!Array.isArray(p.appointments)) p.appointments = [];  // v7+
  });

  // v7+:大周名位卷宗 — 職銜骨架
  if (Array.isArray(data.positions) && data.positions.length) {
    state.positions = data.positions.map(p => ({
      ...p,
      note: p.note || "",
      quota: Number(p.quota) || 0
    }));
  } else {
    state.positions = (typeof buildDefaultPositions === "function")
      ? buildDefaultPositions()
      : [];
  }
  state.nextPositionId = data.nextPositionId || (
    state.positions.length
      ? Math.max(...state.positions.map(p => Number(p.id) || 0)) + 1
      : 1
  );

  // v3+:年史紀錄
  state.chronicle = Array.isArray(data.chronicle) ? data.chronicle : [];

  // v6+:議親案卷紀錄與合適度資料的持久化
  state.matchChapters = Array.isArray(data.matchChapters) ? data.matchChapters : [];
  state.pairScores = (data.pairScores && typeof data.pairScores === "object") ? data.pairScores : {};

  // v3 新增欄位:家族向後相容處理
  state.families.forEach(f => {
    if (!Array.isArray(f.allies)) f.allies = [];
  });

  normalizeRelations();
  saveState(); // 儲存到 localStorage


  // === 修復 spouseRelations 結構，補上結婚年份 year ===
state.persons.forEach(p => {
  p.spouseRelations = p.spouseRelations.map(r => {
    if (r.year === undefined) r.year = null;
    return r;
  });
});

}



function resetGame() {
  if (!confirm("確定要重置所有遊戲資料嗎？此操作不可逆。")) return;
  localStorage.removeItem(STORAGE_KEY);
  state.regions = [...DEFAULT_REGIONS];
  state.families = [];
  state.persons = [];
  state.originOptions = [...DEFAULT_ORIGINS];
  state.territoryOptions = [...DEFAULT_TERRITORIES];
  state.occOptions = [...DEFAULT_OCCS];
  state.resOptions = [...DEFAULT_RES];
  state.roleOptions = [...DEFAULT_ROLES];
  state.nextFamilyId = 1;
  state.nextPersonId = 1;
  state.selectedFamilyId = null;
  state.selectedPersonId = null;
  state.childModeParentId = null;
  state.gameYear = INITIAL_YEAR;
  state.positions = [];  // v7+
  state.nextPositionId = 1;
  state.chronicle = [];           // v3+
  state.matchChapters = [];       // v6+:議親案卷
  state.pairScores = {};          // v6+:合適度資料

  saveState();
  updateYearViews();
  renderOptionSelects();
  renderRegionSelects();
  renderFamilyOptions();
  renderFamilies();
  renderFamilyDetail();
  renderPersonDetail();
  renderRegions();
  renderOptionOverview();
  advisorSay("舊帳已清空，家主可重新書寫宗族史。");
}

