const accessPassword = "lurch2026";
const accessStorageKey = "timik-engine-rebuild-access-v1";
const storageKey = "timik-engine-current-job-v1";
const jobsKey = "timik-engine-saved-jobs-v1";
const customersKey = "timik-engine-customers-v1";
const settingsKey = "timik-engine-settings-v1";
const diaryKey = "timik-engine-diary-v1";
const logoKey = "timik-engine-logo-v1";
const today = new Date().toISOString().slice(0, 10);

const fields = [
  "companyName","jobNumber","jobDate","engineer","labourHours","machineHours","customerName","contactDetails","address","machine","serialNumber",
  "engineMake","engineModel","engineSerial","buildReference","previousRebuild","jobStatus","oilCondition","coolantCondition","boreCondition","crankCondition","headCondition","ancillaryCondition",
  "damageFindings","measurements","torqueSettings","finalChecks","notes"
];
const stageNames = ["Strip complete","Clean and inspect","Machining complete","Bottom end built","Cylinder head fitted","Timed / fuel system set","Ancillaries fitted","Oil pressure checked","Leaks checked","Test run complete","Final inspection complete","Ready for collection"];
let parts = [{ partNumber:"", description:"", quantity:"" }];
let photos = [];
let stages = {};
let currentJobId = null;

function qs(id){return document.getElementById(id);}
function clean(v){return v && String(v).trim() ? String(v).trim() : "-";}
function formatDate(v){if(!v)return "-";return new Date(v + "T00:00:00").toLocaleDateString("en-GB");}
function escapeHtml(v){return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");}
function makeId(){return Date.now().toString(36) + Math.random().toString(36).slice(2,7);}
function parseHours(v){const n = Number(String(v || "").replace(",", ".")); return Number.isFinite(n) ? n : 0;}
function mondayOf(dateString){const d = dateString ? new Date(dateString + "T00:00:00") : new Date(); const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1); return d.toISOString().slice(0,10);}
function addDays(dateString, days){const d = new Date(dateString + "T00:00:00"); d.setDate(d.getDate() + days); return d.toISOString().slice(0,10);}

function unlockApp(){
  if(qs("accessCode").value.trim() === accessPassword){localStorage.setItem(accessStorageKey,"unlocked");showApp();}
  else qs("lockError").textContent = "Incorrect access code.";
}
function showApp(){qs("lockScreen").style.display="none";qs("appContent").classList.remove("locked");}
function checkAccess(){if(localStorage.getItem(accessStorageKey)==="unlocked")showApp();}

function getJobComplete(){return document.querySelector('input[name="jobComplete"]:checked')?.value || "no";}
function getData(){
  const data = {};
  fields.forEach(id => { if(qs(id)) data[id] = qs(id).value; });
  data.jobComplete = getJobComplete();
  data.id = currentJobId;
  data.parts = parts;
  data.photos = photos;
  data.stages = stages;
  data.updatedAt = new Date().toISOString();
  return data;
}
function setData(data){
  currentJobId = data.id || null;
  fields.forEach(id => { if(qs(id) && data[id] !== undefined) qs(id).value = data[id]; });
  const radio = document.querySelector(`input[name="jobComplete"][value="${data.jobComplete || "no"}"]`);
  if(radio) radio.checked = true;
  parts = Array.isArray(data.parts) && data.parts.length ? data.parts : [{ partNumber:"", description:"", quantity:"" }];
  photos = Array.isArray(data.photos) ? data.photos : [];
  stages = data.stages || {};
  renderStagesEditor();
  renderPartsEditor();
  renderPhotoPreviews();
  updatePreview();
}
function loadSavedCurrent(){
  const saved = localStorage.getItem(storageKey);
  if(saved){try{setData(JSON.parse(saved));return;}catch{localStorage.removeItem(storageKey);}}
  qs("jobDate").value = today;
  qs("companyName").value = "TIMIK Agriculture";
  renderStagesEditor();
  renderPartsEditor();
  updatePreview();
}
function updatePreview(){
  const data = getData();
  document.querySelectorAll("[data-preview]").forEach(el => {
    const key = el.getAttribute("data-preview");
    if(key === "companyName" && clean(data[key]) === "-"){el.textContent = "TIMIK Agriculture"; return;}
    el.textContent = key === "jobDate" ? formatDate(data[key]) : clean(data[key]);
  });
  const status = qs("previewStatus");
  const complete = data.jobComplete === "yes" || data.jobStatus === "Complete";
  status.textContent = complete ? "COMPLETE" : clean(data.jobStatus).toUpperCase();
  status.classList.toggle("complete", complete);
  renderPartsPreview();
  renderStagesPreview();
  renderPhotoPreviews();
  loadSettingsIntoPreview();
  localStorage.setItem(storageKey, JSON.stringify(data));
  qs("saveStatus").textContent = "Saved locally";
}

