// TIMIK V7 default engineer improvements - editable engineer fields and weekly engineer totals
(() => {
  "use strict";

  const STORAGE_KEY = "timik_engine_rebuild_record_v12";
  const APP_VERSION = "V19.1 Job Timer Fixed";
  const DEFAULT_PASSWORD = "timik";
  const DEFAULT_ENGINEERS = ["Dave", "Tom", "James", "Workshop"];
  const PHOTO_STAGES = [
    { key: "arrival", title: "Arrival Photos", help: "Overall engine, courier condition, pallet condition and visible damage." },
    { key: "serial", title: "Serial Number Photos", help: "Clear serial plate/number evidence before strip down." },
    { key: "damage", title: "Damage Photos", help: "Damage, wear, contamination, broken parts and anything warranty related." },
    { key: "strip", title: "Strip Photos", help: "Strip-down condition, removed components and cleaned parts." },
    { key: "build", title: "Build Photos", help: "Build progress, timing marks, bearing/clearance evidence and assembled stages." },
    { key: "dyno", title: "Dyno Photos", help: "Dyno setup, readings, leaks found/addressed and final test evidence." },
    { key: "shipping", title: "Final Shipping Photos", help: "Painted engine, heat tabs, sticker, pallet, strapping, wrapping and loaded engine." }
  ];

  const PROCESS_OPTIONS = ["Pending", "In Progress", "Complete"];
  const SIMPLE_OPTIONS = ["Pending", "Complete"];
  const INSPECTION_OPTIONS = ["Pass", "Fail", "Monitor"];
  const EXTERNAL_OPTIONS = ["Not Sent", "Sent", "Returned", "Not Required"];
  const JOB_STATUS_OPTIONS = ["In Progress", "Awaiting Parts", "Awaiting Machining", "Ready For Dyno", "Ready For Shipping", "Complete", "On Hold"];

  const ARRIVAL_TASKS = ["Engine unloaded", "Arrival photos taken", "Serial number photographed", "Job number assigned", "Engine logged", "Engine stored safely"];
  const STRIP_PROCESS_TASKS = ["Engine power washed", "Engine stripped", "All sides photographed", "Damage photographed", "Parts washed", "Paint stripped where required", "Parts tagged", "Parts list sent to office"];
  const STRIP_INSPECTIONS = ["Oil condition", "Metal contamination", "Bore condition", "Crank journal condition", "Cylinder head condition", "Block condition", "Turbo condition", "Injector condition", "Cooling system condition"];
  const EXTERNAL_ITEMS = ["Block machining", "Crank grinding / measuring", "Cylinder head reman", "Turbo reman", "Starter rewind", "Alternator rewind"];
  const BUILD_TASKS = ["Workspace cleared", "Block cleaned", "Water jacket cleaned", "Block dried and lubed", "Parts prepared", "Short motor assembled", "Cylinder head fitted", "Fuel system fitted", "Ancillaries fitted", "Oil filled before dyno"];
  const DYNO_INSPECTIONS = ["Cold start", "Hot start", "Cold oil pressure", "Hot oil pressure", "Leak check", "Full load test", "Dyno run sheet completed"];
  const PACKAGING_TASKS = ["Dyno kit removed", "Holes bunged", "Engine washed and dried", "Non-painted parts taped", "Engine painted", "Heat tabs fitted", "TIMIK sticker fitted", "Openings taped", "Engine palletised", "Engine strapped", "Final photos taken", "Shipping label attached"];

  const $app = document.getElementById("app");

  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const fmtDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };
  const moneySafe = (v) => String(v ?? "").replace(/[<>&]/g, s => ({ "<":"&lt;", ">":"&gt;", "&":"&amp;" }[s]));
  const num = (v) => Number.parseFloat(v || 0) || 0;

  const makeStatusMap = (items, initial = "") => Object.fromEntries(items.map(x => [x, initial]));

  const blankJob = () => ({
    id: uid(),
    jobNo: nextJobNo(),
    status: "In Progress",
    createdAt: todayISO(),
    updatedAt: todayISO(),
    completedAt: "",

    customer: "",
    engineer: (state?.settings?.defaultEngineer || ""),
    contact: "",
    phone: "",
    email: "",

    engineMake: "",
    engineModel: "",
    engineSerial: "",
    buildRef: "",
    previousRebuild: "Unknown",

    deliveryNotes: "",
    arrivalNotes: "",
    arrivalTasks: makeStatusMap(ARRIVAL_TASKS, false),

    stripProcess: makeStatusMap(STRIP_PROCESS_TASKS, ""),
    stripChecks: makeStatusMap(STRIP_INSPECTIONS, ""),
    stripNotes: "",
    damageFindings: "",
    cleaningNotes: "",
    machiningRequiredNotes: "",

    externalWork: makeStatusMap(EXTERNAL_ITEMS, ""),
    externalNotes: "",
    officeNotes: "",

    buildTasks: makeStatusMap(BUILD_TASKS, ""),
    buildNotes: "",
    measurements: [],
    bearingClearances: "",
    torqueSettings: "",
    valveClearances: "",

    dynoChecks: makeStatusMap(DYNO_INSPECTIONS, ""),
    coldOilPressure: "",
    hotOilPressure: "",
    maxRpm: "",
    loadPercent: "",
    fullLoadResults: "",
    leakCheckNotes: "",
    dynoNotes: "",

    packagingTasks: makeStatusMap(PACKAGING_TASKS, ""),
    packagingNotes: "",
    shippingNotes: "",

    parts: [],
    signOffEngineer: (state?.settings?.defaultEngineer || ""),
    signOffDate: "",
    warrantyNotes: "",
    customerNotes: "",
    finalNotes: "",
    photos: [],
    timeEntries: []
  });

  const blankDiary = () => ({
    id: uid(),
    date: todayISO(),
    engineer: (state?.settings?.defaultEngineer || ""),
    jobId: "",
    hours: "",
    workDone: "",
    partsFitted: "",
    issues: "",
    photos: []
  });

  let state = loadState();
  let ui = {
    tab: "engine",
    openSections: [],
    currentJobId: state.currentJobId || null,
    diaryDraft: blankDiary(),
    partDraft: { partNo: "", description: "", qty: "1", addNotes: false, notes: "" },
    measurementDraft: { item: "", spec: "", actual: "" },
    savedSearch: "",
    savedFilter: "All",
    reportWeekOffset: 0,
    toast: "",
    unlocked: !state.settings?.passwordEnabled || sessionStorage.getItem("timikUnlocked") === "yes",
    loginPassword: "",
    loginError: ""
  };


  function ensureJobShape(job) {
    job.status = job.status === "Completed" ? "Complete" : (job.status || "In Progress");
    job.arrivalTasks = job.arrivalTasks || makeStatusMap(ARRIVAL_TASKS, false);
    job.stripProcess = job.stripProcess || makeStatusMap(STRIP_PROCESS_TASKS, "");
    job.stripChecks = job.stripChecks || makeStatusMap(STRIP_INSPECTIONS, "");
    job.externalWork = job.externalWork || makeStatusMap(EXTERNAL_ITEMS, "");
    job.buildTasks = job.buildTasks || makeStatusMap(BUILD_TASKS, "");
    job.dynoChecks = job.dynoChecks || makeStatusMap(DYNO_INSPECTIONS, "");
    job.packagingTasks = job.packagingTasks || makeStatusMap(PACKAGING_TASKS, "");
    job.parts = job.parts || [];
    job.timeEntries = job.timeEntries || [];
    job.measurements = job.measurements || [];
    job.photos = (job.photos || []).map((p, idx) => {
      if (typeof p === "string") return { id: uid(), stage: "general", src: p, name: `Photo ${idx + 1}`, addedAt: todayISO() };
      return { id: p.id || uid(), stage: p.stage || "general", src: p.src || p.data || "", name: p.name || `Photo ${idx + 1}`, addedAt: p.addedAt || todayISO() };
    }).filter(p => p.src);
    return job;
  }
  state.jobs.forEach(ensureJobShape);

  if (!ui.currentJobId || !state.jobs.find(j => j.id === ui.currentJobId)) {
    const first = state.jobs[0] || blankJob();
    if (!state.jobs.length) state.jobs.push(first);
    ui.currentJobId = first.id;
    state.currentJobId = first.id;
  loadOpenSectionsForJob((state.jobs || []).find(j => j.id === state.currentJobId));
    persist();
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [],
          diary: Array.isArray(parsed.diary) ? parsed.diary : [],
          customers: Array.isArray(parsed.customers) ? parsed.customers : [],
          engineers: Array.isArray(parsed.engineers) && parsed.engineers.length ? parsed.engineers : DEFAULT_ENGINEERS,
          currentJobId: parsed.currentJobId || null,
          settings: { workshopName: "TIMIK Agriculture", defaultEngineer: "", defaultEmail: "", password: DEFAULT_PASSWORD, appPassword: DEFAULT_PASSWORD, passwordEnabled: true, ...(parsed.settings || {}) }
        };
      }
    } catch (e) {
      console.warn(e);
    }
    return { jobs: [], diary: [], customers: [], engineers: DEFAULT_ENGINEERS, currentJobId: null, settings: { workshopName: "TIMIK Agriculture", defaultEngineer: "", defaultEmail: "", password: DEFAULT_PASSWORD, appPassword: DEFAULT_PASSWORD, passwordEnabled: true } };
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function nextJobNo() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const data = raw ? JSON.parse(raw) : { jobs: [] };
      const max = (data.jobs || []).reduce((acc, j) => {
        const m = String(j.jobNo || "").match(/(\d+)$/);
        return Math.max(acc, m ? Number(m[1]) : 0);
      }, 0);
      return "EJ-" + String(max + 1).padStart(5, "0");
    } catch {
      return "EJ-00001";
    }
  }

  function currentJob() {
    return state.jobs.find(j => j.id === ui.currentJobId) || state.jobs[0];
  }

  function setTab(tab) {
    ui.tab = tab;
    render();
  }

  function showToast(msg) {
    ui.toast = msg;
    render();
    setTimeout(() => {
      ui.toast = "";
      render();
    }, 1800);
  }

  function updateJob(patch, shouldRender = true) {
    const job = currentJob();
    if (!job) return;
    Object.assign(job, patch, { updatedAt: todayISO() });
    if (patch.status === "Completed" && !job.completedAt) job.completedAt = todayISO();
    if (patch.status && patch.status !== "Completed") job.completedAt = "";
    persist();
    if (shouldRender) render();
  }

  function updateJobField(key, val) {
    updateJob({ [key]: val }, false);
  }

  function saveCurrentJob() {
    const job = currentJob();
    if (!job) return;
    job.updatedAt = todayISO();
    if (job.customer && !state.customers.includes(job.customer)) state.customers.push(job.customer);
    persist();
    showToast("Job saved");
  }

  function newJob() {
    const job = blankJob();
    state.jobs.unshift(job);
    state.currentJobId = job.id;
  loadOpenSectionsForJob((state.jobs || []).find(j => j.id === state.currentJobId));
    ui.currentJobId = job.id;
    ui.tab = "engine";
    ui.openSections = [];
    persist();
    showToast("New engine job created");
  }

  function duplicateJob(jobId) {
    const old = state.jobs.find(j => j.id === jobId);
    if (!old) return;
    const copy = JSON.parse(JSON.stringify(old));
    copy.id = uid();
    copy.jobNo = nextJobNo();
    copy.status = "In Progress";
    copy.createdAt = todayISO();
    copy.updatedAt = todayISO();
    copy.completedAt = "";
    state.jobs.unshift(copy);
    ui.currentJobId = copy.id;
    ui.tab = "engine";
    persist();
    render();
  }

  function deleteJob(jobId) {
    if (!confirm("Delete this engine job? This cannot be undone.")) return;
    state.jobs = state.jobs.filter(j => j.id !== jobId);
    state.diary = state.diary.filter(d => d.jobId !== jobId);
    if (!state.jobs.length) state.jobs.push(blankJob());
    ui.currentJobId = state.jobs[0].id;
    state.currentJobId = ui.currentJobId;
  loadOpenSectionsForJob((state.jobs || []).find(j => j.id === state.currentJobId));
    persist();
    render();
  }

  
