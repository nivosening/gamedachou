// match.js
// 議親室 — 改寫自「亂點鴛鴦譜」,接到宗族之書 state
// 共用:state.persons / state.families / state.gameYear / spouseRelations / chronicle / localStorage

// =============== Stub:議親室頁面沒有主頁的 DOM,讓 addPerson 等共用函式不爆 ===============
// 強制覆蓋(不用 undefined 判斷),因為 family.js / utils.js 已先定義這些函式
(function(){
  const g = typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : this);

  // null-safe proxy:讓 $("不存在元素").style.display = "none" 不爆
  const _nullProxy = new Proxy({}, {
    get(_, prop) { if (prop === "then") return undefined; return _nullProxy; },
    set() { return true; }
  });
  // 覆蓋 $ 函式:找不到元素時回傳 proxy 而非 null
  g.$ = function(id) { return document.getElementById(id) || _nullProxy; };

  // 強制覆蓋:這些函式在主頁 js 已定義,但議親室沒有對應 DOM,必須蓋掉
  g.exitChildModeUI = function(){ if (typeof state !== "undefined") state.childModeParentId = null; };
  g.advisorSay = function(msg){ /* noop in 議親室 */ };
  g.renderFamilies = function(){};
  g.renderFamilyOptions = function(){};
  g.renderFamilyDetail = function(){};
  g.renderPersonDetail = function(){};
  g.renderRegions = function(){};
  g.renderOptionOverview = function(){};
  g.renderAdvisorLocationSelect = function(){};
  g.renderRegionSelects = function(){};
  g.renderOptionSelects = function(){};
  g.openParentSelectDialog = function(){ /* 議親室不彈第二父母對話框 */ };
  g.recordChronicle = function(entry){ if (!state.chronicle) state.chronicle = []; state.chronicle.push(entry); };
})();

// =============== 議親室本身的暫存 ===============
const matchState = {
  aFamilyId: "all",          // A 的家族篩選("all" / "noFamily" / 家族 id)
  bFamilyId: "all",
  aId: null,
  bId: null,
  pendingAction: null,
  archiveTab: "people",
  archiveSearch: "",
  archiveFilter: "全部",
  forcePick: false,          // 強推:解除「適齡未婚」限制
  suggestionsTarget: "a",    // 看看誰適合:目前以 a 還是 b 為基準
  // 口頭議親不寫入 state,但需在本地記住階段,讓下一步按鈕能接續
  // key = pairKey(aId, bId), value = "已議親成功"(口頭議親後)
  oralEngagements: {},
  // v6+:本次議親意向(條件單),每次「看看誰適合」前由家主設定
  // null = 尚未設定;非 null 時表示這一次的議親條件
  intent: null,
  // v6+:目前進行中的劇情案卷(null = 無)
  narrative: null,
  // v6+:破局類動作待決:暫存提出方,確認後執行 executeAction
  // { actionKey, by: "A方"|"B方"|"雙方" }
  dissolveDecision: null
};

// 議親條件單預設值
function defaultMatchIntent() {
  return {
    // 婚事性質
    kind: "正配",  // 正配 / 側室 / 續弦 / 入贅 / 政治聯姻
    // 本次看重(最多 3 項)
    values: [],
    // 本次看重的細節參數(出身清單、職業清單)
    valueOrigins: [],
    valueOccupations: [],
    // 育齡上限(僅當勾選 fertileAge 時生效)
    fertileAgeLimit: 25,
    // 本次忌諱(最多 2 項)
    taboos: [],
    // 忌諱的細節參數
    tabooOrigin: "",
    // 自由備註
    note: ""
  };
}

// 看重項目清單(用於勾選 UI)
const INTENT_VALUE_OPTIONS = [
  { key: "hasFamily",       label: "對方須有家族（不接受未歸宗族）" },
  { key: "highStanding",    label: "對方門第相當或更高" },
  { key: "thrivingFamily",  label: "對方家族人丁興旺" },
  { key: "matchOrigin",     label: "對方出身相符（可指定）" },
  { key: "sameRegion",      label: "對方在本區域" },
  { key: "matchOccupation", label: "對方為指定職業" },
  { key: "legitimateChild", label: "對方為嫡系子女" },
  { key: "ageClose",        label: "對方年紀相當" },
  { key: "fertileAge",      label: "對方在育齡（可指定上限）" },
  { key: "noChildren",      label: "對方無子女" },
  { key: "neverMarried",    label: "對方無婚配紀錄" },
  { key: "parentsAlive",    label: "對方雙親健在" }
];

// 忌諱項目清單
const INTENT_TABOO_OPTIONS = [
  { key: "tabooOrigin",     label: "忌諱特定出身（可指定）" },
  { key: "tabooFarRegion",  label: "忌諱遠地（不同區域）" },
  { key: "tabooSameRegion", label: "忌諱本地（同區域，求外地姻親）" },
  { key: "tabooMarried",    label: "忌諱已有家室者" },
  { key: "tabooHasChildren",label: "忌諱已有子女者" },
  { key: "tabooConcubineBorn", label: "忌諱庶出子女" },
  { key: "tabooSidebranch", label: "忌諱旁系" },
  { key: "tabooAgeGap",     label: "忌諱年齡懸殊（5 歲以上）" }
];

// 互斥規則:勾了其中一個,另一個自動關掉
const INTENT_EXCLUSIVE_PAIRS = [
  ["tabooFarRegion", "tabooSameRegion"]  // 遠地 vs 本地
];

// 婚事性質選項
const INTENT_KIND_OPTIONS = [
  { key: "正配",   label: "正配（嫡妻／嫡夫）", hint: "嚴格門第、年齡相當、無婚史優先" },
  { key: "側室",   label: "側室／妾",           hint: "可接受對方門第較低，重點看子嗣可期" },
  { key: "續弦",   label: "續弦／繼室",         hint: "接受對方有婚史，年齡差容忍度較大" },
  { key: "入贅",   label: "入贅",               hint: "對方家族規模、長嗣狀況優先" },
  { key: "政治聯姻", label: "政治聯姻",         hint: "看重對方家族規模、區域、是否盟友" }
];

function pairKey(x, y) { return [x, y].sort((a,b) => a - b).join("__"); }

// =============== 工具 ===============
function _$(id) { return document.getElementById(id); }
function getMA() { return findPerson(matchState.aId); }
function getMB() { return findPerson(matchState.bId); }

function getMatchAge(p) {
  if (!p) return null;
  return getAge(p); // 共用 time.js 的 getAge
}

// 適齡未婚池(議親室預設可挑的人)
function eligibleForMatch() {
  return state.persons.filter(p => {
    if (p.deceased) return false;
    if (p.spouseIds && p.spouseIds.length > 0) return false;
    const age = getMatchAge(p);
    if (age == null) return false;
    return age >= 15 && age <= 35;
  });
}

// 全人物池(強推模式)
function allLivingPeople() {
  return state.persons.filter(p => !p.deceased);
}

// 拿到目前選人的有效池
function pickablePool() {
  return matchState.forcePick ? allLivingPeople() : eligibleForMatch();
}

// 找兩人之間的 spouseRelation(雙向)
function relationBetween(aId, bId) {
  const a = findPerson(aId);
  if (!a) return null;
  return (a.spouseRelations || []).find(r => r.id === bId) || null;
}

// 取得人物現有的所有 spouseRelations 對象(已配對者)
function spouseListOf(p) {
  if (!p || !Array.isArray(p.spouseRelations)) return [];
  return p.spouseRelations.map(r => ({
    rel: r,
    other: findPerson(r.id)
  })).filter(x => x.other);
}

// =============== 案件類型推導 ===============
function deriveCaseType(a, b) {
  if (!a || !b) return "未開案";
  if (a.id === b.id) return "同人案";
  if (a.gender && b.gender && a.gender === b.gender) return "性別不合案";

  const rel = relationBetween(a.id, b.id);
  if (rel) {
    // 真正成婚才算「婚後案」:有 marryYear、matchStage===已婚、或 type 是成婚名分
    // v6:離異/喪偶等已結束的關係不算現任,改走普通議親(可考慮復合或另娶)。
    const _marriedTypes = ["婚配","正妻","夫","平妻","繼室","側室","妾","入贅","正室"];
    const ended = rel.endYear || rel.matchStage === "已離異" || rel.matchStage === "已喪偶";
    const trulyMarried = !ended && (!!rel.marryYear || rel.matchStage === "已婚" || _marriedTypes.includes(rel.type));
    if (trulyMarried) return "婚後案";
    // 否則(訂婚、婚期籌備中等)走議親流程
    return "普通議親案";
  }

  // 沒有直接關係,但雙方有別的配偶 → 納新人/續娶
  // 注意:只算「已成婚」的配偶,不算訂婚對象;
  // v6:離異/喪偶等已結束的關係(endYear/已離異/已喪偶)不算現任配偶。
  function hasRealSpouse(person) {
    if (!Array.isArray(person.spouseRelations) || !person.spouseRelations.length) return false;
    return person.spouseRelations.some(r => {
      if (r.endYear || r.matchStage === "已離異" || r.matchStage === "已喪偶") return false;
      return r.marryYear || r.matchStage === "已婚" || ["婚配","正妻","夫","平妻","繼室","側室","妾","入贅","正室"].includes(r.type);
    });
  }
  if (hasRealSpouse(a) || hasRealSpouse(b)) return "納新人／續娶案";

  const ageA = getMatchAge(a), ageB = getMatchAge(b);
  if ((ageA != null && ageA < 15) || (ageB != null && ageB < 15)) return "暫緩觀察案";
  return "普通議親案";
}


// 名分顯示：「正妻」和「夫」統一顯示為「婚配」
function displaySpouseType(type) {
  if (!type) return "婚配";
  if (type === "正妻" || type === "夫") return "婚配";
  return type;
}

// 取得兩人當前的階段(從 spouseRelation.matchStage 或 type 推導)
function getStageOfPair(a, b) {
  const rel = relationBetween(a.id, b.id);
  if (rel) {
    if (rel.matchStage) return rel.matchStage;
    if (rel.marryYear) return "已婚";
    return "已議親成功";
  }
  // 沒有寫入族譜的情況:看本地口頭議親紀錄
  const oral = matchState.oralEngagements[pairKey(a.id, b.id)];
  if (oral) return oral;
  return "未進入流程";
}

// =============== 可用動作 ===============
function getActions(a, b) {
  const type = deriveCaseType(a, b);
  if (type === "性別不合案" || type === "同人案") {
    return [{ key: "rejectByRite", label: "以禮法駁回（不合禮制）" }];
  }
  if (type === "婚後案") {
    return [
      { key: "settleHousehold", label: "安排／調整院落與婚後名分" },
      { key: "addChild", label: "新增子嗣線" },
      { key: "maritalConflict", label: "推進婚後衝突" },
      { key: "spousalAlliance", label: "讓夫妻結盟" },
    ];
  }
  if (type === "納新人／續娶案") {
    return [
      { key: "consultHousehold", label: "先查既有正室、側室與子嗣反應" },
      { key: "takeConsort", label: "納為側妃／妾室／繼室" },
      { key: "rejectByHousehold", label: "以後宅不穩駁回" },
      { key: "delayCase", label: "暫緩，封存名冊" },
    ];
  }
  if (type === "暫緩觀察案") {
    return [
      { key: "protocolSchool", label: "改入女史禮制課／旁修觀察" },
      { key: "askPeople", label: "先問當事人意願" },
      { key: "rejectByRite", label: "以年齡與禮法駁回" },
      { key: "delayCase", label: "暫緩，不准外傳" },
    ];
  }
  const stage = getStageOfPair(a, b);
  if (stage === "未進入流程") {
    return [
      { key: "askPeople", label: "先問當事人意願" },
      { key: "engage", label: "議親成功（口頭說定）" },
      { key: "rejectByRite", label: "以禮法駁回" },
      { key: "delayCase", label: "暫緩，封存名冊" },
    ];
  }
  if (stage === "已議親成功") {
    return [
      { key: "formalBetrothal", label: "正式定親（換婚書信物，寫入族譜）" },
      { key: "breakOldPromise", label: "翻案改議（傷兩家面子）" },
      { key: "preWeddingIncident", label: "婚前生變" },
      { key: "delayCase", label: "暫緩處置" },
    ];
  }
  if (stage === "已定親") {
    return [
      { key: "setWeddingDate", label: "商定婚期" },
      { key: "preWeddingIncident", label: "婚前生變" },
      { key: "breakOldPromise", label: "悔婚（撕婚書）" },
    ];
  }
  if (stage === "婚期籌備") {
    return [
      { key: "marry", label: "正式成婚" },
      { key: "preWeddingIncident", label: "婚前生變" },
      { key: "delayCase", label: "婚期延後" },
    ];
  }
  return [{ key: "delayCase", label: "暫緩處置" }];
}

// 動作需要的欄位
function getRequiredFields(action) {
  switch (action) {
    case "marry": return ["aTitle", "bTitle", "courtyard", "marryYear"];
    case "takeConsort": return ["sharedTitle", "courtyard", "marryYear"];
    case "settleHousehold": return ["courtyard"];
    case "addChild": return ["child"];
    case "formalBetrothal": return ["spouseType"];
    case "editMarriage": return ["editMarryYear", "editSpouseType"];
    default: return [];
  }
}

// =============== 案情摘要 ===============
function buildSummary(a, b) {
  if (!a || !b) return "請挑選兩位人物。";
  const type = deriveCaseType(a, b);
  const stage = getStageOfPair(a, b);
  const rel = relationBetween(a.id, b.id);
  const lines = [];
  lines.push(`案件類型：${type}`);
  lines.push(`人物：${a.name} × ${b.name}`);
  lines.push(`當前階段：${stage}`);

  if (type === "性別不合案") {
    lines.push("兩人性別相同，不符當時婚配禮制，無法走一般議親流程。");
    return lines.join("\n");
  }
  if (type === "同人案") {
    lines.push("無法為同一人開議親案。");
    return lines.join("\n");
  }

  if (rel) {
    lines.push(`既有關係：${displaySpouseType(rel.type)}；於星曆 ${rel.marryYear || "未記"} 年成立。`);
    if (rel.courtyard) lines.push(`院落：${rel.courtyard}`);
    lines.push("此案應處理婚後秩序、子嗣、衝突或同盟。");
  } else if (type === "納新人／續娶案") {
    const aHas = (a.spouseIds || []).length > 0;
    const married = aHas ? a : b;
    const incoming = aHas ? b : a;
    const others = spouseListOf(married).map(x => `${x.other.name}（${displaySpouseType(x.rel.type)}）`).join("、") || "無紀錄";
    lines.push(`${married.name}既有配偶：${others}`);
    lines.push(`若納${incoming.name}，應走側妃／妾／繼室路線，並安排院落。`);
  } else if (type === "暫緩觀察案") {
    const young = (getMatchAge(a) || 99) < (getMatchAge(b) || 99) ? a : b;
    lines.push(`${young.name}年紀尚小(${getMatchAge(young)}歲),不宜直接推成婚事。`);
  } else {
    lines.push("兩人目前可進入一般議親流程。");
  }

  // 牽涉家族
  const aFam = a.familyId ? getFamilyNameById(a.familyId) : "未歸宗族";
  const bFam = b.familyId ? getFamilyNameById(b.familyId) : "未歸宗族";
  lines.push(`牽涉家族：${aFam} × ${bFam}`);

  return lines.join("\n");
}

// =============== 隨機事件(擲一下) ===============
const randomEvents = [
  { id: "rumor", title: "流言：暗中通信被外人撞見",
    body: (a, b) => `京中傳出${a.name}與${b.name}暗中通信。流言發酵的速度比議親本身還快,兩家臉面都被人盯著。`,
    caseTypes: ["普通議親案"], stages: ["未進入流程", "已議親成功"] },
  { id: "third-suitor", title: "第三人加入：另有提親者",
    body: (a, b) => `${a.name}與${b.name}議親消息傳開後,另一家也派人來向同一人提親。簡單的議親變成兩家暗中較勁。`,
    caseTypes: ["普通議親案"], stages: ["未進入流程", "已議親成功"] },
  { id: "elder", title: "長輩插手：朝中長輩過問",
    body: (a, b) => `上頭過問了。${a.name}與${b.name}的婚事被朝中長輩召見問話,原本可慢慢談的事,現在必須給回應。`,
    caseTypes: ["普通議親案", "改議風波案"], stages: ["未進入流程", "已議親成功", "已定親"] },
  { id: "old-flame", title: "舊情未斷：心上人出現",
    body: (a, b) => `事情看似要走向定局時,${a.name}或${b.name}舊日的心上人重新出現。`,
    caseTypes: ["普通議親案"], stages: ["已議親成功", "已定親", "婚期籌備"] },
  { id: "wedding-disaster", title: "婚當日：迎親隊伍出事",
    body: (a, b) => `迎親當日,隊伍中途出了意外。可能是有人故意,也可能是天意。${a.name}與${b.name}的婚事在最後一刻被打斷。`,
    caseTypes: ["普通議親案"], stages: ["婚期籌備"] },
  { id: "family-scandal", title: "家中變故：一方家族出事",
    body: (a, b) => `${a.name}或${b.name}家中突然出事——可能是父輩被彈劾、可能是兄姐惹禍。婚事在這節骨眼變得尷尬。`,
    caseTypes: ["普通議親案"], stages: ["已議親成功", "已定親", "婚期籌備"] },
  { id: "side-vs-main", title: "後宅震動：側室質疑正室",
    body: (a) => `偏院的人開始不安分。請安順序、月例、子嗣排行——${a.name}府中的秩序開始被測試。`,
    caseTypes: ["婚後案", "納新人／續娶案"], stages: [] },
  { id: "pregnant-side", title: "侍妾有孕：嫡庶之爭浮上檯面",
    body: (a, b) => `府中傳出有人有孕,且不是正室。${a.name}與${b.name}必須處理嫡庶、撫養、名分這些原本可拖的問題。`,
    caseTypes: ["婚後案"], stages: [] },
  { id: "old-promise-leak", title: "舊約洩漏：婚前那段被人翻出",
    body: (a, b) => `成婚前那段沒講清楚的事被人翻出來了。${a.name}與${b.name}的婚姻信任面臨第一次大考。`,
    caseTypes: ["婚後案"], stages: [] },
  { id: "main-counter", title: "正室反擊：以禮制壓回新人",
    body: () => "既有的正室不會坐視新人入府。她以禮制、家族、皇命之中可動用的東西去壓回這次納娶。",
    caseTypes: ["納新人／續娶案"], stages: [] },
  { id: "young-self-aware", title: "當事人自覺：年幼者主動表態",
    body: () => "年紀尚小的那一位主動表態了——可能說不要嫁,可能說願意等。",
    caseTypes: ["暫緩觀察案"], stages: [] },
];

function pickRandomEvent(a, b) {
  if (!a || !b) return { title: "風平浪靜", body: "尚未選定人物，案卷無事可記。" };
  const type = deriveCaseType(a, b);
  const stage = getStageOfPair(a, b);
  const candidates = randomEvents.filter(ev => {
    if (!ev.caseTypes.includes(type)) return false;
    if (ev.stages && ev.stages.length > 0 && !ev.stages.includes(stage)) return false;
    return true;
  });
  if (!candidates.length) {
    return { title: "風平浪靜", body: `這一輪${a.name}與${b.name}的案卷沒有任何意外發生。可繼續推進。` };
  }
  const ev = pickRandom(candidates);
  return { title: ev.title, body: ev.body(a, b) };
}

// =============== 第三方反應 ===============
function getThirdPartyReactions(action, a, b) {
  const reactions = [];

  if (action === "takeConsort" || action === "marry") {
    // 既有配偶
    const existing = [...spouseListOf(a), ...spouseListOf(b)]
      .filter(x => x.other.id !== a.id && x.other.id !== b.id);
    const seen = new Set();
    existing.forEach(x => {
      if (seen.has(x.other.id)) return;
      seen.add(x.other.id);
      reactions.push({
        who: x.other.name,
        role: displaySpouseType(x.rel.type),
        reaction: "地位受威脅,會試探新人來歷與家族背景,可能藉禮制壓回。"
      });
    });
  }

  if (action === "takeConsort" || action === "marry" || action === "addChild") {
    // 既有子女
    const kids = new Set();
    [a, b].forEach(p => {
      (p.childIds || []).forEach(cid => kids.add(cid));
    });
    if (kids.size > 0) {
      const names = Array.from(kids).slice(0, 3).map(id => findPerson(id)?.name).filter(Boolean);
      reactions.push({
        who: `既有子嗣(${names.join("、")}${kids.size > 3 ? "...等" : ""})`,
        role: "子女",
        reaction: "排行、嫡庶身分、未來繼承都可能因此變化,撫養者會替他們爭。"
      });
    }
  }

  if (action === "engage" || action === "formalBetrothal" || action === "marry") {
    // 兩家族反應
    if (a.familyId && b.familyId && a.familyId !== b.familyId) {
      reactions.push({
        who: `${getFamilyNameById(a.familyId)} × ${getFamilyNameById(b.familyId)}`,
        role: "雙方家族",
        reaction: "兩家正式建立姻親聯繫,連帶影響各自的盟友網絡與商議席次。"
      });
    }
  }

  if (action === "rejectByRite" || action === "rejectByHousehold" || action === "breakOldPromise") {
    if (a.familyId && b.familyId && a.familyId !== b.familyId) {
      reactions.push({
        who: `${getFamilyNameById(a.familyId)} × ${getFamilyNameById(b.familyId)}`,
        role: "雙方家族",
        reaction: "被駁回／翻案的那方臉面受損,另一方則需自證沒有趁機落井下石。"
      });
    }
  }

  if (action === "protocolSchool") {
    reactions.push({
      who: "提親者",
      role: "原本想推這樁親事的人",
      reaction: "失了著力點。若再強推會顯得不合禮法。"
    });
  }

  return reactions;
}

