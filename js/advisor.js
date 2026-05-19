// advisor.js
// 輔佐官指令解析與所有 advisor 查詢/修改函式

// ---------- 輔佐官指令集 ----------

function findPersonsByName(name) {
  const k = (name || "").toLowerCase();
  return state.persons.filter(p => (p.name || "").includes(k));
}
function findFamiliesByName(name) {
  const k = (name || "").toLowerCase();
  return state.families.filter(f => (f.name || "").includes(k));
}
function findRegionsByName(name) {
  const k = (name || "").toLowerCase();
  return state.regions.filter(r => (r.name || "").includes(k) || (r.id || "").includes(k));
}
function findTerritoriesByName(name) {
  const k = (name || "").toLowerCase();
  return state.territoryOptions.filter(t => (t.name || "").includes(k));
}

function advisorWorldSummary() {
  const famCount = state.families.length;
  const totalPop = state.persons.length;
  const alivePop = state.persons.filter(p => !p.deceased).length;
  const regionCount = state.regions.length;
  const terrCount = state.territoryOptions.length;
  const year = state.gameYear;
  advisorSay(`目前是星曆 ${year} 年。宗族之書記載了 ${famCount} 個家族，共 ${totalPop} 位族人（在世 ${alivePop} 人）。天下劃分 ${regionCount} 個區域，共有 ${terrCount} 個據點。`);
}

function advisorSearchName(name) {
  const k = (name || "").trim();
  if (!k) { advisorSay("請指定人物姓名。"); return; }
  const list = findPersonsByName(k);
  if (!list.length) { advisorSay(`未找到名為「${k}」之人。`); return; }

  let msg = `名為「${k}」的人物共有 ${list.length} 位：`;
  msg += list.map(p => {
    const age = getAge(p);
    const famName = p.familyId ? (state.families.find(f => f.id === p.familyId)?.name || "未知家族") : "未歸宗族";
    let deceasedText = p.deceased ? "【已逝】" : "";
    return `${p.name}${deceasedText}（${famName}，${age != null ? age + '歲' : '年齡未記'}）`;
  }).join("、") + "。";
  advisorSay(msg);

  state.selectedPersonId = list[0].id;
  state.selectedFamilyId = list[0].familyId || null;
  renderFamilies();
  renderFamilyDetail();
  renderPersonDetail();
}

function advisorSearchFamily(name) {
  const k = (name || "").trim();
  if (!k) { advisorSay("請指定家族名稱。"); return; }
  const list = findFamiliesByName(k);
  if (!list.length) { advisorSay(`未找到名為「${k}」的家族。`); return; }

  let msg = `名為「${k}」或相關的家族共有 ${list.length} 個：`;
  msg += list.map(f => f.name).join("、") + "。";
  advisorSay(msg);

  state.selectedFamilyId = list[0].id;
  state.selectedPersonId = null;
  renderFamilies();
  renderFamilyDetail();
  renderPersonDetail();
}

