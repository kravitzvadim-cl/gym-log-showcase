"use strict";
// Coaching logic: load targets, warm-ups, plate maths, rest times and weekly stats.
// Uses helpers from app.js (num, fmtKg, blockWeek, dayFor, sessionProgress, ALL_ITEMS, db) at call time.

// %1RM for a given number of reps at RPE 10 (reps 1…16). Each RPE point below 10 = one more rep in reserve.
const RPE_PCT = [100, 95.5, 92.2, 89.2, 86.3, 83.7, 81.1, 78.6, 76.2, 73.9, 71.6, 69.4, 67.3, 65.3, 63.3, 61.4];
const WEEK_RPE = { 1: 7, 2: 8, 3: 9, 4: null };
const pctOf1RM = (reps, rpe) => RPE_PCT[Math.max(0, Math.min(RPE_PCT.length - 1, Math.round(reps + (10 - rpe)) - 1))] / 100;
const roundTo = (x, step = 2.5) => Math.round(x / step) * step;
const BAR = 20;
const BARBELL = new Set(["squat", "bench", "deadlift", "ohp"]);

// Estimated 1RM from the most recent non-deload top set, using that week's prescribed RPE
function recentE1rm(it, date) {
  const dates = Object.keys(db.sessions).filter(d => d < date).sort().reverse();
  for (const d of dates) {
    const top = db.sessions[d].sets && db.sessions[d].sets[it.id] && db.sessions[d].sets[it.id][0];
    const w = top && num(top.w), r = top && num(top.r);
    const rpe = WEEK_RPE[blockWeek(d)];
    if (w && r && rpe) return w / pctOf1RM(r, rpe);
  }
  return null;
}

// Today's plan for a main lift: top set, back-offs, or deload work
function mainPlan(it, date) {
  const wk = blockWeek(date), rpe = WEEK_RPE[wk];
  const m = it.reps.match(/(\d+)[–-](\d+)/);
  const lo = m ? +m[1] : 5, hi = m ? +m[2] : 5;
  const boReps = +((it.reps.match(/(\d+)\s*back/) || [])[1] || 5);
  const e = recentE1rm(it, date);
  if (!e) return { calibrate: true, rpe, wk };
  if (!rpe) return { deload: true, work: roundTo(e * .65), reps: 5, wk };
  const reps = wk === 1 ? hi : wk === 2 ? Math.round((lo + hi) / 2) : lo;   // 6 → 5 → 4 style wave
  return { top: roundTo(e * pctOf1RM(reps, rpe)), reps, rpe, boReps, boPct: wk === 3 ? .92 : .9, wk };
}
const backoffWeight = (plan, actualTop) => roundTo((actualTop || plan.top) * plan.boPct);

// Warm-up ramp toward a working weight
function warmups(work, id) {
  const steps = id === "deadlift" ? [[.4, 5], [.6, 3], [.75, 2], [.88, 1]] : [[0, 10], [.5, 5], [.7, 3], [.85, 2], [.93, 1]];
  const out = [];
  steps.forEach(([p, r]) => {
    const w = p ? Math.max(BAR, roundTo(work * p, 5)) : BAR;
    if (w < work && !out.some(x => x.w === w)) out.push({ w, r });
  });
  return out;
}

// Plates per side, in competition colours
const PLATES = [[25, "red"], [20, "blue"], [15, "yellow"], [10, "green"], [5, "white"], [2.5, "black"], [1.25, "chrome"]];
function platesFor(total) {
  let side = (total - BAR) / 2;
  if (side < -1e-9) return null;
  const out = [];
  for (const [p, c] of PLATES) while (side >= p - 1e-9) { out.push([p, c]); side -= p; }
  return out;
}
function plateHTML(total) {
  const ps = platesFor(total);
  if (!ps) return "";
  if (!ps.length) return `<span class="loadout"><span class="lo-bar">bar only</span></span>`;
  return `<span class="loadout" role="img" aria-label="Per side: ${ps.map(p => p[0]).join(" + ")} kg">${ps.map(([p, c]) => `<i class="pl pl-${c} pl-${String(p).replace(".", "_")}">${p}</i>`).join("")}<span class="lo-side">/side</span></span>`;
}