// =============== 執行動作:這裡是真會改 state 的地方 ===============
function makeOutcome(action, a, b, inputs) {
  const out = {
    title: "",
    immediate: "",
    next: "",
    hint: "",
    actionLabel: "",
    reactions: [],
    kind: "action",
    // 副作用旗標
    writeBetrothal: false,      // 寫入訂婚到 spouseRelations
    updateStage: null,          // 更新 matchStage
    writeMarry: false,          // 正式婚禮:寫 marryYear、改 type
    writeConsort: false,        // 納妾:新關係
    consortType: "",
    courtyard: "",
    spouseTypeChosen: "正妻",
    addChild: false,
    breakBetrothal: false,
  };

  switch (action) {
    case "askPeople":
      out.title = `問意願:${a.name} × ${b.name}`;
      out.immediate = `先不急著寫入名冊，分別詢問${a.name}與${b.name}的意願。`;
      out.next = "兩人的回應保留，婚事暫時還能轉圜。";
      out.hint = "接下來可議親成功，也可駁回或暫緩。";
      break;

    case "engage":
      out.title = `議親成功:${a.name} × ${b.name}`;
      out.immediate = "兩家口頭說成婚事。從這一刻開始，之後若再議他人，就不是普通議親，而是改議或悔婚。";
      out.next = "下一步可正式定親（寫入族譜）、駁回，或在婚前插入變故。";
      out.hint = "口頭議親不寫入族譜，但記在議親室，下一步按鈕會接續。";
      out.updateStage = "已議親成功";
      out.writeOralEngage = true;
      break;

    case "formalBetrothal":
      out.title = `正式定親:${a.name} × ${b.name}`;
      out.immediate = `婚書與信物交換,${a.name}與${b.name}的婚約正式定下,寫入宗族之書（訂婚）。`;
      out.next = "聘禮、嫁妝、主婚人與禮序會成為下一輪重點。";
      out.hint = "已寫入 spouseRelations，類型為「訂婚」，但 marryYear 留空，等成婚時補上。";
      out.writeBetrothal = true;
      out.spouseTypeChosen = inputs.spouseType || "訂婚";
      out.updateStage = "已定親";
      break;

    case "setWeddingDate":
      out.title = `商定婚期:${a.name} × ${b.name}`;
      out.immediate = "婚期被排入禮單,婚事從可議進入籌備。";
      out.next = "旁人若要阻止，必須趕在禮成之前。";
      out.hint = "下一步可正式成婚,也可婚前生變。";
      out.updateStage = "婚期籌備";
      break;

    case "marry": {
      const yr = parseInt(inputs.marryYear) || state.gameYear;
      const aTitleRaw = inputs.aTitle || "夫";
      const bTitleRaw = inputs.bTitle || "正妻";
      // 「夫」或「正妻」寫入族譜時統一存為「婚配」
      const toWriteType = (t) => (t === "夫" || t === "正妻") ? "婚配" : t;
      const bWriteType = toWriteType(bTitleRaw);
      out.title = `正式成婚：${a.name} × ${b.name}`;
      out.immediate = `${a.name}以「${aTitleRaw}」身分成婚，${b.name}以「${bTitleRaw}」身分入局，院落安排為「${inputs.courtyard || "未定"}」，於星曆 ${yr} 年成婚。`;
      out.next = "此後不再走議親流程，改為婚後院落、子嗣、衝突與夫妻同盟。";
      out.hint = "spouseRelations 補上 marryYear，夫／正妻統一以「婚配」寫入族譜。";
      out.writeMarry = true;
      out.marryYearChosen = yr;
      out.courtyard = inputs.courtyard || "";
      out.spouseTypeChosen = bWriteType;
      out.updateStage = "已婚";
      break;
    }

    case "takeConsort": {
      const aHas = (a.spouseIds || []).length > 0;
      const main = aHas ? a : b;
      const incoming = aHas ? b : a;
      const t = inputs.sharedTitle || "妾";
      const yr = parseInt(inputs.marryYear) || state.gameYear;
      out.title = `納新人入府:${main.name} × ${incoming.name}`;
      out.immediate = `${incoming.name}以「${t}」名分入局,院落安排為「${inputs.courtyard || "未定"}」,於星曆 ${yr} 年入府。`;
      out.next = "既有正室、側室與子嗣都會受到影響。";
      out.hint = "會新增一筆 spouseRelations，類型為輸入的名分。";
      out.writeConsort = true;
      out.consortType = t;
      out.courtyard = inputs.courtyard || "";
      out.marryYearChosen = yr;
      break;
    }

    case "editMarriage": {
      const yr = parseInt(inputs.editMarryYear);
      const t = inputs.editSpouseType || "";
      out.title = `修改婚姻紀錄:${a.name} × ${b.name}`;
      const changes = [];
      if (!isNaN(yr)) changes.push(`結婚年份改為星曆 ${yr} 年`);
      if (t) changes.push(`名分改為「${t}」`);
      out.immediate = changes.length ? changes.join("，") + "。" : "未輸入要修改的欄位。";
      out.next = "此修改僅調整既有 spouseRelations 紀錄，不會新增關係。";
      out.hint = "若兩人並未真正成婚或定親，不會生效。";
      if (!isNaN(yr)) out.editMarryYear = yr;
      if (t) out.editSpouseType = t;
      break;
    }

    case "settleHousehold":
      out.title = `婚後安置:${a.name} × ${b.name}`;
      out.immediate = `院落安排為「${inputs.courtyard || "未定"}」。`;
      out.next = "院落、請安、帳冊與稱呼會影響後宅秩序。";
      out.hint = "只調整既有 spouseRelations 的 courtyard 欄位。";
      out.courtyard = inputs.courtyard || "";
      break;

    case "addChild": {
      const childName = inputs.childName || "未命名";
      const childGender = inputs.childGender || "子";
      const childStatus = inputs.childStatus || "嫡出";
      out.title = `子嗣線:${a.name} × ${b.name}`;
      out.immediate = `${childStatus}${childGender}「${childName}」加入兩人的子嗣線。`;
      out.next = "嫡庶、排行、由誰撫養，會牽動後宅與繼承。";
      out.hint = "會新建一位人物並連結父母。";
      out.addChild = true;
      break;
    }

    case "maritalConflict":
      out.title = `婚後衝突:${a.name} × ${b.name}`;
      out.immediate = "成婚後的矛盾浮出水面。";
      out.next = "若處理不好，後續可能演變成冷戰、納新人或家族介入。";
      out.hint = "這是婚後線，不會退回普通議親。";
      break;

    case "spousalAlliance":
      out.title = `夫妻結盟:${a.name} × ${b.name}`;
      out.immediate = "兩人選擇先站在同一邊。";
      out.next = "長輩再想分化兩人會變得更困難。";
      out.hint = "婚事從被安排,轉為兩人主動經營。";
      break;

    case "consultHousehold":
      out.title = `查後宅:${a.name} × ${b.name}`;
      out.immediate = "先查既有正室、側室、侍妾與子嗣，暫不推進婚事。";
      out.next = "若既有秩序不穩，新人入府會成為風波。";
      out.hint = "納新人前的合理步驟。";
      break;

    case "protocolSchool": {
      const young = (getMatchAge(a) || 99) < (getMatchAge(b) || 99) ? a : b;
      out.title = `保護性暫緩:${young.name}`;
      out.immediate = `${young.name}改入女史禮制課或旁修觀察,從待嫁名冊退出。`;
      out.next = "提親者若再逼迫，就會顯得不合禮法。";
      out.hint = "適合年紀過小者。";
      break;
    }

    case "rejectByRite":
    case "rejectByHousehold":
      out.title = `正式駁回:${a.name} × ${b.name}`;
      out.immediate = "這樁婚事被以禮法、年齡、名分或後宅秩序駁回。";
      out.next = "提議者可能失面子，也可能換一種方式再推。";
      out.hint = "案卷暫時結束。";
      out.breakBetrothal = true;
      out.updateStage = "未進入流程";
      break;

    case "delayCase":
      out.title = `暫緩封存:${a.name} × ${b.name}`;
      out.immediate = "名冊暫時封存，不准外傳。";
      out.next = "各方會私下打聽真正原因。";
      out.hint = "暫緩會保留轉圜空間。";
      break;

    case "breakOldPromise":
      out.title = `翻案改議／悔婚:${a.name} × ${b.name}`;
      out.immediate = "已議的婚事被翻案，信物退還，婚書作廢。";
      out.next = "兩家臉面與後續議親都會受影響。";
      out.hint = "若已寫入族譜的訂婚紀錄會被移除。";
      out.breakBetrothal = true;
      out.updateStage = "未進入流程";
      break;

    case "preWeddingIncident":
      out.title = `婚前生變:${a.name} × ${b.name}`;
      out.immediate = "在禮成之前出了事。可能是迎親隊伍受阻、可能是長輩出面、可能是當事人臨陣反悔。";
      out.next = "婚事被打斷，下一步要決定是繼續推、改議、或全盤推翻。";
      out.hint = "案卷會停在婚前階段，不會自動推到已婚。";
      break;

    default:
      out.title = "案卷停滯";
      out.immediate = "這一步尚未推動劇情。";
      out.next = "眾人繼續觀望。";
      out.hint = "請改選更符合目前關係的操作。";
  }

  return out;
}

// 真正改變 state 的副作用
// ----- 修正(v6+) -----
// 新增 action 參數,讓破局邏輯能在 dissolveAction 欄位記錄是哪種動作觸發的破局,
// 以便人物詳情頁正確顯示「翻案改議／悔婚 / 禮法駁回 / 後宅駁回」等具體標籤。
// -------------------
function applySideEffects(out, a, b, inputs, action) {
  let touched = false;

  // 寫入訂婚:在 spouseRelations 加一筆「訂婚」
  if (out.writeBetrothal) {
    if (!Array.isArray(a.spouseRelations)) a.spouseRelations = [];
    if (!Array.isArray(b.spouseRelations)) b.spouseRelations = [];
    if (!a.spouseIds) a.spouseIds = [];
    if (!b.spouseIds) b.spouseIds = [];

    const existsA = a.spouseRelations.find(r => r.id === b.id);
    if (!existsA) {
      a.spouseRelations.push({
        id: b.id,
        type: "訂婚",
        marryYear: null,
        matchStage: "已定親",
        courtyard: "",
        betrothalYear: state.gameYear
      });
    }
    const existsB = b.spouseRelations.find(r => r.id === a.id);
    if (!existsB) {
      b.spouseRelations.push({
        id: a.id,
        type: "訂婚",
        marryYear: null,
        matchStage: "已定親",
        courtyard: "",
        betrothalYear: state.gameYear
      });
    }
    if (!a.spouseIds.includes(b.id)) a.spouseIds.push(b.id);
    if (!b.spouseIds.includes(a.id)) b.spouseIds.push(a.id);
    // 正式定親後清掉口頭議親暫存，避免 getStageOfPair 仍回傳「已議親成功」
    delete matchState.oralEngagements[pairKey(a.id, b.id)];
    touched = true;
  }

  // 正式成婚:把訂婚補完(或新建)
  if (out.writeMarry) {
    if (!Array.isArray(a.spouseRelations)) a.spouseRelations = [];
    if (!Array.isArray(b.spouseRelations)) b.spouseRelations = [];
    if (!a.spouseIds) a.spouseIds = [];
    if (!b.spouseIds) b.spouseIds = [];

    const marryYr = out.marryYearChosen || state.gameYear;
    const rA = a.spouseRelations.find(r => r.id === b.id);
    const newType = out.spouseTypeChosen || "正妻";
    if (rA) {
      rA.type = newType;
      rA.marryYear = marryYr;
      rA.matchStage = "已婚";
      if (out.courtyard) rA.courtyard = out.courtyard;
    } else {
      a.spouseRelations.push({
        id: b.id, type: newType, marryYear: marryYr,
        matchStage: "已婚", courtyard: out.courtyard || ""
      });
    }
    const rB = b.spouseRelations.find(r => r.id === a.id);
    if (rB) {
      rB.type = newType;
      rB.marryYear = marryYr;
      rB.matchStage = "已婚";
      if (out.courtyard) rB.courtyard = out.courtyard;
    } else {
      b.spouseRelations.push({
        id: a.id, type: newType, marryYear: marryYr,
        matchStage: "已婚", courtyard: out.courtyard || ""
      });
    }
    if (!a.spouseIds.includes(b.id)) a.spouseIds.push(b.id);
    if (!b.spouseIds.includes(a.id)) b.spouseIds.push(a.id);

    // 年史
    recordChronicleSafe({
      year: marryYr, kind: "event", eventKind: "marriage",
      decision: `議親室成婚:${a.name} × ${b.name}(${newType})`,
      actors: { person1Id: a.id, person2Id: b.id }
    });
    // 成婚後清掉本地口頭議親
    delete matchState.oralEngagements[pairKey(a.id, b.id)];
    touched = true;
  }

  // 納妾:新增一筆 spouseRelations,類型為輸入
  if (out.writeConsort) {
    const aHas = (a.spouseIds || []).length > 0;
    const main = aHas ? a : b;
    const incoming = aHas ? b : a;
    if (!Array.isArray(main.spouseRelations)) main.spouseRelations = [];
    if (!Array.isArray(incoming.spouseRelations)) incoming.spouseRelations = [];
    if (!main.spouseIds) main.spouseIds = [];
    if (!incoming.spouseIds) incoming.spouseIds = [];

    const marryYr = out.marryYearChosen || state.gameYear;
    if (!main.spouseRelations.find(r => r.id === incoming.id)) {
      main.spouseRelations.push({
        id: incoming.id, type: out.consortType || "妾",
        marryYear: marryYr, matchStage: "已婚",
        courtyard: out.courtyard || ""
      });
    }
    if (!incoming.spouseRelations.find(r => r.id === main.id)) {
      incoming.spouseRelations.push({
        id: main.id, type: out.consortType || "妾",
        marryYear: marryYr, matchStage: "已婚",
        courtyard: out.courtyard || ""
      });
    }
    if (!main.spouseIds.includes(incoming.id)) main.spouseIds.push(incoming.id);
    if (!incoming.spouseIds.includes(main.id)) incoming.spouseIds.push(main.id);

    recordChronicleSafe({
      year: marryYr, kind: "event", eventKind: "marriage",
      decision: `議親室納:${main.name} 納 ${incoming.name}(${out.consortType})`,
      actors: { person1Id: main.id, person2Id: incoming.id }
    });
    touched = true;
  }

  // 院落改動
  if (!out.writeMarry && !out.writeConsort && out.courtyard) {
    const rA = (a.spouseRelations || []).find(r => r.id === b.id);
    const rB = (b.spouseRelations || []).find(r => r.id === a.id);
    if (rA) rA.courtyard = out.courtyard;
    if (rB) rB.courtyard = out.courtyard;
    if (rA || rB) touched = true;
  }

  // 修改結婚年份
  if (out.editMarryYear != null) {
    const rA = (a.spouseRelations || []).find(r => r.id === b.id);
    const rB = (b.spouseRelations || []).find(r => r.id === a.id);
    if (rA) { rA.marryYear = out.editMarryYear; touched = true; }
    if (rB) { rB.marryYear = out.editMarryYear; touched = true; }
  }

  // 修改名分／關係類型
  if (out.editSpouseType) {
    const rA = (a.spouseRelations || []).find(r => r.id === b.id);
    const rB = (b.spouseRelations || []).find(r => r.id === a.id);
    if (rA) { rA.type = out.editSpouseType; touched = true; }
    if (rB) { rB.type = out.editSpouseType; touched = true; }
  }

  // 更新 matchStage(僅在已有 relation 時)
  // ----- 修正(v6+) -----
  // 破局時(breakBetrothal=true)不走這段:破局自己會處理 dissolved 標記,
  // 並透過 dissolveStage 記錄當下階段。讓 matchStage 被覆蓋為「未進入流程」
  // 會破壞顯示語意。
  // -------------------
  if (out.updateStage && !out.writeBetrothal && !out.writeMarry && !out.writeConsort && !out.breakBetrothal) {
    const rA = (a.spouseRelations || []).find(r => r.id === b.id);
    const rB = (b.spouseRelations || []).find(r => r.id === a.id);
    if (rA) { rA.matchStage = out.updateStage; touched = true; }
    if (rB) { rB.matchStage = out.updateStage; touched = true; }
  }

  // 口頭議親:寫入本地暫存(讓 getStageOfPair 抓得到「已議親成功」)
  if (out.writeOralEngage) {
    matchState.oralEngagements[pairKey(a.id, b.id)] = "已議親成功";
  }

  // 駁回／悔婚:依當下階段決定處理方式
  // - 已定親 / 婚期籌備:保留 spouseRelations 那筆,加 dissolved 標記寫入婚配紀錄
  // - 其他(口頭議親或未進入流程):維持現有的 filter 邏輯,不寫入永久紀錄
  if (out.breakBetrothal) {
    const decisionInfo = matchState.dissolveDecision || { by: "A方", reason: "" };

    const rA = (a.spouseRelations || []).find(r => r.id === b.id);
    const rB = (b.spouseRelations || []).find(r => r.id === a.id);

    // ====================================================================
    // 破局紀錄:一律保留 spouseRelations,加上 dissolved 標記
    // ====================================================================
    // 注意:currentStage 要在這裡才取(line 826 的 updateStage 已經把 matchStage
    // 改成「未進入流程」,直接呼叫 getStageOfPair 會拿到錯的值)。
    // 我們用 rA.matchStage 在改寫前的值 — 但因為上面已被改,所以改從動作 action
    // 反推一個合理的 stage 字串。
    //
    // 更簡單的做法:直接用 action 描述破局時機,而非 stage:
    //   - breakOldPromise   → "已定親/婚期" (因為翻案改議只能在訂婚後)
    //   - rejectByRite      → "議親早期"
    //   - rejectByHousehold → "議親早期"
    //   - breakWedding      → "成婚當日"
    // 玩家看到的「夫人這人是怎麼解約的」用 dissolveAction 顯示就夠了,
    // dissolveStage 只是輔助。
    // ====================================================================
    const stageGuessByAction = {
      "breakOldPromise":   "已定親",
      "rejectByRite":      "議親階段",
      "rejectByHousehold": "議親階段",
      "breakWedding":      "成婚前夕"
    };
    const stageRecord = stageGuessByAction[action] || "議親階段";

    if (rA && rA.type === "訂婚" && !rA.marryYear) {
      rA.dissolved = true;
      rA.dissolveYear = state.gameYear;
      rA.dissolveStage = stageRecord;
      rA.dissolveAction = action || "breakOldPromise";
      rA.dissolvedBy = decisionInfo.by || "A方";
      rA.dissolveReason = decisionInfo.reason || "";
      // 已解約者從 spouseIds 移除(不再算現役)
      a.spouseIds = (a.spouseIds || []).filter(id => id !== b.id);
      touched = true;
    }

    if (rB && rB.type === "訂婚" && !rB.marryYear) {
      const reverseBy = decisionInfo.by === "A方" ? "B方"
                      : decisionInfo.by === "B方" ? "A方"
                      : "雙方";
      rB.dissolved = true;
      rB.dissolveYear = state.gameYear;
      rB.dissolveStage = stageRecord;
      rB.dissolveAction = action || "breakOldPromise";
      rB.dissolvedBy = reverseBy;
      rB.dissolveReason = decisionInfo.reason || "";
      b.spouseIds = (b.spouseIds || []).filter(id => id !== a.id);
      touched = true;
    }

    // 清掉口頭議親紀錄(無論 spouseRelations 是否存在都該清)
    if (matchState.oralEngagements) {
      delete matchState.oralEngagements[pairKey(a.id, b.id)];
    }
  }

  // 新增子嗣 — 規則:子女預設 familyId = 父方家族(以性別為準),入贅婚則 = 母方
  if (out.addChild) {
    const childName = inputs.childName || generateGivenName();
    const childGenderInput = inputs.childGender || "子";
    const gender = (childGenderInput === "女") ? "女" : "男";
    const role = inputs.childRole || (inputs.childStatus === "庶出" ? "庶出子女" : "嫡支子女");
    const birthYearInput = inputs.childBirthYear;

    // 找雙方關係,判斷是否入贅婚
    const rel = (a.spouseRelations || []).find(r => r.id === b.id)
             || (b.spouseRelations || []).find(r => r.id === a.id);
    const isUxorilocal = rel && rel.type === "入贅"; // 入贅婚

    // 找出父親與母親
    let father = null, mother = null;
    if (a.gender === "男") { father = a; mother = b; }
    else if (b.gender === "男") { father = b; mother = a; }
    else { father = a; mother = b; } // 兩人都沒性別,A 預設為父

    // 子女家族歸屬:入贅 → 母方;否則 → 父方
    const inheritFamilyFrom = isUxorilocal ? mother : father;
    const childFamilyId = inheritFamilyFrom?.familyId || father?.familyId || mother?.familyId || null;

    // 暫時擋掉 childMode / parentMode，避免觸發主頁 DOM 流程
    const savedChildMode = state.childModeParentId;
    const savedParentMode = state.parentModeChildId;
    state.childModeParentId = null;
    state.parentModeChildId = null;

    const baby = addPerson({
      name: childName,
      gender: gender,
      role: role,
      familyId: childFamilyId,
      occupation: "",
      residence: "",
      ageOrBirthInput: birthYearInput ? String(birthYearInput) : String(state.gameYear),
      notes: `(議親室子嗣${isUxorilocal ? "・入贅母方家族" : ""})`
    });
    // 還原 childMode / parentMode
    state.childModeParentId = savedChildMode;
    state.parentModeChildId = savedParentMode;

    if (baby) {
      // 父母連結:兩位都要連
      linkParentChild(father, baby, { ignoreRule: true, silent: true });
      linkParentChild(mother, baby, { ignoreRule: true, silent: true });
      normalizeRelations();
      touched = true;
      out._babyName = baby.name;
      out._babyFamily = childFamilyId ? getFamilyNameById(childFamilyId) : "未歸宗族";
    }
  }

  if (touched) {
    saveState();
  }
  return touched;
}