function getOpenSectionStorageKey(jobId) {
  return "timik_open_sections_" + (jobId || "new");
}

function getActiveJobForOpenSections() {
  if (typeof state !== "undefined") {
    if (state.currentJobId && Array.isArray(state.jobs)) {
      return state.jobs.find(j => j.id === state.currentJobId) || null;
    }
    if (state.currentJob) return state.currentJob;
    if (state.activeJob) return state.activeJob;
  }
  if (typeof currentJob === "function") {
    try { return currentJob(); } catch (e) {}
  }
  return null;
}

function saveOpenSectionsForJob() {
  try {
    const job = getActiveJobForOpenSections();
    const key = getOpenSectionStorageKey(job && job.id);
    localStorage.setItem(key, JSON.stringify(ui.openSections || []));
    if (job) job.openSections = Array.isArray(ui.openSections) ? [...ui.openSections] : [];
    if (typeof persist === "function") persist();
  } catch (e) {
    console.warn("Could not save open section state", e);
  }
}

function loadOpenSectionsForJob(job) {
  try {
    if (!job || !job.id) {
      ui.openSections = [];
      return;
    }
    if (Array.isArray(job.openSections)) {
      ui.openSections = [];
      return;
    }
    const saved = localStorage.getItem(getOpenSectionStorageKey(job.id));
    ui.openSections = saved ? JSON.parse(saved) : [];
  } catch (e) {
    ui.openSections = [];
  }
}

