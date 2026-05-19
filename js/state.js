// state.js
// 遊戲狀態與筆畫表

const state = {
  regions: [...DEFAULT_REGIONS],
  families: [],
  persons: [],
  originOptions: [...DEFAULT_ORIGINS],
  territoryOptions: [...DEFAULT_TERRITORIES],
  occOptions: [...DEFAULT_OCCS],
  resOptions: [...DEFAULT_RES],
  roleOptions: [...DEFAULT_ROLES],
  nextFamilyId: 1,
  nextPersonId: 1,
  nextPositionId: 1,      // v7+:名位卷宗的 ID 計數器
  selectedFamilyId: null,
  selectedPersonId: null,
  childModeParentId: null,
  gameYear: INITIAL_YEAR,
  chronicle: [],          // v3 新增:年史 — 死亡/誕生/事件決策的時序記錄
  positions: []           // v7+:大周名位卷宗 — 職銜骨架(slot 由 persons[].appointments 反推)
};

// 事件系統用的暫存(原本是隱性 global, 此處明確宣告)
let pendingEvent = null;
let pendingEventKind = null;

const STROKE_TABLE = {
  "一":1, "丁":2, "七":2, "乃":2, "九":2,
  "了":2, "人":2, "入":2,
  "八":2, "于":3, "三":3,
  "王":4, "井":4, "互":4, "五":4,
  "田":5, "由":5, "史":5, "白":5, "石":5,
  "朱":6, "任":6,
  "安":6, "宋":7, "何":7, "余":7,
  "林":8, "周":8, "宗":8,
  "胡":9, "洪":9,
  "高":10, "康":11,
  "張":11, "許":11,
  "黃":12,
  "陳":16, "鄭":19, "顏":18, "龔":24
};

// 取得姓氏筆畫