// safe wrapper: recordChronicle 在 events.js 已宣告
function recordChronicleSafe(entry) {
  try {
    if (typeof recordChronicle === "function") recordChronicle(entry);
    else {
      if (!state.chronicle) state.chronicle = [];
      state.chronicle.push(entry);
    }
  } catch (e) { /* noop */ }
}

// =============== 看看誰適合 ===============
function suggestMatchesFor(target) {
  if (!target) return [];
  const oppositeGender = target.gender === "男" ? "女" : (target.gender === "女" ? "男" : null);
  const intent = matchState.intent || defaultMatchIntent();
  let pool = matchState.forcePick ? allLivingPeople() : eligibleForMatch();

  // v6+:婚事性質會影響池子(側室/續弦自動納入已婚對象)
  if (!matchState.forcePick && (intent.kind === "側室" || intent.kind === "續弦")) {
    pool = allLivingPeople();
  }

  return pool
    .filter(c => c.id !== target.id)
    .filter(c => oppositeGender ? c.gender === oppositeGender : true)
    .map(c => {
      const reasons = [];
      const concerns = [];
      let score = 0;
      const tAge = getMatchAge(target);
      const cAge = getMatchAge(c);
      const ageDiff = (tAge != null && cAge != null) ? Math.abs(tAge - cAge) : null;
      if (ageDiff != null) {
        if (ageDiff <= 3) { reasons.push("年齡相當"); score += 3; }
        else if (ageDiff <= 6) { reasons.push("年齡尚可"); score += 1; }
        else if (ageDiff > 10) {
          // v6+:續弦對年齡差容忍度大,減半扣分
          const penalty = intent.kind === "續弦" ? -1 : -2;
          concerns.push(`年齡差 ${ageDiff} 歲偏大`);
          score += penalty;
        }
      }
      if (cAge != null && cAge < 15) { concerns.push(`${c.name}年紀過小，需走暫緩觀察案`); score -= 3; }
      if (tAge != null && tAge < 15) concerns.push(`${target.name}年紀過小`);

      const cHas = (c.spouseIds || []).length > 0;
      const tHas = (target.spouseIds || []).length > 0;

      // v6+:婚事性質影響「對方已婚」這條的判定
      // 側室/續弦:對方已婚不扣分,反而是預期內;政治聯姻:中性
      // 正配/入贅:照舊扣分
      if (cHas && !tHas) {
        if (intent.kind === "側室" || intent.kind === "續弦") {
          // 不扣分,也不加分,純說明
        } else {
          concerns.push(`${c.name}已有婚配，只能納為側室／繼室`);
          score -= 1;
        }
      }
      if (tHas && !cHas) reasons.push(`${target.name}已有婚配，${c.name}可作側妃／侍妾／續弦人選`);
      if (cHas && tHas) {
        if (intent.kind === "側室" || intent.kind === "續弦") {
          score -= 1;
        } else {
          concerns.push("雙方都已有婚配");
          score -= 3;
        }
      }

      // 同家族需查血緣
      if (c.familyId && target.familyId && c.familyId === target.familyId) {
        concerns.push("同家族,需查血緣");
        score -= 2;
      }

      // 區域同地加分(交通方便)
      const tFam = state.families.find(f => f.id === target.familyId);
      const cFam = state.families.find(f => f.id === c.familyId);
      if (tFam && cFam && tFam.regionId && tFam.regionId === cFam.regionId) {
        reasons.push("同區域,聯姻易行");
        score += 1;
      }

      // 盟友家族加分
      if (tFam && cFam && (tFam.allies || []).includes(cFam.id)) {
        reasons.push("兩家已為盟友,聯姻可深化");
        score += 2;
      }

      // 死者不行(理論上池子已過濾)
      if (c.deceased) { concerns.push("已逝"); score -= 99; }

      // ============================================================
      // v6+:本次意向計分(看重 +、忌諱 -)
      // ============================================================
      const intentResult = scoreByIntent(target, c, intent, tFam, cFam, tAge, cAge, ageDiff);
      score += intentResult.delta;
      intentResult.reasons.forEach(r => reasons.push(r));
      intentResult.concerns.forEach(co => concerns.push(co));

      return { person: c, reasons, concerns, score };
    })
    .filter(item => item.score > -10)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

// =============== v6+:意向計分 ===============
// 回傳 { delta, reasons, concerns }
function scoreByIntent(target, c, intent, tFam, cFam, tAge, cAge, ageDiff) {
  let delta = 0;
  const reasons = [];
  const concerns = [];

  // 標籤前綴,讓玩家分辨哪些是因為本次意向加減的
  const VAL = "★合本次意向：";
  const TAB = "✕犯本次忌諱：";

  const cHas = (c.spouseIds || []).length > 0;
  const cChildrenIds = (c.children || []).filter(id => {
    const ch = findPerson(id);
    return ch && !ch.deceased;
  });
  const cParents = [c.fatherId, c.motherId].filter(id => {
    const p = findPerson(id);
    return p && !p.deceased;
  });

  // 門第等級索引(數字越小越高)
  function standingRank(fam) {
    if (!fam || !fam.standing) return DEFAULT_STANDINGS.indexOf("尋常人家");
    const idx = DEFAULT_STANDINGS.indexOf(fam.standing);
    return idx >= 0 ? idx : DEFAULT_STANDINGS.indexOf("尋常人家");
  }

  // ====== 看重項目計分 ======
  intent.values.forEach(key => {
    switch (key) {
      case "hasFamily":
        if (c.familyId) {
          delta += 8;
          reasons.push(VAL + "對方有家族");
        } else {
          delta -= 12;
          concerns.push(VAL + "對方未歸宗族");
        }
        break;

      case "highStanding": {
        if (!cFam) {
          // 無家族,無從判斷;依本次政策視為失格
          delta -= 5;
          concerns.push(VAL + "對方無家族，門第無從評斷");
          break;
        }
        const tRank = standingRank(tFam);
        const cRank = standingRank(cFam);
        // 對方門第 ≤ 我方(rank 數字越小門第越高)
        if (cRank < tRank) {
          delta += 15;
          reasons.push(VAL + `對方門第（${cFam.standing}）高於本家`);
        } else if (cRank === tRank) {
          delta += 8;
          reasons.push(VAL + `門當戶對（同為${cFam.standing}）`);
        } else {
          delta -= 8;
          concerns.push(VAL + `對方門第（${cFam.standing}）低於本家`);
        }
        break;
      }

      case "thrivingFamily": {
        if (!cFam) {
          delta -= 3;
          break;
        }
        const memberCount = state.persons.filter(
          p => p.familyId === cFam.id && !p.deceased
        ).length;
        if (memberCount >= 8) {
          delta += 12;
          reasons.push(VAL + `對方家族人丁興旺（在世 ${memberCount} 人）`);
        } else if (memberCount >= 5) {
          delta += 6;
          reasons.push(VAL + `對方家族人丁尚足（在世 ${memberCount} 人）`);
        } else {
          delta -= 4;
          concerns.push(VAL + `對方家族人丁單薄（在世 ${memberCount} 人）`);
        }
        break;
      }

      case "matchOrigin": {
        if (!intent.valueOrigins.length) break;  // 沒指定就不計
        const cOrigin = cFam ? cFam.origin : "";
        if (cOrigin && intent.valueOrigins.includes(cOrigin)) {
          delta += 12;
          reasons.push(VAL + `對方出身「${cOrigin}」符合所求`);
        } else {
          delta -= 5;
          concerns.push(VAL + "對方出身不在所求之列");
        }
        break;
      }

      case "sameRegion": {
        if (!tFam || !cFam) {
          delta -= 2;
          break;
        }
        if (tFam.regionId && tFam.regionId === cFam.regionId) {
          delta += 10;
          reasons.push(VAL + "對方在本區域");
        } else {
          delta -= 5;
          concerns.push(VAL + "對方不在本區域");
        }
        break;
      }

      case "matchOccupation": {
        if (!intent.valueOccupations.length) break;
        const occ = c.occupation || "";
        if (occ && intent.valueOccupations.includes(occ)) {
          delta += 12;
          reasons.push(VAL + `對方為「${occ}」`);
        } else {
          delta -= 4;
          concerns.push(VAL + "對方職業不在所求之列");
        }
        break;
      }

      case "legitimateChild":
        if (c.role === "嫡支子女") {
          delta += 10;
          reasons.push(VAL + "對方為嫡支子女");
        } else if (c.role === "庶出子女") {
          delta -= 6;
          concerns.push(VAL + "對方為庶出，非所求嫡系");
        } else if (c.role === "旁系宗親") {
          delta -= 4;
          concerns.push(VAL + "對方為旁系，非所求嫡系");
        } else {
          // 身分未明 / 家主等
          delta -= 1;
        }
        break;

      case "ageClose": {
        // 強化現有的年齡相當判斷
        if (ageDiff == null) break;
        if (ageDiff <= 3) {
          delta += 8;
          reasons.push(VAL + "年紀相當（強化）");
        } else if (ageDiff <= 6) {
          delta += 2;
        } else {
          delta -= 6;
          concerns.push(VAL + `年齡差 ${ageDiff} 歲，未達相當`);
        }
        break;
      }

      case "fertileAge": {
        if (cAge == null) {
          delta -= 2;
          break;
        }
        const limit = intent.fertileAgeLimit || 25;
        if (cAge <= limit) {
          delta += 10;
          reasons.push(VAL + `對方 ${cAge} 歲，在育齡之內`);
        } else {
          delta -= 6;
          concerns.push(VAL + `對方 ${cAge} 歲，已逾育齡（${limit}）`);
        }
        break;
      }

      case "noChildren":
        if (cChildrenIds.length === 0) {
          delta += 8;
          reasons.push(VAL + "對方尚無子女");
        } else {
          delta -= 5;
          concerns.push(VAL + `對方已有 ${cChildrenIds.length} 名子女`);
        }
        break;

      case "neverMarried":
        if (!cHas) {
          delta += 10;
          reasons.push(VAL + "對方無婚配紀錄");
        } else {
          delta -= 8;
          concerns.push(VAL + "對方曾有婚配");
        }
        break;

      case "parentsAlive": {
        if (cParents.length === 2) {
          delta += 8;
          reasons.push(VAL + "對方雙親健在");
        } else if (cParents.length === 1) {
          delta += 2;
        } else {
          delta -= 3;
          concerns.push(VAL + "對方雙親皆已不在");
        }
        break;
      }
    }
  });

  // ====== 忌諱項目計分 ======
  intent.taboos.forEach(key => {
    switch (key) {
      case "tabooOrigin": {
        if (!intent.tabooOrigin) break;
        const cOrigin = cFam ? cFam.origin : "";
        if (cOrigin === intent.tabooOrigin) {
          delta -= 15;
          concerns.push(TAB + `對方出身「${cOrigin}」`);
        }
        break;
      }

      case "tabooFarRegion": {
        if (!tFam || !cFam) break;
        if (tFam.regionId && cFam.regionId && tFam.regionId !== cFam.regionId) {
          delta -= 10;
          concerns.push(TAB + "對方在遠地（不同區域）");
        }
        break;
      }

      case "tabooSameRegion": {
        if (!tFam || !cFam) break;
        if (tFam.regionId && tFam.regionId === cFam.regionId) {
          delta -= 10;
          concerns.push(TAB + "對方在本地（求外地姻親）");
        }
        break;
      }

      case "tabooMarried":
        if (cHas) {
          delta -= 15;
          concerns.push(TAB + "對方已有家室");
        }
        break;

      case "tabooHasChildren":
        if (cChildrenIds.length > 0) {
          delta -= 12;
          concerns.push(TAB + `對方已有 ${cChildrenIds.length} 名子女`);
        }
        break;

      case "tabooConcubineBorn":
        if (c.role === "庶出子女") {
          delta -= 15;
          concerns.push(TAB + "對方為庶出子女");
        }
        break;

      case "tabooSidebranch":
        if (c.role === "旁系宗親") {
          delta -= 12;
          concerns.push(TAB + "對方為旁系宗親");
        }
        break;

      case "tabooAgeGap":
        if (ageDiff != null && ageDiff > 5) {
          delta -= 10;
          concerns.push(TAB + `年齡懸殊 ${ageDiff} 歲`);
        }
        break;
    }
  });

  // ====== 婚事性質額外修正 ======
  // 政治聯姻:大幅放大「對方家族人丁興旺」的價值,且額外給有家族的對象加分
  if (intent.kind === "政治聯姻") {
    if (cFam) {
      delta += 5;
      // 不重複加入 reasons,避免雜訊
    } else {
      delta -= 10;
      concerns.push("★政治聯姻無從締結（對方無家族）");
    }
  }
  // 入贅:對方家族規模、長嗣狀況優先(尤其有家族 + 嫡系)
  if (intent.kind === "入贅") {
    if (cFam && c.role === "嫡支子女") {
      delta += 6;
    }
  }
  // 側室:對方門第低不視為扣分,反之太高反成阻礙
  if (intent.kind === "側室" && cFam && tFam) {
    const tRank = standingRank(tFam);
    const cRank = standingRank(cFam);
    if (cRank < tRank - 1) {
      delta -= 5;
      concerns.push("側室人選門第過高，難以名分自處");
    }
  }

  return { delta, reasons, concerns };
}

// =============== 人物資訊文字 ===============
function statusText(person) {
  if (!person) return "";
  const age = getMatchAge(person);
  const famName = person.familyId ? getFamilyNameById(person.familyId) : "未歸宗族";
  const lines = [
    `姓名:${person.name}${person.deceased ? "【已逝】" : ""}`,
    `年齡:${age != null ? age + " 歲" : "未記"}`,
    `性別:${person.gender || "未指定"}`,
    `身分:${person.role || "未指定"}`,
    `家族:${famName}`,
  ];
  // ====================================================================
  // 過濾掉「已結束」的配偶關係,只顯示現任
  // ====================================================================
  // 已結束狀態包含:
  //   - dissolved=true   (破局/解約,訂婚後撤回)
  //   - matchStage="已離異" (成婚後解除)
  //   - matchStage="已喪偶" (配偶過世)
  //   - endYear 有值      (有結束年份的)
  // 已結束的配偶在這個欄位不顯示;若想看歷史紀錄請到人物詳情頁。
  // ====================================================================
  const sp = spouseListOf(person).filter(x => {
    const r = x.rel;
    if (r.dissolved) return false;
    if (r.matchStage === "已離異" || r.matchStage === "已喪偶") return false;
    if (r.endYear != null) return false;
    return true;
  });
  if (sp.length) {
    lines.push(`配偶／訂親：${sp.map(x => `${x.other.name}（${displaySpouseType(x.rel.type)}${x.rel.marryYear ? `，${x.rel.marryYear}年成婚` : (x.rel.matchStage === "已婚" ? "，已成婚" : "，未成婚")}${x.rel.courtyard ? `，${x.rel.courtyard}` : ""}）`).join("、")}`);
  } else {
    lines.push("配偶／訂親：無");
  }
  if (person.childIds && person.childIds.length) {
    const kids = person.childIds.map(id => findPerson(id)?.name).filter(Boolean).join("、");
    lines.push(`子女:${kids}`);
  }
  return lines.join("\n");
}

// =============== 渲染 ===============
function renderPersonSelector(selectId, currentId, pool) {
  const sel = _$(selectId);
  if (!sel) return;
  sel.innerHTML = "";
  if (!pool.length) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "(無可選人物)";
    sel.appendChild(opt);
    return;
  }
  pool.forEach(p => {
    const opt = document.createElement("option");
    opt.value = String(p.id);
    const age = getMatchAge(p);
    const fam = p.familyId ? getFamilyNameById(p.familyId) : "未歸宗族";
    opt.textContent = `${p.name}(${p.gender || "?"}・${age != null ? age + "歲" : "?歲"}・${fam})`;
    if (p.id === currentId) opt.selected = true;
    sel.appendChild(opt);
  });
}

// 依家族篩選 + 強推模式組合人物池
function poolByFamilyFilter(famFilter) {
  const base = pickablePool();
  if (!famFilter || famFilter === "all") return base;
  if (famFilter === "noFamily") return base.filter(p => !p.familyId);
  const fid = Number(famFilter);
  return base.filter(p => p.familyId === fid);
}

function renderFamilyFilters() {
  const fams = state.families || [];
  const options = [
    `<option value="all">全部家族</option>`,
    ...fams.map(f => `<option value="${f.id}">${f.name}</option>`),
    `<option value="noFamily">未歸宗族</option>`
  ].join("");
  const aSel = _$("aFamilyFilter");
  const bSel = _$("bFamilyFilter");
  if (aSel) {
    aSel.innerHTML = options;
    aSel.value = String(matchState.aFamilyId);
  }
  if (bSel) {
    bSel.innerHTML = options;
    bSel.value = String(matchState.bFamilyId);
  }
}

function renderSelectors() {
  const poolA = poolByFamilyFilter(matchState.aFamilyId);
  const poolB = poolByFamilyFilter(matchState.bFamilyId);

  // 若已選的人物仍存在(即使不在池子裡,如已訂親/已婚),保留選擇;
  // 只在「完全沒選」或「人物已不存在(如已逝)」時才自動挑
  const personA = matchState.aId ? findPerson(matchState.aId) : null;
  if (!personA || personA.deceased) {
    matchState.aId = poolA[0]?.id || null;
  }
  const personB = matchState.bId ? findPerson(matchState.bId) : null;
  if (!personB || personB.deceased) {
    const aPerson = findPerson(matchState.aId);
    const second = poolB.find(p => p.id !== matchState.aId && p.gender && aPerson?.gender && p.gender !== aPerson.gender)
                || poolB.find(p => p.id !== matchState.aId)
                || poolB[0];
    matchState.bId = second?.id || null;
  }

  // 顯示選單:若當事人不在池子裡,額外補入供顯示
  const displayPoolA = poolA.find(p => p.id === matchState.aId)
    ? poolA
    : [...(personA && !personA.deceased ? [personA] : []), ...poolA];
  const displayPoolB = poolB.find(p => p.id === matchState.bId)
    ? poolB
    : [...(personB && !personB.deceased ? [personB] : []), ...poolB];

  renderPersonSelector("aPerson", matchState.aId, displayPoolA);
  renderPersonSelector("bPerson", matchState.bId, displayPoolB);
}

function renderPersonInfo() {
  const a = getMA();
  const b = getMB();
  _$("aInfo").textContent = a ? statusText(a) : "尚未選人";
  _$("bInfo").textContent = b ? statusText(b) : "尚未選人";
}

function renderCase() {
  const a = getMA();
  const b = getMB();
  _$("caseTitle").textContent = a && b ? `${a.name} × ${b.name}` : "未開案";
  _$("caseSummary").textContent = buildSummary(a, b);
  renderPairScoreBox(a, b);
}

