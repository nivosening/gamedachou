// time.js
// 年份推進、年齡計算、死亡檢查
// v3:setGameYear 在「年份遞增」時觸發 advanceYear (自然生育、年史)

// ---------- 顯示 ----------

function updateYearViews() {
  $("worldYearDisplay").textContent = "星曆 " + state.gameYear + " 年";
  $("timelineYear").textContent = "星曆 " + state.gameYear + " 年";
}

// ---------- 年份設定 ----------
// 注意:setGameYear 是低階 API,直接賦值。
// 玩家按「+1 年」時應該走 advanceYear,才會觸發年度事件。

function setGameYear(y) {
  let year = Number(y);
  if (Number.isNaN(year)) return;
  if (year < 1) year = 1;
  state.gameYear = year;
  checkDeathsAndNotify();
  saveState();
  updateYearViews();
  renderFamilies();
  renderFamilyDetail();
  renderPersonDetail();
  renderRegions();
  renderOptionOverview();
}

// 進階版:玩家點 +1 年時用這個, 處理自然生育與年史
function advanceYear() {
  state.gameYear += 1;

  // 1. 死亡檢查(原本就有)
  const deaths = collectDeathsThisYear();

  // 2. 自然生育(已婚 + 女性 < 45 歲 + 15% 機率)
  const births = naturalBirthsThisYear();

  // 3. 寫入年史
  deaths.forEach(d => recordChronicle({
    year: state.gameYear, kind: "death", personId: d.id, name: d.name, age: d.age
  }));
  births.forEach(b => recordChronicle({
    year: state.gameYear, kind: "birth", personId: b.id, name: b.name, motherId: b.motherId, fatherId: b.fatherId
  }));

  // 4. 年末回報
  reportYearEnd(deaths, births);

  // 5. 同步 UI
  saveState();
  updateYearViews();
  renderFamilies();
  renderFamilyDetail();
  renderPersonDetail();
  renderRegions();
  renderOptionOverview();
}

// 倒退一年(僅減年, 不回溯狀態)
function regressYear() {
  state.gameYear -= 1;
  if (state.gameYear < 1) state.gameYear = 1;
  saveState();
  updateYearViews();
  renderFamilies();
  renderFamilyDetail();
  renderPersonDetail();
  renderRegions();
  renderOptionOverview();
}

// ---------- 年齡 ----------

function getAge(person) {
  if (person.birthYear == null) return null;
  const ref = person.deceased && person.deathYear ? person.deathYear : state.gameYear;
  return ref - person.birthYear;
}

// ---------- 死亡 ----------

// 原本的「檢查死亡並 advisorSay」, 給 setGameYear 用
function checkDeathsAndNotify() {
  const newlyDead = collectDeathsThisYear();
  if (newlyDead.length) {
    let msg = `星曆 ${state.gameYear} 年,有 ${newlyDead.length} 位族人辭世:`;
    msg += newlyDead.map(d => {
      if (d.age != null) return `${d.name}(享年 ${d.age} 歲,卒於星曆 ${d.year} 年)`;
      return `${d.name}(卒於星曆 ${d.year} 年)`;
    }).join("、") + "。";
    advisorSay(msg);
  }
}

// 收集本年新逝者, 不另外 advisorSay (給 advanceYear 用, 由 reportYearEnd 統一回報)
function collectDeathsThisYear() {
  const newlyDead = [];
  state.persons.forEach(p => {
    if (!p.deceased && p.deathYear && p.deathYear <= state.gameYear) {
      p.deceased = true;
      const age = getAge(p);
      newlyDead.push({ id: p.id, name: p.name, year: p.deathYear, age });
    }
  });
  return newlyDead;
}

// ---------- 自然生育 ----------

function naturalBirthsThisYear() {
  const births = [];
  const candidates = state.persons.filter(p => {
    if (p.deceased) return false;
    if (p.gender !== "女") return false; // 由「能孕者」一方計算機率
    if (!p.spouseIds || p.spouseIds.length === 0) return false;
    // 至少有一位健在的配偶
    const livingSpouse = p.spouseIds.some(sid => {
      const sp = findPerson(sid);
      return sp && !sp.deceased;
    });
    if (!livingSpouse) return false;
    const age = getAge(p);
    if (age == null) return false;
    return age >= 16 && age < 45;
  });

  candidates.forEach(mother => {
    if (Math.random() < 0.15) {
      // 找一位健在配偶當父親(優先異性)
      const livingSpouses = mother.spouseIds
        .map(sid => findPerson(sid))
        .filter(sp => sp && !sp.deceased);
      if (!livingSpouses.length) return;
      // 優先選異性
      const males = livingSpouses.filter(sp => sp.gender === "男");
      const father = males.length ? pickRandom(males) : pickRandom(livingSpouses);

      const baby = addPerson({
        name: generateGivenName(),
        gender: Math.random() < 0.5 ? "男" : "女",
        role: "嫡支子女",
        familyId: mother.familyId,
        occupation: "",
        residence: "",
        ageOrBirthInput: String(state.gameYear),
        notes: ""
      });
      if (!baby) return;

      // 接上父母
      linkParentChild(mother, baby, {});
      if (father && father.id !== mother.id) {
        linkParentChild(father, baby, {});
      }
      normalizeRelations();
      births.push({ id: baby.id, name: baby.name, motherId: mother.id, fatherId: father ? father.id : null });
    }
  });
  return births;
}

// ---------- 年末回報 ----------

function reportYearEnd(deaths, births) {
  const lines = [];
  if (deaths.length) {
    const txt = deaths.map(d => d.age != null ? `${d.name}(享年 ${d.age})` : d.name).join("、");
    lines.push(`本年辭世者 ${deaths.length} 位:${txt}。`);
  }
  if (births.length) {
    const txt = births.map(b => {
      const mom = findPerson(b.motherId);
      return mom ? `${mom.name}誕下${b.name}` : `${b.name}降生`;
    }).join("、");
    lines.push(`本年添丁者 ${births.length} 位:${txt}。`);
  }
  if (!lines.length) {
    advisorSay(`星曆 ${state.gameYear} 年,天下尚屬平靜。`);
  } else {
    advisorSay(`星曆 ${state.gameYear} 年 — ` + lines.join(" "));
  }
}

// ---------- 年齡 / 出生年輸入處理 ----------

function processAgeOrBirthInput(input) {
  if (!input) return null;
  const v = (input || "").trim();
  const num = Number(v);
  if (Number.isNaN(num) || num <= 0) return null;
  if (num < 150) {
    const age = Math.round(num);
    return state.gameYear - age;
  } else {
    return Math.round(num);
  }
}
