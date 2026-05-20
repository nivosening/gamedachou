// utils.js
// 小工具:DOM 取用、隨機、區域名解析、輔佐官對話 log

// ---------- 小工具 ----------
function $(id) {
  return document.getElementById(id);
}
function advisorSay(msg) {
  const log = $("advisorLog");
  const p = document.createElement("p");
  p.textContent = "【輔佐官】" + msg;
  log.appendChild(p);
  log.scrollTop = log.scrollHeight;
}
function userSay(msg) {
  const log = $("advisorLog");
  const p = document.createElement("p");
  p.textContent = "【家主】" + msg;
  log.appendChild(p);
  log.scrollTop = log.scrollHeight;
}
function pickRandom(arr) {
  if (!arr || !arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}
function randomInt(min, max) {
  const a = Number(min), b = Number(max);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  if (b < a) return null;
  return a + Math.floor(Math.random() * (b - a + 1));
}
function getRegionName(id) {
  if (!id) return "";
  const r = state.regions.find(r => r.id === id);
  return r ? r.name : "";
}

// 取得家族顯示名:從 notes 首段抽「XX{姓}氏」,顯示為「{姓}氏({郡名})」;
// 抽不到時只顯示「{姓}氏」(無括號)
// 注意:此函式只用於「顯示」,所有篩選 / 比對 key 仍應用 f.name 或 f.id。
function getFamilyDisplayName(f) {
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
function getTerritoryObj(name) {
  if (!name) return null;
  return state.territoryOptions.find(t => t.name === name) || null;
}
function ensureTerritoryForRegion(territoryName, regionId) {
  const name = (territoryName || "").trim();
  if (!name) return "";
  const rId = regionId || "";
  let terr = getTerritoryObj(name);
  if (terr) {
    if (terr.regionId && rId && terr.regionId !== rId) {
      alert(`據點「${name}」已標記為「${getRegionName(terr.regionId) || terr.regionId}」，不可改屬其他區域。`);
      return null;
    }
    if (!terr.regionId && rId) terr.regionId = rId;
    return terr.name;
  } else {
    if (!rId) {
      alert("請先選擇區域，再指定據點。");
      return null;
    }
    terr = { name, regionId: rId };
    state.territoryOptions.push(terr);
    return terr.name;
  }
}


// 依照 ID 找人物(原本 game.js 有兩處重複定義, 保留此一份)
function findPerson(id) {
  return state.persons.find(p => p.id === Number(id)) || null;
}


// 點擊「人名連結」時跳轉到該人物詳情,並自動切換家族
function goToPerson(personId) {
  const p = state.persons.find(x => x.id === personId);
  if (!p) {
    advisorSay("此人已不在宗族之書中。");
    return;
  }
  state.selectedPersonId = p.id;
  if (p.familyId) state.selectedFamilyId = p.familyId;
  // 重繪
  renderFamilies();
  renderFamilyDetail();
  renderPersonDetail();
  // 滾動到人物詳情頂部
  const detailEl = document.getElementById("personDetail");
  if (detailEl && detailEl.scrollIntoView) {
    detailEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

// 阿拉伯數字轉中文大寫(用於代數標題:第 一 代 / 第 十二 代)
// 支援 0-99,99 代以上回傳原數字
function toChineseNumeral(n) {
  if (typeof n !== "number" || isNaN(n)) return String(n);
  if (n < 0) return String(n);
  if (n > 99) return String(n);  // 99 代之後罕見, 直接用阿拉伯

  const digits = ["零","一","二","三","四","五","六","七","八","九"];
  if (n < 10) return digits[n];
  if (n === 10) return "十";
  if (n < 20) return "十" + digits[n - 10];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return digits[tens] + "十" + (ones === 0 ? "" : digits[ones]);
}

// v6:HTML 字串轉義,避免使用者輸入的備註打壞畫面或被當作標籤執行。
// 同時把換行符換成 <br> 以保留段落感。
function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br>");
}

