// init.js
// 初始化、DOM 事件綁定、第二父母選擇對話框

// ---------- 初始化與事件綁定 ----------

function init() {
  loadState();
  updateYearViews();
  renderRegionSelects();
  renderOptionSelects();
  renderFamilyOptions();
  renderFamilies();
  renderFamilyDetail();
  renderPersonDetail();
  renderRegions();
  renderOptionOverview();

  // v7+:從大周名位卷宗跳轉回來時, 自動選中該人物
  const jumpId = localStorage.getItem("dazhou_jumpToPerson");
  if (jumpId) {
    localStorage.removeItem("dazhou_jumpToPerson");
    const pid = Number(jumpId);
    const p = state.persons.find(x => x.id === pid);
    if (p) {
      state.selectedFamilyId = p.familyId || null;
      state.selectedPersonId = p.id;
      saveState();
      renderFamilies();
      renderFamilyDetail();
      renderPersonDetail();
      // 滾動到人物詳情區塊
      setTimeout(() => {
        document.getElementById("personDetail")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  init();

  const optBox = $("optionOverview");
  if (optBox) {
    optBox.addEventListener("click", e => {
      const t = e.target;
      if (!t) return;
      handleOptionEditClick(t);
    });
  }

  $("familyForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("familyName").value;
    if (!name.trim()) {
      alert("請輸入家族名稱。");
      return;
    }
    const data = {
      name,
      origin: $("familyOrigin").value,
      regionId: $("familyRegion").value,
      territory: $("familyTerritory").value,
      notes: $("familyNotes").value.trim(),
      standing: $("familyStanding").value
    };
    addFamily(data);
    $("familyForm").reset();
    // 重置後重填預設值
    const standingSel = $("familyStanding");
    if (standingSel) standingSel.value = "尋常人家";
  });

  $("addOriginBtn").addEventListener("click", () => {
    addOrigin($("newOrigin").value);
    $("newOrigin").value = "";
  });
  
  const rBtn = document.getElementById("addRoleBtn");
  if(rBtn) rBtn.onclick = () => addRole(document.getElementById("newRole").value);
  const oBtn = document.getElementById("addOccBtn");
  if(oBtn) oBtn.onclick = () => addOcc(document.getElementById("newOcc").value);
  const resBtn = document.getElementById("addResBtn");
  if(resBtn) resBtn.onclick = () => addRes(document.getElementById("newRes").value);

  $("addTerritoryBtn").addEventListener("click", () => {
    const v = $("newTerritory").value;
    const regionId = $("familyRegion").value || $("quickRegion").value;
    addTerritory(v, regionId);
    $("newTerritory").value = "";
  });

  $("quickFamilyForm").addEventListener("submit", e => {
    e.preventDefault();
    quickCreateFamily({
      surname: $("quickSurname").value,
      count: $("quickCount").value,
      minAge: $("quickAgeMin").value,
      maxAge: $("quickAgeMax").value,
      origin: $("quickOrigin").value,
      regionId: $("quickRegion").value,
      territory: $("quickTerritory").value
    });
    $("quickFamilyForm").reset();
  });

  $("personForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("personName").value;
    if (!name.trim()) {
      alert("請輸入姓名。");
      return;
    }
    
    // 處理新的年齡/出生年份輸入欄位
    const ageOrBirthInput = $("personAgeOrBirth").value;

    const familyId = $("personFamily").value ? Number($("personFamily").value) : null;
    addPerson({
      name,
      ageOrBirthInput, // 使用新的輸入欄位
      gender: $("personGender").value,
      role: $("personRole").value,
      familyId,
      occupation: $("personOcc").value,
      residence: $("personRes").value,
      notes: $("personNotes").value.trim()
    });
    $("personForm").reset();
  });

 $("cancelChildModeBtn").addEventListener("click", () => {
    state.childModeParentId = null;
    state.parentModeChildId = null;
    state.parentModeGender = null;

    const btn = $("cancelChildModeBtn");
    btn.style.display = "none";
    btn.textContent = "取消以此人為父母建立子女";

    advisorSay("已取消建立子女或父母模式。");
});


  $("yearMinusBtn").addEventListener("click", () => regressYear());
  $("yearPlusBtn").addEventListener("click", () => advanceYear());

  $("exportBtn").addEventListener("click", exportGame);
  $("importBtn").addEventListener("click", () => $("importFile").click());
  $("importFile").addEventListener("change", (e) => importGame(e.target.files[0]));
  $("resetBtn").addEventListener("click", resetGame);

  $("triggerEventBtn").addEventListener("click", () => {
    triggerEvent($("eventType").value);
  });
  $("resolveEventBtn").addEventListener("click", resolveEvent);
  $("cancelEventBtn").addEventListener("click", () => {
    $("eventModal").classList.add("hidden");
    advisorSay("家主決定暫時擱置此事件。");
    pendingEvent = null;
    pendingEventKind = null;
  });

  $("advisorCommandForm").addEventListener("submit", e => {
    e.preventDefault();
    handleAdvisorCommand($("advisorCommand").value);
  });
});

  // ======== 輔佐官搜尋按鈕功能補綁定 ========

  // 查人按鈕
  $("advisorSearchBtn").addEventListener("click", () => {
    const name = $("advisorSearchName").value.trim();
    if (!name) { advisorSay("請家主輸入姓名。"); return; }
    advisorSearchName(name);
  });

  // 查地點按鈕
  $("advisorLocationBtn").addEventListener("click", () => {
    const loc = $("advisorLocation").value.trim();
    if (!loc) { advisorSay("請家主選擇地點。"); return; }
    advisorSearchLocation(loc);
  });

  // 查年齡按鈕
  $("advisorAgeBtn").addEventListener("click", () => {
    const a = $("ageMin").value;
    const b = $("ageMax").value;
    advisorSearchAge(a, b);
  });

  // 天下總覽按鈕
  $("worldSummaryBtn").addEventListener("click", () => {
    advisorWorldSummary();
  });

  // 指令送出按鈕
  $("advisorCommandBtn")?.addEventListener("click", () => {
    handleAdvisorCommand($("advisorCommand").value);
  });


// === 小型第二父母選擇視窗 ===

function openParentSelectDialog(child, parent, spouseList) {
  const box = document.getElementById("parentSelectDialog");
  const txt = document.getElementById("parentSelectText");
  const btns = document.getElementById("parentSelectButtons");

  if (!box) return;

  txt.innerText = `為「${child.name}」選擇另一位父母：`;

  btns.innerHTML = "";

  // 建立配偶按鈕
  spouseList.forEach(sp => {
    const b = document.createElement("button");
    b.innerText = sp.name;
    b.style.padding = "6px 10px";
    b.style.border = "1px solid #444";
    b.style.borderRadius = "6px";
    b.onclick = () => confirmSecondParent(child.id, parent.id, sp.id);
    btns.appendChild(b);
  });

  // 無（不詳）按鈕
  const none = document.createElement("button");
  none.innerText = "無（不詳）";
  none.style.padding = "6px 10px";
  none.style.border = "1px solid #444";
  none.style.borderRadius = "6px";
  none.onclick = () => confirmSecondParent(child.id, parent.id, null);
  btns.appendChild(none);

  box.style.display = "block";
}

function closeParentSelectDialog() {
  const box = document.getElementById("parentSelectDialog");
  if (box) box.style.display = "none";
}

function confirmSecondParent(childId, parentId, secondId) {
  const child = findPerson(childId);
  const p1 = findPerson(parentId);

  if (!child || !p1) return;

  if (secondId !== null) {
    const sp = findPerson(secondId);
    if (sp) {
      if (!child.parentIds.includes(sp.id)) child.parentIds.push(sp.id);
      if (!sp.childIds.includes(child.id)) sp.childIds.push(child.id);

      advisorSay(`已為「${child.name}」設定父母：${p1.name} 與 ${sp.name}`);
    }
  } else {
    advisorSay(`已為「${child.name}」設定單一父母（${p1.name}）`);
  }

  closeParentSelectDialog();
  normalizeRelations();
  saveState();
  renderFamilies();
  renderFamilyDetail();
  renderPersonDetail();
}