function toggleSection(name) {
    if (ui.openSections.includes(name)) ui.openSections = ui.openSections.filter(x => x !== name);
    else ui.openSections.push(name);
    render();
  }

  function statusClass(status) {
    return {
      "In Progress": "status-in-progress",
      "Awaiting Parts": "status-on-hold",
      "Awaiting Machining": "status-on-hold",
      "Ready For Dyno": "status-not-started",
      "Ready For Shipping": "status-not-started",
      "Complete": "status-completed",
      "Completed": "status-completed",
      "On Hold": "status-on-hold",
      "Not Started": "status-not-started"
    }[status] || "status-not-started";
  }

  function field(label, value, oninput, type = "text", extra = "") {
    return `<div class="field"><label>${label}</label><input class="input" type="${type}" value="${moneySafe(value)}" ${extra} oninput="${oninput}" /></div>`;
  }

  function textarea(label, value, oninput, extra = "") {
    return `<div class="field"><label>${label}</label><textarea class="textarea" ${extra} oninput="${oninput}">${moneySafe(value)}</textarea></div>`;
  }

  function select(label, value, options, onchange) {
    return `<div class="field"><label>${label}</label><select class="select" onchange="${onchange}">${options.map(o => `<option ${o === value ? "selected" : ""}>${moneySafe(o)}</option>`).join("")}</select></div>`;
  }

  function section(name, icon, body) {
    const open = ui.openSections.includes(name);
    return `<div class="section-card ${open ? "open" : ""}">
      <button class="section-head" onclick="TIMIK.toggleSection('${name.replace(/'/g, "\\'")}')">
        <span class="section-icon">${icon}</span>
        <span>${name}</span>
        <span class="chev">›</span>
      </button>
      <div class="section-body">${body}</div>
    </div>`;
  }

  
  function isLocked() {
    return !!state.settings?.passwordEnabled && !ui.unlocked;
  }

  function renderLogin() {
    $app.innerHTML = `<div class="login-shell">
      <div class="login-card">
        <div class="logo-mark login-logo">TIMIK<small>AGRICULTURE</small></div>
        <h1>Engine Rebuild Record</h1>
        <p class="help">Enter the workshop password to open the app.</p>
        <input class="input login-input" type="password" placeholder="Password" value="${moneySafe(ui.loginPassword)}"
          oninput="TIMIK.setLoginPassword(this.value)" onkeydown="if(event.key==='Enter') TIMIK.unlockApp()" autofocus />
        ${ui.loginError ? `<div class="login-error">${moneySafe(ui.loginError)}</div>` : ""}
        <button class="primary-btn full-width" onclick="TIMIK.unlockApp()">Unlock App</button>
        <div class="app-footer">Powered by SouthWorx • ${APP_VERSION}</div>
      </div>
    </div>`;
  }

  function renderShell(content) {
    const titles = {
      engine: "Engine Job",
      diary: "Daily Diary",
      report: "Weekly Report",
      saved: "Saved Jobs",
      settings: "Settings"
    };
    const headerAction = headerActions();
    $app.innerHTML = `<div class="app-shell">
      <header class="topbar">
        <div class="status-strip"></div>
        <div class="header-row clean-header">
          <div class="header-title">
            <strong>${titles[ui.tab]}</strong>
            <span>TIMIK Agriculture • Engine Rebuild Record</span>
          </div>
          <div class="header-actions no-print">${headerAction}</div>
        </div>
      </header>
      <main class="content">${content}<div class="app-footer">Powered by SouthWorx • ${APP_VERSION}</div></main>
      <nav class="bottom-tabs no-print">
        ${tabBtn("engine", "🔧", "Engine Job")}
        ${tabBtn("diary", "🗓️", "Daily Diary")}
        ${tabBtn("report", "📋", "Weekly Report")}
        ${tabBtn("saved", "🗂️", "Saved Jobs")}
        ${tabBtn("settings", "⚙️", "Settings")}
      </nav>
      <div class="toast ${ui.toast ? "show" : ""}">${moneySafe(ui.toast)}</div>
    </div>`;
  }


  function headerActions() {
    // Keep the top-right header clean on mobile.
    // Page-specific actions live inside each tab where they make sense.
    return "";
  }

  function tabBtn(id, icon, label) {
    return `<button class="tab-btn ${ui.tab === id ? "active" : ""}" onclick="TIMIK.setTab('${id}')"><span class="tab-icon">${icon}</span><span>${label}</span></button>`;
  }

  function renderHero() {
    const complete = state.jobs.filter(j => j.status === "Completed").length;
    const progress = state.jobs.filter(j => j.status === "In Progress").length;
    const week = getWeekEntries();
    const hours = week.reduce((a, d) => a + num(d.hours), 0);
    return `<div class="hero-card">
      <div class="brand-lockup">
        <div class="logo-mark">TIMIK<small>AGRICULTURE</small></div>
        <div>
          <h1 class="hero-title">Engine Rebuild Record</h1>
          <p class="hero-subtitle">Professional • Simple • Workshop focused</p>
        </div>
      </div>
      <div class="quick-stats">
        <div class="stat-pill"><strong>${progress}</strong><span>In Progress</span></div>
        <div class="stat-pill"><strong>${complete}</strong><span>Completed</span></div>
        <div class="stat-pill"><strong>${hours.toFixed(1)}</strong><span>Week Hours</span></div>
      </div>
    </div>`;
  }

  function taskList(key, labels, values = {}, options = PROCESS_OPTIONS) {
    return `<div class="check-list">${labels.map(label => {
      const val = values?.[label] || "";
      return `<div class="check-item workflow-choice">
        <span>${moneySafe(label)}</span>
        <div class="segment">
          ${options.map(x => `<button class="${val === x ? "active" : ""}" onclick="TIMIK.setCheck('${key}','${label.replace(/'/g, "\\'")}','${x}')">${moneySafe(x)}</button>`).join("")}
        </div>
      </div>`;
    }).join("")}</div>`;
  }

  function tickList(key, labels, values = {}) {
    return `<div class="check-list">${labels.map(label => {
      const checked = !!values?.[label];
      return `<label class="check-item tick-choice">
        <span>${moneySafe(label)}</span>
        <input type="checkbox" ${checked ? "checked" : ""} onchange="TIMIK.setBooleanCheck('${key}','${label.replace(/'/g, "\\'")}',this.checked)" />
      </label>`;
    }).join("")}</div>`;
  }

  function renderStagePhotos(stage, title, help) {
    const j = currentJob();
    const photos = (j.photos || []).filter(p => p.stage === stage);
    return `<div class="photo-stage-box photo-upload-box">
      <div class="photo-stage-head">
        <div>
          <strong>${moneySafe(title)}</strong>
          <span>${moneySafe(help)}</span>
        </div>
        <span class="photo-count">${photos.length} photo${photos.length === 1 ? "" : "s"}</span>
      </div>
      <label class="photo-add-btn">
        + Add Photos
        <input type="file" accept="image/*" multiple onchange="TIMIK.handleStagePhotos(event,'${stage}')" />
      </label>
      ${photos.length ? `<div class="photo-grid stage-photo-grid">${photos.map(p => `<div class="photo-thumb">
        <img src="${p.src}" alt="${moneySafe(p.name || title)}" />
        <button class="danger-btn full-width" onclick="TIMIK.removeStagePhoto('${p.id}')">Remove</button>
      </div>`).join("")}</div>` : `<div class="empty photo-empty">No ${moneySafe(title.toLowerCase())} added yet.</div>`}
    </div>`;
  }

  function renderArrival(j) {
    return `<div class="grid-2">
      ${field("Customer", j.customer, "TIMIK.updateJobField('customer',this.value)", "text", `list="customer-list"`)}
      ${field("Engineer", j.engineer || state.settings?.defaultEngineer || "", "TIMIK.updateJobField('engineer',this.value)", "text", 'placeholder="Engineer name"')}
      ${field("Contact", j.contact, "TIMIK.updateJobField('contact',this.value)")}
      ${field("Phone", j.phone, "TIMIK.updateJobField('phone',this.value)", "tel")}
      ${field("Email", j.email, "TIMIK.updateJobField('email',this.value)", "email")}
      ${field("Engine make", j.engineMake, "TIMIK.updateJobField('engineMake',this.value)")}
      ${field("Engine model", j.engineModel, "TIMIK.updateJobField('engineModel',this.value)")}
      ${field("Engine serial number", j.engineSerial, "TIMIK.updateJobField('engineSerial',this.value)")}
      ${field("Build reference", j.buildRef, "TIMIK.updateJobField('buildRef',this.value)")}
      ${select("Previous rebuild?", j.previousRebuild, ["Unknown", "No", "Yes"], "TIMIK.updateJobField('previousRebuild',this.value)")}
      ${select("Job status", j.status, JOB_STATUS_OPTIONS, "TIMIK.updateJob({status:this.value})")}
    </div>
    <datalist id="customer-list">${state.customers.map(c => `<option value="${moneySafe(c)}"></option>`).join("")}</datalist>
    ${textarea("Courier / delivery notes", j.deliveryNotes || "", "TIMIK.updateJobField('deliveryNotes',this.value)")}
    ${textarea("Arrival notes", j.arrivalNotes || "", "TIMIK.updateJobField('arrivalNotes',this.value)")}
    <h3 class="subsection-title">Arrival actions</h3>
    ${tickList("arrivalTasks", ARRIVAL_TASKS, j.arrivalTasks)}
    ${renderStagePhotos("arrival", "Arrival Photos", "Overall engine, courier condition, pallet condition and visible damage.")}
    ${renderStagePhotos("serial", "Serial Number Photos", "Clear serial plate/number evidence before strip down.")}`;
  }

  function renderStripDown(j) {
    return `<h3 class="subsection-title">Process tasks</h3>
      ${taskList("stripProcess", STRIP_PROCESS_TASKS, j.stripProcess, PROCESS_OPTIONS)}
      <h3 class="subsection-title">Inspection items</h3>
      ${taskList("stripChecks", STRIP_INSPECTIONS, j.stripChecks, INSPECTION_OPTIONS)}
      ${textarea("Strip notes", j.stripNotes || "", "TIMIK.updateJobField('stripNotes',this.value)")}
      ${textarea("Damage findings", j.damageFindings || "", "TIMIK.updateJobField('damageFindings',this.value)")}
      ${textarea("Cleaning notes", j.cleaningNotes || "", "TIMIK.updateJobField('cleaningNotes',this.value)")}
      ${textarea("Machining required notes", j.machiningRequiredNotes || "", "TIMIK.updateJobField('machiningRequiredNotes',this.value)")}
      ${renderStagePhotos("damage", "Damage Photos", "Damage, wear, contamination, broken parts and anything warranty related.")}
      ${renderStagePhotos("strip", "Strip Photos", "Strip-down condition, removed components and cleaned parts.")}`;
  }

  function renderNonWorkshop(j) {
    return `<h3 class="subsection-title">External work tracking</h3>
      ${taskList("externalWork", EXTERNAL_ITEMS, j.externalWork, EXTERNAL_OPTIONS)}
      ${textarea("External work notes", j.externalNotes || "", "TIMIK.updateJobField('externalNotes',this.value)")}
      ${textarea("Office / paperwork notes", j.officeNotes || "", "TIMIK.updateJobField('officeNotes',this.value)")}`;
  }

  function renderBuild(j) {
    return `<h3 class="subsection-title">Build tasks</h3>
      ${taskList("buildTasks", BUILD_TASKS, j.buildTasks, PROCESS_OPTIONS)}
      ${textarea("Build notes", j.buildNotes || "", "TIMIK.updateJobField('buildNotes',this.value)")}
      ${textarea("Bearing clearances", j.bearingClearances || "", "TIMIK.updateJobField('bearingClearances',this.value)")}
      ${textarea("Torque settings", j.torqueSettings || "", "TIMIK.updateJobField('torqueSettings',this.value)")}
      ${textarea("Valve clearances", j.valveClearances || "", "TIMIK.updateJobField('valveClearances',this.value)")}
      ${renderMeasurements(j)}
      ${renderStagePhotos("build", "Build Photos", "Build progress, timing marks, bearing/clearance evidence and assembled stages.")}`;
  }

  function renderDyno(j) {
    return `<h3 class="subsection-title">Dyno checks</h3>
      ${taskList("dynoChecks", DYNO_INSPECTIONS, j.dynoChecks, INSPECTION_OPTIONS)}
      <div class="grid-2">
        ${field("Cold oil pressure", j.coldOilPressure || "", "TIMIK.updateJobField('coldOilPressure',this.value)")}
        ${field("Hot oil pressure", j.hotOilPressure || "", "TIMIK.updateJobField('hotOilPressure',this.value)")}
        ${field("Max RPM", j.maxRpm || "", "TIMIK.updateJobField('maxRpm',this.value)")}
        ${field("Load %", j.loadPercent || "", "TIMIK.updateJobField('loadPercent',this.value)")}
      </div>
      ${textarea("Full load results", j.fullLoadResults || "", "TIMIK.updateJobField('fullLoadResults',this.value)")}
      ${textarea("Leak check notes", j.leakCheckNotes || "", "TIMIK.updateJobField('leakCheckNotes',this.value)")}
      ${textarea("Dyno notes", j.dynoNotes || "", "TIMIK.updateJobField('dynoNotes',this.value)")}
      ${renderStagePhotos("dyno", "Dyno Photos", "Dyno setup, readings, leaks found/addressed and final test evidence.")}`;
  }

  function renderPackaging(j) {
    return `${taskList("packagingTasks", PACKAGING_TASKS, j.packagingTasks, SIMPLE_OPTIONS)}
      ${textarea("Packaging notes", j.packagingNotes || "", "TIMIK.updateJobField('packagingNotes',this.value)")}
      ${textarea("Shipping notes", j.shippingNotes || "", "TIMIK.updateJobField('shippingNotes',this.value)")}
      ${renderStagePhotos("shipping", "Final Shipping Photos", "Painted engine, heat tabs, sticker, pallet, strapping, wrapping and loaded engine.")}`;
  }


  const ACTIVE_TIMER_KEY = "timik_active_job_timer_v19";

  function activeTimer() {
    try { return JSON.parse(localStorage.getItem(ACTIVE_TIMER_KEY) || "null"); }
    catch { return null; }
  }

  function setActiveTimer(timer) {
    if (timer) localStorage.setItem(ACTIVE_TIMER_KEY, JSON.stringify(timer));
    else localStorage.removeItem(ACTIVE_TIMER_KEY);
  }

  function timerMs(timer) {
    if (!timer) return 0;
    return Math.max(0, Date.now() - new Date(timer.startTime).getTime());
  }

  function timerText(ms) {
    const totalSeconds = Math.floor((ms || 0) / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function timerHours(ms) {
    return Math.round(((ms || 0) / 3600000) * 100) / 100;
  }

  function jobTotalHours(job) {
    return (job.timeEntries || []).reduce((sum, entry) => sum + num(entry.hours), 0);
  }

  function renderJobTimer(job) {
    job.timeEntries = job.timeEntries || [];
    const timer = activeTimer();
    const running = timer && timer.jobId === job.id;
    const total = jobTotalHours(job).toFixed(2);
    const recent = job.timeEntries.slice().reverse().slice(0, 5);

    return `<section class="timer-panel no-print">
      <div class="timer-panel-head">
        <div>
          <div class="timer-title">Job Timer</div>
          <div class="timer-subtitle">Track accurate workshop time against this engine rebuild.</div>
        </div>
        <div class="timer-total"><span>Total</span><strong>${total} hrs</strong></div>
      </div>

      <div class="timer-display ${running ? "running" : ""}" id="jobTimerDisplay">${running ? timerText(timerMs(timer)) : "00:00:00"}</div>

      <div class="timer-buttons">
        <button class="primary-btn" ${running ? "disabled" : ""} onclick="TIMIK.startJobTimer()">Start Timer</button>
        <button class="secondary-btn" ${running ? "" : "disabled"} onclick="TIMIK.stopJobTimer()">Stop & Save</button>
      </div>

      <div class="field timer-note-wrap">
        <label>Timer note</label>
        <textarea id="timerNote" class="textarea" placeholder="Optional: what was worked on?"></textarea>
      </div>

      <div class="timer-history">
        ${recent.length ? recent.map(e => `<div class="timer-entry">
          <div class="timer-entry-head"><strong>${Number(e.hours || 0).toFixed(2)} hrs</strong><span>${fmtDate(e.date)}</span></div>
          <div class="timer-entry-note">${moneySafe(e.note || "No note added")}</div>
        </div>`).join("") : `<div class="timer-empty">No recorded timer entries yet.</div>`}
      </div>
    </section>`;
  }

  function updateTimerDisplay() {
    const display = document.getElementById("jobTimerDisplay");
    if (!display) return;
    const job = currentJob();
    const timer = activeTimer();
    if (timer && job && timer.jobId === job.id) {
      display.textContent = timerText(timerMs(timer));
      display.classList.add("running");
    }
  }

  function startJobTimer() {
    const job = currentJob();
    if (!job) {
      showToast("Open or create a job first");
      return;
    }
    const existing = activeTimer();
    if (existing) {
      showToast("A timer is already running");
      return;
    }
    setActiveTimer({
      jobId: job.id,
      jobNo: job.jobNo,
      engineer: job.engineer || state.settings?.defaultEngineer || "",
      startTime: new Date().toISOString()
    });
    showToast("Timer started");
    render();
  }

  function stopJobTimer() {
    const job = currentJob();
    const timer = activeTimer();
    if (!job || !timer) return;
    if (timer.jobId !== job.id) {
      showToast("Timer belongs to another job");
      return;
    }

    const endTime = new Date().toISOString();
    const ms = new Date(endTime).getTime() - new Date(timer.startTime).getTime();
    const hours = timerHours(ms);
    const note = document.getElementById("timerNote")?.value?.trim() || "";

    job.timeEntries = job.timeEntries || [];
    job.timeEntries.push({
      id: uid(),
      date: todayISO(),
      engineer: timer.engineer || job.engineer || state.settings?.defaultEngineer || "",
      startTime: timer.startTime,
      endTime,
      hours,
      note
    });
    job.updatedAt = todayISO();
    setActiveTimer(null);
    persist();
    showToast(`${hours.toFixed(2)} hours saved`);
  }


  function renderEngine() {
    const j = currentJob();
    const content = `${renderHero()}
      <div class="engine-action-strip no-print">
        <button class="primary-btn" onclick="TIMIK.saveCurrentJob()">Save Job</button>
        <button class="secondary-btn" onclick="TIMIK.newJob()">+ New Job</button>
      </div>
      ${renderJobTimer(j)}
      <div class="job-meta">
        <div><strong>Job: ${moneySafe(j.jobNo)}</strong><div class="help">Updated: ${fmtDate(j.updatedAt)}</div></div>
        <span class="status-badge ${statusClass(j.status)}">${moneySafe(j.status)}</span>
      </div>
      ${section("Arrival", "📥", renderArrival(j))}
      ${section("Strip Down", "🔍", renderStripDown(j))}
      ${section("Non Workshop", "🚚", renderNonWorkshop(j))}
      ${section("Build", "🔧", renderBuild(j))}
      ${section("Dyno", "📈", renderDyno(j))}
      ${section("Packaging", "📦", renderPackaging(j))}
      ${section("Parts", "🧰", renderParts(j))}
      ${section("Sign Off", "✍️", renderSignOff(j))}
      <div class="action-row no-print">
        <button class="secondary-btn full-width" onclick="TIMIK.printJob()">Export / Print Job</button>
        <button class="ghost-btn full-width" onclick="TIMIK.emailJob()">Email Job Summary</button>
      </div>`;
    renderShell(content);
  }

  function renderCustomer(j) {
    return `<div class="grid-2">
      ${field("Customer", j.customer, "TIMIK.updateJobField('customer',this.value)", "text", `list="customer-list"`)}
      ${field("Engineer", j.engineer || state.settings?.defaultEngineer || "", "TIMIK.updateJobField('engineer',this.value)", "text", 'placeholder="Engineer name"')}
      ${field("Contact", j.contact, "TIMIK.updateJobField('contact',this.value)")}
      ${field("Phone", j.phone, "TIMIK.updateJobField('phone',this.value)", "tel")}
      ${field("Email", j.email, "TIMIK.updateJobField('email',this.value)", "email")}
      ${field("Machine make", j.machineMake, "TIMIK.updateJobField('machineMake',this.value)")}
      ${field("Machine model", j.machineModel, "TIMIK.updateJobField('machineModel',this.value)")}
      ${field("Machine serial / registration", j.machineSerial, "TIMIK.updateJobField('machineSerial',this.value)")}
      ${field("Machine hours", j.machineHours, "TIMIK.updateJobField('machineHours',this.value)", "number")}
    </div>
    <datalist id="customer-list">${state.customers.map(c => `<option value="${moneySafe(c)}"></option>`).join("")}</datalist>`;
  }

  function renderEngineDetails(j) {
    return `<div class="grid-2">
      ${field("Engine make", j.engineMake, "TIMIK.updateJobField('engineMake',this.value)")}
      ${field("Engine model", j.engineModel, "TIMIK.updateJobField('engineModel',this.value)")}
      ${field("Engine serial", j.engineSerial, "TIMIK.updateJobField('engineSerial',this.value)")}
      ${field("Build reference", j.buildRef, "TIMIK.updateJobField('buildRef',this.value)")}
      ${select("Previous rebuild?", j.previousRebuild, ["Unknown", "No", "Yes"], "TIMIK.updateJobField('previousRebuild',this.value)")}
      ${select("Job status", j.status, ["Not Started", "In Progress", "On Hold", "Completed"], "TIMIK.updateJob({status:this.value})")}
    </div>`;
  }

  function renderChecks(key, labels, values = {}) {
    return `<div class="check-list">${labels.map(label => {
      const val = values[label] || "";
      return `<div class="check-item">
        <span>${moneySafe(label)}</span>
        <div class="segment">
          ${["Pass","Fail","N/A"].map(x => `<button class="${val === x ? "active" : ""}" onclick="TIMIK.setCheck('${key}','${label.replace(/'/g, "\\'")}','${x}')">${x}</button>`).join("")}
        </div>
      </div>`;
    }).join("")}</div>`;
  }

  function renderMeasurements(j) {
    return `<div class="parts-add-card">
      <h3>Add measurement</h3>
      <div class="grid-3">
        ${field("Item", ui.measurementDraft.item, "TIMIK.setMeasurementDraft('item',this.value)")}
        ${field("Spec / tolerance", ui.measurementDraft.spec, "TIMIK.setMeasurementDraft('spec',this.value)")}
        ${field("Actual", ui.measurementDraft.actual, "TIMIK.setMeasurementDraft('actual',this.value)")}
      </div>
      <button class="primary-btn full-width" onclick="TIMIK.addMeasurement()">+ Add Measurement</button>
    </div>
    <div class="table-card">
      <div class="table-row header"><div class="table-cell">Item</div><div class="table-cell">Spec</div><div class="table-cell">Actual</div><div class="table-cell"></div></div>
      ${(j.measurements || []).map((m, idx) => `<div class="table-row">
        <div class="table-cell">${moneySafe(m.item)}</div>
        <div class="table-cell">${moneySafe(m.spec)}</div>
        <div class="table-cell">${moneySafe(m.actual)}</div>
        <div class="table-cell"><button class="icon-btn light" onclick="TIMIK.removeMeasurement(${idx})">×</button></div>
      </div>`).join("") || `<div class="empty">No measurements added yet.</div>`}
    </div>`;
  }

  function renderParts(j) {
    const d = ui.partDraft;
    return `<div class="parts-add-card">
      <h3>Add part fitted / required</h3>
      <div class="grid-3">
        ${field("Part number", d.partNo, "TIMIK.setPartDraft('partNo',this.value)")}
        ${field("Description", d.description, "TIMIK.setPartDraft('description',this.value)")}
        ${field("Qty", d.qty, "TIMIK.setPartDraft('qty',this.value)", "number")}
      </div>
      <label class="check-item" style="grid-template-columns:30px 1fr;margin-bottom:10px;">
        <input type="checkbox" ${d.addNotes ? "checked" : ""} onchange="TIMIK.setPartDraft('addNotes',this.checked,true)" />
        <span>Add notes to this part</span>
      </label>
      ${d.addNotes ? textarea("Part notes", d.notes, "TIMIK.setPartDraft('notes',this.value)") : ""}
      <button class="primary-btn full-width" onclick="TIMIK.addPart()">+ Add Part</button>
      <div class="help">The add-part box stays at the top so engineers can quickly keep adding items.</div>
    </div>
    <div>
      ${(j.parts || []).map((p, idx) => `<div class="part-card">
        <div class="card-line"><h4>${moneySafe(p.partNo || "No part number")}</h4><strong>Qty ${moneySafe(p.qty || "1")}</strong></div>
        <div class="card-line"><span>Description</span><strong>${moneySafe(p.description || "-")}</strong></div>
        ${p.notes ? `<div class="card-line"><span>Notes</span><strong>${moneySafe(p.notes)}</strong></div>` : ""}
        <div class="action-row" style="margin-top:10px;"><button class="danger-btn" onclick="TIMIK.removePart(${idx})">Remove</button></div>
      </div>`).join("") || `<div class="empty">No parts added yet.</div>`}
    </div>`;
  }

  function renderStages(j) {
    return `<div class="check-list">${DEFAULT_STAGES.map(stage => `<div class="field">
      <label>${moneySafe(stage)}</label>
      <select class="select" onchange="TIMIK.setStage('${stage.replace(/'/g, "\\'")}',this.value)">
        ${["Not Started","In Progress","Completed","On Hold"].map(o => `<option ${j.stages?.[stage] === o ? "selected" : ""}>${o}</option>`).join("")}
      </select>
    </div>`).join("")}</div>`;
  }

  function renderSignOff(j) {
    return `<div class="grid-2">
      ${field("Engineer sign-off", j.signOffEngineer, "TIMIK.updateJobField('signOffEngineer',this.value)")}
      ${field("Sign-off date", j.signOffDate, "TIMIK.updateJobField('signOffDate',this.value)", "date")}
    </div>
    ${textarea("Final notes", j.finalNotes, "TIMIK.updateJobField('finalNotes',this.value)")}
    ${textarea("Warranty notes", j.warrantyNotes, "TIMIK.updateJobField('warrantyNotes',this.value)")}
    ${textarea("Customer notes", j.customerNotes, "TIMIK.updateJobField('customerNotes',this.value)")}`;
  }

  function renderPhotos(j, mode) {
    return `<div class="field">
      <label>Add workshop photos</label>
      <input class="input" type="file" accept="image/*" multiple onchange="TIMIK.handlePhotos(event,'${mode}')" />
      <div class="help">Photos are stored on this device inside the app data.</div>
    </div>
    <div class="photo-grid">${(j.photos || []).map((src, idx) => `<div><img src="${src}" alt="Workshop photo ${idx+1}" /><button class="danger-btn full-width" onclick="TIMIK.removePhoto(${idx},'${mode}')">Remove</button></div>`).join("")}</div>`;
  }

  function renderDiary() {
    const d = ui.diaryDraft;
    const entries = [...state.diary].sort((a,b) => (b.date || "").localeCompare(a.date || ""));
    const jobOptions = state.jobs.map(j => `<option value="${j.id}" ${d.jobId === j.id ? "selected" : ""}>${moneySafe(j.jobNo)} - ${moneySafe(jobTitle(j))}</option>`).join("");
    const content = `${renderHero()}
      <div class="section-card open"><button class="section-head"><span class="section-icon">➕</span><span>Add Daily Diary Entry</span><span></span></button>
      <div class="section-body">
        <div class="grid-2">
          ${field("Date", d.date, "TIMIK.setDiaryDraft('date',this.value)", "date", "", "date-field")}
          ${field("Engineer", d.engineer, "TIMIK.setDiaryDraft('engineer',this.value)", "text", 'placeholder="Engineer name"')}
        </div>
        <div class="field"><label>Job / engine worked on</label><select class="select" onchange="TIMIK.setDiaryDraft('jobId',this.value)"><option value="">Select job</option>${jobOptions}</select></div>
        ${field("Hours", d.hours, "TIMIK.setDiaryDraft('hours',this.value)", "number", "step='0.25'")}
        ${textarea("Work done", d.workDone, "TIMIK.setDiaryDraft('workDone',this.value)")}
        ${textarea("Parts fitted today", d.partsFitted, "TIMIK.setDiaryDraft('partsFitted',this.value)")}
        ${textarea("Issues / notes", d.issues, "TIMIK.setDiaryDraft('issues',this.value)")}
        <button class="primary-btn full-width" onclick="TIMIK.addDiaryEntry()">+ Add Entry</button>
      </div></div>
      <h2 class="mini-title">Recent diary entries</h2>
      ${entries.map(e => diaryCard(e)).join("") || `<div class="empty">No diary entries yet.</div>`}`;
    renderShell(content);
  }

  function diaryCard(e) {
    const j = state.jobs.find(x => x.id === e.jobId);
    return `<div class="diary-card">
      <div class="card-line"><h4>${moneySafe(j?.jobNo || "No job")} ${moneySafe(j ? jobTitle(j) : "")}</h4><span class="status-badge status-not-started">Hours: ${moneySafe(e.hours || "0")}</span></div>
      <div class="card-line"><span>Date</span><strong>${fmtDate(e.date)}</strong></div>
      <div class="card-line"><span>Engineer</span><strong>${moneySafe(e.engineer || "-")}</strong></div>
      <p><strong>Work Done:</strong><br>${moneySafe(e.workDone || "-")}</p>
      ${e.partsFitted ? `<p><strong>Parts Fitted:</strong><br>${moneySafe(e.partsFitted)}</p>` : ""}
      ${e.issues ? `<p><strong>Issues:</strong><br>${moneySafe(e.issues)}</p>` : ""}
      <div class="action-row"><button class="danger-btn" onclick="TIMIK.deleteDiary('${e.id}')">Delete</button></div>
    </div>`;
  }

  function renderReport() {
    const entries = getWeekEntries();
    const range = getWeekRange(ui.reportWeekOffset);
    const totalHours = entries.reduce((a,e) => a + num(e.hours), 0);
    const jobIds = [...new Set(entries.map(e => e.jobId).filter(Boolean))];
    const completed = state.jobs.filter(j => j.completedAt && j.completedAt >= range.start && j.completedAt <= range.end).length;
    const partsCount = entries.reduce((a,e) => a + countPartsLines(e.partsFitted), 0);
    const hoursByJob = jobIds.map(id => {
      const job = state.jobs.find(j => j.id === id);
      const h = entries.filter(e => e.jobId === id).reduce((a,e) => a + num(e.hours), 0);
      return { job, hours: h };
    }).sort((a,b) => b.hours - a.hours);
    const engineerTotals = entries.reduce((acc, e) => {
      const name = (e.engineer || "Unassigned").trim() || "Unassigned";
      acc[name] = (acc[name] || 0) + num(e.hours);
      return acc;
    }, {});
    const hoursByEngineer = Object.entries(engineerTotals).map(([engineer, hours]) => ({ engineer, hours })).sort((a,b) => b.hours - a.hours);
    const content = `${renderHero()}
      <div class="section-card open"><button class="section-head"><span class="section-icon">📅</span><span>Week ${getWeekNumber(range.startDate)}</span><span></span></button>
      <div class="section-body">
        <div class="week-selector no-print">
          <button class="secondary-btn week-nav" onclick="TIMIK.changeWeek(-1)">‹ Previous</button>
          <div class="week-range">${fmtDate(range.start)} – ${fmtDate(range.end)}</div>
          <button class="secondary-btn week-nav" onclick="TIMIK.changeWeek(1)">Next ›</button>
        </div>
      </div></div>
      <div class="report-grid">
        <div class="report-stat"><strong>${totalHours.toFixed(2)}</strong><span>Total Hours</span></div>
        <div class="report-stat"><strong>${completed}</strong><span>Engines Completed</span></div>
        <div class="report-stat"><strong>${jobIds.length}</strong><span>Jobs Worked On</span></div>
        <div class="report-stat"><strong>${partsCount}</strong><span>Parts Lines Fitted</span></div>
      </div>
      <div class="report-card">
        <h3 class="mini-title">Hours by job</h3>
        ${hoursByJob.map(r => `<div class="card-line"><span>${moneySafe(r.job?.jobNo || "Unknown")} ${moneySafe(r.job ? jobTitle(r.job) : "")}</span><strong>${r.hours.toFixed(2)}</strong></div>`).join("") || `<div class="empty">No hours logged for this week.</div>`}
      </div>
      <div class="report-card">
        <h3 class="mini-title">Hours by engineer</h3>
        ${hoursByEngineer.map(r => `<div class="card-line"><span>${moneySafe(r.engineer)}</span><strong>${r.hours.toFixed(2)}</strong></div>`).join("") || `<div class="empty">No engineer hours logged for this week.</div>`}
      </div>
      <div class="report-card">
        <h3 class="mini-title">Diary entries this week</h3>
        ${entries.map(e => diaryCard(e)).join("") || `<div class="empty">No diary entries this week.</div>`}
      </div>
      <div class="action-row no-print">
        <button class="primary-btn full-width" onclick="TIMIK.printWeeklyReport()">Export / Print Weekly Report</button>
        <button class="ghost-btn full-width" onclick="TIMIK.emailWeeklyReport()">Email Weekly Report</button>
      </div>`;
    renderShell(content);
  }

  function renderSaved() {
    let jobs = [...state.jobs];
    if (ui.savedFilter !== "All") jobs = jobs.filter(j => j.status === ui.savedFilter);
    if (ui.savedSearch.trim()) {
      const q = ui.savedSearch.toLowerCase();
      jobs = jobs.filter(j => JSON.stringify(j).toLowerCase().includes(q));
    }
    const content = `${renderHero()}
      <div class="search-filter">
        <input class="input" placeholder="Search jobs..." value="${moneySafe(ui.savedSearch)}" oninput="TIMIK.setSavedSearch(this.value)" />
        <div class="chip-row">${["All","In Progress","Completed","On Hold"].map(f => `<button class="chip ${ui.savedFilter === f ? "active" : ""}" onclick="TIMIK.setSavedFilter('${f}')">${f}</button>`).join("")}</div>
      </div>
      <button class="primary-btn full-width" onclick="TIMIK.newJob()">+ New Job</button>
      <div style="height:10px"></div>
      ${jobs.map(j => `<div class="saved-job-card">
        <div class="card-line"><h4>${moneySafe(j.jobNo)} ${moneySafe(jobTitle(j))}</h4><span class="status-badge ${statusClass(j.status)}">${moneySafe(j.status)}</span></div>
        <div class="card-line"><span>Customer</span><strong>${moneySafe(j.customer || "-")}</strong></div>
        <div class="card-line"><span>Engineer</span><strong>${moneySafe(j.engineer || j.signOffEngineer || "-")}</strong></div>
        <div class="card-line"><span>Updated</span><strong>${fmtDate(j.updatedAt)}</strong></div>
        <div class="action-row" style="margin-top:10px;">
          <button class="primary-btn" onclick="TIMIK.openJob('${j.id}')">Open</button>
          <button class="secondary-btn" onclick="TIMIK.duplicateJob('${j.id}')">Duplicate</button>
          <button class="danger-btn" onclick="TIMIK.deleteJob('${j.id}')">Delete</button>
        </div>
      </div>`).join("") || `<div class="empty">No saved jobs found.</div>`}`;
    renderShell(content);
  }

  function renderSettings() {
    const settings = state.settings || {};
    const content = `${renderHero()}
      <div class="settings-card version-card">
        <div>
          <h2 class="mini-title no-margin">App Version</h2>
          <p class="help">Use this to check whether your phone is loading the newest GitHub Pages version.</p>
        </div>
        <div class="version-pill">${APP_VERSION}</div>
      </div>

      <h2 class="mini-title">Workshop Defaults</h2>
      <div class="settings-card">
        ${field("Workshop name", settings.workshopName || "TIMIK Agriculture", "TIMIK.updateSetting(\'workshopName\', this.value)")}
        ${field("Default engineer", settings.defaultEngineer || "", "TIMIK.updateSetting(\'defaultEngineer\', this.value)", "text", 'placeholder="Engineer name"')}
        ${field("Default report email", settings.defaultEmail || "", "TIMIK.updateSetting(\'defaultEmail\', this.value)", "email", 'placeholder="workshop@example.co.uk"')}
        <p class="help">These are simple defaults only. They do not change old records.</p>
      </div>

      <h2 class="mini-title">Data Management</h2>
      ${listLink("👥", "Customers", `${state.customers.length} saved customers`)}
      ${listLink("⚙️", "Engine Library", "Add preset engine types later")}
      ${listLink("🧰", "Parts Library", "Reuse frequent rebuild parts later")}
      ${listLink("👷", "Engineer names", "Typed directly on jobs and diary entries")}
      <button class="secondary-btn full-width" onclick="TIMIK.exportData()">Export All Data</button>
      <button class="secondary-btn full-width" onclick="document.getElementById('importFile').click()">Import Data Backup</button>
      <input id="importFile" type="file" accept="application/json" style="display:none" onchange="TIMIK.importData(event)" />
      <button class="danger-btn full-width" onclick="TIMIK.clearAllData()">Clear All Data</button>

      <h2 class="mini-title">Password Protection</h2>
      <div class="settings-card">
        <div class="card-line"><span>Status</span><strong>${settings.passwordEnabled ? "Enabled" : "Disabled"}</strong></div>
        <label class="check-item tick-choice">
          <span>Require password when opening the app</span>
          <input type="checkbox" ${settings.passwordEnabled ? "checked" : ""} onchange="TIMIK.updatePasswordEnabled(this.checked)" />
        </label>
        ${field("App password", settings.appPassword || settings.password || DEFAULT_PASSWORD, "TIMIK.updatePassword(this.value)", "text", 'placeholder="Password"')}
        <p class="help">Default password is <strong>timik</strong>. This is basic local app protection for workshop use.</p>
        <button class="secondary-btn full-width" onclick="TIMIK.lockApp()">Lock App Now</button>
      </div>

      <h2 class="mini-title">App Refresh</h2>
      <div class="settings-card">
        <p class="help">If your iPhone/iPad is showing old buttons or an old layout, press this. It clears the PWA cache and reloads the latest files.</p>
        <button class="primary-btn full-width" onclick="TIMIK.refreshApp()">Refresh App / Clear Cache</button>
      </div>

      <h2 class="mini-title">About</h2>
      ${listLink("ℹ️", "About TIMIK Engine Rebuild", "Fast workshop documentation for engine rebuilds")}
      ${listLink("📱", "PWA / Install", "Use Add to Home Screen on iPhone/iPad")}
      ${listLink("🔐", "Password Protection", settings.passwordEnabled ? "Enabled" : "Disabled")}
      <div class="footer-brand">Powered by SouthWorx • ${APP_VERSION}</div>`;
    renderShell(content);
  }

  function listLink(icon, title, subtitle) {
    return `<div class="list-link"><span class="list-icon">${icon}</span><span>${moneySafe(title)}<br><small class="help">${moneySafe(subtitle)}</small></span><span>›</span></div>`;
  }

  function render() {
    if (isLocked()) return renderLogin();
    if (ui.tab === "engine") return renderEngine();
    if (ui.tab === "diary") return renderDiary();
    if (ui.tab === "report") return renderReport();
    if (ui.tab === "saved") return renderSaved();
    if (ui.tab === "settings") return renderSettings();
  }

  function jobTitle(j) {
    return [j.engineMake, j.engineModel].filter(Boolean).join(" ") || "Engine Rebuild";
  }

  function setBooleanCheck(key, label, val) {
    const j = currentJob();
    if (!j[key]) j[key] = {};
    j[key][label] = !!val;
    j.updatedAt = todayISO();
    persist();
  }

  function setCheck(key, label, val) {
    const j = currentJob();
    if (!j[key]) j[key] = {};
    j[key][label] = val;
    j.updatedAt = todayISO();
    persist();
    render();
  }

  function setStage(stage, val) {
    const j = currentJob();
    if (!j.stages) j.stages = {};
    j.stages[stage] = val;
    j.updatedAt = todayISO();
    persist();
    render();
  }

  function setPartDraft(key, val, shouldRender = false) {
    ui.partDraft[key] = val;
    if (shouldRender) render();
  }

  function addPart() {
    const d = ui.partDraft;
    if (!d.partNo && !d.description) return showToast("Add a part number or description first");
    const j = currentJob();
    j.parts = j.parts || [];
    j.parts.unshift({ partNo: d.partNo, description: d.description, qty: d.qty || "1", notes: d.addNotes ? d.notes : "" });
    j.updatedAt = todayISO();
    ui.partDraft = { partNo: "", description: "", qty: "1", addNotes: false, notes: "" };
    persist();
    showToast("Part added");
  }

  function removePart(idx) {
    const j = currentJob();
    j.parts.splice(idx, 1);
    j.updatedAt = todayISO();
    persist();
    render();
  }

  function setMeasurementDraft(key, val) {
    ui.measurementDraft[key] = val;
  }

  function addMeasurement() {
    const d = ui.measurementDraft;
    if (!d.item && !d.spec && !d.actual) return showToast("Add measurement details first");
    const j = currentJob();
    j.measurements = j.measurements || [];
    j.measurements.unshift({ ...d });
    ui.measurementDraft = { item: "", spec: "", actual: "" };
    j.updatedAt = todayISO();
    persist();
    showToast("Measurement added");
  }

  function removeMeasurement(idx) {
    const j = currentJob();
    j.measurements.splice(idx, 1);
    j.updatedAt = todayISO();
    persist();
    render();
  }

  function handlePhotos(event, mode) {
    const files = [...event.target.files].slice(0, 12);
    const target = mode === "job" ? currentJob() : ui.diaryDraft;
    target.photos = target.photos || [];
    let remaining = files.length;
    if (!remaining) return;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        target.photos.push(reader.result);
        remaining--;
        if (remaining === 0) {
          if (mode === "job") {
            currentJob().updatedAt = todayISO();
            persist();
          }
          render();
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function removePhoto(idx, mode) {
    if (mode === "job") {
      const j = currentJob();
      j.photos.splice(idx, 1);
      j.updatedAt = todayISO();
      persist();
    }
    render();
  }


  function handleStagePhotos(event, stage) {
    const files = [...event.target.files].slice(0, 12);
    const j = currentJob();
    j.photos = j.photos || [];
    let remaining = files.length;
    if (!remaining) return;
    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        j.photos.push({ id: uid(), stage, src: reader.result, name: file.name || "Workshop photo", addedAt: todayISO() });
        remaining--;
        if (remaining === 0) {
          j.updatedAt = todayISO();
          persist();
          render();
        }
      };
      reader.readAsDataURL(file);
    });
  }

  function removeStagePhoto(photoId) {
    const j = currentJob();
    j.photos = (j.photos || []).filter(p => p.id !== photoId);
    j.updatedAt = todayISO();
    persist();
    render();
  }

  function setLoginPassword(value) {
    ui.loginPassword = value;
  }

  function unlockApp() {
    const expected = state.settings?.appPassword || state.settings?.password || DEFAULT_PASSWORD;
    if (ui.loginPassword === expected) {
      ui.unlocked = true;
      ui.loginPassword = "";
      ui.loginError = "";
      sessionStorage.setItem("timikUnlocked", "yes");
      render();
      return;
    }
    ui.loginError = "Incorrect password";
    render();
  }

  function lockApp() {
    ui.unlocked = false;
    ui.loginPassword = "";
    ui.loginError = "";
    sessionStorage.removeItem("timikUnlocked");
    render();
  }

  function updatePasswordEnabled(enabled) {
    state.settings = state.settings || {};
    state.settings.passwordEnabled = !!enabled;
    if (!state.settings.appPassword) state.settings.appPassword = state.settings.password || DEFAULT_PASSWORD;
    persist();
    if (!enabled) {
      ui.unlocked = true;
      sessionStorage.setItem("timikUnlocked", "yes");
    }
    render();
  }

  function updatePassword(value) {
    state.settings = state.settings || {};
    state.settings.appPassword = value || DEFAULT_PASSWORD;
    state.settings.password = state.settings.appPassword;
    state.settings.passwordEnabled = true;
    persist();
  }

  function setDiaryDraft(key, val) {
    ui.diaryDraft[key] = val;
  }

  function addDiaryEntry() {
    const d = ui.diaryDraft;
    if (!d.date || !d.jobId || !d.hours) return showToast("Date, job and hours are required");
    state.diary.unshift({ ...d, id: uid() });
    ui.diaryDraft = blankDiary();
    persist();
    showToast("Diary entry added");
  }

  function deleteDiary(id) {
    if (!confirm("Delete this diary entry?")) return;
    state.diary = state.diary.filter(e => e.id !== id);
    persist();
    render();
  }

  function getWeekRange(offset = 0) {
    const now = new Date();
    now.setDate(now.getDate() + offset * 7);
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const iso = d => d.toISOString().slice(0,10);
    return { start: iso(monday), end: iso(sunday), startDate: monday, endDate: sunday };
  }

  function getWeekEntries() {
    const r = getWeekRange(ui.reportWeekOffset);
    return state.diary.filter(e => e.date >= r.start && e.date <= r.end).sort((a,b) => (a.date || "").localeCompare(b.date || ""));
  }

  function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
  }

  function changeWeek(delta) {
    ui.reportWeekOffset += delta;
    render();
  }

  function countPartsLines(text) {
    if (!text) return 0;
    return text.split(/\n|,/).map(x => x.trim()).filter(Boolean).length;
  }

  let savedSearchTimer = null;
  function setSavedSearch(v) {
    ui.savedSearch = v;
    clearTimeout(savedSearchTimer);
    savedSearchTimer = setTimeout(render, 250);
  }
  function setSavedFilter(v) { ui.savedFilter = v; render(); }

  function openJob(id) {
    ui.currentJobId = id;
    state.currentJobId = id;
  loadOpenSectionsForJob((state.jobs || []).find(j => j.id === state.currentJobId));
    ui.tab = "engine";
    persist();
    render();
  }

  function plainJobSummary(j) {
    return [
      `TIMIK Agriculture - Engine Rebuild Record`,
      `Powered by SouthWorx`,
      ``,
      `Job: ${j.jobNo}`,
      `Status: ${j.status}`,
      `Customer: ${j.customer}`,
      `Engine: ${j.engineMake} ${j.engineModel}`,
      `Engine Serial: ${j.engineSerial}`,
      `Photos: ${(j.photos || []).length}`,
      ``,
      `Parts Used:`,
      ...(j.parts || []).map(p => `- ${p.qty || 1} x ${p.partNo || ""} ${p.description || ""}${p.notes ? " (" + p.notes + ")" : ""}`),
      ``,
      `Final Notes: ${j.finalNotes || ""}`,
      `Warranty Notes: ${j.warrantyNotes || ""}`
    ].join("\n");
  }

  function printJob() {
    saveCurrentJob();
    window.print();
  }

  function emailJob() {
    const j = currentJob();
    const subject = encodeURIComponent(`TIMIK Engine Rebuild Record - ${j.jobNo}`);
    const body = encodeURIComponent(plainJobSummary(j));
    window.location.href = `mailto:${encodeURIComponent(j.email || "")}?subject=${subject}&body=${body}`;
  }

  function weeklyReportText() {
    const r = getWeekRange(ui.reportWeekOffset);
    const entries = getWeekEntries();
    const total = entries.reduce((a,e) => a + num(e.hours), 0).toFixed(2);
    const lines = [
      `TIMIK Agriculture - Weekly Workshop Report`,
      `Powered by SouthWorx`,
      ``,
      `Week: ${fmtDate(r.start)} - ${fmtDate(r.end)}`,
      `Total hours: ${total}`,
      ``,
      `Entries:`
    ];
    entries.forEach(e => {
      const j = state.jobs.find(x => x.id === e.jobId);
      lines.push(`- ${fmtDate(e.date)} | ${e.engineer || "-"} | ${j?.jobNo || "-"} ${j ? jobTitle(j) : ""} | ${e.hours || 0} hours | ${e.workDone || ""}`);
      if (e.partsFitted) lines.push(`  Parts: ${e.partsFitted}`);
      if (e.issues) lines.push(`  Issues: ${e.issues}`);
    });
    return lines.join("\n");
  }

  function printWeeklyReport() {
    window.print();
  }

  function emailWeeklyReport() {
    const subject = encodeURIComponent("TIMIK Agriculture - Weekly Workshop Report");
    const body = encodeURIComponent(weeklyReportText());
    window.location.href = `mailto:${encodeURIComponent(state.settings?.defaultEmail || "")}?subject=${subject}&body=${body}`;
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timik-engine-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!Array.isArray(imported.jobs) || !Array.isArray(imported.diary)) throw new Error("Invalid backup");
        state = imported;
        if (!state.engineers) state.engineers = DEFAULT_ENGINEERS;
        ui.currentJobId = state.currentJobId || state.jobs[0]?.id;
        persist();
        showToast("Backup imported");
      } catch {
        showToast("Could not import backup");
      }
    };
    reader.readAsText(file);
  }


  function updateSetting(key, val) {
    state.settings = state.settings || {};
    state.settings[key] = val;
    if (key === "defaultEngineer") {
      if (!ui.diaryDraft.engineer) ui.diaryDraft.engineer = val;
      const job = currentJob();
      if (job && !job.engineer) job.engineer = val;
      if (job && !job.signOffEngineer) job.signOffEngineer = val;
    }
    persist();
  }

  async function refreshApp() {
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(reg => reg.unregister()));
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }
      showToast("App cache cleared. Reloading...");
      setTimeout(() => window.location.reload(true), 600);
    } catch (e) {
      console.warn(e);
      window.location.reload(true);
    }
  }

  function clearAllData() {
    if (!confirm("Clear all local app data? This cannot be undone.")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = loadState();
    const first = blankJob();
    state.jobs.push(first);
    ui.currentJobId = first.id;
    state.currentJobId = first.id;
  loadOpenSectionsForJob((state.jobs || []).find(j => j.id === state.currentJobId));
    persist();
    render();
  }

  window.TIMIK = {
    setTab, newJob, saveCurrentJob, toggleSection, updateJob, updateJobField, startJobTimer, stopJobTimer, setBooleanCheck, setCheck, setStage,
    setPartDraft, addPart, removePart, setMeasurementDraft, addMeasurement, removeMeasurement,
    handlePhotos, removePhoto, handleStagePhotos, removeStagePhoto, setLoginPassword, unlockApp, lockApp, updatePasswordEnabled, updatePassword, setDiaryDraft, addDiaryEntry, deleteDiary,
    changeWeek, printJob, emailJob, printWeeklyReport, emailWeeklyReport,
    setSavedSearch, setSavedFilter, openJob, duplicateJob, deleteJob,
    exportData, importData, updateSetting, refreshApp, clearAllData
  };

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(console.warn));
  }

  saveOpenSectionsForJob();
  render();
  setInterval(updateTimerDisplay, 1000);
})();