// Double-progression nudge for accessories
function accHint(it, date) {
  const last = lastFor(it.id, date);
  const m = it.reps.match(/^(\d+)[–-](\d+)/);
  if (!last || !m) return "";
  const hi = +m[2], sets = filledSets(last.sets);
  if (!sets.length) return "";
  const w = Math.max(0, ...sets.map(s => num(s.w) || 0));
  if (sets.length >= it.sets && sets.every(s => (num(s.r) || 0) >= hi) && w && it.kind !== "bw") {
    return `Every set hit ${hi} last time. Go up to <b>${fmtKg(w + (/DB/.test(it.name) ? 2 : 2.5))} kg</b>.`;
  }
  return `Beat last time: same weight, <b>+1 rep</b> on a set or two.`;
}

// Rest time in seconds from strings like "3 min", "90s", "60s after pair"; 0 means go straight on
function restSeconds(it) {
  const r = it.rest || "";
  let m = r.match(/(\d+)\s*min/); if (m) return +m[1] * 60;
  m = r.match(/(\d+)\s*s\b/); if (m) return +m[1];
  return 0;
}

// Hard sets per muscle: 1 = primary mover, 0.5 = meaningful secondary
const MUSCLES = {
  squat: { Quads: 1, Glutes: 1 }, rdl: { Hamstrings: 1, Glutes: .5 }, bss: { Quads: 1, Glutes: .5 }, leg_ext: { Quads: 1 },
  seated_curl: { Hamstrings: 1 }, cable_crunch: { Abs: 1 },
  bench: { Chest: 1, Triceps: .5, Shoulders: .5 }, wpullup: { Back: 1, Biceps: .5 }, incline_db: { Chest: 1, Shoulders: .5, Triceps: .5 },
  cs_row: { Back: 1, Biceps: .5 }, lat_raise: { Shoulders: 1 }, ez_curl: { Biceps: 1 }, oh_tri: { Triceps: 1 }, ab_wheel: { Abs: 1 },
  deadlift: { Hamstrings: 1, Glutes: 1, Back: .5 }, hack_squat: { Quads: 1, Glutes: .5 }, hip_thrust: { Glutes: 1 }, nordic: { Hamstrings: 1 },
  calf_seat: { Calves: 1 }, spanish_squat: { Quads: .5 }, suitcase: { Abs: 1 },
  ohp: { Shoulders: 1, Triceps: .5 }, paused_bench: { Chest: 1, Triceps: .5, Shoulders: .5 }, speed_squat: { Quads: .5, Glutes: .5 }, bb_row: { Back: 1, Biceps: .5 }, dips: { Chest: 1, Triceps: 1 }, pulldown: { Back: 1, Biceps: .5 },
  lat_raise_b: { Shoulders: 1 }, rear_delt: { Shoulders: 1 }, inc_curl: { Biceps: 1 }, pushdown: { Triceps: 1 }, hlr: { Abs: 1 },
  m_stepup: { Quads: .5 }, m_rev_nordic: { Quads: .5 }, m_pullover: { Back: .5, Chest: .5 }, m_deficit_pu: { Chest: .5 },
  dead_bug: { Abs: 1 }, side_plank: { Abs: 1 }, hkr: { Abs: 1 }, rev_crunch: { Abs: 1 }, plank_reach: { Abs: 1 }, bird_dog: { Abs: .5 },
};
const MUSCLE_ORDER = ["Chest", "Back", "Shoulders", "Quads", "Hamstrings", "Glutes", "Biceps", "Triceps", "Calves", "Abs"];

