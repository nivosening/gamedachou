// events.js
// 事件系統(婚姻、誕生、衝突、結盟、災異、繼承)
// v3:事件生成時把具體當事人寫入 pendingEvent.actors,
//    resolveEvent 真的會改變世界狀態(配偶、家族、領養、繼承等)

// ---------- 工具:候選池 ----------

// 找出某家族裡的「適齡未婚者」(18-30 歲、未婚、健在)
function findEligibleSinglesInFamily(familyId) {
  return state.persons.filter(p => {
    if (p.familyId !== familyId) return false;
    if (p.deceased) return false;
    if (p.spouseIds && p.spouseIds.length > 0) return false;
    const age = getAge(p);
    if (age == null) return false;
    return age >= 18 && age <= 30;
  });
}

// 找出全宗族裡的「適齡未婚者」, 可選排除某家族
function findEligibleSinglesGlobal(excludeFamilyId) {
  return state.persons.filter(p => {
    if (p.deceased) return false;
    if (p.spouseIds && p.spouseIds.length > 0) return false;
    if (excludeFamilyId != null && p.familyId === excludeFamilyId) return false;
    const age = getAge(p);
    if (age == null) return false;
    return age >= 18 && age <= 30;
  });
}

// ---------- 決策選項 ----------

function buildDecisionOptions(kind) {
  switch(kind) {
    case "marriage": return ["同意婚事,正式提親","暫緩觀望,先觀察局勢","婉拒此事,以免牽扯過深"];
    case "birth": return ["記錄此兆,準備迎接新生","視為流言,不予理會"];
    case "conflict": return ["出面調停,化解內鬥","袖手旁觀,任由矛盾發酵","暗中偏袒一方,藉機布局"];
    case "alliance": return ["主動推動結盟,互通有無","保持距離,維持友好但不深交"];
    case "disaster": return ["派遣族人與物資前往馳援","交由地方自理,不介入","趁亂整頓地方勢力"];
    case "inheritance": return ["指派明確繼承人,穩定局勢","任其自行角力,觀察勝負","分家處理,減少集中權力"];
    default: return ["記錄於宗族之書","暫不處理"];
  }
}

// ---------- 候選人/家族抽選 ----------

function pickFamilyByRegion(regionId) {
  let fams = state.families;
  if (regionId) {
    const inR = state.families.filter(f => f.regionId === regionId);
    if (inR.length) fams = inR;
  }
  return pickRandom(fams);
}

function pickPersonByRegion(regionId) {
  if (!state.persons.length) return null;
  if (!regionId) return pickRandom(state.persons);
  const fam = pickFamilyByRegion(regionId);
  if (!fam) return pickRandom(state.persons);
  const members = state.persons.filter(p => p.familyId === fam.id);
  return members.length ? pickRandom(members) : pickRandom(state.persons);
}

// ---------- 事件生成 ----------
// 每個 gen 函式回傳 { text, actors }
// actors 是事件涉及的人物/家族 ID, 供 resolveEvent 使用

function genMarriageEvent(regionId) {
  const localFams = regionId ? state.families.filter(f => f.regionId === regionId) : state.families;
  if (!localFams.length) return { text: "宗族尚無人家,談不上婚嫁。", actors: {} };

  let p1Pool = [];
  localFams.forEach(f => {
    p1Pool = p1Pool.concat(findEligibleSinglesInFamily(f.id));
  });
  if (!p1Pool.length) p1Pool = findEligibleSinglesGlobal();
  if (!p1Pool.length) return { text: "宗族中暫無適齡未婚者,婚事尚難議起。", actors: {} };

  const p1 = pickRandom(p1Pool);
  let p2Pool = findEligibleSinglesGlobal(p1.familyId).filter(p => p.id !== p1.id);
  const opposite = p2Pool.filter(p => p.gender && p1.gender && p.gender !== p1.gender);
  if (opposite.length) p2Pool = opposite;
  if (!p2Pool.length) return { text: "宗族中尚無與之般配者, 婚事擱置。", actors: {} };

  const p2 = pickRandom(p2Pool);
  const p1Fam = getFamilyNameById(p1.familyId) || "未歸宗族";
  const p2Fam = getFamilyNameById(p2.familyId) || "未歸宗族";
  const regionName = getRegionName(state.families.find(f => f.id === p1.familyId)?.regionId) || "某地";

  return {
    text: `${regionName}的「${p1Fam}」族人「${p1.name}」近來頗受注目, 「${p2Fam}」家透過媒人前來提親, 欲以「${p2.name}」為配, 結秦晉之好。`,
    actors: { person1Id: p1.id, person2Id: p2.id }
  };
}

