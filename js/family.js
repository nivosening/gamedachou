// family.js
// 家族與人物建立、隨機生成、子女/父母模式

// ---------- 家族 & 人物 ----------
function getFamilyNameById(id) {
  if (!id) return "";
  const f = state.families.find(x => x.id === id);
  return f ? f.name : "";
}

function addFamily(data) {
  const terrName = ensureTerritoryForRegion(data.territory, data.regionId);
  if (terrName === null) return null;

  const f = {
    id: state.nextFamilyId++,
    name: data.name.trim(),
    origin: data.origin || "",
    regionId: data.regionId || "",
    territory: terrName || "",
    notes: data.notes || "",
    standing: data.standing || "尋常人家",  // v6+:家族門第
    allies: []         // v3 新增:盟友家族 ID 列表
  };
  state.families.push(f);
  saveState();
  renderFamilies();
  renderFamilyOptions();
  renderRegions();
  renderOptionOverview();
  renderAdvisorLocationSelect();
  advisorSay(`已將「${f.name}」記入宗族之書。`);
  return f;
}

function renderFamilyOptions() {
  const sel = $("personFamily");
  sel.innerHTML = "";
  const def = document.createElement("option");
  def.value = "";
  def.textContent = "未歸宗族";
  sel.appendChild(def);
  state.families.forEach(f => {
    const opt = document.createElement("option");
    opt.value = String(f.id);
    opt.textContent = (typeof getFamilyDisplayName === "function")
      ? getFamilyDisplayName(f)
      : f.name;
    sel.appendChild(opt);
  });
}

function addPerson(data) {
  // 使用新的處理函數來獲得 birthYear
  const birthYear = processAgeOrBirthInput(data.ageOrBirthInput);

  const p = {
    id: state.nextPersonId++,
    name: data.name.trim(),
    birthYear: birthYear, // 已處理的 birthYear
    gender: data.gender || "",
    role: data.role || "",
    familyId: data.familyId || null,
    occupation: data.occupation || "",
    residence: data.residence || "",
    notes: data.notes || "",
    spouseIds: [],
    spouseRelations: [],
    parentIds: [],
    childIds: [],
    deathYear: data.deathYear || null,
    deceased: false,
    appointments: []   // v7+:名位卷宗 — 此人擔任的職位列表
  };

  // === 自動生成預期壽命（自然壽命模型） ===
function generateRandomLifespan() {
  const r = Math.random();

  if (r < 0.05) return Math.floor(30 + Math.random() * 20);  // 30–50 夭折/短壽
  if (r < 0.85) return Math.floor(55 + Math.random() * 30);  // 55–85 常見壽命
  return Math.floor(86 + Math.random() * 20);                 // 86–105 高壽
}

// 指定隨機壽命
p.lifespan = generateRandomLifespan();

// 若已知出生年，則計算死亡年份
if (p.birthYear && p.lifespan) {
  p.deathYear = p.birthYear + p.lifespan;

  // 若已過世（比遊戲年份還早），標記已逝
  if (p.deathYear <= state.gameYear) {
    p.deceased = true;
  }
}


  if (state.childModeParentId) {

  const parent = state.persons.find(x => x.id === state.childModeParentId);

  if (parent) {

    // 第一位父母連結
    linkParentChild(parent, p, { ignoreRule: false });

    // 取得可選的第二位父母（配偶）
    const spouseList = (parent.spouseIds || [])
      .map(id => state.persons.find(pp => pp.id === id))
      .filter(Boolean);

    // 立即彈出視窗
    openParentSelectDialog(p, parent, spouseList);
  }
}

// ===== 父母建立模式 =====
if (state.parentModeChildId) {
  const child = findPerson(state.parentModeChildId);

  if (child) {
    // 若建立的人性別還沒設定，補上按鈕選的性別
    if (!p.gender && state.parentModeGender) {
      p.gender = state.parentModeGender;
    }

    // 設定父母
    if (!child.parentIds.includes(p.id)) child.parentIds.push(p.id);

    // 設定子女
    if (!p.childIds.includes(child.id)) p.childIds.push(child.id);

    advisorSay(
      `已為「${child.name}」新增${state.parentModeGender === "男" ? "父親" : "母親"}「${p.name}」。`
    );
  }

  // 清除模式（保持 UI 乾淨）
  state.parentModeChildId = null;
  state.parentModeGender = null;

  const btn = $("cancelChildModeBtn");
  btn.style.display = "none";
  btn.textContent = "取消以此人為父母建立子女";
}





  state.persons.push(p);
  state.childModeParentId = null;
  normalizeRelations();
  saveState();
  renderFamilies();
  renderFamilyDetail();
  state.selectedPersonId = p.id;
  renderPersonDetail();
  renderAdvisorLocationSelect();
  exitChildModeUI();
  const famName = p.familyId ? (state.families.find(f => f.id === p.familyId)?.name || "未知家族") : "未歸宗族";
  advisorSay(`已錄入新族人「${p.name}」,暫歸屬「${famName}」。`);
  return p;   // v3 新增:回傳新人物參考, 供自然生育/事件領養使用
}