// v6+:合適度條
function renderPairScoreBox(a, b) {
  const box = _$("pairScoreBox");
  if (!box) return;
  if (!a || !b) {
    box.innerHTML = "";
    return;
  }
  const pd = getPairData(a.id, b.id);
  if (!pd) {
    box.innerHTML = `<div class="pair-score-empty">尚未開始議親推進，合適度暫未紀錄。</div>`;
    return;
  }
  const score = pd.score;
  let barColor = "#a3491e";
  if (score >= 70) barColor = "#5b7a3a";
  else if (score >= 40) barColor = "#a08544";

  // 過往破局紀錄
  const breakWarn = (pd.lastBreak && pd.history.length === 0) ? `
    <div class="pair-score-break-warn">
      此對人前次因「${pd.lastBreak}」破局，重議基底已下降 ${pd.penalty} 分。
    </div>
  ` : "";

  const historyHtml = pd.history.length ? `
    <details class="pair-score-details">
      <summary>本案進展紀錄（共 ${pd.history.length} 段）</summary>
      ${pd.history.map(h => `
        <div class="pair-score-hist-row">
          <div><strong>【${h.stage}】${h.eventTitle}</strong> <span class="nar-delta ${h.delta >= 0 ? "pos" : "neg"}">${h.delta >= 0 ? "+" : ""}${h.delta}</span></div>
          <div class="pair-score-hist-choice">→ ${h.choiceLabel}</div>
          <div class="pair-score-hist-conseq">${h.consequence}</div>
        </div>
      `).join("")}
    </details>
  ` : "";

  box.innerHTML = `
    <div class="pair-score-block">
      <div class="pair-score-label">合適度</div>
      <div class="pair-score-row">
        <div class="pair-score-bar"><div class="pair-score-fill" style="width:${score}%;background:${barColor};"></div></div>
        <div class="pair-score-num" style="color:${barColor};">${score}</div>
      </div>
      <div class="pair-score-trail">初始 ${pd.baseScore}　已歷 ${pd.stagesDone.length} 段</div>
      ${breakWarn}
      ${historyHtml}
    </div>
  `;
}

function renderActions() {
  const a = getMA(), b = getMB();
  if (!a || !b) {
    _$("actions").innerHTML = `<p class="empty">請先選定兩位人物。</p>`;
    return;
  }
  const actions = getActions(a, b);
  _$("actions").innerHTML = actions.map(act => `
    <button class="action-btn ${matchState.pendingAction === act.key ? "pending" : ""}" data-action="${act.key}">
      ${act.label}${matchState.pendingAction === act.key ? '<span class="pending-note">← 填寫下方欄位後確認</span>' : ""}
    </button>
  `).join("");
  document.querySelectorAll("[data-action]").forEach(btn => {
    btn.addEventListener("click", () => handleActionClick(btn.dataset.action));
  });
  renderInputPanel();
}

function renderInputPanel() {
  const panel = _$("inputPanel");
  const fields = matchState.pendingAction ? getRequiredFields(matchState.pendingAction) : [];
  if (!matchState.pendingAction || fields.length === 0) {
    panel.classList.add("hidden");
    _$("dynamicInputs").innerHTML = "";
    return;
  }
  panel.classList.remove("hidden");
  const a = getMA(), b = getMB();
  const chunks = [];

  // 名分用選單(可選 SPOUSE_TYPES 或自訂)
  const titleOptions = ["夫", "正妻", "平妻", "繼室", "側室", "妾", "入贅"];
  if (fields.includes("aTitle")) {
    chunks.push(`<div><label>${a.name} 的名分</label>
      <select id="aTitle">
        ${titleOptions.map(t => `<option>${t}</option>`).join("")}
      </select>
    </div>`);
  }
  if (fields.includes("bTitle")) {
    chunks.push(`<div><label>${b.name} 的名分</label>
      <select id="bTitle">
        ${titleOptions.map(t => `<option ${t === "婚配" ? "selected" : ""}>${t}</option>`).join("")}
      </select>
    </div>`);
  }
  if (fields.includes("sharedTitle")) {
    chunks.push(`<div><label>納入名分</label><select id="sharedTitle">${SPOUSE_TYPES.filter(t => t !== "訂婚").map(t => `<option>${t}</option>`).join("")}</select></div>`);
  }
  if (fields.includes("spouseType")) {
    chunks.push(`<div><label>訂婚預定名分</label><select id="spouseType">${["訂婚","婚配","平妻","妾","繼室","入贅"].map(t => `<option>${t}</option>`).join("")}</select></div>`);
  }
  if (fields.includes("courtyard")) {
    chunks.push(`<div><label>院落安排</label><input id="courtyard" placeholder="如:正院／聽雪院／偏院" /></div>`);
  }
  if (fields.includes("marryYear")) {
    chunks.push(`<div><label>結婚年份(星曆)</label><input id="marryYear" type="number" value="${state.gameYear}" /></div>`);
  }
  if (fields.includes("editMarryYear")) {
    // 找出當前 spouseRelations 的年份
    const rel = relationBetween(a.id, b.id);
    const currentYear = rel?.marryYear || state.gameYear;
    const currentType = displaySpouseType(rel?.type);
    chunks.push(`<div><label>修改結婚年份(星曆)</label><input id="editMarryYear" type="number" value="${currentYear}" /></div>`);
  }
  if (fields.includes("editSpouseType")) {
    const rel = relationBetween(a.id, b.id);
    const currentType = displaySpouseType(rel?.type);
    chunks.push(`<div><label>修改名分／關係類型</label>
      <select id="editSpouseType">
        ${SPOUSE_TYPES.map(t => `<option ${t === currentType ? "selected" : ""}>${t}</option>`).join("")}
      </select>
    </div>`);
  }
  if (fields.includes("child")) {
    // 身分選項取自 state.roleOptions(就是 DEFAULT_ROLES)
    const roleOpts = (state.roleOptions || ["嫡支子女", "庶出子女", "旁系宗親"]);
    chunks.push(`
      <div style="grid-column:1/-1;">
        <label>子嗣資訊</label>
        <div class="input-grid three" style="margin-bottom:8px;">
          <input id="childName" placeholder="姓名" />
          <select id="childGender"><option>男</option><option>女</option></select>
          <input id="childBirthYear" type="number" placeholder="出生年(星曆)" value="${state.gameYear}" />
        </div>
        <div class="input-grid">
          <select id="childRole">
            ${roleOpts.map(r => `<option ${r === "嫡支子女" ? "selected" : ""}>${r}</option>`).join("")}
          </select>
          <select id="childStatus">
            <option>嫡出</option>
            <option>庶出</option>
          </select>
        </div>
      </div>
    `);
  }
  _$("dynamicInputs").innerHTML = `<div class="input-grid">${chunks.join("")}</div>`;
}

function getInputValues() {
  return {
    aTitle: _$("aTitle")?.value || "",
    bTitle: _$("bTitle")?.value || "",
    sharedTitle: _$("sharedTitle")?.value || "",
    spouseType: _$("spouseType")?.value || "",
    courtyard: _$("courtyard")?.value || "",
    marryYear: _$("marryYear")?.value || "",
    editMarryYear: _$("editMarryYear")?.value || "",
    editSpouseType: _$("editSpouseType")?.value || "",
    childName: _$("childName")?.value || "",
    childGender: _$("childGender")?.value || "男",
    childStatus: _$("childStatus")?.value || "嫡出",
    childRole: _$("childRole")?.value || "",
    childBirthYear: _$("childBirthYear")?.value || "",
  };
}

function getChapters() {
  if (!state.matchChapters) state.matchChapters = [];
  return state.matchChapters;
}

function addChapter(ch) {
  getChapters().unshift(ch);
  // 避免過多
  if (getChapters().length > 500) {
    state.matchChapters = getChapters().slice(0, 500);
  }
  saveState();
}

function renderChapters() {
  const chs = getChapters();
  _$("historyCount").textContent = `共 ${chs.length} 筆`;
  const latest = chs.slice(0, 6);
  if (!latest.length) {
    _$("chapters").innerHTML = `<p class="empty">尚未處理。選一個合理操作,或擲一下。</p>`;
    return;
  }
  _$("chapters").innerHTML = latest.map(ch => `
    <div class="chapter ${ch.kind === "event" ? "event" : ""}${ch.hasNarrative ? " narrative" : ""}">
      <div class="chapter-title">${ch.title}</div>
      <div class="small-muted">處理:${ch.actionLabel} ・ 星曆 ${ch.year} 年${ch.pair ? ` ・ ${ch.pair}` : ""}</div>
      <div><strong>當下:</strong><pre class="chapter-pre">${ch.immediate}</pre></div>
      <div><strong>後續:</strong><pre class="chapter-pre">${ch.next}</pre></div>
      <div><strong>提示:</strong>${ch.hint}</div>
      ${ch.reactions && ch.reactions.length ? `
        <div class="reaction-box">
          <div class="reaction-title">相關人物反應</div>
          ${ch.reactions.map(r => `<div><strong>${r.who}</strong><span class="small-muted">(${r.role})</span>:${r.reaction}</div>`).join("")}
        </div>
      ` : ""}
    </div>
  `).join("");
}

// ============================================================
// 渲染過往痕跡(flag)區塊 — 議親室主畫面右下
// ============================================================
// 設計重點:
//   1. 只在目前選中的 A、B 兩人有 flag 時才顯示
//   2. 沒有 flag 時清空容器內容並移除 has-flags class(CSS 控制不顯示)
//   3. 統一顯示,不區分永久/時效;失效的 flag 由 getActiveFlags 過濾掉
// ============================================================
function renderPairFlags() {
  const box = _$("pairFlags");
  if (!box) return;     // 防呆:容器不存在時直接 return

  const aId = matchState.aId;
  const bId = matchState.bId;

  // 未選定雙方:清空
  if (!aId || !bId) {
    box.innerHTML = "";
    box.classList.remove("has-flags");
    return;
  }

  // 取得 pairData(若還沒建立,getPairData 會回 null)
  const pd = getPairData(aId, bId);
  if (!pd) {
    box.innerHTML = "";
    box.classList.remove("has-flags");
    return;
  }

  // 取得有效 flag(過濾掉時效已過的)
  const activeFlags = getActiveFlags(pd);
  if (activeFlags.length === 0) {
    box.innerHTML = "";
    box.classList.remove("has-flags");
    return;
  }

  // 有 flag 才填內容
  const chips = activeFlags
    .map(f => `<span class="pair-flag-chip">${f.name}</span>`)
    .join("");

  box.innerHTML = `
    <div class="pair-flags-title">過往痕跡（${activeFlags.length}）</div>
    <div class="pair-flags-list">${chips}</div>
  `;
  box.classList.add("has-flags");
}

function renderAll() {
  renderFamilyFilters();
  renderSelectors();
  renderPersonInfo();
  renderCase();
  renderActions();
  renderChapters();
  renderPairFlags();          // ← 新增:渲染過往痕跡
}

// =============== 動作觸發 ===============
function handleActionClick(actionKey) {
  const fields = getRequiredFields(actionKey);
  if (!fields.length) {
    executeActionWithNarrative(actionKey);
  } else {
    matchState.pendingAction = actionKey;
    renderActions();
  }
}

// 暴露為全域,讓 onclick 抓得到
function matchConfirm() {
  if (matchState.pendingAction) executeActionWithNarrative(matchState.pendingAction);
}
function matchCancel() {
  matchState.pendingAction = null;
  renderAll();
}
if (typeof window !== "undefined") {
  window.matchConfirm = matchConfirm;
  window.matchCancel = matchCancel;
}

function executeAction(action) {
  const a = getMA(), b = getMB();
  if (!a || !b) return;
  try {
    const actions = getActions(a, b);
    const inputs = getInputValues();
    const out = makeOutcome(action, a, b, inputs);
    applySideEffects(out, a, b, inputs, action);

    const reactions = getThirdPartyReactions(action, a, b);

    // v6+:若此動作前剛跑過劇情,把劇情段落寫進 chapter
    const pre = matchState._narrativePrefix;
    let immediate = out.immediate;
    let extraNext = "";
    if (pre) {
      immediate = `【${pre.stage}・${pre.eventTitle}】\n你的選擇：${pre.choiceLabel}（${pre.delta >= 0 ? "+" : ""}${pre.delta}）\n${pre.consequence}\n\n${out.immediate}`;
      extraNext = `\n（合適度現為 ${pre.score}）`;
    }

    // v6+:負向動作的合適度清算
    const negApplied = applyNegativeAction(action, a.id, b.id);
    if (negApplied) {
      if (negApplied.type === "reset") {
        extraNext += `\n（因「${negApplied.label}」，此對人合適度與進展紀錄已清除；日後重議基底將下降 ${negApplied.penalty} 分。）`;
      } else {
        const pd = getPairData(a.id, b.id);
        const curScore = pd ? pd.score : 0;
        extraNext += `\n（因「${negApplied.label}」扣 ${negApplied.penalty} 分，合適度現為 ${curScore}。）`;
      }
    }

    // v6+:破局提出方資訊(若有)
    if (matchState.dissolveDecision) {
      const info = matchState.dissolveDecision;
      const byLabel = info.by === "雙方" ? "雙方協議" : `由${info.by === "A方" ? a.name : b.name}（${info.by}）提出`;
      extraNext += `\n（${byLabel}${info.reason ? "，緣由：" + info.reason : ""}）`;
    }

    addChapter({
      title: out.title,
      actionLabel: actions.find(x => x.key === action)?.label || action,
      immediate,
      next: out.next + extraNext,
      hint: out.hint,
      reactions,
      kind: "action",
      hasNarrative: !!pre,  // v6+:這筆 chapter 是否包含劇情段落
      year: state.gameYear,
      aId: a.id,
      bId: b.id,
      pair: `${a.name} × ${b.name}`,
    });
    matchState.pendingAction = null;
    matchState.dissolveDecision = null;  // v6+:用完即清
    saveState();  // v6+:確保 pairScores 與 chapters 一併存檔
    renderAll();
  } catch (err) {
    console.error("執行動作時出錯：", err);
    alert("執行動作時發生錯誤,請打開瀏覽器主控台(F12)查看細節:\n\n" + err.message);
  }
}

function rollRandomEvent() {
  const a = getMA(), b = getMB();
  if (!a || !b) return;
  const ev = pickRandomEvent(a, b);
  addChapter({
    title: ev.title,
    actionLabel: "擲了一下",
    immediate: ev.body,
    next: "事件本身不會改變人物狀態,請決定要不要繼續推進、改議、或駁回。",
    hint: "隨機事件僅作為劇情催化。",
    reactions: [],
    kind: "event",
    year: state.gameYear,
    aId: a.id,
    bId: b.id,
    pair: `${a.name} × ${b.name}`,
  });
  renderAll();
}

function randomizePair() {
  const pool = pickablePool();
  if (pool.length < 2) return;
  const first = pickRandom(pool);
  let second = pickRandom(pool);
  let guard = 0;
  while ((second.id === first.id || (first.gender && second.gender && first.gender === second.gender)) && guard < 80) {
    second = pickRandom(pool);
    guard++;
  }
  matchState.aId = first.id;
  matchState.bId = second.id;
  matchState.pendingAction = null;
  renderAll();
}

// =============== 翻檔案 / 看看誰適合 ===============
function openArchive() {
  _$("archiveModal").classList.add("active");
  renderArchive();
}

function renderArchive() {
  const body = _$("archiveBody");
  const filter = _$("archiveFilter");
  const search = (matchState.archiveSearch || "").toLowerCase();

  if (matchState.archiveTab === "people") {
    // 篩選家族
    const fams = ["全部", ...state.families.map(f => f.name), "未歸宗族"];
    filter.innerHTML = fams.map(g => `<option value="${g}" ${g === matchState.archiveFilter ? "selected" : ""}>${g}</option>`).join("");
    const filtered = state.persons.filter(p => {
      // 家族過濾
      if (matchState.archiveFilter !== "全部") {
        const fname = p.familyId ? getFamilyNameById(p.familyId) : "未歸宗族";
        if (fname !== matchState.archiveFilter) return false;
      }
      if (!search) return true;
      const fname = p.familyId ? getFamilyNameById(p.familyId) : "未歸宗族";
      return `${p.name} ${p.role || ""} ${fname} ${p.notes || ""}`.toLowerCase().includes(search);
    });
    body.innerHTML = filtered.length ? filtered.map(p => `
      <div class="archive-item">
        <div class="archive-top">
          <div>
            <div class="archive-name">${p.name}${p.deceased ? "【已逝】" : ""}</div>
            <div class="archive-sub">${getMatchAge(p) != null ? getMatchAge(p) + "歲" : "?歲"} · ${p.role || "未指定"} · ${p.familyId ? getFamilyNameById(p.familyId) : "未歸宗族"}</div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn" data-jump-a="${p.id}" style="font-size:12px;padding:7px 10px;">設為 A</button>
            <button class="btn" data-jump-b="${p.id}" style="font-size:12px;padding:7px 10px;">設為 B</button>
          </div>
        </div>
        <pre class="archive-pre">${statusText(p)}</pre>
      </div>
    `).join("") : `<p class="empty">沒有符合的人物</p>`;
    document.querySelectorAll("[data-jump-a]").forEach(btn => {
      btn.addEventListener("click", () => {
        matchState.aId = Number(btn.dataset.jumpA);
        _$("archiveModal").classList.remove("active");
        renderAll();
      });
    });
    document.querySelectorAll("[data-jump-b]").forEach(btn => {
      btn.addEventListener("click", () => {
        matchState.bId = Number(btn.dataset.jumpB);
        _$("archiveModal").classList.remove("active");
        renderAll();
      });
    });
  } else {
    // 事件頁:列出議親室持久化的案卷
    filter.innerHTML = ["全部", "動作", "事件", "含劇情"].map(v => `<option value="${v}" ${v === matchState.archiveFilter ? "selected" : ""}>${v}</option>`).join("");
    const chs = getChapters();
    const filtered = chs.filter(ch => {
      if (matchState.archiveFilter === "動作" && ch.kind === "event") return false;
      if (matchState.archiveFilter === "事件" && ch.kind !== "event") return false;
      if (matchState.archiveFilter === "含劇情" && !ch.hasNarrative) return false;
      if (!search) return true;
      return `${ch.title} ${ch.immediate} ${ch.actionLabel} ${ch.pair || ""}`.toLowerCase().includes(search);
    });
    body.innerHTML = filtered.length ? filtered.map(ch => `
      <div class="archive-item ${ch.kind === "event" ? "event-archive" : ""}${ch.hasNarrative ? " narrative-archive" : ""}">
        <div class="archive-top">
          <div>
            <div class="chapter-title">${ch.title}</div>
            <div class="small-muted">處理:${ch.actionLabel} · 星曆 ${ch.year} 年${ch.pair ? ` · ${ch.pair}` : ""}</div>
          </div>
          ${(ch.aId != null && ch.bId != null) ? `<button class="btn" data-reopen-a="${ch.aId}" data-reopen-b="${ch.bId}" style="font-size:12px;padding:7px 10px;white-space:nowrap;">重開此案</button>` : ""}
        </div>
        <div style="margin-top:4px;"><pre class="chapter-pre">${ch.immediate}</pre></div>
        ${ch.next ? `<div class="small-muted" style="margin-top:4px;">後續:<pre class="chapter-pre">${ch.next}</pre></div>` : ""}
      </div>
    `).join("") : `<p class="empty">沒有符合的紀錄</p>`;
    document.querySelectorAll("[data-reopen-a]").forEach(btn => {
      btn.addEventListener("click", () => {
        matchState.aId = Number(btn.dataset.reopenA);
        matchState.bId = Number(btn.dataset.reopenB);
        matchState.pendingAction = null;
        _$("archiveModal").classList.remove("active");
        renderAll();
      });
    });
  }
}

function openSuggestions(targetWhich) {
  matchState.suggestionsTarget = targetWhich || "a";
  // v6+:先開條件單,設定完才看推薦
  openIntentDialog();
}

// 跳過條件單,直接顯示推薦(供條件單「採用本次條件」按鈕呼叫)
function showSuggestionsModal() {
  _$("suggestionsModal").classList.add("active");
  renderSuggestions();
}

// =============== 議親條件單(本次議親意向) ===============
function openIntentDialog() {
  const target = matchState.suggestionsTarget === "b" ? getMB() : getMA();
  if (!target) {
    alert("請先選定要為其議親的對象。");
    return;
  }
  // 若已有 intent 沿用,否則用預設
  if (!matchState.intent) matchState.intent = defaultMatchIntent();
  _$("intentModal").classList.add("active");
  renderIntentDialog();
}

function closeIntentDialog() {
  _$("intentModal").classList.remove("active");
}