function genBirthEvent(regionId) {
  const p1 = pickPersonByRegion(regionId);
  if (!p1) return { text: "宗族尚無族人,談不上添丁之喜。", actors: {} };
  const p1Fam = p1.familyId ? getFamilyNameById(p1.familyId) : "未歸宗族";
  const regionName = p1.familyId ? (getRegionName(state.families.find(f => f.id === p1.familyId)?.regionId) || "某地") : "某地";
  return {
    text: `${regionName}的「${p1Fam}」傳出有人誕下麟兒, 來歷不明, 求歸於宗族之下。家主可選擇是否收養, 或視作流言。`,
    actors: { adopterId: p1.id, adopterFamilyId: p1.familyId }
  };
}

function genConflictEvent(regionId) {
  const fam = pickFamilyByRegion(regionId);
  if (!fam) return { text: "民間傳聞有衝突發生, 但與宗族無直接關聯。", actors: {} };
  const regionName = getRegionName(fam.regionId) || "某地";
  const members = state.persons.filter(p => p.familyId === fam.id && !p.deceased);
  if (members.length < 2) return { text: `${regionName}的「${fam.name}」成員過少, 傳聞有內鬥, 但應屬虛言。`, actors: {} };
  const p1 = pickRandom(members);
  const p2 = pickRandom(members.filter(p => p.id !== p1.id));
  if (!p2) return { text: `${regionName}的「${fam.name}」成員過少, 傳聞有內鬥, 但應屬虛言。`, actors: {} };
  return {
    text: `${regionName}的「${fam.name}」族人「${p1.name}」與「${p2.name}」間爆發了嚴重的權力衝突, 隱有分家之兆。`,
    actors: { familyId: fam.id, person1Id: p1.id, person2Id: p2.id }
  };
}

function genAllianceEvent(regionId) {
  const fam = pickFamilyByRegion(regionId);
  if (!fam) return { text: "天下間有結盟之議,但與宗族無直接關聯。", actors: {} };
  const others = state.families.filter(f => f.id !== fam.id);
  if (!others.length) return { text: `${fam.name}孤立無援, 暫無結盟之機。`, actors: {} };
  const partner = pickRandom(others);
  const regionName = getRegionName(fam.regionId) || "某地";
  return {
    text: `${regionName}附近的「${fam.name}」, 與「${partner.name}」實力相當, 後者正探詢結盟可能。此舉將鞏固或動搖您家族的影響力。`,
    actors: { family1Id: fam.id, family2Id: partner.id }
  };
}

function genDisasterEvent(regionId) {
  const fam = pickFamilyByRegion(regionId);
  if (!fam) return { text: "有關災異的流言在民間蔓延,但尚無具體指向任何家族。", actors: {} };
  const regionName = getRegionName(fam.regionId) || "某地";
  return {
    text: `${regionName}一帶忽有災異, ${fam.territory || "其領地附近"}可能遭逢水患、瘟疫或盜匪四起。家主可考慮派員馳援, 或藉此整頓地方。`,
    actors: { familyId: fam.id, regionId: fam.regionId }
  };
}

function genInheritanceEvent(regionId) {
  if (!state.families.length) return { text: "宗族尚小,談不上繼承與分家。", actors: {} };
  const fam = pickFamilyByRegion(regionId);
  const regionName = fam ? (getRegionName(fam.regionId) || "某地") : "某地";
  const members = state.persons.filter(p => p.familyId === (fam ? fam.id : null) && !p.deceased);
  if (!members.length) return { text: `${regionName}的「${fam.name}」只有名號無後人, 繼承問題懸而未決。`, actors: {} };
  const elder = members.reduce((a, b) => (getAge(a) || 0) > (getAge(b) || 0) ? a : b);
  return {
    text: `${regionName}的「${fam.name}」中, 長者「${elder.name}」健康每況愈下, 家主之位與家產繼承的議題悄然浮上檯面。`,
    actors: { familyId: fam.id, elderId: elder.id }
  };
}

// ---------- 觸發事件 ----------