function exitChildModeUI() {
  state.childModeParentId = null;
  $("personParentId").value = "";
  $("cancelChildModeBtn").style.display = "none";
}

function enterChildMode(personId) {
  state.childModeParentId = personId;
  $("personParentId").value = String(personId);
  $("cancelChildModeBtn").style.display = "inline-block";
  const p = state.persons.find(x => x.id === personId);
  if (p) advisorSay(`已以「${p.name}」為父母建立子女。`);
}

function enterParentMode(childId, gender) {
  state.parentModeChildId = childId;
  state.parentModeGender = gender;

  const cancelBtn = $("cancelChildModeBtn");
  cancelBtn.style.display = "inline-block";
  cancelBtn.textContent = "取消以此人為子女建立父母";

  advisorSay(
    `已啟用建立父母模式。新增的人物將成為「${findPerson(childId).name}」的${gender === "男" ? "父親" : "母親"}。`
  );
}


function generateGivenName() {
  const a = pickRandom(GIVEN_NAME_PARTS) || "";
  const b = Math.random() < 0.6 ? "" : (pickRandom(GIVEN_NAME_PARTS) || "");
  const n = a + b;
  return n || "某";
}

function quickCreateFamily(data) {
  const surname = (data.surname || "").trim();
  if (!surname) {
    alert("請輸入家族姓氏。");
    return;
  }
  const count = Number(data.count);
  const minAge = Number(data.minAge);
  const maxAge = Number(data.maxAge);
  if (!count || count <= 0) {
    alert("人數需大於 0。");
    return;
  }
  if (Number.isNaN(minAge) || Number.isNaN(maxAge) || maxAge < minAge) {
    alert("請正確填寫年齡區間。");
    return;
  }

  const regionId = data.regionId || "";
  const terrName = data.territory ? ensureTerritoryForRegion(data.territory, regionId) : "";
  if (terrName === null) return;

  const familyName = surname + "氏家族";
  const family = addFamily({
    name: familyName,
    origin: data.origin || "",
    regionId,
    territory: terrName || "",
    notes: ""
  });
  if (!family) return;

  const usedNames = new Set(state.persons.map(p => p.name));
  const members = [];

  function uniqueName() {
    let n, safe = 0;
    do {
      n = surname + generateGivenName();
      safe++;
      if (safe > 200) break;
    } while (usedNames.has(n));
    usedNames.add(n);
    return n;
  }

  for (let i = 0; i < count; i++) {
    const age = randomInt(minAge, maxAge);
    const birthYear = age != null ? state.gameYear - age : null;
    const gender = Math.random() < 0.5 ? "男" : "女";
    let role = "";
    if (i === 0) role = "家主";
    else if (age != null && age <= 18) role = Math.random() < 0.5 ? "嫡支子女" : "庶出子女";
    else role = pickRandom(["旁系宗親", "庶出子女", ""]) || "";

    const occ = pickRandom(state.occOptions) || "";
    const res = pickRandom(state.resOptions) || "";
    let deathYear = null;
    if (birthYear != null) {
      let life = randomInt(45, 85);
      if (life == null) life = 60;
      deathYear = birthYear + life;
      if (deathYear <= state.gameYear) {
        // 為了快速建立時保證所有人物皆為在世狀態，將死亡年份推遲到未來
        deathYear = state.gameYear + randomInt(1, 30);
      }
    }
    members.push({
      id: state.nextPersonId++,
      name: uniqueName(),
      birthYear,
      gender,
      role,
      familyId: family.id,
      occupation: occ,
      residence: res,
      notes: "由快速建立功能生成，性格與命格尚待家主補完。",
      spouseIds: [],
      spouseRelations: [],
      parentIds: [],
      childIds: [],
      deathYear,
      deceased: false
    });
  }

  members.sort((a,b) => {
    const aa = a.birthYear != null ? a.birthYear : 0;
    const bb = b.birthYear != null ? b.birthYear : 0;
    return aa - bb;
  });
  const firstGenCount = Math.min(3, members.length);
  for (let i = firstGenCount; i < members.length; i++) {
    const child = members[i];
    if (child.birthYear == null) continue;
    const candidates = members.filter(p => p.id !== child.id && p.birthYear != null && p.birthYear <= child.birthYear - 16);
    if (!candidates.length) continue;
    const parent1 = pickRandom(candidates);
    linkParentChild(parent1, child, { ignoreRule: false, silent: true });
  }

  state.persons.push(...members);
  normalizeRelations();
  saveState();
  state.selectedFamilyId = family.id;
  state.selectedPersonId = null;
  renderFamilies();
  renderFamilyOptions();
  renderFamilyDetail();
  renderPersonDetail();
  renderAdvisorLocationSelect();
  renderRegions();
  renderOptionOverview();
  advisorSay(`已為「${family.name}」生成 ${count} 位成員，並安排父母子女關係（多為單親設定，婚配留待家主親自決斷）。`);
}