function renderIntentDialog() {
  const target = matchState.suggestionsTarget === "b" ? getMB() : getMA();
  const intent = matchState.intent;
  _$("intentTitle").textContent = `為「${target.name}」議親 — 本次條件`;

  // 婚事性質
  const kindHtml = INTENT_KIND_OPTIONS.map(o => `
    <label class="intent-kind${intent.kind === o.key ? " selected" : ""}">
      <input type="radio" name="intentKind" value="${o.key}"${intent.kind === o.key ? " checked" : ""} />
      <div>
        <div class="intent-kind-title">${o.label}</div>
        <div class="intent-kind-hint">${o.hint}</div>
      </div>
    </label>
  `).join("");

  // 看重(最多 3 項)
  const valueHtml = INTENT_VALUE_OPTIONS.map(o => {
    const checked = intent.values.includes(o.key);
    return `
      <label class="intent-check">
        <input type="checkbox" data-value-key="${o.key}"${checked ? " checked" : ""} />
        <span>${o.label}</span>
      </label>
    `;
  }).join("");

  // 出身選擇(看重對方出身)
  const originSelHtml = state.originOptions.map(o =>
    `<label class="intent-tag${intent.valueOrigins.includes(o) ? " selected" : ""}" data-origin="${o}">${o}</label>`
  ).join("");

  // 職業選擇(看重對方職業)
  const occSelHtml = state.occOptions.map(o =>
    `<label class="intent-tag${intent.valueOccupations.includes(o) ? " selected" : ""}" data-occ="${o}">${o}</label>`
  ).join("");

  // 育齡上限下拉
  const fertileAgeOptions = [22, 25, 28, 30, 35];
  const fertileAgeHtml = `
    <select id="intentFertileAgeSel">
      ${fertileAgeOptions.map(a =>
        `<option value="${a}"${intent.fertileAgeLimit === a ? " selected" : ""}>${a} 歲以下</option>`
      ).join("")}
    </select>
  `;

  // 忌諱(最多 2 項)
  const tabooHtml = INTENT_TABOO_OPTIONS.map(o => {
    const checked = intent.taboos.includes(o.key);
    return `
      <label class="intent-check">
        <input type="checkbox" data-taboo-key="${o.key}"${checked ? " checked" : ""} />
        <span>${o.label}</span>
      </label>
    `;
  }).join("");

  // 忌諱出身的單選下拉
  const tabooOriginHtml = `
    <select id="intentTabooOriginSel">
      <option value="">— 請選擇忌諱的出身 —</option>
      ${state.originOptions.map(o =>
        `<option value="${o}"${intent.tabooOrigin === o ? " selected" : ""}>${o}</option>`
      ).join("")}
    </select>
  `;

  _$("intentBody").innerHTML = `
    <div class="intent-section">
      <div class="intent-section-title">一、婚事性質</div>
      <div class="intent-kind-list">${kindHtml}</div>
    </div>

    <div class="intent-section">
      <div class="intent-section-title">二、本次看重（最多 3 項）<span class="intent-count" id="intentValueCount">${intent.values.length} / 3</span></div>
      <div class="intent-check-list">${valueHtml}</div>

      <div class="intent-subblock${intent.values.includes("matchOrigin") ? "" : " disabled"}" id="intentOriginBlock">
        <div class="intent-sub-title">指定看重的出身（可複選）</div>
        <div class="intent-tag-list">${originSelHtml}</div>
      </div>

      <div class="intent-subblock${intent.values.includes("matchOccupation") ? "" : " disabled"}" id="intentOccBlock">
        <div class="intent-sub-title">指定看重的職業（可複選）</div>
        <div class="intent-tag-list">${occSelHtml}</div>
      </div>

      <div class="intent-subblock${intent.values.includes("fertileAge") ? "" : " disabled"}" id="intentFertileAgeBlock">
        <div class="intent-sub-title">育齡上限</div>
        ${fertileAgeHtml}
      </div>
    </div>

    <div class="intent-section">
      <div class="intent-section-title">三、本次忌諱（最多 2 項）<span class="intent-count" id="intentTabooCount">${intent.taboos.length} / 2</span></div>
      <div class="intent-check-list">${tabooHtml}</div>

      <div class="intent-subblock${intent.taboos.includes("tabooOrigin") ? "" : " disabled"}" id="intentTabooOriginBlock">
        <div class="intent-sub-title">指定忌諱的出身</div>
        ${tabooOriginHtml}
      </div>
    </div>

    <div class="intent-section">
      <div class="intent-section-title">四、備註（選填）</div>
      <textarea id="intentNote" rows="2" placeholder="例：老夫人指明要找江南書香之家。">${intent.note || ""}</textarea>
    </div>

    <div class="intent-actions">
      <button class="btn" id="intentResetBtn">重置條件</button>
      <button class="btn btn-primary" id="intentApplyBtn">採用本次條件 → 看推薦</button>
    </div>
  `;

  bindIntentDialogEvents();
}

function bindIntentDialogEvents() {
  const intent = matchState.intent;

  // 婚事性質
  document.querySelectorAll('input[name="intentKind"]').forEach(r => {
    r.addEventListener("change", e => {
      intent.kind = e.target.value;
      renderIntentDialog();
    });
  });

  // 看重勾選
  document.querySelectorAll('input[data-value-key]').forEach(c => {
    c.addEventListener("change", e => {
      const key = e.target.dataset.valueKey;
      if (e.target.checked) {
        if (intent.values.length >= 3) {
          e.target.checked = false;
          alert("本次看重的條件至多 3 項。");
          return;
        }
        if (!intent.values.includes(key)) intent.values.push(key);
      } else {
        intent.values = intent.values.filter(k => k !== key);
      }
      renderIntentDialog();
    });
  });

  // 出身標籤
  document.querySelectorAll('.intent-tag[data-origin]').forEach(t => {
    t.addEventListener("click", () => {
      if (!intent.values.includes("matchOrigin")) return;
      const o = t.dataset.origin;
      if (intent.valueOrigins.includes(o)) {
        intent.valueOrigins = intent.valueOrigins.filter(x => x !== o);
      } else {
        intent.valueOrigins.push(o);
      }
      renderIntentDialog();
    });
  });

  // 職業標籤
  document.querySelectorAll('.intent-tag[data-occ]').forEach(t => {
    t.addEventListener("click", () => {
      if (!intent.values.includes("matchOccupation")) return;
      const o = t.dataset.occ;
      if (intent.valueOccupations.includes(o)) {
        intent.valueOccupations = intent.valueOccupations.filter(x => x !== o);
      } else {
        intent.valueOccupations.push(o);
      }
      renderIntentDialog();
    });
  });

  // 忌諱勾選
  document.querySelectorAll('input[data-taboo-key]').forEach(c => {
    c.addEventListener("change", e => {
      const key = e.target.dataset.tabooKey;
      if (e.target.checked) {
        // 互斥檢查:若勾的這項與已勾的某項互斥,先把互斥那項拿掉
        const pair = INTENT_EXCLUSIVE_PAIRS.find(p => p.includes(key));
        if (pair) {
          const other = pair.find(k => k !== key);
          if (intent.taboos.includes(other)) {
            intent.taboos = intent.taboos.filter(k => k !== other);
          }
        }
        if (intent.taboos.length >= 2) {
          e.target.checked = false;
          alert("本次忌諱的條件至多 2 項。");
          return;
        }
        if (!intent.taboos.includes(key)) intent.taboos.push(key);
      } else {
        intent.taboos = intent.taboos.filter(k => k !== key);
      }
      renderIntentDialog();
    });
  });

  // 忌諱出身下拉
  const tabSel = _$("intentTabooOriginSel");
  if (tabSel) {
    tabSel.addEventListener("change", e => {
      intent.tabooOrigin = e.target.value;
    });
  }

  // v6+:育齡上限下拉
  const fertSel = _$("intentFertileAgeSel");
  if (fertSel) {
    fertSel.addEventListener("change", e => {
      intent.fertileAgeLimit = Number(e.target.value) || 25;
    });
  }

  // 備註
  const noteEl = _$("intentNote");
  if (noteEl) {
    noteEl.addEventListener("input", e => { intent.note = e.target.value; });
  }

  // 重置
  _$("intentResetBtn").addEventListener("click", () => {
    matchState.intent = defaultMatchIntent();
    renderIntentDialog();
  });

  // 採用條件 → 看推薦
  _$("intentApplyBtn").addEventListener("click", () => {
    closeIntentDialog();
    showSuggestionsModal();
  });
}

function renderSuggestions() {
  const target = matchState.suggestionsTarget === "b" ? getMB() : getMA();
  if (!target) {
    _$("suggestionsTitle").textContent = "尚未選人";
    _$("suggestionsBody").innerHTML = `<p class="empty">請先選定人物。</p>`;
    return;
  }
  _$("suggestionsTitle").textContent = `給 ${target.name} 的議親建議`;

  // v6+:本次條件摘要
  const intent = matchState.intent || defaultMatchIntent();
  const valueLabels = intent.values.map(k => {
    const opt = INTENT_VALUE_OPTIONS.find(o => o.key === k);
    if (!opt) return k;
    if (k === "matchOrigin" && intent.valueOrigins.length)
      return `出身：${intent.valueOrigins.join("、")}`;
    if (k === "matchOccupation" && intent.valueOccupations.length)
      return `職業：${intent.valueOccupations.join("、")}`;
    if (k === "fertileAge")
      return `育齡：${intent.fertileAgeLimit}歲以下`;
    return opt.label.replace(/（.*$/, "");
  });
  const tabooLabels = intent.taboos.map(k => {
    const opt = INTENT_TABOO_OPTIONS.find(o => o.key === k);
    if (!opt) return k;
    if (k === "tabooOrigin" && intent.tabooOrigin)
      return `忌諱出身：${intent.tabooOrigin}`;
    return opt.label.replace(/（.*$/, "");
  });

  const summaryHtml = `
    <div class="intent-summary">
      <div class="intent-summary-row">
        <span class="intent-summary-label">婚事性質</span>
        <span class="intent-summary-value">${intent.kind}</span>
      </div>
      <div class="intent-summary-row">
        <span class="intent-summary-label">本次看重</span>
        <span class="intent-summary-value">${valueLabels.length ? valueLabels.join("｜") : "—"}</span>
      </div>
      <div class="intent-summary-row">
        <span class="intent-summary-label">本次忌諱</span>
        <span class="intent-summary-value">${tabooLabels.length ? tabooLabels.join("｜") : "—"}</span>
      </div>
      ${intent.note ? `<div class="intent-summary-row"><span class="intent-summary-label">備註</span><span class="intent-summary-value">${intent.note}</span></div>` : ""}
      <div class="intent-summary-actions">
        <button class="btn btn-small" id="reopenIntentBtn">修改本次條件</button>
        <span class="intent-summary-hint">★合本次意向 = 加分；✕犯本次忌諱 = 扣分</span>
      </div>
    </div>
  `;

  const suggestions = suggestMatchesFor(target);
  const listHtml = suggestions.length ? suggestions.map(({ person, reasons, concerns, score }) => `
    <div class="archive-item">
      <div class="archive-top">
        <div>
          <div class="archive-name">${person.name}</div>
          <div class="archive-sub">${getMatchAge(person)}歲 · ${person.gender || "?"} · ${person.familyId ? getFamilyNameById(person.familyId) : "未歸宗族"}</div>
          <div class="suggestion-score">合適度 ${score}</div>
        </div>
        <button class="btn" data-pick="${person.id}" style="font-size:12px;padding:7px 10px;">選為對方</button>
      </div>
      ${reasons.length ? `<div class="reason"><span class="small-muted">合適:</span>${reasons.join("、")}</div>` : ""}
      ${concerns.length ? `<div class="reason"><span class="concern-label">阻礙:</span>${concerns.join("、")}</div>` : ""}
    </div>
  `).join("") : `<p class="empty">沒有合適對象。試試切換「強推」拿任意人物。</p>`;

  _$("suggestionsBody").innerHTML = summaryHtml + listHtml;

  // 修改條件按鈕:關閉推薦清單,回到條件單
  const reopenBtn = _$("reopenIntentBtn");
  if (reopenBtn) {
    reopenBtn.addEventListener("click", () => {
      _$("suggestionsModal").classList.remove("active");
      openIntentDialog();
    });
  }

  document.querySelectorAll("[data-pick]").forEach(btn => {
    btn.addEventListener("click", () => {
      const pid = Number(btn.dataset.pick);
      if (matchState.suggestionsTarget === "b") matchState.aId = pid;
      else matchState.bId = pid;
      _$("suggestionsModal").classList.remove("active");
      renderAll();
    });
  });
}

// ============================================================
// v6+:劇情案卷系統(階段事件、合適度條、選擇分支)
// ============================================================

// 階段定義
const NARRATIVE_STAGES = [
  { key: "提親", label: "一・提親", kicker: "媒人初訪" },
  { key: "議親", label: "二・議親", kicker: "條件商議" },
  { key: "定親", label: "三・定親", kicker: "正式約定" },
  { key: "婚前", label: "四・婚前", kicker: "變數浮現" },
  { key: "成婚", label: "五・成婚", kicker: "禮成之日" }
];

// 結局判定門檻
const NARRATIVE_OUTCOMES = [
  { min: 70, key: "圓滿成親", label: "圓滿成親", desc: "兩家盡興，本人投契，自此結為秦晉之好。" },
  { min: 40, key: "勉強成親", label: "勉強成親", desc: "禮數雖成，內裡卻多有勉強。日後相處，端看造化。" },
  { min: -999, key: "破局", label: "親事破局", desc: "終究議不下去。兩家心照不宣地讓此事不了了之。" }
];