function advisorSearchLocation(keyword) {
  const k = (keyword || "").trim();
  if (!k) { advisorSay("請指定區域或據點名稱。"); return; }

  const regions = findRegionsByName(k);
  const territories = findTerritoriesByName(k);

  // ====== ① 若搜尋的是「區域」 ======
  if (regions.length) {
    const r = regions[0];
    const families = state.families.filter(f => f.regionId === r.id);

    // 每個家族的人數統計
    let detail = "";
    if (families.length) {
      detail = families
        .map(f => {
          const count = state.persons.filter(p => p.familyId === f.id).length;
          return `「${f.name}」：${count} 人`;
        })
        .join("； ");
    } else {
      detail = "尚無家族在此區域活動。";
    }

    advisorSay(
      `區域「${r.name}」：${r.desc}\n` +
      `共有 ${families.length} 個家族活動。\n` +
      detail
    );

    if (families.length) {
      state.selectedFamilyId = families[0].id;
      state.selectedPersonId = null;
      renderFamilies();
      renderFamilyDetail();
    }
    return;
  }

  // ====== ② 若搜尋的是「據點」 ======
  if (territories.length) {
    const t = territories[0];
    const families = state.families.filter(f => f.territory === t.name);

    // 每家族人數
    let detail = "";
    if (families.length) {
      detail = families
        .map(f => {
          const count = state.persons.filter(p => p.familyId === f.id).length;
          return `「${f.name}」：${count} 人`;
        })
        .join("； ");
    } else {
      detail = "尚無家族在此據點活動。";
    }

    advisorSay(
      `據點「${t.name}」（位於 ${getRegionName(t.regionId) || "區域未定"}）\n` +
      `共有 ${families.length} 個家族在此據點。\n` +
      detail
    );

    if (families.length) {
      state.selectedFamilyId = families[0].id;
      state.selectedPersonId = null;
      renderFamilies();
      renderFamilyDetail();
    }
    return;
  }

  // ====== ③ 若不是區域也不是據點 → 嘗試搜尋包含名稱的家族或人物 ======
  const families = state.families.filter(
    f => f.name.includes(k) || (f.territory && f.territory.includes(k))
  );

  if (families.length) {
    const detail = families
      .map(f => {
        const count = state.persons.filter(p => p.familyId === f.id).length;
        return `「${f.name}」：${count} 人`;
      })
      .join("； ");

    advisorSay(`找到相關家族 ${families.length} 個：${detail}`);

    state.selectedFamilyId = families[0].id;
    state.selectedPersonId = null;
    renderFamilies();
    renderFamilyDetail();
    return;
  }

  advisorSay(`在宗族記錄中找不到與「${k}」相關的地點。`);
}


function advisorSearchAge(minAge, maxAge) {
  const a = Number(minAge), b = Number(maxAge);
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) { advisorSay("請正確填寫年齡區間。"); return; }

  const hits = state.persons.filter(p => {
    const age = getAge(p);
    if (age == null) return false;
    return age >= a && age <= b;
  });

  if (!hits.length) {
    advisorSay(`未找到年齡介於 ${a} 至 ${b} 歲的族人。`);
    return;
  }

  let msg = `年齡介於 ${a} 至 ${b} 歲的族人有 ${hits.length} 位：`;
  msg += hits.map(p => {
    const age = getAge(p);
    let deceasedText = p.deceased ? "【已逝】" : "";
    return `${p.name}${deceasedText}（${age}歲）`;
  }).join("、") + "。";
  advisorSay(msg);

  state.selectedPersonId = hits[0].id;
  state.selectedFamilyId = hits[0].familyId || null;
  renderFamilies();
  renderFamilyDetail();
  renderPersonDetail();
}

function advisorCheckLifespan(name) {
  const list = findPersonsByName(name);
  if (!list.length) { advisorSay(`未找到名為「${name}」之人，無法評估壽命。`); return; }
  const p = list[0];
  
  if (!p.deathYear) {
    advisorSay(`「${p.name}」尚未標記預期死亡年份，可透過指令「改人物死亡年份 姓名 年份」設定。`);
    state.selectedPersonId = p.id;
    state.selectedFamilyId = p.familyId || null;
    renderFamilies();
    renderFamilyDetail();
    renderPersonDetail();
    return;
  }
  
  const age = p.birthYear != null ? (p.deathYear - p.birthYear) : null;
  if (age != null) advisorSay(`依目前記錄，「${p.name}」預計卒於星曆 ${p.deathYear} 年，約享年 ${age} 歲。`);
  else advisorSay(`依目前記錄，「${p.name}」預計卒於星曆 ${p.deathYear} 年，具體享年尚不可知。`);
  
  state.selectedPersonId = p.id;
  state.selectedFamilyId = p.familyId || null;
  renderFamilies();
  renderFamilyDetail();
  renderPersonDetail();
}

