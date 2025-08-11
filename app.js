
/** Minimal client-side app for GitHub Pages.
 * - Loads data/BlokPeriodisering.xlsx via fetch + SheetJS
 * - Simple plan generator based on 1RM, exercise percentages, and phase intensity
 * - LocalStorage persistence for 1RM and history
 */

const BASES = ["Squat","Bench-Press","Deadlift","Military-Press","Pull-Up","Clean","Snatch","Bicep Curl"];
const PHASE_RULES = {
  "BeweegFase": { sets: 3, reps: 10, intensity: 0.60 },
  "BelastFase": { sets: 4, reps: 6,  intensity: 0.75 },
  "BeproefFase": { sets: 5, reps: 3,  intensity: 0.85 },
};
const GROUPS = ["Squat-Double Leg","Hinge-Double Leg","Push-Horizontal","Push-Vertical","Pull-Horizontal","Squat-Single Leg"];

const els = {
  phase: document.getElementById("phase"),
  onermGrid: document.getElementById("onerm-grid"),
  save1rm: document.getElementById("save-1rm"),
  gen: document.getElementById("gen"),
  plan: document.getElementById("plan"),
  dlPlan: document.getElementById("dl-plan"),
  search: document.getElementById("search"),
  movement: document.getElementById("movement"),
  exercises: document.getElementById("exercises"),
  logUI: document.getElementById("log-ui"),
  dlLog: document.getElementById("dl-log"),
  clearLog: document.getElementById("clear-log"),
};

const LS_1RM = "lchm_pages_onerm";
const LS_HIST = "lchm_pages_history";

function get1RM() {
  try { return JSON.parse(localStorage.getItem(LS_1RM)) || {}; } catch { return {}; }
}
function set1RM(obj) {
  localStorage.setItem(LS_1RM, JSON.stringify(obj));
}
function getHistory() {
  try { return JSON.parse(localStorage.getItem(LS_HIST)) || {}; } catch { return {}; }
}
function setHistory(obj) {
  localStorage.setItem(LS_HIST, JSON.stringify(obj));
}

function default1RM() {
  return { "Bench-Press":80,"Squat":100,"Deadlift":120,"Military-Press":50,"Pull-Up":25,"Clean":70,"Snatch":50,"Bicep Curl":25 };
}

function round2p5(x) { return Math.round(x/2.5)*2.5; }

function csvDownloadLink(rows, headers) {
  const csv = [headers.join(",")].concat(rows.map(r => headers.map(h => String(r[h] ?? "")).join(","))).join("\n");
  const blob = new Blob([csv], {type: "text/csv"});
  return URL.createObjectURL(blob);
}

async function loadExcel() {
  const resp = await fetch("data/BlokPeriodisering.xlsx");
  const arr = await resp.arrayBuffer();
  const wb = XLSX.read(arr, { type: "array" });
  const phasesSheet = XLSX.utils.sheet_to_json(wb.Sheets["Fases"], { header:1 }).flat().filter(Boolean);
  const exSheet = XLSX.utils.sheet_to_json(wb.Sheets["Exercises"], { header:1 });
  // Headings: Exercise, Movement, Percentage, Percentage of
  const headers = exSheet[0];
  const idx = {
    name: headers.indexOf("Exercise"),
    movement: headers.indexOf("Movement"),
    percent: headers.indexOf("Percentage"),
    percentOf: headers.indexOf("Percentage of"),
  };
  const exercises = exSheet.slice(1).map(r => ({
    name: r[idx.name],
    movement: r[idx.movement],
    percent: typeof r[idx.percent] === "string" ? parseFloat(r[idx.percent]) : r[idx.percent],
    percentOf: r[idx.percentOf],
  })).filter(e => e && e.name && e.movement && e.percent && e.percentOf);

  return { phases: phasesSheet, exercises };
}

function render1RM(onerm) {
  els.onermGrid.innerHTML = "";
  BASES.forEach((b,i) => {
    const wrap = document.createElement("label");
    wrap.innerHTML = `<span>${b}</span><input id="onerm_${i}" type="number" step="0.5" value="${onerm[b] ?? ""}" />`;
    els.onermGrid.appendChild(wrap);
  });
}

function renderExercises(list, q="", mov="Alle") {
  let filtered = list;
  if (q.trim()) filtered = filtered.filter(e => e.name.toLowerCase().includes(q.toLowerCase()));
  if (mov !== "Alle") filtered = filtered.filter(e => e.movement === mov);

  const by2 = document.createElement("div");
  by2.className = "cards";
  filtered.slice(0,200).forEach(e => {
    const c = document.createElement("div");
    c.className = "card";
    c.innerHTML = `<div class="row" style="justify-content:space-between">
      <div><strong>${e.name}</strong><div class="pill">${e.movement} • basis: ${e.percentOf}</div></div>
      <div class="pill">${Math.round(e.percent*100)}%</div>
    </div>`;
    by2.appendChild(c);
  });
  els.exercises.innerHTML = "";
  els.exercises.appendChild(by2);

  // movement select
  const uniqueMov = ["Alle"].concat([...new Set(list.map(e => e.movement))].sort());
  els.movement.innerHTML = uniqueMov.map(m => `<option value="${m}">${m}</option>`).join("");
  els.movement.value = mov;
}