// 事件庫
// delta: 固定加減分
// dynamicDelta(ctx): 條件式加減,回傳 { delta, consequence } 覆寫
// kinds: 此事件適用的婚事性質(空陣列 = 全適用)
const NARRATIVE_EVENTS = [
  // ----- 一・提親 -----
  {
    id: "first-visit",
    stage: "提親",
    title: "初次拜會",
    body: (a, b) => {
      const aFam = a.familyId ? getFamilyNameById(a.familyId) : "本家";
      const bFam = b.familyId ? getFamilyNameById(b.familyId) : `${b.name}府上`;
      return `${aFam}遣媒人攜禮拜會${bFam}。茶過三巡，雙方家長尚未談到婚事正題，氣氛微有些尷尬。媒人遞了個眼色：話該怎麼接，全看本家當主的意思。`;
    },
    kinds: [],
    choices: [
      {
        label: "由家主親自出面，直言來意，請對方斟酌",
        delta: 4,
        consequence: "對方覺得本家誠懇，但少了三分婉轉，後話留得不夠。"
      },
      {
        label: "推由長輩出面，閒話家常中暗示婚意",
        delta: 2,
        consequence: "合於禮數，雙方都有迴旋餘地。"
      },
      {
        label: "邀對方家中子女出來見禮，由人物自身致意",
        dynamicDelta: (ctx) => {
          if (ctx.ageDiff != null && ctx.ageDiff <= 3) {
            return { delta: 6, consequence: "兩位當事人年齒相當，自然投契，本家此舉反成佳話。" };
          }
          return { delta: -2, consequence: "兩位當事人本不熟悉，當眾相見反而尷尬，徒增疏離。" };
        }
      }
    ]
  },

  // ── 提親・其二:媒人擇日覆命(工筆・次要) ──
  // 條件:無;讀 aFamilyEldersCount(本家是否有長輩可派口信)
  {
    id: "go-between-report",
    stage: "提親",
    title: "媒人擇日覆命",
    body: () => "媒人初訪後三日方才覆命，言語間頗有斟酌。她說對方家長「未說準，未說不準」，茶水卻換了好幾遍，又問了好幾句本家近況。本家當主聽完，問她：「依你看，這事該怎麼接？」",
    kinds: [],
    choices: [
      {
        label: "信媒人見識，由她相機行事再去走一趟",
        delta: 3,
        consequence: "媒人得了授權，下回去得從容，話也敢說滿幾分。對方家中對這位媒人的口碑漸生信任。"
      },
      {
        label: "著媒人帶上家中長輩的口信，名正言順再訪",
        dynamicDelta: (ctx) => {
          // 動態條件:本家若有長輩(年齡 >= 50 在世族人),口信才有分量
          if (ctx.aFamilyEldersCount > 0) {
            return { delta: 4, consequence: "長輩口信遞到，對方家中老人感念這份周到。" };
          }
          return { delta: 1, consequence: "媒人代為轉述長輩之意，但本家無人能親自背書，少了那份分量。" };
        }
      },
      {
        label: "暫不急著二訪，先打聽對方家中近況再說",
        delta: 1,
        consequence: "緩了半月，本家對對方家中情形心裡有了底，但媒人手腳也閒了下來，話頭涼了幾分。"
      }
    ]
  },

  // ── 提親・其三:對方家中傳出的話(戲劇・核心) ──
  // 條件:無;讀 standingDiff、roll
  // 戲劇變數來自「對方族中閒話」這個外部觸發點
  {
    id: "rumor-from-other-house",
    stage: "提親",
    title: "對方家中傳出的話",
    body: () => "媒人第三度上門，神色比往常凝重。她說對方家中昨夜傳出一句閒話 —— 有族中長輩飯桌上提了一句：「本家近年是不是太順了些？」話雖隨意，落在媒人耳裡卻像一根刺。事既送到，本家總得有個處置。",
    kinds: [],
    choices: [
      {
        label: "命管事多備一份禮，請媒人下回低調帶去",
        dynamicDelta: (ctx) => {
          // 對方門第低或相當:加厚合於規矩;對方門第高:加厚反成示弱
          if (ctx.standingDiff <= 0) {
            return { delta: 5, consequence: "禮數加厚，那句閒話像是被輕輕蓋過去了。" };
          }
          return { delta: -3, consequence: "加厚的禮反成示弱，對方家中暗自冷笑。" };
        }
      },
      {
        label: "視作族中老人的閒話，著媒人不必傳回",
        delta: 2,
        consequence: "本家不接這個話，事便不成事。媒人雖覺有些可惜，亦敬本家氣度。"
      },
      {
        label: "請媒人代為回話 ——「本家近年順與不順，自有族中先人保佑」",
        dynamicDelta: (ctx) => {
          // 50% 隨機:言辭剛硬,看對方家中如何接
          if (ctx.roll < 0.5) {
            return { delta: 7, consequence: "話傳到對方家中，那位長輩聽完反讚一句「有骨氣」，事情就此化開。" };
          }
          return { delta: -5, consequence: "話過於剛硬，對方家中老人覺本家不近人情，提親一事擱了下來。" };
        }
      }
    ]
  },

  // ── 提親・其四:本家後園的閒話(工筆・次要) ──
  // 條件:無;讀 aGender(A 為當家女性時,親自出面別有分量)
  {
    id: "backyard-rumor",
    stage: "提親",
    title: "本家後園的閒話",
    body: () => "提親事尚未明朗，本家後園卻已有閒話流出。或說對方家中規矩太重，或說本家是否太急，或說那位媒人手腳是否乾淨。當主在午後茶席上，命人傳話 —— 後園的話，當收到什麼時候為止。",
    kinds: [],
    choices: [
      {
        label: "著管事到後園走一趟，閒話即日打住",
        delta: 2,
        consequence: "後園聲音收得乾淨。當主這份手段，連幾位本就觀望的族人也心裡點了頭。"
      },
      {
        label: "由當主擇日召集女眷，當面把話說透",
        dynamicDelta: (ctx) => {
          // 動態條件:A 為當家女性時,親自出面分量足
          if (ctx.aGender === "女") {
            return { delta: 4, consequence: "當家者親自出面，分量是一回事，姿態又是一回事，後園諸人心裡皆服。" };
          }
          return { delta: 1, consequence: "男主談後園女眷的事，反顯失了分寸，幾位嬤嬤面上應和、心裡未必盡服。" };
        }
      },
      {
        label: "不去管它，後園的話幾日自己就涼了",
        delta: -1,
        consequence: "話確實涼了，但其中一兩句已傳到對方家中，媒人下次來時順道提了一句，當主才知此事不可全放。"
      }
    ]
  },

  // ----- 二・議親 -----
  {
    id: "betrothal-gift",
    stage: "議親",
    title: "聘禮商議",
    body: () => "議親漸入正題。聘禮數目須兩家私下議定。本家規格與對方家境之間，總要拿捏個分寸。",
    kinds: [],
    choices: [
      {
        label: "依本家門第規格從厚，彰顯重視",
        dynamicDelta: (ctx) => {
          // 若對方門第低於本家,從厚反成壓力
          if (ctx.standingDiff > 1) {
            return { delta: -3, consequence: "誠意可見，但門第差大時反成炫耀，對方暗自不安。" };
          }
          return { delta: 5, consequence: "本家規格俱備，對方家中老人讚一聲體面。" };
        }
      },
      {
        label: "依對方家境略作斟酌，以對等為要",
        delta: 3,
        consequence: "對方感念體貼，但本家族中或有人覺得失了體面。"
      },
      {
        label: "委由媒人居中傳話，雙方各退一步",
        delta: 1,
        consequence: "穩妥但平淡，雙方都不會特別記住這場議親。"
      }
    ]
  },

  // ── 議親・其二:信物的擇定(工筆・次要) ──
  // 條件:無;讀 aFamily.standing(本家門第)、intent.kind(婚事性質)
  {
    id: "token-selection",
    stage: "議親",
    title: "信物的擇定",
    body: () => "聘禮之外，尚有定情信物一節。本家當主翻看祖傳幾件可備之物 —— 一對玉璧、一只銀鎖、一冊舊年家中女眷親繡的緞帖。媒人說對方家中規矩，信物可以重，但不可以新 —— 越是舊物，越見誠意。",
    kinds: [],
    choices: [
      {
        label: "取那對玉璧 —— 物件貴重，分量自然足",
        delta: 3,
        consequence: "玉璧送到，對方家中傳閱再三。物是好物，只是貴氣多於溫度，老人說了一句「分量是夠了」。"
      },
      {
        label: "取那只銀鎖 —— 舊物有來歷，當主能說出典故",
        dynamicDelta: (ctx) => {
          // 動態條件:本家為高門第時,典故才有分量
          // DEFAULT_STANDINGS 從高至低:["上品世家","中品仕宦","尋常人家","寒微之家"]
          const standing = ctx.aFamily && ctx.aFamily.standing;
          if (standing === "上品世家" || standing === "中品仕宦") {
            return { delta: 5, consequence: "舊物有典，本家門第加持下，對方家中老人連讚兩聲。" };
          }
          return { delta: 2, consequence: "物是好物，只是典故說來無人接得上。" };
        }
      },
      {
        label: "取那冊緞帖 —— 女眷親繡，物雖輕，意卻深",
        dynamicDelta: (ctx) => {
          // 動態條件:緞帖之意給的是長久夫妻,正配/續弦合宜,側室/政治聯姻不合
          const kind = ctx.intent && ctx.intent.kind;
          if (kind === "正配" || kind === "續弦") {
            return { delta: 6, consequence: "緞帖一遞，對方家中女眷便明白本家是當這門親事為長久之計。" };
          }
          return { delta: -2, consequence: "緞帖之意是給正配的，遞錯了場合，對方家中暗覺輕慢。" };
        }
      }
    ]
  },

  // ── 議親・其三:合婚帖的交換(工筆・核心) ──
  // 條件:無;讀 aFamilyMembersCount(A 方家族規模)
  {
    id: "marriage-card",
    stage: "議親",
    title: "合婚帖的交換",
    body: () => "合婚帖是議親將定的標誌。雙方各書一份，寫明姓字、行第、生年月日、家中三代尊長名諱。媒人捧著對方那份帖子過來，又指著本家這份問:當主要不要親筆書寫？這一筆下去，便是兩家的書面承諾。",
    kinds: [],
    choices: [
      {
        label: "當主親筆書寫，落款時加蓋私印",
        delta: 4,
        consequence: "帖子送到對方家中，對方家長見親筆與私印，當即收入內室。這份慎重，是要傳給後人看的。"
      },
      {
        label: "請族中善書者代筆，當主只在末尾畫押",
        dynamicDelta: (ctx) => {
          // 動態條件:A 方家族規模 >= 8 時,代筆合於大族規矩;否則略嫌不夠用心
          if (ctx.aFamilyMembersCount >= 8) {
            return { delta: 3, consequence: "大族規矩，由族中善書者代筆是常例，反顯本家底蘊。" };
          }
          return { delta: -2, consequence: "本可親筆卻假他人手，對方家中略覺本家不夠用心。" };
        }
      },
      {
        label: "著管事按本家舊例寫成，當主驗過便交媒人帶去",
        delta: 1,
        consequence: "帖子合於規格，沒挑出毛病。只是少了一分人氣，對方家中收得也平淡。"
      }
    ]
  },

  // ── 議親・其四:對方家中傳出的拘謹(工筆・次要) ──
  // 條件:無;讀 standingDiff、roll
  {
    id: "other-house-quiet",
    stage: "議親",
    title: "對方家中傳出的拘謹",
    body: () => "媒人覆命時提了一句 —— 對方家中近日待客似乎拘謹了些，幾位常來走動的親戚都被悄悄囑咐少談本家婚事。媒人說不準是好是壞，但這份小心，總是值得本家也對應一二。是否要本家這邊也收緊些動靜？",
    kinds: [],
    choices: [
      {
        label: "著本家內外口風一律收緊，與對方步調一致",
        delta: 3,
        consequence: "兩家都靜了下來，反顯雙方都是真心要做這件事。媒人在兩邊跑得也順了。"
      },
      {
        label: "不去附和，本家照常待客、照常議事",
        dynamicDelta: (ctx) => {
          // 動態條件:對方門第低或相當,從容反顯氣度;對方門第高,則覺本家不謹慎
          if (ctx.standingDiff <= 0) {
            return { delta: 2, consequence: "本家從容，對方家中亦敬本家有度。" };
          }
          return { delta: -3, consequence: "對方覺本家不夠謹慎，私下嘆了一句。" };
        }
      },
      {
        label: "著管事悄悄打聽，對方為何收緊",
        dynamicDelta: (ctx) => {
          // 50% 隨機:是否查出對方家中有老人染恙
          if (ctx.roll < 0.5) {
            return { delta: 4, consequence: "打聽出對方家中有位老人染恙，怕沖了喜事。本家便也低調起來，反成默契。" };
          }
          return { delta: -2, consequence: "本家打聽的動作被對方知曉，覺本家好奇過了頭。" };
        }
      }
    ]
  },

  // ── 議親・其五:媒人偏私之嫌(戲劇・核心) ──
  // 條件:無;讀 currentScore、roll
  // 議親階段唯一戲劇事件,變數來自「中介本身」這個第三方
  {
    id: "go-between-suspicion",
    stage: "議親",
    title: "媒人偏私之嫌",
    body: () => "議親進到一半，本家當主忽然得了一個消息 —— 媒人近月在對方家中走動格外勤，遠勝於本家。族中有人說她收了對方家中的好處、暗中替對方說項;也有人說她不過是與對方家中熟識，無甚可疑。媒人下回再來時，當主是否要點破此事？",
    kinds: [],
    choices: [
      {
        label: "不點破，照常與她議事，留心她下回的話",
        delta: 3,
        consequence: "本家暗中留意，媒人並未察覺，依然兩邊跑。事後本家私下查證，傳言不過子虛烏有，反顯本家有度。"
      },
      {
        label: "當面婉言相詢，請媒人自己解釋",
        dynamicDelta: (ctx) => {
          // 動態條件:前情累積夠厚,媒人感本家信任;反之則覺被動疑
          if (ctx.currentScore >= 50) {
            return { delta: 5, consequence: "前情累積得厚，媒人感本家信任、當下據實以告，反成兩家、媒人三方的默契。" };
          }
          return { delta: -4, consequence: "底子未深就動疑，媒人當下答得勉強，自此話頭收了三分。" };
        }
      },
      {
        label: "換一位媒人，原媒人禮數送清、另起爐灶",
        dynamicDelta: (ctx) => {
          // 50% 隨機:換人是否被視為手段或多疑
          if (ctx.roll < 0.5) {
            return { delta: 6, consequence: "新媒人來歷乾淨，對方家中見本家有此手段，反更鄭重。" };
          }
          return { delta: -7, consequence: "原媒人在外散了風聲，對方家中聽說本家換人之事，覺本家多疑、議親一事冷了下來。" };
        }
      }
    ]
  },

  // ----- 三・定親 -----
  {
    id: "bazi-reading",
    stage: "定親",
    title: "八字相合與否",
    body: () => "命書送到，先生捻著鬚搖頭又點頭。八字之說，向來信者恆信，但定親前這一關不能省。本家對「相合」「相沖」的態度，往往看的是當主的氣度。",
    // 側室、續弦案卷會跳過
    kinds: ["正配", "入贅", "政治聯姻"],
    choices: [
      {
        label: "命書既不利，重金請另一位名家複看",
        dynamicDelta: (ctx) => {
          // 60% 機率再判相合
          if (ctx.roll < 0.6) {
            return { delta: 3, consequence: "另一位先生果然斷為大吉，破局轉合，本家私下鬆了口氣。" };
          }
          return { delta: -2, consequence: "兩位先生皆判相沖，本家迷信之名傳出，反傷顏面。" };
        }
      },
      {
        label: "八字不過皮毛，本家自有家風護持",
        dynamicDelta: (ctx) => {
          // 若意向勾選「對方雙親健在」: 額外 +2
          const bonus = (ctx.intent.values || []).includes("parentsAlive") ? 2 : 0;
          return {
            delta: 5 + bonus,
            consequence: bonus
              ? "本家剛斷有度，對方雙親在堂、見此氣度亦深以為然。"
              : "本家剛斷有度，對方亦敬佩這份篤定。"
          };
        }
      },
      {
        label: "既有不利之說，不如先擱置數月再議",
        delta: -4,
        consequence: "耽擱本身就是一種拒絕，對方家中漸生不耐。"
      }
    ]
  },

  // ── 定親・其二:族譜寫入的儀程(工筆・核心) ──
  // 條件:無;讀 aFamilyMembersCount(本家規模)
  {
    id: "register-in-genealogy",
    stage: "定親",
    title: "族譜寫入的儀程",
    body: () => "定親既成，本家須擇日將對方姓名、行第、生年寫入族譜訂婚一欄。族中長者捧著譜冊與筆，等當主示下。寫入之事看似程序，實則是本家對族人、對先人、對未來子嗣的一次正式交代 —— 落筆當日的禮數，族中老人會記上一輩子。",
    kinds: ["正配", "入贅", "政治聯姻"],
    choices: [
      {
        label: "擇吉日，召集族中尊長同至祠堂，當眾寫入",
        dynamicDelta: (ctx) => {
          // 動態條件:大族(>= 8 人)當眾寫入分量自足;小族略嫌單薄
          if (ctx.aFamilyMembersCount >= 8) {
            return { delta: 5, consequence: "大族規模，當眾寫入分量自足，對方家中聽說後深感本家鄭重。" };
          }
          return { delta: 2, consequence: "禮數雖足，但族中人少，氣勢稍嫌單薄。" };
        }
      },
      {
        label: "由當主與族中執筆者兩人靜室寫入即可",
        delta: 3,
        consequence: "簡省合於本家風格，落筆鄭重。對方家中雖未到場，事後得知亦無話可說。"
      },
      {
        label: "著管事按舊例補寫，當主不必親至",
        delta: -1,
        consequence: "族譜寫入是本家分內事，由管事代辦合於常例，但少了一分當主的個人鄭重，老人們暗中嘆了一句。"
      }
    ]
  },

  // ── 定親・其三:過大禮日的雨(工筆・次要) ──
  // 條件:無;讀 roll
  {
    id: "rain-on-betrothal-day",
    stage: "定親",
    title: "過大禮日的雨",
    body: () => "過大禮那日，天色卻變。媒人一早來報，雲沉得低，下半晌恐有雨。禮車裝載的衣料、果品、酒罈最忌沾濕。族中老人說「雨喜雨喜，逢雨是喜」，但車隊真要中途被淋，又是另一回事。當主須當機立斷。",
    kinds: [],
    choices: [
      {
        label: "信老人「雨喜」之說，禮車照常出發",
        dynamicDelta: (ctx) => {
          // 50% 隨機:雨究竟落不落
          if (ctx.roll < 0.5) {
            return { delta: 5, consequence: "雨終究沒落下，禮車到時陽光乍現，對方家中傳為佳兆。" };
          }
          return { delta: -3, consequence: "禮車半路遇雨，衣料受了潮，對方家中收禮時面上未說、心裡記了一筆。" };
        }
      },
      {
        label: "命人加蓋油布，禮車照原時辰出發",
        delta: 3,
        consequence: "油布雖醜，禮品無損。對方家中收禮時見此周到，反讚本家臨機有度。"
      },
      {
        label: "改後一日再過大禮，當日重新擇時",
        delta: -2,
        consequence: "過大禮改期不是小事，雖避了雨，禮數上總留了一道痕跡。對方家中雖未明說，亦覺本家過於小心。"
      }
    ]
  },

  // ── 定親・其四:對方家中突生白事(戲劇・核心) ──
  // 條件:無;讀 aFamilyEldersCount(本家有長輩可親送奠儀)、currentScore
  // 變數來自「對方家中變故」這個本家無法主動的外部因素
  {
    id: "death-in-other-house",
    stage: "定親",
    title: "對方家中突生白事",
    body: () => "大禮過後不及半月，媒人黑著面色趕來。對方家中昨夜傳出 —— 一位旁支長輩驟然辭世。雖非至親，但禮數上對方家中須有所收斂，定親之事該如何接續，他們把話遞了過來，請本家自己拿主意。本家當主接過這份話，知道這是一道考題。",
    kinds: [],
    choices: [
      {
        label: "本家親自備一份奠儀，由族中長輩送去",
        dynamicDelta: (ctx) => {
          // 動態條件:本家有長輩,親送奠儀分量足;無長輩,管事代送稍嫌不足
          if (ctx.aFamilyEldersCount > 0) {
            return { delta: 7, consequence: "長輩親送奠儀，對方家中見此分量，悲喜之間反更覺與本家投契。" };
          }
          return { delta: 3, consequence: "本家管事代送，禮數雖到，分量稍嫌不足。" };
        }
      },
      {
        label: "著媒人代為遞話，本家暫不上門，待對方家中安頓再續",
        delta: 4,
        consequence: "知禮識體，對方家中見本家退一步反更感念。事情緩了月餘，再接續時氣氛反更溫煦。"
      },
      {
        label: "不予理會，定親既成、按原議程推進婚期",
        dynamicDelta: (ctx) => {
          // 動態條件:前情累積厚則小傷;不厚則重創
          if (ctx.currentScore >= 60) {
            return { delta: -3, consequence: "前情雖厚，這份冷淡仍讓對方家中側目。事後得彌補一番。" };
          }
          return { delta: -8, consequence: "本家失禮至此，對方家中當下動了悔意，媒人費盡口舌才把話頭穩住。" };
        }
      }
    ]
  },

  // ── 定親・其五:婚期初議(工筆・次要) ──
  // 條件:無;讀 currentScore、intent.kind
  {
    id: "wedding-date-initial",
    stage: "定親",
    title: "婚期初議",
    body: () => "定親既成，婚期該議。本家當主翻看擇日先生開的三張單子 —— 一個近在三月後、一個半年、一個年底。媒人說對方家中傾向半年，但未明言。族中亦有人說早辦早安心、有人說年底辦最合本家節氣。三個選項，各有其理。",
    kinds: [],
    choices: [
      {
        label: "取三月後的近期 —— 早辦早安心，免夜長夢多",
        dynamicDelta: (ctx) => {
          // 動態條件:前情累積厚,倉促反顯篤定;不厚,則顯急切
          if (ctx.currentScore >= 60) {
            return { delta: 4, consequence: "前情累積得厚，倉促之間反顯本家篤定。" };
          }
          return { delta: -3, consequence: "底子未穩就急著定，對方家中覺本家急切，反生猶豫。" };
        }
      },
      {
        label: "取半年之後 —— 合於對方家中傾向，禮數從容",
        delta: 5,
        consequence: "媒人覆命時，對方家長親自捎話:「本家體貼，這份心意我們知道。」一句話便是分量。"
      },
      {
        label: "取年底之期 —— 合於本家節氣，禮數最盛",
        dynamicDelta: (ctx) => {
          // 動態條件:正配/政治聯姻合於大辦;側室/續弦則嫌張揚
          const kind = ctx.intent && ctx.intent.kind;
          if (kind === "正配" || kind === "政治聯姻") {
            return { delta: 4, consequence: "年底大辦合於兩家門第，禮數從容。" };
          }
          return { delta: -2, consequence: "本是不必大辦的場合，本家擇期過盛，反顯張揚。" };
        }
      }
    ]
  },

  // ----- 四・婚前 -----
  {
    id: "old-affair",
    stage: "婚前",
    title: "舊事翻出",
    body: (a, b) => `將近婚期時，一封匿名書信送到本家。信中提及${b.name}年少時曾與某人有過婚約傳聞，雖未成事，知情者卻不在少數。`,
    kinds: [],
    choices: [
      {
        label: "派人查明此事，當面對質",
        dynamicDelta: (ctx) => {
          // 50% 是真
          if (ctx.roll < 0.5) {
            return { delta: -2, consequence: "果有其事，對方坦承。雙方信任打了折扣，但事既明白，反而清爽。" };
          }
          return { delta: 6, consequence: "為小人造謠，本家以禮應對、不失分寸，立場反而更穩。" };
        }
      },
      {
        label: "私下打聽底細，卻不向對方挑明",
        delta: 1,
        consequence: "本家暗中存了一道防備，日後若有事，可作底牌。"
      },
      {
        label: "視作流言，當著媒人面焚毀此信",
        dynamicDelta: (ctx) => {
          // 50% 隨機骰: 焚毀的代價
          if (ctx.roll < 0.5) {
            return { delta: 8, consequence: "氣度傳出，對方銘感於心，這份信任成為親事最深的底。" };
          }
          return { delta: -5, consequence: "事後此事被旁人翻出證實，本家成了知情不問之人，難以辯白。" };
        }
      }
    ]
  },

  // ── 婚前・其二:婚服試樣(工筆・次要) ──
  // 條件:無;讀 aGender(當主性別影響「自選紋樣」是否合宜)、standingDiff
  {
    id: "wedding-attire-fitting",
    stage: "婚前",
    title: "婚服試樣",
    body: () => "婚服送到本家試樣。繡娘跟著進門，捧著針線匣子在一旁候著，說顏色、紋樣若有不合，當下尚可改動。當主看了一眼，又看當事人 —— 顏色是按舊例選的，紋樣是按本家規格定的，但這一件穿的，畢竟是他／她自己。",
    kinds: [],
    choices: [
      {
        label: "一切按本家舊例，繡娘照原樣縫製",
        delta: 2,
        consequence: "婚服合於規格，挑不出毛病。當事人試穿時神色平靜，族中老人見了亦無話可說。"
      },
      {
        label: "由當事人自選一處紋樣加飾，當主應允",
        dynamicDelta: (ctx) => {
          // 動態條件:A 為當家女性時,允添紋樣分量足;男主則略顯失分寸
          if (ctx.aGender === "女") {
            return { delta: 5, consequence: "當家者允當事人添一筆，本家從容氣度傳了出去，對方家中亦感念。" };
          }
          return { delta: 3, consequence: "當主開了恩，當事人添了一處小巧紋樣，氣氛親和不少。" };
        }
      },
      {
        label: "著繡娘按對方家中送來的紋樣參考再做調整",
        dynamicDelta: (ctx) => {
          // 動態條件:對方門第低或相當,本家遷就反顯氣度;對方門第高,則姿態放太低
          if (ctx.standingDiff <= 0) {
            return { delta: 3, consequence: "本家肯遷就，對方家中見了感動。" };
          }
          return { delta: -2, consequence: "本家姿態放得太低，反顯失了主場。" };
        }
      }
    ]
  },

  // ── 婚前・其三:當事人臨陣猶疑(戲劇・核心) ──
  // 條件:無;讀 currentScore、aFamilyEldersCount、roll
  // 戲劇變數來自「內部」—— 當事人自身的心結
  {
    id: "last-minute-doubt",
    stage: "婚前",
    title: "當事人臨陣猶疑",
    body: () => "婚期前十日，當主忽然得了一個消息 —— 當事人這幾日寢食不安，夜裡常獨坐。族中嬤嬤旁敲側擊問過，當事人不肯明說，只說「想到要嫁／娶到那邊去，心裡空了一塊」。話傳到當主這裡，是該勸是該緩，是該問是該不問，每一條都關乎此後一輩子。",
    kinds: [],
    choices: [
      {
        label: "親自與當事人長談一夜，把該說的都說透",
        dynamicDelta: (ctx) => {
          // 動態條件:前情厚則心結化開;不厚則只是壓住而非解開
          if (ctx.currentScore >= 60) {
            return { delta: 7, consequence: "前情累積得厚，當主一席話下來，當事人心結化開，反更篤定。" };
          }
          return { delta: 2, consequence: "當主盡力安撫，當事人勉強應下，但那份遲疑只是被壓住而非解開。" };
        }
      },
      {
        label: "請族中長輩出面開導，當主不必親至",
        dynamicDelta: (ctx) => {
          // 動態條件:本家有長輩,開導可成;無長輩,事情無人可托
          if (ctx.aFamilyEldersCount > 0) {
            return { delta: 4, consequence: "長輩到場開導，當事人受教，事情得以平息。" };
          }
          return { delta: -2, consequence: "本家無人可托，事情拖了兩日，反更焦躁。" };
        }
      },
      {
        label: "不去多問，臨陣猶疑是常事，過了便過了",
        dynamicDelta: (ctx) => {
          // 50% 隨機:不過問有時是智慧,有時是失職
          if (ctx.roll < 0.5) {
            return { delta: 3, consequence: "當事人自己想通了，當主這份不過問反顯氣度。" };
          }
          return { delta: -6, consequence: "當事人心結未解，婚禮前夜獨坐到天明，本家後來才知此事，懊悔已遲。" };
        }
      }
    ]
  },

  // ── 婚前・其四:嫁妝／聘禮的清點(工筆・次要) ──
  // 條件:無;讀 standingDiff、roll
  {
    id: "dowry-inventory",
    stage: "婚前",
    title: "嫁妝／聘禮的清點",
    body: () => "婚期將近，嫁妝(或聘禮)須當著兩家管事的面清點封箱。本家管事核對單據時發現 —— 對方送來的禮單上有一兩樣東西，與當初議定時略有出入。或多或少都不算大事，但這是要寫入紅冊存底的，當主須親自過問。",
    kinds: [],
    choices: [
      {
        label: "按原議定數目重新覆核，當面點清",
        delta: 3,
        consequence: "點清之後，差額其實是對方家中加進去的兩樣，本意是周到。本家當面謝過，禮數兩全。"
      },
      {
        label: "略過此節，當作沒看見，紅冊照單寫成",
        dynamicDelta: (ctx) => {
          // 動態條件:對方門第低或相當,氣度傳出;對方門第高,反覺本家不夠用心
          if (ctx.standingDiff <= 0) {
            return { delta: 4, consequence: "本家氣度傳出，對方家中感念這份不計較。" };
          }
          return { delta: -2, consequence: "對方反覺本家不夠用心，禮單之事本該講究。" };
        }
      },
      {
        label: "私下喚對方管事過來談，請他自己拿回去理清",
        dynamicDelta: (ctx) => {
          // 50% 隨機:私下談是體面手段或被視為質疑
          if (ctx.roll < 0.5) {
            return { delta: 5, consequence: "對方管事感念本家給了體面，回去後特意周全此事，兩家管事之間反更熟絡。" };
          }
          return { delta: -3, consequence: "對方管事覺受了質疑，回去後話傳得難聽，對方家中聽說此事略有不快。" };
        }
      }
    ]
  },

  // ── 婚前・其五:外人攪局(戲劇・核心) ──
  // 條件:無;讀 currentScore、roll
  // 戲劇變數來自「外部」—— 第三方介入
  {
    id: "outsider-interference",
    stage: "婚前",
    title: "外人攪局",
    body: () => "婚期前數日，一位本家舊識忽然登門。此人與本家有些年頭的交情，這次卻是替另一家來說項 —— 他們家中有位人物，論門第、論才情、論年齒，與當事人都更合適，希望本家能在婚期前重新考慮。話說到這份上，已是相當不客氣。當主聽完，茶盅在手裡轉了兩圈。",
    kinds: [],
    choices: [
      {
        label: "當下回絕，請此人轉告:本家婚事已定，無從更改",
        dynamicDelta: (ctx) => {
          // 動態條件:前情厚,底氣足;不厚,雖回絕但仍生餘波
          if (ctx.currentScore >= 60) {
            return { delta: 7, consequence: "前情累積得厚，本家底氣足、態度從容，此人無話可說、辭去之後便絕了話頭。" };
          }
          return { delta: 2, consequence: "本家雖然回絕，舊識去後仍在外傳了幾句閒話，本家後續得多費一番彌補。" };
        }
      },
      {
        label: "不當下回絕，先聽他把話講完，再婉言相謝",
        delta: 3,
        consequence: "本家以禮應對、不失分寸，舊識去後反而傳了句「那家當主是有度量的」，事情就此化開。"
      },
      {
        label: "不予接見，著管事送客",
        dynamicDelta: (ctx) => {
          // 50% 隨機:硬氣是手段或失分寸
          if (ctx.roll < 0.5) {
            return { delta: 4, consequence: "本家硬氣，舊識識趣便走、後續再無動靜。" };
          }
          return { delta: -6, consequence: "此人覺受了輕慢，外頭散了不少難聽的話，對方家中也聽說此事，覺本家行事過於剛烈。" };
        }
      }
    ]
  },

  // ── 婚前・其六:婚前夜的本家內議(工筆・次要) ──
  // 條件:無;讀 aFamilyMembersCount、currentScore
  // 純氛圍的「呼吸事件」,撐住婚前的節奏
  {
    id: "night-before-wedding",
    stage: "婚前",
    title: "婚前夜的本家內議",
    body: () => "婚禮前一夜，本家族中老人聚在當主廳裡，沒有議題，卻誰都不肯先告退。或說明日席位該如何擺、或說某位遠房親戚是否該請、或說婚後新人院落還有哪些未盡之事。當主明白 —— 他們不是要議事，是要陪本家當主把這一夜過完。",
    kinds: [],
    choices: [
      {
        label: "留族中長者一同小酌至深夜，順勢把細節都議定",
        delta: 4,
        consequence: "細節議定，氣氛親和。明日大事在前，族中老人見當主從容，自己心裡也安了。"
      },
      {
        label: "婉言請眾人早歸 —— 明日大事在前，皆需早眠",
        dynamicDelta: (ctx) => {
          // 動態條件:大族(>= 8 人)散去合於規矩;小族則嫌冷清
          if (ctx.aFamilyMembersCount >= 8) {
            return { delta: 2, consequence: "大族規矩，當主肯為族人著想是分內事，眾人散去之前皆道一句「明日早至」。" };
          }
          return { delta: -1, consequence: "本就人少，當主一句話便散了，留下的空氣略嫌冷清。" };
        }
      },
      {
        label: "由當主一人靜坐到天明",
        dynamicDelta: (ctx) => {
          // 動態條件:前情厚,獨坐成回憶;不厚,獨坐成負擔
          if (ctx.currentScore >= 60) {
            return { delta: 5, consequence: "前情累積得厚，這一夜的靜坐反成本家當主一生記得的一刻。" };
          }
          return { delta: 1, consequence: "當主獨坐到天明，心事重，明日精神難免不足。" };
        }
      }
    ]
  },

  // ----- 五・成婚 -----
  {
    id: "wedding-day",
    stage: "成婚",
    title: "婚當日的最後波折",
    body: (a, b) => {
      const aFam = a.familyId ? getFamilyNameById(a.familyId) : "本家";
      return `迎親隊伍將至，府門外卻來了一位不速之客——或為${b.name}舊識，或為${aFam}族中故人，言辭間似有勸阻之意。婚禮已近，是停是行，只在當主一念。`;
    },
    kinds: [],
    choices: [
      {
        label: "命人禮送其離去，婚禮如常進行",
        delta: 4,
        consequence: "場面雖緊張，禮數無虧，賓客皆稱本家有度。"
      },
      {
        label: "暫停儀程，請此人入內細說",
        dynamicDelta: (ctx) => {
          // 50% 隨機骰
          if (ctx.roll < 0.5) {
            return { delta: 5, consequence: "此人所言果有玄機，本家避過一場禍事，對方家中事後亦感念這份審慎。" };
          }
          return { delta: -3, consequence: "誤了吉時，賓客面上不說，心裡卻覺本家不夠堅定。" };
        }
      },
      {
        label: "由當事人親自出面回應",
        dynamicDelta: (ctx) => {
          // 若本來合適度 >= 50,表示前面累積得不錯,當事人有底氣
          if (ctx.currentScore >= 50) {
            return { delta: 7, consequence: "當事人從容應對，這一幕反成佳話，傳為一段風雅。" };
          }
          return { delta: -4, consequence: "當事人尚有遲疑，當眾露怯，賓客間私語不止。" };
        }
      }
    ]
  },

  // ── 成婚・其二:拜堂時的小變故(戲劇・核心) ──
  // 條件:無;讀 aFamilyMembersCount、currentScore
  // 戲劇變數來自「儀程中」的小意外,與前一個戲劇(門外攔截)形成「空間-時間」對照
  {
    id: "ceremony-hiccup",
    stage: "成婚",
    title: "拜堂時的小變故",
    body: () => "拜堂正禮，三跪九叩之間，禮官唱喏的聲音忽然頓了一下 —— 樂工那邊一支笛子斷了音，賓席最末有人忍不住低聲笑了出來。事雖小，卻是兩家對外公示禮成的時刻。在場數十雙眼睛都看著當主，看他這一刻會怎麼接。",
    kinds: [],
    choices: [
      {
        label: "揮手示意禮儀照常，斷音當作未聞",
        delta: 3,
        consequence: "當主從容，禮官重新接上唱喏。眾人心裡那一笑便也壓了下去，事情就此過去。"
      },
      {
        label: "當下命人換笛、補上樂段，禮儀重整",
        dynamicDelta: (ctx) => {
          // 動態條件:大族有備用樂工;小族則倉促
          if (ctx.aFamilyMembersCount >= 8) {
            return { delta: 5, consequence: "大族規模，當場換樂工合於排場，賓客反而稱本家備辦周到。" };
          }
          return { delta: -2, consequence: "本家無備用樂工，補上的笛子音色不一，反顯倉促。" };
        }
      },
      {
        label: "當主朗聲一句:「斷音是斷塵，後福長遠」",
        dynamicDelta: (ctx) => {
          // 動態條件:前情厚則機智從容;不厚則氣勢不足
          if (ctx.currentScore >= 60) {
            return { delta: 8, consequence: "前情累積得厚，當主這一句機智從容，反成這場婚禮日後最被傳誦的一刻。" };
          }
          return { delta: -3, consequence: "當主雖然開了口，氣勢不足，賓客面上應和、心裡覺本家強自圓場。" };
        }
      }
    ]
  },

  // ── 成婚・其三:宴席間的本家敬酒(工筆・次要) ──
  // 條件:無;讀 intent.kind、aFamilyEldersCount
  {
    id: "wedding-toast",
    stage: "成婚",
    title: "宴席間的本家敬酒",
    body: () => "拜堂之後，婚宴開席。賓客分席而坐，本家當主須當場敬酒一輪 —— 從對方家長開始，到雙方族中尊長，再到遠來的賓客。酒過三巡，敬到哪裡、停在何處、何時該由當事人接手，這一輪走下來，便是本家把這場婚事的人情都記在了帳上。",
    kinds: [],
    choices: [
      {
        label: "依本家舊例，按尊卑次序逐席敬到",
        delta: 3,
        consequence: "規格俱備，挑不出毛病。對方家長見本家按部就班，亦敬本家有禮。"
      },
      {
        label: "對方家長敬畢後，由當事人接過酒壺，續敬餘下諸席",
        dynamicDelta: (ctx) => {
          // 動態條件:正配/入贅/政治聯姻合於入家標誌;側室/續弦則嫌張揚
          const kind = ctx.intent && ctx.intent.kind;
          if (kind === "正配" || kind === "入贅" || kind === "政治聯姻") {
            return { delta: 5, consequence: "當事人接手敬酒是新人入家的標誌，對方家中見此安排深感本家鄭重。" };
          }
          return { delta: 1, consequence: "當事人接手敬酒在這類場合略嫌張揚，本家族中有人面色微變。" };
        }
      },
      {
        label: "敬到對方家中一輪即止，餘下諸席由族中長輩代敬",
        dynamicDelta: (ctx) => {
          // 動態條件:有長輩代敬合於規矩;無長輩則「本家人單」
          if (ctx.aFamilyEldersCount > 0) {
            return { delta: 4, consequence: "長輩代敬合於規矩，當主反顯沉穩。" };
          }
          return { delta: -2, consequence: "本家無長輩可托，代敬之事落到管事身上，賓客私下嘆了一句「本家人單」。" };
        }
      }
    ]
  },

  // ── 成婚・其四:禮畢之後(工筆・次要) ──
  // 條件:無;讀 currentScore
  // 全套劇情的收尾,分數小,重點在收束
  // 此事件會落下整場議親的「最後一筆」,讓玩家在歷史紀錄上看到不同的結局氣質
  {
    id: "after-the-rite",
    stage: "成婚",
    title: "禮畢之後",
    body: () => "賓客散去，府中燈籠一盞盞熄到只剩前廳那一對。族中老人都已歸房，當事人也被嬤嬤引到了新院落。當主獨自坐在廳中，案上還擺著未收的禮單與半盞冷茶。媒人推門進來覆最後一次命，問當主:明日是否還有事要交代？",
    kinds: [],
    choices: [
      {
        label: "命她明日卯時來，本家備一份謝禮",
        delta: 3,
        consequence: "媒人應下退去。明日謝禮備得周到，這場議親從頭到尾，媒人在外提起時都帶著一份體面。"
      },
      {
        label: "命她暫且歇下，謝禮之事三日後再議",
        delta: 2,
        consequence: "媒人退去，本家心裡那根弦也鬆了下來。三日之後再見，氣氛從容，謝禮也議得從容。"
      },
      {
        label: "揮手請她退下，當主獨自再坐一刻",
        dynamicDelta: (ctx) => {
          // 動態條件:前情累積得圓滿則餘味深長;不圓滿則餘味略嘆
          if (ctx.currentScore >= 70) {
            return { delta: 5, consequence: "前情累積得圓滿，當主獨坐至冷茶見底，這一刻便是這場婚事最後落下的一筆。" };
          }
          return { delta: -1, consequence: "當主獨坐到燈油盡，心中那點未盡之意化成了一聲輕嘆。" };
        }
      }
    ]
  }
];