function handleAdvisorCommand(cmd) {
  const text = (cmd || "").trim();
  const input = $("advisorCommand");
  if (!text) {
    advisorSay("家主若有吩咐，請直接在此處說明。");
    return;
  }
  userSay(text);

  let m;

  if (text === "總覽" || text === "天下總覽") {
    advisorWorldSummary();
    input.value = "";
    return;
  }

  // === v3 新增指令 ===

  // 本年大事 / 近年大事
  if (text === "本年大事" || text === "今年大事") {
    advisorReportChronicleYear(state.gameYear);
    input.value = "";
    return;
  }
  m = text.match(/^近\s*(\d+)\s*年大事$/);
  if (m) {
    advisorReportChronicleRecent(Number(m[1]));
    input.value = "";
    return;
  }

  // 查盟友 家族名
  m = text.match(/^查盟友\s+(.+)$/);
  if (m) {
    advisorListAllies(m[1].trim());
    input.value = "";
    return;
  }

  // 查可婚配 家族名
  m = text.match(/^查可婚配\s+(.+)$/);
  if (m) {
    advisorListEligibleSingles(m[1].trim());
    input.value = "";
    return;
  }

  // 建議 家族名 — 觀察該家族現況
  m = text.match(/^建議\s+(.+)$/);
  if (m) {
    advisorAdviseFamily(m[1].trim());
    input.value = "";
    return;
  }

  // 模糊查詢:單純「查 xxx」, 同時搜人/家族/地
  m = text.match(/^查\s+(.+)$/);
  if (m) {
    advisorFuzzyLookup(m[1].trim());
    input.value = "";
    return;
  }

  // === 既有指令 ===

  m = text.match(/^查人\s+(.+)$/);
  if (m) {
    advisorSearchName(m[1]);
    input.value = "";
    return;
  }

  m = text.match(/^查地\s+(.+)$/);
  if (m) {
    advisorSearchLocation(m[1]);
    input.value = "";
    return;
  }
  
  m = text.match(/^查家族\s+(.+)$/);
  if (m) {
    advisorSearchFamily(m[1]);
    input.value = "";
    return;
  }

  m = text.match(/^查年齡\s+(\d+)\s+到\s+(\d+)$/);
  if (m) {
    advisorSearchAge(m[1], m[2]);
    input.value = "";
    return;
  }

  m = text.match(/^查壽命\s+(.+)$/);
  if (m) {
    advisorCheckLifespan(m[1]);
    input.value = "";
    return;
  }

    // 查詢未歸宗族
  if (text === "查未歸宗族") {
    const list = state.persons.filter(p => !p.familyId);

    if (!list.length) {
      advisorSay("目前沒有未歸宗族的人物。");
      input.value = "";
      return;
    }

    let msg = `共有 ${list.length} 位族人尚未隸屬任何家族：`;
    msg += list.map(p => {
      const age = getAge(p);
      const deceased = p.deceased ? "【已逝】" : "";
      return `${p.name}${deceased}（${age != null ? age + '歲' : '年齡未記'}）`;
    }).join("、") + "。";

    advisorSay(msg);

    // 自動選中第一位
    const p = list[0];
    state.selectedPersonId = p.id;
    state.selectedFamilyId = null;
    renderFamilies();
    renderPersonDetail();

    input.value = "";
    return;
  }


  m = text.match(/^改家族據點\s+(\S+)\s+(\S+)$/);
  if (m) {
    const famName = m[1];
    const terrName = m[2];
    const families = findFamiliesByName(famName);
    if (!families.length) advisorSay(`未找到名為「${famName}」的家族。`);
    else {
      const fam = families[0];
      const terrObj = getTerritoryObj(terrName);
      let newRegionId = terrObj ? terrObj.regionId : fam.regionId;

      const terrResult = ensureTerritoryForRegion(terrName, newRegionId);
      if (terrResult === null) return;
      fam.territory = terrResult;
      if (terrObj && terrObj.regionId) fam.regionId = terrObj.regionId; // 同步區域

      saveState();
      renderFamilies();
      renderFamilyDetail();
      renderPersonDetail();
      renderRegions();
      renderOptionOverview();
      renderAdvisorLocationSelect();
      advisorSay(`已將「${fam.name}」據點改為「${terrName}」。`);
    }
    input.value = "";
    return;
  }

  m = text.match(/^改人物家族\s+(\S+)\s+(\S+)$/);
  if (m) {
    const name = m[1];
    const famName = m[2];
    const persons = findPersonsByName(name);
    if (!persons.length) advisorSay(`未找到名為「${name}」之人。`);
    else {
      const p = persons[0];
      if (famName === "無") {
        p.familyId = null;
        advisorSay(`已將「${p.name}」設為未歸宗族。`);
      } else {
        const fam = state.families.find(f => f.name === famName || f.name.includes(famName));
        if (!fam) advisorSay(`未找到名為「${famName}」的家族。`);
        else {
          p.familyId = fam.id;
          advisorSay(`已將「${p.name}」改隸屬於「${fam.name}」。`);
        }
      }
      saveState();
      state.selectedPersonId = p.id;
      state.selectedFamilyId = p.familyId || null;
      renderFamilies();
      renderFamilyDetail();
      renderPersonDetail();
    }
    input.value = "";
    return;
  }

  m = text.match(/^改人物死亡年份\s+(\S+)\s+(\d+)$/);
  if (m) {
      const name = m[1];
      const deathYear = Number(m[2]);
      const persons = findPersonsByName(name);
      if (!persons.length) {
          advisorSay(`未找到名為「${name}」之人。`);
      } else {
          const p = persons[0];
          const oldYear = p.deathYear;
          const oldDeceased = p.deceased;
          p.deathYear = deathYear;

          // 立即更新生死狀態
          if (!p.deceased && p.deathYear && p.deathYear <= state.gameYear) {
            p.deceased = true;
          } else if (p.deceased && p.deathYear && p.deathYear > state.gameYear) {
            p.deceased = false;
          }

          saveState();
          state.selectedPersonId = p.id;
          state.selectedFamilyId = p.familyId || null;
          renderFamilies();
          renderFamilyDetail();
          renderPersonDetail();

          let msg = `已將「${p.name}」的死亡年份從「${oldYear || '未定'}」改為「星曆 ${deathYear} 年」。`;
          if (oldDeceased !== p.deceased) {
              msg += p.deceased ? `該人物現已標記為「已逝」。` : `該人物現已標記為「在世」。`;
          }

          advisorSay(msg);
      }
      input.value = "";
      return;
  }

  m = text.match(/^加父母\s+(\S+)\s+(\S+)$/);
  if (m) {
    const childName = m[1];
    const parentName = m[2];
    const childs = findPersonsByName(childName);
    const parents = findPersonsByName(parentName);
    if (!childs.length) advisorSay(`未找到名為「${childName}」之子女。`);
    else if (!parents.length) advisorSay(`未找到名為「${parentName}」之父母候選。`);
    else {
      const child = childs[0];
      const parent = parents[0];
      if (linkParentChild(parent, child, { ignoreRule: false })) {
        saveState();
        advisorSay(`已將「${parent.name}」標記為「${child.name}」的父母之一。`);
        state.selectedPersonId = child.id;
        renderPersonDetail();
        renderFamilyDetail();
      }
    }
    input.value = "";
    return;
  }

  m = text.match(/^加子女\s+(\S+)\s+(\S+)$/);
  if (m) {
    const parentName = m[1];
    const childName = m[2];
    const parents = findPersonsByName(parentName);
    const childs = findPersonsByName(childName);
    if (!parents.length) advisorSay(`未找到名為「${parentName}」之父母。`);
    else if (!childs.length) advisorSay(`未找到名為「${childName}」之子女候選。`);
    else {
      const parent = parents[0];
      const child = childs[0];
      if (linkParentChild(parent, child, { ignoreRule: false })) {
        saveState();
        advisorSay(`已將「${parent.name}」標記為「${child.name}」的父母之一。`);
        state.selectedPersonId = parent.id;
        renderPersonDetail();
        renderFamilyDetail();
      }
    }
    input.value = "";
    return;
  }

  m = text.match(/^結為連理\s+(\S+)\s+(\S+)(?:\s+(.+))?$/);
  if (m) {
    const name1 = m[1];
    const name2 = m[2];
    const relType = m[3] || "婚配";
    const p1List = findPersonsByName(name1);
    const p2List = findPersonsByName(name2);

    if (!p1List.length) advisorSay(`未找到名為「${name1}」之人。`);
    else if (!p2List.length) advisorSay(`未找到名為「${name2}」之人。`);
    else {
      const p1 = p1List[0];
      const p2 = p2List[0];
      
      if (p1.id === p2.id) { advisorSay("不可與自己結為連理。"); input.value = ""; return; }
      if (p1.spouseIds.includes(p2.id)) { advisorSay("兩人已結為連理。"); input.value = ""; return; }

      if (!p1.spouseIds.includes(p2.id)) p1.spouseIds.push(p2.id);
      if (!p2.spouseIds.includes(p1.id)) p2.spouseIds.push(p1.id);

      let p1Rel = p1.spouseRelations.find(r => r.id === p2.id);
      if (!p1Rel) { p1Rel = { id: p2.id, type: relType }; p1.spouseRelations.push(p1Rel); }
      else p1Rel.type = relType;
      let p2Rel = p2.spouseRelations.find(r => r.id === p1.id);
      if (!p2Rel) { p2Rel = { id: p1.id, type: relType }; p2.spouseRelations.push(p2Rel); }
      else p2Rel.type = relType;

      saveState();
      state.selectedPersonId = p1.id;
      renderPersonDetail();
      renderFamilyDetail();
      advisorSay(`已為「${p1.name}」與「${p2.name}」訂下婚約（${relType}）。`);
    }
    input.value = "";
    return;
  }
  
  advisorSay("家主所言甚是，但此處並無對應的指令。請參考指令集。");
  input.value = "";
}


