// storage.js
// localStorage 存取

// ---------- 儲存與載入 ----------
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// 取得預設的職銜骨架(每個職銜配上 id)
function buildDefaultPositions() {
  return DEFAULT_POSITIONS.map((p, i) => ({
    id: i + 1,
    category: p.category,
    system: p.system,
    position: p.position,
    rank: p.rank,
    quota: p.quota,
    note: p.note || ""
  }));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);

  // 首次開啟:植入預設職銜骨架,讓大周頁面一開就有完整名分制度
  if (!raw) {
    state.positions = buildDefaultPositions();
    state.nextPositionId = state.positions.length + 1;
    return;
  }

  try {
    const data = JSON.parse(raw);
    state.regions = data.regions && data.regions.length ? data.regions : [...DEFAULT_REGIONS];
    state.families = data.families || [];
    state.persons = data.persons || [];
    state.originOptions = data.originOptions && data.originOptions.length ? data.originOptions : [...DEFAULT_ORIGINS];

    if (Array.isArray(data.territoryOptions) && data.territoryOptions.length) {
      if (typeof data.territoryOptions[0] === "string") {
        state.territoryOptions = data.territoryOptions.map(name => ({ name, regionId: "" }));
      } else {
        state.territoryOptions = data.territoryOptions.map(t => ({
          name: t.name,
          regionId: t.regionId || ""
        }));
      }
    } else {
      state.territoryOptions = [...DEFAULT_TERRITORIES];
    }

    state.roleOptions = data.roleOptions && data.roleOptions.length ? data.roleOptions : [...DEFAULT_ROLES];
    
    state.occOptions = data.occOptions && data.occOptions.length ? data.occOptions : [...DEFAULT_OCCS];
    state.resOptions = data.resOptions && data.resOptions.length ? data.resOptions : [...DEFAULT_RES];
    state.nextFamilyId = data.nextFamilyId || 1;
    state.nextPersonId = data.nextPersonId || 1;
    state.selectedFamilyId = data.selectedFamilyId || null;
    state.selectedPersonId = data.selectedPersonId || null;
    state.childModeParentId = null;
    state.gameYear = data.gameYear || INITIAL_YEAR;

    state.persons.forEach(p => {
      if (p.deceased == null) p.deceased = false;
      if (!Array.isArray(p.spouseRelations)) p.spouseRelations = [];
      if (!Array.isArray(p.spouseIds)) p.spouseIds = p.spouseIds || [];
      if (!Array.isArray(p.parentIds)) p.parentIds = p.parentIds || [];
      if (!Array.isArray(p.childIds)) p.childIds = p.childIds || [];
      if (!Array.isArray(p.appointments)) p.appointments = [];   // v7+:任職紀錄
    });

    // v3 新增欄位:向後相容處理
    state.families.forEach(f => {
      if (!Array.isArray(f.allies)) f.allies = [];
      // headId 留 undefined 也行, 不強制設定
    });
    state.chronicle = Array.isArray(data.chronicle) ? data.chronicle : [];

    // v6+:議親案卷紀錄與合適度資料的持久化
    state.matchChapters = Array.isArray(data.matchChapters) ? data.matchChapters : [];
    state.pairScores = (data.pairScores && typeof data.pairScores === "object") ? data.pairScores : {};

    // v7+:大周名位卷宗 — 職銜骨架(僅存職位定義, 不存席位內容; 席位由 appointments 反推)
    if (Array.isArray(data.positions) && data.positions.length) {
      state.positions = data.positions.map(p => ({
        ...p,
        note: p.note || "",
        quota: Number(p.quota) || 0
      }));
    } else {
      state.positions = buildDefaultPositions();
    }
    state.nextPositionId = data.nextPositionId || (
      state.positions.length
        ? Math.max(...state.positions.map(p => Number(p.id) || 0)) + 1
        : 1
    );

    normalizeRelations();
  } catch (e) {
    console.warn("載入存檔失敗", e);
  }
}