// 為當前案卷依階段挑事件(同案卷不重複)
// 為當前案卷依階段挑事件(同對人不重複)
function pickNarrativeEvent(stageKey, kind, usedIds) {
  const candidates = NARRATIVE_EVENTS.filter(ev => {
    if (ev.stage !== stageKey) return false;
    if (ev.kinds && ev.kinds.length && !ev.kinds.includes(kind)) return false;
    if (usedIds && usedIds.includes(ev.id)) return false;
    return true;
  });
  if (!candidates.length) return null;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// =============== 動作 → 劇情階段 映射 ===============
// 只有「推進性質」的動作會綁劇情;駁回、悔婚、延案、改議等不綁
const ACTION_TO_NARRATIVE_STAGE = {
  "engage": "提親",                  // 議親成功(口頭說定)
  "formalBetrothal": "議親",         // 正式定親
  "setWeddingDate": "定親",          // 商定婚期
  "marry": "婚前",                   // 正式成婚(成婚前先跑「婚前」階段)
  "takeConsort": "議親"              // 納為側室/繼室
};

// 給定動作 key,回傳對應的劇情階段(沒有對應就回 null)
function getNarrativeStageForAction(actionKey) {
  return ACTION_TO_NARRATIVE_STAGE[actionKey] || null;
}

// =============== 負向動作的合適度清算 ===============
// "破局型":清除進展紀錄,並記下 penalty(影響日後重議的初始合適度)
// "扣分型":不清除進展,僅扣分
const ACTION_PENALTY_RESET = {
  // 破局型(清除進展 + 加 penalty)
  "breakOldPromise":   { type: "reset", penalty: 25, label: "翻案改議／悔婚" },
  "rejectByRite":      { type: "reset", penalty: 20, label: "禮法駁回" },
  "rejectByHousehold": { type: "reset", penalty: 15, label: "後宅駁回" },
  "breakWedding":      { type: "reset", penalty: 30, label: "婚事告吹" },
  // 扣分型(保留進展,僅扣分)
  "delayCase":          { type: "deduct", penalty: 8,  label: "暫緩" },
  "preWeddingIncident": { type: "deduct", penalty: 5,  label: "婚前生變" }
};

// 在動作執行後,若是負向動作則清算合適度
function applyNegativeAction(actionKey, aId, bId) {
  const rule = ACTION_PENALTY_RESET[actionKey];
  if (!rule) return null;  // 非負向動作

  const all = getPairScores();
  const key = pairKey(aId, bId);
  const pd = all[key];
  if (!pd) {
    // 沒有 pair 資料,沒東西可清,只建立 penalty 紀錄
    // ----- 修改說明 -----
    // 即使是首次破局(沒有 pairData),也要把「破局重議」flag 種下,
    // 以便日後重新議親時讀到。flags 直接初始化為帶 flag 的陣列。
    // ------------------
    all[key] = {
      score: 0,
      baseScore: 0,
      stagesDone: [],
      history: [],
      flags: [{ name: "破局重議", year: state.gameYear, duration: null }],
      penalty: rule.penalty,
      lastBreak: rule.label
    };
    return rule;
  }

  if (rule.type === "reset") {
    // 累計 penalty (若先前已有 penalty 再疊加)
    const oldPenalty = pd.penalty || 0;
    // ----- 修改說明 -----
    // 破局重置時不清掉 flags — 歷史是不可磨滅的,即使重新議親也帶著。
    // 多種一個「破局重議」flag(永久)以記錄此次經歷。
    // ------------------
    const carryFlags = (pd.flags || []).slice();   // 複製一份
    // 同名 flag 先移掉(避免重複),再加新的
    const filtered = carryFlags.filter(f => f.name !== "破局重議");
    filtered.push({ name: "破局重議", year: state.gameYear, duration: null });
    all[key] = {
      score: 0,
      baseScore: 0,
      stagesDone: [],
      history: [],
      flags: filtered,
      penalty: oldPenalty + rule.penalty,
      lastBreak: rule.label
    };
  } else {
    // 扣分型:不重置進展,只扣分
    pd.score = Math.max(0, pd.score - rule.penalty);
    pd.history.push({
      stage: "－",
      eventId: "_neg",
      eventTitle: rule.label,
      choiceLabel: "（負向動作）",
      delta: -rule.penalty,
      consequence: `因「${rule.label}」扣分。`,
      year: state.gameYear
    });
  }
  return rule;
}

// =============== 破局動作的「提出方」選擇 ===============
// 點這些動作會先彈出選單讓玩家選誰提出
const BREAKUP_ACTIONS = ["breakOldPromise", "rejectByRite", "rejectByHousehold"];

function openDissolveModal(actionKey) {
  const a = getMA(), b = getMB();
  if (!a || !b) return;
  const actions = getActions(a, b);
  const label = (actions.find(x => x.key === actionKey) || {}).label || actionKey;
  const stage = getStageOfPair(a, b);

  // 預設提出方:A 方
  const body = `
    <div style="padding:14px 16px;">
      <div class="intent-section-title">即將進行：${label}</div>
      <div style="margin:10px 0;font-size:13px;color:#6b5b48;line-height:1.7;">
        當前階段：<strong>${stage}</strong>。請選擇此次由哪一方提出，將如實記入婚配紀錄。
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">
        <label class="intent-kind">
          <input type="radio" name="dissolveBy" value="A方" checked />
          <div>
            <div class="intent-kind-title">${a.name}（A 方）提出</div>
            <div class="intent-kind-hint">本家主動。常見：以禮法、後宅秩序為由，或本家臨陣反悔。</div>
          </div>
        </label>
        <label class="intent-kind">
          <input type="radio" name="dissolveBy" value="B方" />
          <div>
            <div class="intent-kind-title">${b.name}（B 方）提出</div>
            <div class="intent-kind-hint">對方家中主動。常見：對方家中變故、對方臨陣反悔。</div>
          </div>
        </label>
        <label class="intent-kind">
          <input type="radio" name="dissolveBy" value="雙方" />
          <div>
            <div class="intent-kind-title">雙方協議</div>
            <div class="intent-kind-hint">私下談妥，對外不分主動方。</div>
          </div>
        </label>
      </div>
      <div class="intent-section" style="border-bottom:none;padding-bottom:0;">
        <div class="intent-sub-title">緣由（選填，將寫入婚配紀錄）</div>
        <textarea id="dissolveReasonInput" rows="2" placeholder="例：八字不合、對方家中喪事、另有更佳人選等"></textarea>
      </div>
      <div class="intent-actions" style="margin-top:14px;">
        <button class="btn" id="dissolveCancelBtn">取消</button>
        <button class="btn btn-primary" id="dissolveConfirmBtn">確認 → 執行</button>
      </div>
    </div>
  `;
  _$("dissolveTitle").textContent = "破局事由";
  _$("dissolveBody").innerHTML = body;
  _$("dissolveModal").classList.add("active");

  _$("dissolveCancelBtn").addEventListener("click", closeDissolveModal);
  _$("dissolveConfirmBtn").addEventListener("click", () => {
    const by = document.querySelector('input[name="dissolveBy"]:checked').value;
    const reason = _$("dissolveReasonInput").value.trim();
    matchState.dissolveDecision = { actionKey, by, reason };
    closeDissolveModal();
    // 回流入口執行
    executeActionWithNarrative(actionKey);
  });
}

function closeDissolveModal() {
  _$("dissolveModal").classList.remove("active");
}

// =============== pair 合適度儲存 ===============
// 結構:state.pairScores[pairKey(aId,bId)] = {
//   score: number,            目前合適度
//   stagesDone: [stageKey...]  已跑過的劇情階段
//   history: [{stage, eventId, eventTitle, choiceLabel, delta, consequence, year}]
// }
function getPairScores() {
  if (!state.pairScores) state.pairScores = {};
  return state.pairScores;
}

function getPairData(aId, bId) {
  const key = pairKey(aId, bId);
  const all = getPairScores();
  return all[key] || null;
}

function ensurePairData(aId, bId) {
  const key = pairKey(aId, bId);
  const all = getPairScores();
  if (!all[key] || all[key].penalty != null && all[key].history.length === 0) {
    // 兩種情況會走這裡:
    // 1. 從未建立
    // 2. 曾被「破局型」動作清空,僅剩 penalty 紀錄 → 重新初始化但帶上 penalty
    const a = findPerson(aId);
    let base = 40;
    if (a) {
      const all2 = suggestMatchesFor(a);
      const found = all2.find(x => x.person.id === bId);
      if (found) base = Math.max(10, Math.min(80, 40 + found.score));
    }
    // 扣除過往的 penalty(若有)
    const carryPenalty = (all[key] && all[key].penalty) || 0;
    const carryLastBreak = (all[key] && all[key].lastBreak) || null;
    const adjustedBase = Math.max(0, base - carryPenalty);
    // 保留先前的 flags(若有破局後重新議親的情況,flag 紀錄不該消失)
    const carryFlags = (all[key] && all[key].flags) || [];
    all[key] = {
      score: adjustedBase,
      baseScore: adjustedBase,
      stagesDone: [],
      history: [],
      flags: carryFlags,            // ← 新增:flag 陣列。每個 flag 為 { name, year, duration }
      penalty: carryPenalty,
      lastBreak: carryLastBreak
    };
  }
  // 防呆:舊存檔可能沒有 flags 欄位,補上空陣列
  if (!all[key].flags) all[key].flags = [];
  return all[key];
}

// ====================================================================
// Flag 系統 — 婚前範圍
// ====================================================================
// 設計:每個 flag 為 { name: string, year: number, duration: number|null }
//   - name:     flag 名稱(中文,例如「圓滿成親」)
//   - year:     種下時的遊戲年份(state.gameYear)
//   - duration: 時效(年數)。null 表永久 flag,不會失效
// 讀取時會比對 state.gameYear,超過 duration 的時效 flag 視為失效
// ====================================================================

/**
 * 判斷某對夫妻是否帶有指定 flag(且 flag 仍在時效內)
 * @param {object} pd       pairData(由 ensurePairData 取得)
 * @param {string} flagName flag 名稱
 * @returns {boolean}       flag 存在且未失效則回傳 true
 */
function hasFlag(pd, flagName) {
  if (!pd || !pd.flags) return false;
  const currentYear = state.gameYear;
  return pd.flags.some(f => {
    if (f.name !== flagName) return false;
    if (f.duration == null) return true;          // 永久 flag
    return (currentYear - f.year) < f.duration;   // 仍在時效內
  });
}

/**
 * 為某對夫妻種下 flag。若同名 flag 已存在,則更新時間(等於延長時效)
 * @param {object} pd       pairData
 * @param {string} flagName flag 名稱
 * @param {number|null} duration  時效(年數)。null 表永久,預設為 null
 */
function setFlag(pd, flagName, duration = null) {
  if (!pd) return;
  if (!pd.flags) pd.flags = [];
  // 若已有同名 flag,先移除舊的(避免重複,並讓 year 重置)
  pd.flags = pd.flags.filter(f => f.name !== flagName);
  pd.flags.push({
    name: flagName,
    year: state.gameYear,
    duration: duration
  });
}

/**
 * 取得某對夫妻當前所有「有效」的 flag(過濾掉已失效的時效 flag)
 * 主要供 UI 顯示「過往痕跡」使用
 * @param {object} pd pairData
 * @returns {Array<{name, year, duration, remainingYears}>}
 */
function getActiveFlags(pd) {
  if (!pd || !pd.flags) return [];
  const currentYear = state.gameYear;
  return pd.flags
    .filter(f => {
      if (f.duration == null) return true;
      return (currentYear - f.year) < f.duration;
    })
    .map(f => ({
      name: f.name,
      year: f.year,
      duration: f.duration,
      // 永久 flag 的 remainingYears 為 null;時效 flag 顯示剩餘年數
      remainingYears: f.duration == null ? null : Math.max(0, f.duration - (currentYear - f.year))
    }));
}

// =============== 新版:在動作執行前彈劇情 ===============
// 入口:取代原本兩個直接呼叫 executeAction 的地方
function executeActionWithNarrative(actionKey) {
  const a = getMA(), b = getMB();
  if (!a || !b) return;

  // v6+:破局動作攔截:先讓玩家選擇提出方
  // 已決定過(從 dissolve modal 確認後回流)就不再攔
  if (BREAKUP_ACTIONS.includes(actionKey) && !matchState.dissolveDecision) {
    openDissolveModal(actionKey);
    return;
  }

  // 簡明模式(跳過劇情)
  if (matchState.skipNarrative) {
    executeAction(actionKey);
    return;
  }

  const stageKey = getNarrativeStageForAction(actionKey);
  if (!stageKey) {
    // 此動作無對應劇情(例如駁回/悔婚)
    executeAction(actionKey);
    return;
  }

  // 取得或建立 pair 資料
  const pd = ensurePairData(a.id, b.id);

  // 此階段是否已跑過?
  if (pd.stagesDone.includes(stageKey)) {
    // 跑過就直接執行動作(避免玩家點兩次重跑劇情)
    executeAction(actionKey);
    return;
  }

  // 挑事件
  const intent = matchState.intent || defaultMatchIntent();
  const ev = pickNarrativeEvent(stageKey, intent.kind, pd.history.map(h => h.eventId));
  if (!ev) {
    // 此階段無可用事件(婚事性質排除等),直接執行動作
    executeAction(actionKey);
    return;
  }

  // 設置劇情暫存,開啟 modal
  matchState.narrative = {
    aId: a.id,
    bId: b.id,
    kind: intent.kind,
    intent: JSON.parse(JSON.stringify(intent)),
    stageKey,
    pendingActionKey: actionKey,
    currentEvent: ev
  };
  openNarrativeModal();
}

// 玩家在劇情 modal 做了選擇
function chooseNarrative(choiceIdx) {
  const n = matchState.narrative;
  if (!n || !n.currentEvent) return;
  const ev = n.currentEvent;
  const choice = ev.choices[choiceIdx];
  if (!choice) return;

  const a = findPerson(n.aId), b = findPerson(n.bId);
  if (!a || !b) return;

  // 計算 delta
  const tAge = getMatchAge(a), cAge = getMatchAge(b);
  const ageDiff = (tAge != null && cAge != null) ? Math.abs(tAge - cAge) : null;
  const tFam = state.families.find(f => f.id === a.familyId);
  const cFam = state.families.find(f => f.id === b.familyId);
  const tRank = tFam && tFam.standing ? DEFAULT_STANDINGS.indexOf(tFam.standing) : DEFAULT_STANDINGS.indexOf("尋常人家");
  const cRank = cFam && cFam.standing ? DEFAULT_STANDINGS.indexOf(cFam.standing) : DEFAULT_STANDINGS.indexOf("尋常人家");
  const standingDiff = cRank - tRank;

  // ====================================================================
  // ctx 擴充:供新增的婚前事件讀取家族與人物資訊
  // ====================================================================
  // 設計原則:ctx 只塞「事件動態邏輯實際會用到」的欄位,
  // 避免無限擴張。各欄位用途見下方註釋。
  // ====================================================================
  // A 方家族成員(在世者),供事件讀取「家族規模」、「家族長輩數」
  const aFamilyMembers = a.familyId
    ? state.persons.filter(p => p.familyId === a.familyId && !p.deceased)
    : [];
  // A 方家族長輩(在世且年齡 ≥ 50 者,中式家族常以五十為長輩之界)
  const aFamilyElders = aFamilyMembers.filter(p => {
    const age = getMatchAge(p);
    return age != null && age >= 50;
  });

  const pd = ensurePairData(a.id, b.id);
  const ctx = {
    a, b, ageDiff, intent: n.intent,
    standingDiff,
    currentScore: pd.score,
    roll: Math.random(),
    // ----- 新增欄位 -----
    aFamily: tFam,                                    // A 方家族物件(可能為 null)
    bFamily: cFam,                                    // B 方家族物件(可能為 null)
    aFamilyMembersCount: aFamilyMembers.length,       // A 方家族成員數(在世)
    aFamilyEldersCount: aFamilyElders.length,         // A 方家族長輩數
    aGender: a.gender || "",                          // A 方性別("男"/"女"/"")
    pd                                                // pairData 本身,供事件讀 flag
  };

  let delta = 0;
  let consequence = "";
  if (typeof choice.dynamicDelta === "function") {
    const r = choice.dynamicDelta(ctx);
    delta = r.delta || 0;
    consequence = r.consequence || choice.consequence || "";
  } else {
    delta = choice.delta || 0;
    consequence = choice.consequence || "";
  }

  // 寫入 pair 資料
  pd.score = Math.max(0, Math.min(100, pd.score + delta));
  pd.stagesDone.push(n.stageKey);
  pd.history.push({
    stage: n.stageKey,
    eventId: ev.id,
    eventTitle: ev.title,
    choiceLabel: choice.label,
    delta,
    consequence,
    year: state.gameYear
  });

  // 改顯示為「結果頁」,等玩家按確認再執行動作
  matchState.narrative.lastChoice = { choice, delta, consequence };
  renderNarrative();
}

// 確認執行動作(劇情後的下一步)
function confirmNarrativeAndExecute() {
  const n = matchState.narrative;
  if (!n) return;
  const actionKey = n.pendingActionKey;
  // 把劇情資訊先存到一個暫時容器,供 addChapter 寫入時引用
  const pd = getPairData(n.aId, n.bId);
  const lastHist = pd ? pd.history[pd.history.length - 1] : null;
  matchState._narrativePrefix = lastHist ? {
    stage: lastHist.stage,
    eventTitle: lastHist.eventTitle,
    choiceLabel: lastHist.choiceLabel,
    delta: lastHist.delta,
    consequence: lastHist.consequence,
    score: pd.score
  } : null;

  // ====================================================================
  // 結局 flag 種下時機(婚前範圍)
  // ====================================================================
  // 時機:玩家確認執行「marry(正式成婚)」動作前。此時 pd.score 已是最終值。
  // 判定依 NARRATIVE_OUTCOMES 的門檻:
  //   score >= 70 → 圓滿成親(永久 flag)
  //   score >= 40 → 勉強成親(永久 flag)
  //   score <  40 → 不種 flag(此情況實際上玩家通常會走破局,不會走到 marry)
  // 為何選在這裡而非 applyNarrativeChoice:玩家可能取消最後一個選擇,
  //   在 confirmNarrativeAndExecute 才表示玩家「真的決定要禮成」。
  // ====================================================================
  if (actionKey === "marry" && pd) {
    if (pd.score >= 70) {
      setFlag(pd, "圓滿成親", null);   // 永久
    } else if (pd.score >= 40) {
      setFlag(pd, "勉強成親", null);   // 永久
    }
  }

  // 清掉 narrative 暫存(以免下一步又被觸發劇情)
  matchState.narrative = null;
  closeNarrativeModal();

  // 執行動作
  executeAction(actionKey);

  matchState._narrativePrefix = null;
  saveState();
  renderAll();
}

// 取消(不執行動作,但保留劇情選擇的合適度變化)
// 思考:若取消會否造成不公?保險起見,取消視同放棄這次劇情,把剛加上去的紀錄拿掉
function cancelNarrativeAction() {
  const n = matchState.narrative;
  if (!n) return;
  if (!confirm("放棄此次動作?(已做的選擇與合適度變化將被撤回。)")) return;

  // 若已做選擇,撤回最後一筆
  const pd = getPairData(n.aId, n.bId);
  if (pd && pd.history.length && n.lastChoice) {
    const last = pd.history.pop();
    pd.score = Math.max(0, Math.min(100, pd.score - last.delta));
    // 也要把 stagesDone 最後一筆移除
    const idx = pd.stagesDone.lastIndexOf(n.stageKey);
    if (idx >= 0) pd.stagesDone.splice(idx, 1);
  }

  matchState.narrative = null;
  closeNarrativeModal();
  saveState();
  renderAll();
}

function openNarrativeModal() {
  _$("narrativeModal").classList.add("active");
  renderNarrative();
}

function closeNarrativeModal() {
  _$("narrativeModal").classList.remove("active");
}

function renderNarrative() {
  const n = matchState.narrative;
  if (!n) {
    _$("narrativeBody").innerHTML = `<p class="empty">無進行中的劇情。</p>`;
    return;
  }
  const a = findPerson(n.aId), b = findPerson(n.bId);
  if (!a || !b) {
    _$("narrativeBody").innerHTML = `<p class="empty">人物資料缺失。</p>`;
    return;
  }
  const pd = ensurePairData(a.id, b.id);
  const score = pd.score;
  let barColor = "#a3491e";
  if (score >= 70) barColor = "#5b7a3a";
  else if (score >= 40) barColor = "#a08544";

  // 標題列
  _$("narrativeTitle").textContent = `${a.name} × ${b.name} ・ ${n.stageKey}`;

  // 已做選擇?顯示結果頁
  if (n.lastChoice) {
    const lc = n.lastChoice;
    const deltaText = lc.delta >= 0 ? `+${lc.delta}` : `${lc.delta}`;
    const deltaClass = lc.delta >= 0 ? "pos" : "neg";
    // 警示:若合適度過低,提示對方可能變卦
    const lowWarn = score < 30 ? `
      <div class="nar-warning">
        <strong>警示：</strong>合適度已落至 ${score}。對方家中已生退意，若仍要強行推進此步，恐結下心結。
      </div>
    ` : "";

    _$("narrativeBody").innerHTML = `
      <div class="nar-score-block">
        <div class="nar-score-label">合適度</div>
        <div class="nar-score-row">
          <div class="nar-score-bar"><div class="nar-score-fill" style="width:${score}%;background:${barColor};transition:width .4s, background .4s;"></div></div>
          <div class="nar-score-num" style="color:${barColor};">${score}</div>
        </div>
        <div class="nar-score-trail">本次變動：<span class="nar-delta ${deltaClass}">${deltaText}</span></div>
      </div>

      <div class="nar-event">
        <div class="nar-event-kicker">${n.stageKey}・${n.currentEvent.title}</div>
        <div class="nar-event-body" style="background:#fdf9ed;">
          <div style="margin-bottom:8px;"><strong>你的選擇：</strong>${lc.choice.label}</div>
          <div>${lc.consequence}</div>
        </div>
      </div>

      ${lowWarn}

      <div class="intent-actions">
        <button class="btn" id="narrativeBackBtn">放棄此次動作</button>
        <button class="btn btn-primary" id="narrativeProceedBtn">繼續執行：${getActionLabel(n.pendingActionKey)}</button>
      </div>
    `;
    _$("narrativeBackBtn").addEventListener("click", cancelNarrativeAction);
    _$("narrativeProceedBtn").addEventListener("click", confirmNarrativeAndExecute);
    return;
  }

  // 尚未選擇:顯示事件
  const ev = n.currentEvent;
  const bodyText = typeof ev.body === "function" ? ev.body(a, b) : ev.body;
  const choicesHtml = ev.choices.map((ch, idx) => {
    const deltaText = typeof ch.dynamicDelta === "function"
      ? `<span class="nar-choice-delta unknown">?</span>`
      : `<span class="nar-choice-delta ${ch.delta >= 0 ? "pos" : "neg"}">${ch.delta >= 0 ? "+" : ""}${ch.delta}</span>`;
    return `
      <button class="nar-choice" data-choice-idx="${idx}">
        <div class="nar-choice-head">${deltaText}</div>
        <div class="nar-choice-label">${ch.label}</div>
        ${typeof ch.dynamicDelta === "function" ? '<div class="nar-choice-hint">（此選擇有變數，結果視情勢而定）</div>' : ''}
      </button>
    `;
  }).join("");

  _$("narrativeBody").innerHTML = `
    <div class="nar-score-block">
      <div class="nar-score-label">當前合適度</div>
      <div class="nar-score-row">
        <div class="nar-score-bar"><div class="nar-score-fill" style="width:${score}%;background:${barColor};"></div></div>
        <div class="nar-score-num" style="color:${barColor};">${score}</div>
      </div>
      <div class="nar-score-trail">即將進行：${getActionLabel(n.pendingActionKey)}</div>
    </div>

    <div class="nar-event">
      <div class="nar-event-kicker">${n.stageKey}階段</div>
      <div class="nar-event-title">${ev.title}</div>
      <div class="nar-event-body">${bodyText}</div>
      <div class="nar-choices">${choicesHtml}</div>
    </div>

    <div class="intent-actions">
      <button class="btn" id="narrativeAbandonBtn">放棄此次動作</button>
    </div>
  `;
  document.querySelectorAll(".nar-choice").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.choiceIdx);
      chooseNarrative(idx);
    });
  });
  _$("narrativeAbandonBtn").addEventListener("click", () => {
    matchState.narrative = null;
    closeNarrativeModal();
  });
}