// ============================================================
// v3 新增:指令實作
// ============================================================

// ---------- 本年大事 / 近年大事 ----------

function advisorReportChronicleYear(year) {
  const entries = (state.chronicle || []).filter(e => e.year === year);
  if (!entries.length) {
    advisorSay(`星曆 ${year} 年,並無大事入冊。`);
    return;
  }
  const lines = entries.map(formatChronicleEntry);
  advisorSay(`星曆 ${year} 年大事 — \n` + lines.map(l => "  · " + l).join("\n"));
}

function advisorReportChronicleRecent(n) {
  if (!Number.isFinite(n) || n <= 0) {
    advisorSay("家主請明示欲查幾年之事。");
    return;
  }
  const fromY = state.gameYear - n + 1;
  const entries = (state.chronicle || []).filter(e => e.year >= fromY && e.year <= state.gameYear);
  if (!entries.length) {
    advisorSay(`星曆 ${fromY} 至 ${state.gameYear} 年,並無大事入冊。`);
    return;
  }
  // 按年份分組
  const byYear = {};
  entries.forEach(e => { (byYear[e.year] = byYear[e.year] || []).push(e); });
  const years = Object.keys(byYear).map(Number).sort((a, b) => a - b);
  const blocks = years.map(y => {
    const lines = byYear[y].map(formatChronicleEntry);
    return `【星曆 ${y} 年】\n` + lines.map(l => "  · " + l).join("\n");
  });
  advisorSay(`近 ${n} 年大事 —\n` + blocks.join("\n"));
}