function renderStagesEditor(){
  const box = qs("stageChecks");
  box.innerHTML = stageNames.map((name, i) => `
    <label class="check-card"><input type="checkbox" data-stage="${i}" ${stages[name] ? "checked" : ""} /><span>${escapeHtml(name)}</span></label>
  `).join("");
  box.querySelectorAll("[data-stage]").forEach(cb => cb.addEventListener("change", e => {
    const name = stageNames[Number(e.target.dataset.stage)];
    stages[name] = e.target.checked;
    updatePreview();
  }));
}
function renderStagesPreview(){
  const rows = stageNames.map(name => `<tr><td>${escapeHtml(name)}</td><td class="qty-cell">${stages[name] ? "Yes" : "No"}</td></tr>`).join("");
  qs("stagePreview").innerHTML = `<table><thead><tr><th>Stage</th><th class="qty-cell">Done</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderPartsEditor(){
  const list = qs("partsList");
  list.innerHTML = "";
  parts.forEach((part, index) => {
    const div = document.createElement("div");
    div.className = "part-card";
    div.innerHTML = `
      <div class="part-card-top"><div class="part-card-title">Part ${index + 1}</div><button class="btn danger small" type="button" data-delete-part="${index}">Delete</button></div>
      <div class="part-card-grid">
        <label><span>Part Number</span><input type="text" value="${escapeHtml(part.partNumber)}" data-part-field="partNumber" data-part-index="${index}" placeholder="Part number" /></label>
        <label><span>Description</span><input type="text" value="${escapeHtml(part.description)}" data-part-field="description" data-part-index="${index}" placeholder="Description" /></label>
        <label><span>Qty</span><input type="text" inputmode="numeric" value="${escapeHtml(part.quantity)}" data-part-field="quantity" data-part-index="${index}" placeholder="1" /></label>
      </div>
      <label class="part-note-toggle"><input type="checkbox" data-part-note-toggle="${index}" ${part.showNotes || part.notes ? "checked" : ""} /> <span>Add notes for this part</span></label>
      <label class="part-notes ${part.showNotes || part.notes ? "" : "hidden"}"><span>Part Notes</span><textarea rows="2" data-part-field="notes" data-part-index="${index}" placeholder="Serial/batch, reason fitted, damage found, supplier note, etc.">${escapeHtml(part.notes || "")}</textarea></label>
      </div>`;
    list.appendChild(div);
  });
  list.querySelectorAll("[data-part-field]").forEach(input => input.addEventListener("input", e => {
    const i = Number(e.target.dataset.partIndex);
    parts[i][e.target.dataset.partField] = e.target.value;
    updatePreview();
  }));
  list.querySelectorAll("[data-part-note-toggle]").forEach(cb => cb.addEventListener("change", e => {
    const i = Number(e.target.dataset.partNoteToggle);
    parts[i].showNotes = e.target.checked;
    if(!e.target.checked) parts[i].notes = "";
    renderPartsEditor(); updatePreview();
  }));
  list.querySelectorAll("[data-delete-part]").forEach(btn => btn.addEventListener("click", e => {
    parts.splice(Number(e.target.dataset.deletePart), 1);
    if(!parts.length) parts.unshift({ partNumber:"", description:"", quantity:"", notes:"", showNotes:false });
    renderPartsEditor(); updatePreview();
  }));
}
function renderPartsPreview(){
  const usable = parts.filter(p => clean(p.partNumber) !== "-" || clean(p.description) !== "-" || clean(p.quantity) !== "-");
  if(!usable.length){qs("partsPreview").innerHTML = '<div class="parts-empty">-</div>'; return;}
  const rows = usable.map(p => `<tr><td>${escapeHtml(clean(p.partNumber))}</td><td>${escapeHtml(clean(p.description))}${clean(p.notes) !== "-" ? `<div class="part-note-preview">${escapeHtml(clean(p.notes))}</div>` : ""}</td><td class="qty-cell">${escapeHtml(clean(p.quantity))}</td></tr>`).join("");
  qs("partsPreview").innerHTML = `<table><thead><tr><th>Part Number</th><th>Description / Notes</th><th class="qty-cell">Qty</th></tr></thead><tbody>${rows}</tbody></table>`;
}
function addPart(){parts.unshift({ partNumber:"", description:"", quantity:"", notes:"", showNotes:false }); renderPartsEditor(); updatePreview(); qs("partsList")?.scrollIntoView({behavior:"smooth", block:"start"});}

function getSavedJobs(){try{return JSON.parse(localStorage.getItem(jobsKey)) || [];}catch{return [];}}
function setSavedJobs(jobs){localStorage.setItem(jobsKey, JSON.stringify(jobs)); renderSavedJobs(); refreshDiaryJobOptions();}
function saveJob(){
  const data = getData();
  if(clean(data.customerName) === "-" && clean(data.engineSerial) === "-" && clean(data.jobNumber) === "-"){
    alert("Add at least a customer name, engine serial or job number before saving.");
    return;
  }
  const jobs = getSavedJobs();
  let existing = currentJobId ? jobs.findIndex(j => j.id === currentJobId) : -1;
  if(existing < 0 && clean(data.jobNumber) !== "-") existing = jobs.findIndex(j => j.jobNumber && j.jobNumber === data.jobNumber);
  const id = existing >= 0 ? jobs[existing].id : makeId();
  currentJobId = id;
  const record = { ...data, id, savedAt: new Date().toISOString() };
  if(existing >= 0) jobs[existing] = record; else jobs.unshift(record);
  setSavedJobs(jobs);
  localStorage.setItem(storageKey, JSON.stringify(record));
  qs("saveStatus").textContent = "Engine job saved";
}
function renderSavedJobs(){
  const list = qs("savedJobsList"), jobs = getSavedJobs();
  list.innerHTML = "";
  if(!jobs.length){list.innerHTML = '<p class="helper">No saved engine jobs yet.</p>'; return;}
  jobs.forEach(j => {
    const row = document.createElement("div");
    row.className = "saved-item";
    row.innerHTML = `<div><strong>${escapeHtml(clean(j.jobNumber))} — ${escapeHtml(clean(j.customerName))}</strong><span>${formatDate(j.jobDate)} · ${escapeHtml(clean(j.engineMake))} ${escapeHtml(clean(j.engineModel))} · ${escapeHtml(clean(j.jobStatus))}</span></div><button class="btn small" data-load-job="${j.id}">Load</button><button class="btn danger small" data-delete-job="${j.id}">Delete</button>`;
    list.appendChild(row);
  });
  list.querySelectorAll("[data-load-job]").forEach(b => b.onclick = () => {const job = getSavedJobs().find(j => j.id === b.dataset.loadJob); if(job){setData(job); switchTab("job");}});
  list.querySelectorAll("[data-delete-job]").forEach(b => b.onclick = () => setSavedJobs(getSavedJobs().filter(j => j.id !== b.dataset.deleteJob)));
}
function getCustomers(){try{return JSON.parse(localStorage.getItem(customersKey)) || [];}catch{return [];}}
function setCustomers(c){localStorage.setItem(customersKey, JSON.stringify(c)); renderCustomers();}
function saveCustomer(){
  const c = {id:makeId(), customerName:qs("customerName").value, contactDetails:qs("contactDetails").value, address:qs("address").value, machine:qs("machine").value, serialNumber:qs("serialNumber").value};
  if(clean(c.customerName) === "-"){alert("Enter a customer name first."); return;}
  const customers = getCustomers().filter(x => x.customerName !== c.customerName);
  customers.unshift(c); setCustomers(customers);
}
function renderCustomers(){
  const list = qs("customerList"), customers = getCustomers();
  list.innerHTML = "";
  if(!customers.length){list.innerHTML = '<p class="helper">No customers saved yet.</p>'; return;}
  customers.forEach(c => {
    const row = document.createElement("div"); row.className = "saved-item";
    row.innerHTML = `<div><strong>${escapeHtml(clean(c.customerName))}</strong><span>${escapeHtml(clean(c.contactDetails))}</span></div><button class="btn small" data-load-customer="${c.id}">Use</button><button class="btn danger small" data-delete-customer="${c.id}">Delete</button>`;
    list.appendChild(row);
  });
  list.querySelectorAll("[data-load-customer]").forEach(b => b.onclick = () => {const c = getCustomers().find(x => x.id === b.dataset.loadCustomer); if(c){["customerName","contactDetails","address","machine","serialNumber"].forEach(id => qs(id).value = c[id] || ""); updatePreview();}});
  list.querySelectorAll("[data-delete-customer]").forEach(b => b.onclick = () => setCustomers(getCustomers().filter(c => c.id !== b.dataset.deleteCustomer)));
}

function getSettings(){try{return JSON.parse(localStorage.getItem(settingsKey)) || {};}catch{return {};}}
function saveSettings(){
  const settings = {workshopPhone:qs("workshopPhone").value, workshopEmail:qs("workshopEmail").value, footerText:qs("footerText").value, logo:localStorage.getItem(logoKey) || ""};
  localStorage.setItem(settingsKey, JSON.stringify(settings)); loadSettingsIntoPreview(); qs("settingsModal").classList.add("hidden");
}
function loadSettingsIntoFields(){const s = getSettings(); qs("workshopPhone").value = s.workshopPhone || ""; qs("workshopEmail").value = s.workshopEmail || ""; qs("footerText").value = s.footerText || "Powered by SouthWorx";}
function loadSettingsIntoPreview(){
  const s = getSettings();
  qs("previewWorkshopPhone").textContent = s.workshopPhone || "-";
  qs("previewWorkshopEmail").textContent = s.workshopEmail || "-";
  document.querySelectorAll(".footer-note").forEach(f => f.textContent = s.footerText || "Powered by SouthWorx");
  const logo = qs("previewLogo");
  if(s.logo){logo.src = s.logo; logo.classList.remove("hidden");} else logo.classList.add("hidden");
}
function handleLogoUpload(file){if(!file)return; const reader = new FileReader(); reader.onload = () => {localStorage.setItem(logoKey, reader.result); const s = getSettings(); s.logo = reader.result; localStorage.setItem(settingsKey, JSON.stringify(s)); loadSettingsIntoPreview();}; reader.readAsDataURL(file);}
function handlePhotoUpload(files){
  const selected = Array.from(files).slice(0,3); photos = [];
  if(!selected.length){renderPhotoPreviews(); updatePreview(); return;}
  let loaded = 0;
  selected.forEach(file => {const reader = new FileReader(); reader.onload = () => {photos.push(reader.result); loaded++; if(loaded === selected.length){renderPhotoPreviews(); updatePreview();}}; reader.readAsDataURL(file);});
}
function renderPhotoPreviews(){
  const inline = qs("inlinePhotoPreview"), preview = qs("previewPhotos"); if(!inline || !preview) return;
  if(!photos.length){inline.innerHTML = '<p class="helper">No photos added.</p>'; preview.innerHTML = '<div class="parts-empty">-</div>'; return;}
  const imgs = photos.map(p => `<img src="${p}" alt="Workshop photo" />`).join(""); inline.innerHTML = imgs; preview.innerHTML = imgs;
}

function clearForm(){
  fields.forEach(id => { if(qs(id)) qs(id).value = ""; });
  qs("jobDate").value = today; qs("companyName").value = "TIMIK Agriculture";
  document.querySelector('input[name="jobComplete"][value="no"]').checked = true;
  currentJobId = null;
  parts = [{ partNumber:"", description:"", quantity:"", notes:"", showNotes:false }]; photos = []; stages = {};
  renderStagesEditor(); renderPartsEditor(); renderPhotoPreviews(); updatePreview();
}
function loadSample(){
  setData({companyName:"TIMIK Agriculture",jobNumber:"TIMIK-000124",jobDate:today,engineer:"D. Smith",labourHours:"7.5",machineHours:"4280",customerName:"Greenfield Farm",contactDetails:"office@example.co.uk / 01234 567890",address:"Greenfield Farm\nWinchester Road\nHampshire",machine:"Massey Ferguson tractor",serialNumber:"MF-123456",engineMake:"Perkins",engineModel:"1104",engineSerial:"PK1104-987654",buildReference:"RB-2026-014",previousRebuild:"Unknown",jobStatus:"In Progress",oilCondition:"Metal Present",coolantCondition:"None Found",boreCondition:"Monitor",crankCondition:"Requires Polish",headCondition:"Pressure Test Required",ancillaryCondition:"Repair Required",damageFindings:"Engine stripped. Metal contamination found in sump. Main bearings worn and crank requires inspection before rebuild approval.",measurements:"Main bearing clearances recorded. Liner heights to be confirmed after cleaning. Crank journals measured and logged for machine shop.",torqueSettings:"Torque settings to be confirmed against engine manual before final build.",parts:[{partNumber:"PK-GSK-1104",description:"Full gasket set",quantity:"1",notes:"Required after strip-down inspection",showNotes:true},{partNumber:"PK-MB-STD",description:"Main bearing set",quantity:"1",notes:"Check final size after crank polish",showNotes:true},{partNumber:"PK-BE-STD",description:"Big end bearing set",quantity:"1"}],stages:{"Strip complete":true,"Clean and inspect":true},finalChecks:"Final checks not yet completed.",notes:"Customer to be advised once machine shop report is returned.",jobComplete:"no"});
}

function makePartsEmailTable(usableParts){
  if(!usableParts.length) return "-";
  const headers = ["Part Number", "Description", "Qty", "Notes"];
  const rows = usableParts.map(p => [clean(p.partNumber), clean(p.description), clean(p.quantity), clean(p.notes)]);
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => r[i].length)) + 4);
  const formatRow = row => row.map((cell, i) => String(cell).padEnd(widths[i], " ")).join("");
  return [formatRow(headers), formatRow(widths.map(w => "-".repeat(Math.max(3, w - 4)))), ...rows.map(formatRow)].join("\n");
}
function sendEmail(){
  const d = getData(); const usable = parts.filter(p => clean(p.partNumber) !== "-" || clean(p.description) !== "-" || clean(p.quantity) !== "-"); const settings = getSettings();
  const stagesText = stageNames.map(s => `${s}: ${stages[s] ? "Yes" : "No"}`).join("\n");
  const subject = `TIMIK Engine Rebuild ${clean(d.jobNumber)} - ${clean(d.customerName)}`;
  const body = ["TIMIK Agriculture - Engine Rebuild Record","",`Workshop Phone: ${settings.workshopPhone || "-"}`,`Workshop Email: ${settings.workshopEmail || "-"}`,"",`Status: ${clean(d.jobStatus)}`,`Build Complete: ${d.jobComplete === "yes" ? "Yes" : "No"}`,`Job Number: ${clean(d.jobNumber)}`,`Date: ${formatDate(d.jobDate)}`,`Engineer: ${clean(d.engineer)}`,`Labour Hours: ${clean(d.labourHours)}`,"",`Customer: ${clean(d.customerName)}`,`Contact: ${clean(d.contactDetails)}`,`Address: ${clean(d.address)}`,"",`Machine: ${clean(d.machine)}`,`Machine Serial / Reg: ${clean(d.serialNumber)}`,`Machine Hours: ${clean(d.machineHours)}`,"",`Engine: ${clean(d.engineMake)} ${clean(d.engineModel)}`,`Engine Serial: ${clean(d.engineSerial)}`,`Build Ref: ${clean(d.buildReference)}`,"","Damage Findings:",clean(d.damageFindings),"","Measurements / Tolerances:",clean(d.measurements),"","Torque / Build Notes:",clean(d.torqueSettings),"","Parts Used / Required:",makePartsEmailTable(usable),"","Rebuild Stages:",stagesText,"","Final Checks:",clean(d.finalChecks),"","Additional Notes:",clean(d.notes),"","Note: To send a PDF copy, use Print / Save PDF first and attach the saved PDF manually.","",settings.footerText || "Powered by SouthWorx"].join("\n");
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function getDiaryEntries(){try{return JSON.parse(localStorage.getItem(diaryKey)) || [];}catch{return [];}}
function setDiaryEntries(entries){localStorage.setItem(diaryKey, JSON.stringify(entries)); renderDiaryEntries();}
function refreshDiaryJobOptions(){
  const sel = qs("diaryJob"); if(!sel) return;
  const current = sel.value;
  const jobs = getSavedJobs();
  sel.innerHTML = '<option value="">Select saved job</option>' + jobs.map(j => `<option value="${escapeHtml(j.id)}">${escapeHtml(clean(j.jobNumber))} — ${escapeHtml(clean(j.customerName))} — ${escapeHtml(clean(j.engineMake))} ${escapeHtml(clean(j.engineModel))}</option>`).join("");
  sel.value = current;
}
function saveDiaryEntry(){
  const jobId = qs("diaryJob").value;
  if(!jobId){alert("Select a saved engine job first."); return;}
  const job = getSavedJobs().find(j => j.id === jobId);
  const entry = {id:makeId(), date:qs("diaryDate").value || today, engineer:qs("diaryEngineer").value, jobId, jobNumber:job?.jobNumber || "", customerName:job?.customerName || "", engineLabel:`${job?.engineMake || ""} ${job?.engineModel || ""}`.trim(), hours:qs("diaryHours").value, work:qs("diaryWork").value, parts:qs("diaryParts").value, issues:qs("diaryIssues").value, status:qs("diaryStatus").value, completed:qs("diaryCompleted").value, savedAt:new Date().toISOString()};
  const entries = getDiaryEntries(); entries.unshift(entry); setDiaryEntries(entries); clearDiaryForm(false);
}
function clearDiaryForm(resetDate = true){
  if(resetDate) qs("diaryDate").value = today;
  ["diaryEngineer","diaryHours","diaryWork","diaryParts","diaryIssues"].forEach(id => qs(id).value = "");
  qs("diaryJob").value = ""; qs("diaryStatus").value = "In Progress"; qs("diaryCompleted").value = "No";
}
function renderDiaryEntries(){
  const list = qs("diaryList"); if(!list) return;
  const entries = getDiaryEntries(); list.innerHTML = "";
  if(!entries.length){list.innerHTML = '<p class="helper">No diary entries yet.</p>'; return;}
  entries.forEach(e => {
    const row = document.createElement("div"); row.className = "saved-item";
    row.innerHTML = `<div><strong>${formatDate(e.date)} — ${escapeHtml(clean(e.engineer))} — ${escapeHtml(clean(e.jobNumber))}</strong><span>${escapeHtml(clean(e.customerName))} · ${escapeHtml(clean(e.engineLabel))} · ${escapeHtml(clean(e.hours))} hrs · ${escapeHtml(clean(e.status))}</span><span>${escapeHtml(clean(e.work))}</span></div><button class="btn danger small" data-delete-diary="${e.id}">Delete</button>`;
    list.appendChild(row);
  });
  list.querySelectorAll("[data-delete-diary]").forEach(b => b.onclick = () => setDiaryEntries(getDiaryEntries().filter(e => e.id !== b.dataset.deleteDiary)));
}

function buildWeeklyReport(){
  const start = qs("weekStart").value || mondayOf(today); qs("weekStart").value = start;
  const endExclusive = addDays(start, 7); const endDisplay = addDays(start, 6);
  const entries = getDiaryEntries().filter(e => e.date >= start && e.date < endExclusive).sort((a,b) => a.date.localeCompare(b.date));
  const totalHours = entries.reduce((sum, e) => sum + parseHours(e.hours), 0);
  const jobs = {};
  entries.forEach(e => {const key = e.jobNumber || e.jobId || "Unknown"; if(!jobs[key]) jobs[key] = {jobNumber:e.jobNumber, customerName:e.customerName, engineLabel:e.engineLabel, hours:0, completed:false, parts:[], work:[]}; jobs[key].hours += parseHours(e.hours); if(e.completed === "Yes") jobs[key].completed = true; if(clean(e.parts) !== "-") jobs[key].parts.push(e.parts); if(clean(e.work) !== "-") jobs[key].work.push(`${formatDate(e.date)}: ${e.work}`);});
  const jobRows = Object.values(jobs).map(j => `<tr><td>${escapeHtml(clean(j.jobNumber))}</td><td>${escapeHtml(clean(j.customerName))}</td><td>${escapeHtml(clean(j.engineLabel))}</td><td class="qty-cell">${j.hours.toFixed(1)}</td><td>${j.completed ? "Yes" : "No"}</td></tr>`).join("") || '<tr><td colspan="5">No diary entries for this week.</td></tr>';
  const diaryRows = entries.map(e => `<tr><td>${formatDate(e.date)}</td><td>${escapeHtml(clean(e.engineer))}</td><td>${escapeHtml(clean(e.jobNumber))}</td><td class="qty-cell">${escapeHtml(clean(e.hours))}</td><td>${escapeHtml(clean(e.status))}</td><td>${escapeHtml(clean(e.parts))}</td></tr>`).join("") || '<tr><td colspan="6">No diary entries for this week.</td></tr>';
  qs("weeklyReportCard").innerHTML = `
    <div class="job-card-watermark">TIMIK</div>
    <div class="job-card-top"><div><p class="eyebrow">Weekly Workshop Report</p><h2>TIMIK Agriculture</h2></div><div class="job-number-box"><span>WEEK</span><strong>${formatDate(start)}</strong></div></div>
    <div class="accent-line"></div>
    <div class="info-grid three"><div><span>Week Starting</span><strong>${formatDate(start)}</strong></div><div><span>Week Ending</span><strong>${formatDate(endDisplay)}</strong></div><div><span>Prepared By</span><strong>${escapeHtml(clean(qs("reportPreparedBy").value))}</strong></div><div><span>Total Hours</span><strong>${totalHours.toFixed(1)}</strong></div><div><span>Jobs Worked On</span><strong>${Object.keys(jobs).length}</strong></div><div><span>Engines Completed</span><strong>${Object.values(jobs).filter(j => j.completed).length}</strong></div></div>
    <h3>Hours Per Job</h3><div class="parts-preview"><table><thead><tr><th>Job</th><th>Customer</th><th>Engine</th><th class="qty-cell">Hours</th><th>Completed</th></tr></thead><tbody>${jobRows}</tbody></table></div>
    <h3>Diary Detail</h3><div class="parts-preview"><table><thead><tr><th>Date</th><th>Engineer</th><th>Job</th><th class="qty-cell">Hours</th><th>Status</th><th>Parts Fitted</th></tr></thead><tbody>${diaryRows}</tbody></table></div>
    <p class="footer-note">${escapeHtml(getSettings().footerText || "Powered by SouthWorx")}</p>`;
  qs("jobCard").classList.add("hidden"); qs("weeklyReportCard").classList.remove("hidden"); qs("previewTitle").textContent = "Weekly Report Preview"; qs("saveStatus").textContent = `${entries.length} diary entries included`;
}
function sendWeeklyReportEmail(){
  const start = qs("weekStart").value || mondayOf(today); const endExclusive = addDays(start, 7);
  const entries = getDiaryEntries().filter(e => e.date >= start && e.date < endExclusive).sort((a,b) => a.date.localeCompare(b.date));
  const totalHours = entries.reduce((sum, e) => sum + parseHours(e.hours), 0);
  const lines = entries.map(e => `${formatDate(e.date)} | ${clean(e.engineer)} | ${clean(e.jobNumber)} | ${clean(e.hours)} hrs | ${clean(e.status)} | Parts: ${clean(e.parts)}`).join("\n") || "No diary entries for this week.";
  const subject = `TIMIK Weekly Workshop Report - Week Starting ${formatDate(start)}`;
  const body = [`TIMIK Agriculture - Weekly Workshop Report`,"",`Week Starting: ${formatDate(start)}`,`Prepared By: ${clean(qs("reportPreparedBy").value)}`,`Total Hours: ${totalHours.toFixed(1)}`,"","Diary Entries:",lines,"",getSettings().footerText || "Powered by SouthWorx"].join("\n");
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function switchTab(tab){
  ["job","diary","report"].forEach(t => {qs(`${t}Tab`).classList.toggle("hidden", t !== tab); document.querySelector(`[data-tab="${t}"]`).classList.toggle("active", t === tab);});
  if(tab === "report"){qs("jobCard").classList.add("hidden"); qs("weeklyReportCard").classList.remove("hidden"); if(!qs("weeklyReportCard").innerHTML.trim()) buildWeeklyReport(); qs("previewTitle").textContent = "Weekly Report Preview";}
  else {qs("weeklyReportCard").classList.add("hidden"); qs("jobCard").classList.remove("hidden"); qs("previewTitle").textContent = tab === "diary" ? "Current Engine Job Preview" : "Engine Job Preview"; updatePreview();}
  if(tab === "diary") refreshDiaryJobOptions();
}

qs("unlockBtn").onclick = unlockApp; qs("accessCode").onkeydown = e => {if(e.key === "Enter") unlockApp();};
document.querySelectorAll(".tab-btn").forEach(btn => btn.onclick = () => switchTab(btn.dataset.tab));
fields.forEach(id => { if(qs(id)) qs(id).addEventListener("input", updatePreview); if(qs(id)) qs(id).addEventListener("change", updatePreview); });
document.querySelectorAll('input[name="jobComplete"]').forEach(r => r.addEventListener("change", updatePreview));
qs("addPartBtn").onclick = addPart; qs("printBtn").onclick = () => window.print(); qs("emailBtn").onclick = sendEmail; qs("sampleBtn").onclick = loadSample; qs("clearBtn").onclick = clearForm; qs("saveJobBtn").onclick = saveJob; qs("saveCustomerBtn").onclick = saveCustomer;
qs("settingsBtn").onclick = () => {loadSettingsIntoFields(); qs("settingsModal").classList.remove("hidden");}; qs("closeSettingsBtn").onclick = () => qs("settingsModal").classList.add("hidden"); qs("saveSettingsBtn").onclick = saveSettings; qs("logoUpload").onchange = e => {if(e.target.files[0]) handleLogoUpload(e.target.files[0]);};
qs("managePhotosBtn").onclick = () => qs("photoModal").classList.remove("hidden"); qs("closePhotoBtn").onclick = () => qs("photoModal").classList.add("hidden"); qs("photoUpload").onchange = e => handlePhotoUpload(e.target.files);
qs("saveDiaryBtn").onclick = saveDiaryEntry; qs("clearDiaryBtn").onclick = () => clearDiaryForm(true); qs("buildReportBtn").onclick = buildWeeklyReport; qs("printReportBtn").onclick = () => {buildWeeklyReport(); window.print();}; qs("emailReportBtn").onclick = () => {buildWeeklyReport(); sendWeeklyReportEmail();};

qs("jobDate").value = today; qs("diaryDate").value = today; qs("weekStart").value = mondayOf(today);
checkAccess(); loadSavedCurrent(); renderSavedJobs(); renderCustomers(); refreshDiaryJobOptions(); renderDiaryEntries(); loadSettingsIntoPreview();
if("serviceWorker" in navigator){window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));}