function pickExerciseByMovement(exercises, movement) {
  const list = exercises.filter(e => e.movement === movement);
  if (list.length === 0) return null;
  const prio = list.find(e => /Back Squat|Front Squat|Deadlift|Bench Press|Overhead Press|Pull Ups|Row/i.test(e.name));
  return prio || list[0];
}

function computeWeight(ex, ruleIntensity, onerm, history) {
  const base = (onerm[ex.percentOf] || 0) * ex.percent;
  let target = base * ruleIntensity;
  const hist = history[ex.name];
  if (hist && hist.length) {
    const last = hist[hist.length-1].weight;
    target = Math.max(target, last * 1.02);
  }
  return round2p5(target);
}

function generatePlan(exercises, phase, onerm, history) {
  const rule = PHASE_RULES[phase] || PHASE_RULES["BeweegFase"];
  const items = GROUPS.map(g => pickExerciseByMovement(exercises, g)).filter(Boolean);
  return items.map(ex => ({
    name: ex.name,
    movement: ex.movement,
    base: ex.percentOf,
    sets: rule.sets,
    reps: rule.reps,
    weight: computeWeight(ex, rule.intensity, onerm, history),
  }));
}

function renderPlan(plan) {
  if (!plan.length) { els.plan.innerHTML = "<div class='pill'>Nog geen plan — kies fase en klik Genereer.</div>"; return; }
  const tbl = document.createElement("table");
  tbl.className = "table";
  tbl.innerHTML = `<thead><tr><th>Oefening</th><th>Beweging</th><th>Basis</th><th>Sets×Reps</th><th>Gewicht</th></tr></thead>`;
  const tb = document.createElement("tbody");
  plan.forEach(p => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${p.name}</td><td>${p.movement}</td><td>${p.base}</td><td>${p.sets}×${p.reps}</td><td class="kg">${p.weight} kg</td>`;
    tb.appendChild(tr);
  });
  tbl.appendChild(tb);
  els.plan.innerHTML = "";
  els.plan.appendChild(tbl);

  // CSV link
  const url = csvDownloadLink(plan, ["name","movement","base","sets","reps","weight"]);
  els.dlPlan.href = url;
}

function renderLog(plan, history) {
  if (!plan.length) { els.logUI.innerHTML = "<div class='pill'>Genereer eerst een plan.</div>"; return; }
  const wrap = document.createElement("div");
  wrap.className = "grid two";
  plan.forEach((p,idx) => {
    const card = document.createElement("div");
    card.className = "card";
    const wId = `w_${idx}`; const rId = `r_${idx}`;
    const last = (history[p.name] && history[p.name].length) ? history[p.name][history[p.name].length-1] : null;
    card.innerHTML = `
      <div class="row" style="justify-content:space-between;align-items:end;gap:10px">
        <div>
          <div><strong>${p.name}</strong></div>
          <div class="pill">${p.sets}×${p.reps} • target ~ <span class="kg">${p.weight} kg</span></div>
          ${last ? `<div class="pill">Laatste: ${last.weight} kg × ${last.reps} @ ${last.date}</div>` : ""}
        </div>
        <div class="row gap">
          <input id="${wId}" type="number" step="2.5" placeholder="kg" value="${p.weight}" />
          <input id="${rId}" type="number" step="1" placeholder="reps" value="${p.reps}" />
          <button class="btn" id="log_${idx}">Log</button>
        </div>
      </div>`;
    wrap.appendChild(card);
    setTimeout(() => {
      document.getElementById(`log_${idx}`).onclick = () => {
        const w = parseFloat(document.getElementById(wId).value);
        const r = parseInt(document.getElementById(rId).value, 10);
        if (isNaN(w) || isNaN(r)) return;
        history[p.name] = history[p.name] || [];
        history[p.name].push({ weight: w, reps: r, date: new Date().toISOString().slice(0,10) });
        setHistory(history);
        renderLog(plan, history);
      };
    }, 0);
  });
  els.logUI.innerHTML = "";
  els.logUI.appendChild(wrap);

  // CSV history
  const rows = [];
  Object.entries(history).forEach(([name, arr]) => arr.forEach(e => rows.push({exercise:name, ...e})));
  const url = csvDownloadLink(rows, ["exercise","weight","reps","date"]);
  els.dlLog.href = url;
}

(async function init(){
  // Load Excel
  const { phases, exercises } = await loadExcel();

  // Populate phases
  phases.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p; opt.textContent = p;
    els.phase.appendChild(opt);
  });
  els.phase.value = phases[0];

  // 1RM UI
  const onerm = Object.assign(default1RM(), get1RM());
  render1RM(onerm);
  els.save1rm.onclick = () => {
    BASES.forEach((b,i) => {
      const v = parseFloat(document.getElementById(`onerm_${i}`).value);
      if (!isNaN(v)) onerm[b] = v;
    });
    set1RM(onerm);
    alert("1RM opgeslagen");
  };

  // Exercises UI
  renderExercises(exercises);
  els.search.oninput = () => renderExercises(exercises, els.search.value, els.movement.value);
  els.movement.onchange = () => renderExercises(exercises, els.search.value, els.movement.value);

  // Plan + Log
  let plan = [];
  els.gen.onclick = () => {
    plan = generatePlan(exercises, els.phase.value, Object.assign(default1RM(), get1RM()), getHistory());
    renderPlan(plan);
    renderLog(plan, getHistory());
  };

  els.clearLog.onclick = () => {
    if (confirm("Geschiedenis wissen?")) {
      setHistory({});
      renderLog(plan, getHistory());
    }
  };
})();