// 取得動作的中文標籤
function getActionLabel(actionKey) {
  const a = getMA(), b = getMB();
  if (!a || !b) return actionKey;
  const actions = getActions(a, b);
  const f = actions.find(x => x.key === actionKey);
  return f ? f.label : actionKey;
}

// =============== 初始化 ===============
document.addEventListener("DOMContentLoaded", () => {
  loadState();

  // 強推開關
  _$("forcePickToggle").addEventListener("change", e => {
    matchState.forcePick = e.target.checked;
    renderAll();
  });

  // 人物選擇
  _$("aPerson").addEventListener("change", e => { matchState.aId = Number(e.target.value); matchState.pendingAction = null; renderAll(); });
  _$("bPerson").addEventListener("change", e => { matchState.bId = Number(e.target.value); matchState.pendingAction = null; renderAll(); });

  // 家族篩選
  if (_$("aFamilyFilter")) {
    _$("aFamilyFilter").addEventListener("change", e => {
      matchState.aFamilyId = e.target.value === "noFamily" || e.target.value === "all" ? e.target.value : e.target.value;
      matchState.aId = null; // 觸發重新挑預設
      matchState.pendingAction = null;
      renderAll();
    });
  }
  if (_$("bFamilyFilter")) {
    _$("bFamilyFilter").addEventListener("change", e => {
      matchState.bFamilyId = e.target.value;
      matchState.bId = null;
      matchState.pendingAction = null;
      renderAll();
    });
  }

  // 清空案卷
  if (_$("clearChaptersBtn")) {
    _$("clearChaptersBtn").addEventListener("click", () => {
      if (confirm("確定要清空所有案卷紀錄?(不會影響族譜)")) {
        state.matchChapters = [];
        saveState();
        renderAll();
      }
    });
  }

  // 按鈕
  _$("confirmActionBtn").addEventListener("click", () => { if (matchState.pendingAction) executeActionWithNarrative(matchState.pendingAction); });
  _$("cancelActionBtn").addEventListener("click", () => { matchState.pendingAction = null; renderAll(); });
  _$("randomizeBtn").addEventListener("click", randomizePair);
  _$("rollBtn").addEventListener("click", rollRandomEvent);

  // v6+:簡明模式(跳過劇情)
  const skipToggle = _$("skipNarrativeToggle");
  if (skipToggle) {
    skipToggle.checked = !!matchState.skipNarrative;
    skipToggle.addEventListener("change", e => {
      matchState.skipNarrative = e.target.checked;
    });
  }
  const closeNarBtn = _$("closeNarrativeBtn");
  if (closeNarBtn) closeNarBtn.addEventListener("click", closeNarrativeModal);
  const narModal = _$("narrativeModal");
  if (narModal) {
    narModal.addEventListener("click", e => {
      // 劇情視窗不允許點背景關閉(防止意外丟失選擇)
      // 留空
    });
  }

  // v6+:破局事由 modal
  const closeDisBtn = _$("closeDissolveBtn");
  if (closeDisBtn) closeDisBtn.addEventListener("click", closeDissolveModal);
  const disModal = _$("dissolveModal");
  if (disModal) {
    disModal.addEventListener("click", e => {
      if (e.target.id === "dissolveModal") closeDissolveModal();
    });
  }
  _$("archiveBtn").addEventListener("click", openArchive);
  _$("closeArchiveBtn").addEventListener("click", () => _$("archiveModal").classList.remove("active"));
  _$("archiveModal").addEventListener("click", e => { if (e.target.id === "archiveModal") _$("archiveModal").classList.remove("active"); });
  _$("peopleTab").addEventListener("click", () => { matchState.archiveTab = "people"; matchState.archiveFilter = "全部"; _$("peopleTab").classList.add("active"); _$("eventsTab").classList.remove("active"); renderArchive(); });
  _$("eventsTab").addEventListener("click", () => { matchState.archiveTab = "events"; matchState.archiveFilter = "全部"; _$("eventsTab").classList.add("active"); _$("peopleTab").classList.remove("active"); renderArchive(); });
  _$("archiveSearch").addEventListener("input", e => { matchState.archiveSearch = e.target.value; renderArchive(); });
  _$("archiveFilter").addEventListener("change", e => { matchState.archiveFilter = e.target.value; renderArchive(); });
  _$("suggestABtn").addEventListener("click", () => openSuggestions("a"));
  _$("suggestBBtn").addEventListener("click", () => openSuggestions("b"));
  _$("closeSuggestionsBtn").addEventListener("click", () => _$("suggestionsModal").classList.remove("active"));
  _$("suggestionsModal").addEventListener("click", e => { if (e.target.id === "suggestionsModal") _$("suggestionsModal").classList.remove("active"); });

  // v6+:議親條件單 modal 關閉
  const closeIntentBtn = _$("closeIntentBtn");
  if (closeIntentBtn) closeIntentBtn.addEventListener("click", closeIntentDialog);
  const intentModal = _$("intentModal");
  if (intentModal) {
    intentModal.addEventListener("click", e => {
      if (e.target.id === "intentModal") closeIntentDialog();
    });
  }

  renderAll();
});