function triggerEvent(kindRaw) {
  let kind = kindRaw;
  if (kind === "random") {
    const arr = ["marriage","birth","conflict","alliance","disaster","inheritance"];
    kind = pickRandom(arr);
  }
  const regionId = $("eventRegion").value || "";

  let result;
  switch(kind) {
    case "marriage": result = genMarriageEvent(regionId); break;
    case "birth": result = genBirthEvent(regionId); break;
    case "conflict": result = genConflictEvent(regionId); break;
    case "alliance": result = genAllianceEvent(regionId); break;
    case "disaster": result = genDisasterEvent(regionId); break;
    case "inheritance": result = genInheritanceEvent(regionId); break;
    default: result = { text: "未知事件發生。", actors: {} };
  }

  pendingEvent = {
    kind,
    text: result.text,
    options: buildDecisionOptions(kind),
    actors: result.actors || {}
  };
  pendingEventKind = kind;

  const modal = $("eventModal");
  const eventText = $("eventText");
  const decisionSel = $("eventDecision");

  eventText.textContent = result.text;
  decisionSel.innerHTML = "";
  pendingEvent.options.forEach((opt, idx) => {
    const option = document.createElement("option");
    option.value = String(idx);
    option.textContent = opt;
    decisionSel.appendChild(option);
  });
  modal.classList.remove("hidden");
}

// ---------- 解決事件:真的會改變世界狀態 ----------

function resolveEvent() {
  const modal = $("eventModal");
  const decision = $("eventDecision").value;
  if (decision === "" || decision == null) {
    alert("請家主做出決定。");
    return;
  }
  const idx = Number(decision);
  const optionText = pendingEvent.options[idx];
  const kind = pendingEvent.kind;
  const actors = pendingEvent.actors || {};

  advisorSay(`家主決斷:「${optionText}」。`);

  recordChronicle({
    year: state.gameYear,
    kind: "event",
    eventKind: kind,
    decision: optionText,
    actors
  });

  let consequence = null;
  switch(kind) {
    case "marriage": consequence = resolveMarriage(idx, actors); break;
    case "birth": consequence = resolveBirth(idx, actors); break;
    case "conflict": consequence = resolveConflict(idx, actors); break;
    case "alliance": consequence = resolveAlliance(idx, actors); break;
    case "disaster": consequence = resolveDisaster(idx, actors); break;
    case "inheritance": consequence = resolveInheritance(idx, actors); break;
  }
  if (consequence) advisorSay(consequence);

  pendingEvent = null;
  pendingEventKind = null;
  modal.classList.add("hidden");

  saveState();
  renderFamilies();
  renderFamilyDetail();
  renderPersonDetail();
}

// ---------- 各事件的後果實作 ----------

function resolveMarriage(decisionIdx, actors) {
  if (decisionIdx !== 0) return null;
  const p1 = findPerson(actors.person1Id);
  const p2 = findPerson(actors.person2Id);
  if (!p1 || !p2) return "(欲議婚之兩人已不在世間, 此議作罷。)";

  if (!p1.spouseIds.includes(p2.id)) p1.spouseIds.push(p2.id);
  if (!p2.spouseIds.includes(p1.id)) p2.spouseIds.push(p1.id);

  const marryYear = state.gameYear;
  if (!p1.spouseRelations) p1.spouseRelations = [];
  if (!p2.spouseRelations) p2.spouseRelations = [];
  if (!p1.spouseRelations.find(r => r.id === p2.id)) {
    p1.spouseRelations.push({ id: p2.id, type: "平妻", marryYear });
  }
  if (!p2.spouseRelations.find(r => r.id === p1.id)) {
    p2.spouseRelations.push({ id: p1.id, type: "平妻", marryYear });
  }
  normalizeRelations();
  return `「${p1.name}」與「${p2.name}」於星曆 ${marryYear} 年結為連理。`;
}

function resolveBirth(decisionIdx, actors) {
  if (decisionIdx !== 0) return null;
  const adopter = findPerson(actors.adopterId);
  if (!adopter) return "(欲領養之家主已不在世間, 此議作罷。)";

  const baby = addPerson({
    name: generateGivenName(),
    gender: Math.random() < 0.5 ? "男" : "女",
    role: "嫡支子女",
    familyId: actors.adopterFamilyId,
    occupation: "",
    residence: "",
    ageOrBirthInput: String(state.gameYear),
    notes: "(事件領養)"
  });
  if (!baby) return "(領養失敗, 此議作罷。)";

  linkParentChild(adopter, baby, {});
  normalizeRelations();
  return `「${adopter.name}」收養新生兒「${baby.name}」(出生於本年), 入嫡支之列。`;
}