function formatChronicleEntry(e) {
  if (e.kind === "death") {
    return `${e.name}辭世` + (e.age != null ? ` (享年 ${e.age})` : "");
  }
  if (e.kind === "birth") {
    const mom = e.motherId ? findPerson(e.motherId) : null;
    return mom ? `${mom.name}誕下${e.name}` : `${e.name}降生`;
  }
  if (e.kind === "event") {
    const kindName = {
      marriage: "聯姻", birth: "誕生", conflict: "內鬥",
      alliance: "結盟", disaster: "災異", inheritance: "繼承"
    }[e.eventKind] || e.eventKind;
    return `事件(${kindName}) — 家主決斷:「${e.decision}」`;
  }
  return JSON.stringify(e);
}

// ---------- 查盟友 ----------

function advisorListAllies(name) {
  const fams = findFamiliesByName(name);
  if (!fams.length) {
    advisorSay(`未找到名為「${name}」的家族。`);
    return;
  }
  const lines = fams.map(f => {
    const allyIds = f.allies || [];
    if (!allyIds.length) return `「${f.name}」尚無盟友。`;
    const allyNames = allyIds.map(id => {
      const ally = state.families.find(ff => ff.id === id);
      return ally ? ally.name : `(已不存在 #${id})`;
    }).join("、");
    return `「${f.name}」之盟友:${allyNames}。`;
  });
  advisorSay(lines.join("\n"));
}

// ---------- 查可婚配 ----------