// V15 — reusable parts choices for future/add-part UI
window.TIMIK_PART_TYPES = ["New", "Reused", "Customer supplied", "Sent for repair"];


/* V16 — Parts Section Logic helpers
   These helpers are intentionally defensive so they do not break older saved jobs.
   They standardise part records ready for the job-card parts UI. */
window.TIMIK_PART_TYPES = window.TIMIK_PART_TYPES || ["New", "Reused", "Customer supplied", "Sent for repair"];

window.normaliseTimikPart = function(part) {
  return {
    id: part.id || ("part_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7)),
    partNumber: part.partNumber || part.number || "",
    description: part.description || part.name || "",
    quantity: part.quantity || part.qty || "1",
    type: part.type || "New",
    notes: part.notes || ""
  };
};

window.addTimikPart = function(job, part) {
  if (!job) return job;
  if (!Array.isArray(job.parts)) job.parts = [];
  job.parts.unshift(window.normaliseTimikPart(part || {}));
  return job;
};

window.updateTimikPart = function(job, partId, patch) {
  if (!job || !Array.isArray(job.parts)) return job;
  job.parts = job.parts.map(function(part) {
    const normalised = window.normaliseTimikPart(part);
    return normalised.id === partId ? Object.assign({}, normalised, patch || {}) : normalised;
  });
  return job;
};

window.removeTimikPart = function(job, partId) {
  if (!job || !Array.isArray(job.parts)) return job;
  job.parts = job.parts.filter(function(part) {
    return window.normaliseTimikPart(part).id !== partId;
  });
  return job;
};



/* =====================================================
   V17 — Workflow card state persistence
   - New/unknown jobs start with all workflow sections collapsed.
   - User open/closed sections are remembered per job where possible.
   - Works with existing <details> cards and common collapsible button patterns.
   ===================================================== */
(function () {
  const V17_WORKFLOW_STORAGE_PREFIX = "timik.workflow.openSections.";

  function getActiveJobKey() {
    const candidates = [
      window.currentJob?.id,
      window.state?.currentJobId,
      window.state?.activeJobId,
      window.appState?.currentJobId,
      document.querySelector("[data-current-job-id]")?.getAttribute("data-current-job-id"),
      document.querySelector("[data-job-id]")?.getAttribute("data-job-id")
    ].filter(Boolean);
    return candidates[0] || "new-job";
  }

  function isWorkflowCard(el) {
    if (!el) return false;
    const text = (el.querySelector("summary, .card-title, .workflow-title, h2, h3, h4")?.textContent || el.textContent || "").trim().toLowerCase();
    const names = ["arrival", "strip down", "non workshop", "build", "dyno", "packaging", "parts", "sign off", "sign-off"];
    return names.some(n => text.includes(n)) || el.classList.contains("workflow-card") || el.classList.contains("job-section");
  }

  function getSectionName(el, index) {
    const raw = (el.querySelector("summary, .card-title, .workflow-title, h2, h3, h4")?.textContent || "").trim();
    return raw || ("section-" + index);
  }

  function getWorkflowCards() {
    const candidates = Array.from(document.querySelectorAll("details, .workflow-card, .job-section, .accordion-card, .collapsible-card"));
    return candidates.filter(isWorkflowCard);
  }

  function readOpenSet(jobKey) {
    try {
      return new Set(JSON.parse(localStorage.getItem(V17_WORKFLOW_STORAGE_PREFIX + jobKey) || "[]"));
    } catch {
      return new Set();
    }
  }

  function writeOpenSet(jobKey, openSet) {
    try {
      localStorage.setItem(V17_WORKFLOW_STORAGE_PREFIX + jobKey, JSON.stringify(Array.from(openSet)));
    } catch {}
  }

  function cardIsOpen(card) {
    if (card.tagName && card.tagName.toLowerCase() === "details") return card.open;
    if (card.classList.contains("is-open") || card.classList.contains("open") || card.classList.contains("expanded")) return true;
    const body = card.querySelector(".workflow-body, .card-body, .accordion-body, .collapsible-body, .section-body");
    if (body) return body.style.display !== "none" && !body.hidden;
    return false;
  }

  function setCardOpen(card, shouldOpen) {
    if (card.tagName && card.tagName.toLowerCase() === "details") {
      card.open = shouldOpen;
      return;
    }
    card.classList.toggle("is-open", shouldOpen);
    card.classList.toggle("collapsed", !shouldOpen);
    const body = card.querySelector(".workflow-body, .card-body, .accordion-body, .collapsible-body, .section-body");
    if (body) {
      body.hidden = !shouldOpen;
      body.style.display = shouldOpen ? "" : "none";
    }
  }

  function applyWorkflowState() {
    const jobKey = getActiveJobKey();
    const cards = getWorkflowCards();
    const openSet = readOpenSet(jobKey);

    cards.forEach((card, index) => {
      const name = getSectionName(card, index);
      card.dataset.v17SectionName = name;

      // New jobs/no stored state: force all sections closed.
      // Existing stored state: restore only stored open sections.
      setCardOpen(card, openSet.has(name));
    });
  }

  function saveWorkflowState() {
    const jobKey = getActiveJobKey();
    const cards = getWorkflowCards();
    const openSet = new Set();

    cards.forEach((card, index) => {
      const name = card.dataset.v17SectionName || getSectionName(card, index);
      if (cardIsOpen(card)) openSet.add(name);
    });

    writeOpenSet(jobKey, openSet);
  }

  document.addEventListener("toggle", function (event) {
    if (event.target && isWorkflowCard(event.target)) {
      setTimeout(saveWorkflowState, 0);
    }
  }, true);

  document.addEventListener("click", function (event) {
    const clickedHeader = event.target.closest("summary, .workflow-header, .card-header, .accordion-header, .collapsible-header");
    if (clickedHeader) {
      setTimeout(saveWorkflowState, 80);
    }
  }, true);

  const observer = new MutationObserver(function () {
    clearTimeout(window.__timikV17ApplyTimer);
    window.__timikV17ApplyTimer = setTimeout(function () {
      applyWorkflowState();
      // Style helper classes for buttons after renders.
      document.querySelectorAll(".choice-buttons, .status-buttons, .workflow-buttons, .segmented-buttons, .button-options, .option-buttons, .radio-group, .pill-row")
        .forEach(el => el.classList.add("v17-segmented"));
    }, 120);
  });

  window.addEventListener("load", function () {
    applyWorkflowState();
    observer.observe(document.body, { childList: true, subtree: true });
  });

  window.TIMIK_V17_applyWorkflowState = applyWorkflowState;
  window.TIMIK_V17_saveWorkflowState = saveWorkflowState;
})();