function plannedMuscleSets() {
  const out = {};
  PROGRAM.forEach(d => d.blocks.forEach(b => b.items.forEach(it => {
    Object.entries(MUSCLES[it.id] || {}).forEach(([m, f]) => { out[m] = (out[m] || 0) + f * (it.sets || 0); });
  })));
  return out;
}
function doneMuscleSets(fromDate, toDate) {
  const out = {};
  Object.keys(db.sessions).filter(d => d >= fromDate && d <= toDate).forEach(d => {
    Object.entries(db.sessions[d].sets || {}).forEach(([id, sets]) => {
      const n = (sets || []).filter(x => x.d).length;
      Object.entries(MUSCLES[id] || {}).forEach(([m, f]) => { out[m] = (out[m] || 0) + f * n; });
    });
  });
  return out;
}

// One day's numbers: progress, volume, duration, PRs
function dayStats(d) {
  const s = db.sessions[d];
  if (!s) return null;
  const day = dayFor(d), { total, done } = sessionProgress(d, day);
  let vol = 0, sets = 0;
  const prs = [];
  Object.entries(s.sets || {}).forEach(([id, arr]) => {
    const it = ALL_ITEMS[id];
    let best = 0;
    (arr || []).forEach(x => {
      if (!x.d) return;
      sets++;
      if (it && it.kind !== "bw") vol += (num(x.w) || 0) * (num(x.r) || 0);
      best = Math.max(best, e1rm(x.w, x.r) || 0);
    });
    const prev = best && bestBefore(id, d);
    if (it && best && prev && best > prev + .01 && it.kind !== "bw") prs.push({ id, name: it.name, e: best });
  });
  const ms = workoutMs(s), mins = ms ? Math.max(1, Math.round(ms / 60000)) : 0;
  return { day, total, done, vol, sets, mins, prs, start: s.start, end: s.end };
}
function streakDays() {
  let d = todayIso(), n = 0;
  const active = x => { const st = dayStats(x); return st && st.done > 0; };
  if (!active(d)) d = addDays(d, -1);
  while (active(d)) { n++; d = addDays(d, -1); }
  return n;
}
const fmtVol = v => v >= 10000 ? (v / 1000).toFixed(1) + "t" : Math.round(v).toLocaleString();

// ---------- Personal records ----------
// Rep maxes: the heaviest weight lifted for at least N reps, plus the best estimated 1RM
const PR_REPS = [1, 3, 5, 8, 10];
function recordsFor(id) {
  const best = {}, events = [];
  let bestE = null;
  Object.keys(db.sessions).sort().forEach(d => {
    const sets = (db.sessions[d].sets || {})[id];
    if (!sets) return;
    const dayBest = {};
    let dayE = 0, dayESet = null;
    sets.forEach(x => {
      const w = num(x.w), r = num(x.r);
      if (!w || !r || !(x.d || (w != null && r != null))) return;
      PR_REPS.forEach(b => { if (r >= b && w > (dayBest[b] || 0)) dayBest[b] = w; });
      const e = e1rm(w, r) || 0;
      if (e > dayE) { dayE = e; dayESet = `${x.w}×${x.r}`; }
    });
    const labels = [];
    PR_REPS.forEach(b => {
      if (!dayBest[b] || (best[b] && dayBest[b] <= best[b].w)) return;
      if (best[b]) labels.push({ label: `${b}RM`, w: dayBest[b], prev: best[b].w });
      best[b] = { w: dayBest[b], date: d };
    });
    // one set can set several rep maxes at once (105×5 is also a 3RM and 1RM): keep the most reps per weight
    for (let i = labels.length - 1; i >= 0; i--) {
      const l = labels[i];
      if (labels.some(o => o !== l && o.w === l.w && parseInt(o.label) > parseInt(l.label))) labels.splice(i, 1);
    }
    if (dayE && (!bestE || dayE > bestE.e + .01)) {
      if (bestE) labels.unshift({ label: "e1RM", w: dayE, prev: bestE.e });
      bestE = { e: dayE, date: d, set: dayESet };
    }
    if (labels.length) events.push({ date: d, id, labels });
  });
  return { best, bestE, events };
}
function allRecords() {
  const ids = Object.keys(ALL_ITEMS).filter(id => (ALL_ITEMS[id].kind === "main" || ALL_ITEMS[id].kind === "lift"));
  return ids.map(id => ({ id, ...recordsFor(id) })).filter(r => r.bestE);
}