function advisorListEligibleSingles(name) {
  const fams = findFamiliesByName(name);
  if (!fams.length) {
    advisorSay(`未找到名為「${name}」的家族。`);
    return;
  }
  const lines = fams.map(f => {
    const singles = state.persons.filter(p => {
      if (p.familyId !== f.id) return false;
      if (p.deceased) return false;
      if (p.spouseIds && p.spouseIds.length > 0) return false;
      const age = getAge(p);
      if (age == null) return false;
      return age >= 18 && age <= 30;
    });
    if (!singles.length) return `「${f.name}」中無 18-30 歲未婚者。`;
    const txt = singles.map(p => `${p.name}(${p.gender || "性別未記"},${getAge(p)} 歲)`).join("、");
    return `「${f.name}」中適齡未婚者 ${singles.length} 位:${txt}。`;
  });
  advisorSay(lines.join("\n"));
}

// ---------- 建議:觀察家族現況 ----------

function advisorAdviseFamily(name) {
  const fams = findFamiliesByName(name);
  if (!fams.length) {
    advisorSay(`未找到名為「${name}」的家族, 無從建議。`);
    return;
  }
  const f = fams[0];
  const members = state.persons.filter(p => p.familyId === f.id && !p.deceased);
  const observations = [];

  // 觀察 1:有無後嗣?
  const youngsters = members.filter(p => {
    const age = getAge(p);
    return age != null && age < 18;
  });
  if (members.length === 0) {
    observations.push("此族已無在世族人, 名存實亡。");
  } else if (youngsters.length === 0) {
    observations.push(`此族在世 ${members.length} 人, 但無 18 歲以下之後嗣, 香火堪憂。`);
  } else {
    observations.push(`此族在世 ${members.length} 人, 內有 ${youngsters.length} 位幼齡, 後嗣尚可。`);
  }

  // 觀察 2:家主年歲?
  let head = null;
  if (f.headId) head = findPerson(f.headId);
  if (!head) {
    // 找一位「家主(主君)」角色
    head = members.find(p => (p.role || "").includes("家主"));
  }
  if (head) {
    const age = getAge(head);
    if (age != null && age >= 60) {
      observations.push(`家主「${head.name}」年逾耳順 (${age} 歲), 宜及早規劃繼承。`);
    } else if (age != null) {
      observations.push(`家主「${head.name}」現年 ${age} 歲, 春秋鼎盛。`);
    }
  } else {
    observations.push("此族暫無明確家主, 內部恐生角力。");
  }

  // 觀察 3:盟友?
  const allies = f.allies || [];
  if (!allies.length) {
    observations.push("此族尚無盟友, 孤立難久。");
  } else {
    observations.push(`此族盟友 ${allies.length} 家, 互為奧援。`);
  }

  // 觀察 4:適齡未婚?
  const singles = members.filter(p => {
    if (p.spouseIds && p.spouseIds.length > 0) return false;
    const age = getAge(p);
    return age != null && age >= 18 && age <= 30;
  });
  if (singles.length) {
    observations.push(`族內有 ${singles.length} 位 18-30 歲未婚者, 可詢適婚之家。`);
  }

  advisorSay(`【關於「${f.name}」的觀察】\n` + observations.map(o => "  · " + o).join("\n"));
}

// ---------- 模糊查詢:單純「查 xxx」, 同時搜人/家族/地 ----------

function advisorFuzzyLookup(keyword) {
  const persons = findPersonsByName(keyword);
  const fams = findFamiliesByName(keyword);
  const regions = findRegionsByName(keyword);
  const territories = findTerritoriesByName(keyword);

  if (!persons.length && !fams.length && !regions.length && !territories.length) {
    advisorSay(`未在宗族之書中尋得「${keyword}」相關記載。`);
    return;
  }

  const lines = [];
  if (persons.length) {
    lines.push(`人物:${persons.map(p => `${p.name}(${p.gender || "?"},${getAge(p) ?? "?"} 歲)`).join("、")}`);
  }
  if (fams.length) {
    lines.push(`家族:${fams.map(f => `${f.name}(${getRegionName(f.regionId) || "?"})`).join("、")}`);
  }
  if (regions.length) {
    lines.push(`區域:${regions.map(r => r.name).join("、")}`);
  }
  if (territories.length) {
    lines.push(`據點:${territories.map(t => `${t.name}(${getRegionName(t.regionId) || "?"})`).join("、")}`);
  }
  advisorSay(`「${keyword}」在宗族之書中的相關記載 —\n` + lines.map(l => "  · " + l).join("\n"));
}