function resolveConflict(decisionIdx, actors) {
  const p1 = findPerson(actors.person1Id);
  const p2 = findPerson(actors.person2Id);
  const fam = state.families.find(f => f.id === actors.familyId);
  if (!fam) return "(該家族已不存在, 此事作罷。)";

  if (decisionIdx === 0) {
    return p1 && p2 ? `「${p1.name}」與「${p2.name}」的衝突在家主調停下暫得平息。` : null;
  }
  if (decisionIdx === 1) {
    return p1 && p2 ? `「${p1.name}」與「${p2.name}」的衝突日漸發酵, 家主未予干預。` : null;
  }
  if (decisionIdx === 2) {
    if (!p2) return "(欲分家者已不在世間, 此議作罷。)";
    const newFam = splitFamilyFor(p2, fam);
    return newFam
      ? `家主暗中支持「${p1.name}」, 「${p2.name}」自此另立門戶, 「${newFam.name}」於 ${getRegionName(newFam.regionId)} 自此別為一家。`
      : null;
  }
  return null;
}

function resolveAlliance(decisionIdx, actors) {
  if (decisionIdx !== 0) return null;
  const f1 = state.families.find(f => f.id === actors.family1Id);
  const f2 = state.families.find(f => f.id === actors.family2Id);
  if (!f1 || !f2) return "(其中一方家族已不存在, 結盟作罷。)";

  if (!f1.allies) f1.allies = [];
  if (!f2.allies) f2.allies = [];
  if (!f1.allies.includes(f2.id)) f1.allies.push(f2.id);
  if (!f2.allies.includes(f1.id)) f2.allies.push(f1.id);
  return `「${f1.name}」與「${f2.name}」自此結為盟友。`;
}

function resolveDisaster(decisionIdx, actors) {
  const fam = state.families.find(f => f.id === actors.familyId);
  if (!fam) return null;
  if (decisionIdx === 0) {
    const note = `星曆 ${state.gameYear} 年, 馳援 ${getRegionName(actors.regionId) || "本地"} 災情。`;
    fam.notes = fam.notes ? (fam.notes + " / " + note) : note;
    return `「${fam.name}」派員馳援, 史筆留名。`;
  }
  return null;
}

function resolveInheritance(decisionIdx, actors) {
  const fam = state.families.find(f => f.id === actors.familyId);
  if (!fam) return "(該家族已不存在, 繼承之議作罷。)";
  const elder = findPerson(actors.elderId);
  const members = state.persons.filter(p => p.familyId === fam.id && !p.deceased);

  if (decisionIdx === 0) {
    const heirs = members.filter(p => p.role === "嫡支子女");
    if (!heirs.length) {
      const all = members.filter(p => p.id !== (elder ? elder.id : null));
      if (!all.length) return "(無人可承襲, 此議擱置。)";
      const heir = all.reduce((a, b) => (getAge(a) || 0) > (getAge(b) || 0) ? a : b);
      heir.role = "家主(主君)";
      fam.headId = heir.id;
      return `「${fam.name}」立「${heir.name}」為新家主。`;
    }
    const heir = heirs.reduce((a, b) => (getAge(a) || 0) > (getAge(b) || 0) ? a : b);
    heir.role = "家主(主君)";
    fam.headId = heir.id;
    return `「${fam.name}」立嫡長「${heir.name}」為新家主。`;
  }
  if (decisionIdx === 1) {
    return `「${fam.name}」繼承權懸而未決, 內部暗潮洶湧。`;
  }
  if (decisionIdx === 2) {
    const sorted = members.filter(p => p.id !== (elder ? elder.id : null)).sort((a, b) => (getAge(b) || 0) - (getAge(a) || 0));
    if (sorted.length < 2) return `「${fam.name}」族中可分之人不足, 分家不成。`;
    const splitter = sorted[1];
    const newFam = splitFamilyFor(splitter, fam);
    return newFam ? `「${fam.name}」分出「${newFam.name}」一支, 由「${splitter.name}」執掌。` : null;
  }
  return null;
}

// ---------- 輔助:分家 ----------

function splitFamilyFor(person, oldFam) {
  if (!person || !oldFam) return null;
  const newName = person.name.charAt(0) + "氏旁支";
  const newFam = addFamily({
    name: newName,
    origin: oldFam.origin || "",
    regionId: oldFam.regionId || "",
    territory: oldFam.territory || "",
    notes: `自「${oldFam.name}」分支, 立於星曆 ${state.gameYear} 年。`
  });
  if (!newFam) return null;
  person.familyId = newFam.id;
  newFam.headId = person.id;
  return newFam;
}

// ---------- 年史記錄 ----------

function recordChronicle(entry) {
  if (!state.chronicle) state.chronicle = [];
  state.chronicle.push(entry);
}
