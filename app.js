"use strict";

// ---------- Dates ----------
const KEY = "gymlog.v1";
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_COLOR = { d1: "red", d2: "blue", d3: "slate", d4: "yellow", d5: "green", d6: "slate", d7: "slate" };

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseIso(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseIso(s); d.setDate(d.getDate() + n); return iso(d); }
function mondayOf(s) { const d = parseIso(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return iso(d); }
function todayIso() { return iso(new Date()); }
function fmtDate(s, opts = { weekday: "short", day: "numeric", month: "short" }) { return parseIso(s).toLocaleDateString(undefined, opts); }

// ---------- Storage ----------
function load() {
  let data = null;
  try { data = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* ignore */ }
  if (!data || typeof data !== "object") data = {};
  data.v = 1;
  data.startDate = data.startDate || mondayOf(todayIso());
  data.sessions = data.sessions || {};
  data.settings = Object.assign({ restTimer: true, sound: true, swaps: {}, theme: "auto", autoFinish: true }, data.settings || {});
  return data;
}
let db = load();
let saveTimer = null, dirty = false;
function save() { dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 250); }
function saveNow() {
  clearTimeout(saveTimer); dirty = false;
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast("Couldn't save. Phone storage may be full."); }
}
window.addEventListener("pagehide", () => { if (dirty) saveNow(); });
document.addEventListener("visibilitychange", () => { if (document.hidden && dirty) saveNow(); });
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

// ---------- Program helpers ----------
const ALL_ITEMS = {};
PROGRAM.forEach(day => {
  const ssCount = {};
  day.blocks.forEach(b => b.items.forEach(it => {
    if (it.ss) it.ssLabel = it.ss + (ssCount[it.ss] = (ssCount[it.ss] || 0) + 1);
    ALL_ITEMS[it.id] = { ...it, day };
  }));
});
const isLogged = it => it.kind === "main" || it.kind === "lift" || it.kind === "bw";

// Swap alternatives become items too (their prescription comes from the exercise they replace)
Object.entries(SWAPS).forEach(([orig, alts]) => ALL_ITEMS[orig] && alts.forEach(id => {
  if (!ALL_ITEMS[id] && ALTS[id]) ALL_ITEMS[id] = { ...ALL_ITEMS[orig], id, name: ALTS[id].name, cue: "", kind: ALTS[id].kind || ALL_ITEMS[orig].kind, alt: true };
  if (!HOWTO[id] && ALTS[id]) HOWTO[id] = ALTS[id];
  if (!MUSCLES[id] && MUSCLES[orig]) MUSCLES[id] = MUSCLES[orig];
}));
// Which exercise is actually done on a date: the session's own choice, else your default (today onward)
function swapFor(origId, date) {
  const s = db.sessions[date];
  if (s && s.swaps && Object.prototype.hasOwnProperty.call(s.swaps, origId)) return s.swaps[origId] || null;
  if (date >= todayIso()) return (db.settings.swaps || {})[origId] || null;
  return null;
}
function eff(it, date) {
  // program items don't carry their day; the How-to panel and superset hints need it
  const day = it.day || (ALL_ITEMS[it.id] || {}).day;
  const a = isLogged(it) && SWAPS[it.id] && swapFor(it.id, date);
  if (!a || !ALL_ITEMS[a]) return { ...it, day };
  return { ...it, day, id: a, name: ALL_ITEMS[a].name, cue: ALTS[a] ? "" : (ALL_ITEMS[a].cue || ""), kind: (ALTS[a] && ALTS[a].kind) || it.kind, swappedFrom: it.id };
}
// Items as rendered on the current Today screen (swaps applied)
const CUR = {};
const itemFor = id => CUR[id] || ALL_ITEMS[id];
const splitName = name => { const [a, b] = name.split(" — "); return { short: a, sub: b || "" }; };

function blockWeek(dateStr) {
  const days = Math.round((parseIso(dateStr) - parseIso(db.startDate)) / 864e5);
  return ((Math.floor(days / 7) % 4) + 4) % 4 + 1;
}
// Weekly schedule: weekday (0 = Sun … 6 = Sat) → workout id. Defaults to the program; you can rearrange it.
function schedule() {
  const sch = {};
  PROGRAM.forEach(d => { sch[d.dow] = d.id; });
  const mine = db.settings.schedule || {};
  // only accept a complete arrangement where every workout appears once
  const ids = Object.values(mine);
  if (ids.length === 7 && new Set(ids).size === 7 && ids.every(id => PROGRAM.some(d => d.id === id))) Object.assign(sch, mine);
  return sch;
}
const dowOf = dayId => { const s = schedule(); return +Object.keys(s).find(k => s[k] === dayId); };
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const programByWeek = () => WEEK_ORDER.map(w => PROGRAM.find(d => d.id === schedule()[w]));
function defaultDayFor(dateStr) { return PROGRAM.find(d => d.id === schedule()[parseIso(dateStr).getDay()]) || PROGRAM[0]; }
function dayFor(dateStr) {
  const s = db.sessions[dateStr];
  return (s && PROGRAM.find(d => d.id === s.dayId)) || defaultDayFor(dateStr);
}
function session(dateStr, create) {
  let s = db.sessions[dateStr];
  if (!s && create) s = db.sessions[dateStr] = { dayId: defaultDayFor(dateStr).id, sets: {}, ticks: {}, notes: "" };
  if (s && create && !s.swaps && dateStr >= todayIso()) s.swaps = Object.assign({}, db.settings.swaps || {});
  return s;
}
const num = v => { const n = parseFloat(String(v).replace(",", ".")); return isFinite(n) ? n : null; };
function e1rm(w, r) {
  w = num(w); r = num(r);
  if (!w || !r || r < 1) return null;
  return r === 1 ? w : w * (1 + r / 30);
}
const fmtKg = n => (n == null ? "–" : (Math.round(n * 10) / 10).toString());
const filledSets = sets => (sets || []).filter(s => num(s.w) != null || (s.r !== "" && s.r != null));

function lastFor(exId, beforeDate) {
  const dates = Object.keys(db.sessions).filter(d => d < beforeDate).sort().reverse();
  for (const d of dates) {
    const sets = db.sessions[d].sets && db.sessions[d].sets[exId];
    if (filledSets(sets).length) return { date: d, sets };
  }
  return null;
}
function history(exId) {
  return Object.keys(db.sessions).sort().map(d => {
    const sets = filledSets(db.sessions[d].sets && db.sessions[d].sets[exId]).filter(x => x.d || (num(x.w) != null && num(x.r) != null));
    if (!sets.length) return null;
    let best = null, bestSet = null, top = null;
    sets.forEach(s => {
      const e = e1rm(s.w, s.r);
      if (e != null && (best == null || e > best)) { best = e; bestSet = s; }
      const w = num(s.w);
      if (w != null && (top == null || w > top)) top = w;
    });
    const volume = sets.reduce((a, s) => a + (num(s.w) || 0) * (num(s.r) || 0), 0);
    return { date: d, best, bestSet, top, volume, sets };
  }).filter(Boolean);
}
function bestBefore(exId, date) {
  return history(exId).reduce((b, h) => (h.date < date && h.best > b ? h.best : b), 0);
}
function rowCount(it, s) {
  const saved = (s && s.sets && s.sets[it.id]) || [];
  const fixed = s && s.rows && s.rows[it.id];
  return fixed || Math.max(it.sets || 3, saved.length);
}
function sessionProgress(date, day) {
  const s = session(date, false);
  let total = 0, done = 0;
  day.blocks.forEach(b => b.items.forEach(it0 => {
    const it = eff(it0, date);
    if (isLogged(it)) {
      const saved = (s && s.sets && s.sets[it.id]) || [];
      total += rowCount(it, s); done += saved.filter(x => x.d).length;
    } else { total += 1; if (s && s.ticks && s.ticks[it.id]) done += 1; }
  }));
  return { total, done };
}

// ---------- UI utils ----------
const $ = (sel, el = document) => el.querySelector(sel);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ICON = {
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path pathLength="1" d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  swap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5"/></svg>',
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  doc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l5 5v13H7z" fill="none"/><path d="M14 3v5h5M10 13h6M10 17h6" fill="none"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" fill="none"/></svg>',
  watch: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M10 2.5h4M18.5 6.5l1.5-1.5"/></svg>',
  book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5C10 5 7 4.5 4 5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5zM12 6.5v13" stroke-linejoin="round"/></svg>',
};
function toast(msg) {
  document.querySelectorAll(".toast").forEach(t => t.remove());
  const t = document.createElement("div");
  t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2300);
}
const view = $("#view");
let state = { tab: "today", date: todayIso(), progressEx: "squat", logOpen: todayIso() };

// ---------- Theme: Auto (follow the phone), Light or Dark ----------
function applyTheme() {
  const t = db.settings.theme;
  if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
  const dark = t === "dark" || (t !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
    if (t === "light" || t === "dark") { m.setAttribute("content", dark ? "#101215" : "#eef0ee"); }
    else m.setAttribute("content", m.media.includes("dark") ? "#101215" : "#eef0ee");
  });
  const btn = document.getElementById("themeBtn");
  if (btn) btn.dataset.dark = dark ? "1" : "";
}
function setTheme(t) {
  const swapIt = () => { db.settings.theme = t; saveNow(); applyTheme(); };
  if (document.startViewTransition && !reduceMotion()) document.startViewTransition(swapIt); else swapIt();
}
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

const APP_VERSION = "2026.10.11-17";

// ---------- Motion ----------
// Light haptic tick: vibrate where supported; on iPhone (iOS 18+) toggling a hidden switch control gives a system tap
const hapticLabel = (() => {
  const l = document.createElement("label"), i = document.createElement("input");
  l.setAttribute("aria-hidden", "true");
  l.style.cssText = "position:fixed;left:-200px;top:0;width:1px;height:1px;opacity:0;pointer-events:none";
  i.type = "checkbox"; i.setAttribute("switch", ""); i.tabIndex = -1;
  l.appendChild(i); document.body.appendChild(l);
  return l;
})();
function haptic() {
  if (navigator.vibrate) { navigator.vibrate(8); return; }
  try { hapticLabel.click(); } catch (e) { /* no haptics */ }
}
const reduceMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// Restart a one-shot CSS animation class on an element
function flash(el, cls, ms = 700) {
  if (!el) return;
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  clearTimeout(el["_t" + cls]);
  el["_t" + cls] = setTimeout(() => el.classList.remove(cls), ms);
}
// Numbers roll up from 0 to their value
function countUp(root = view) {
  if (reduceMotion()) return;
  root.querySelectorAll("[data-count]").forEach(el => {
    const target = el.dataset.count, to = parseFloat(target);
    if (!isFinite(to) || !to) return;
    const dec = target.includes(".") ? 1 : 0, t0 = performance.now(), dur = 750;
    const step = now => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = p < 1 ? (to * e).toFixed(dec) : target;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
// Little burst of plate-coloured sparks from an element
function burst(el, n = 16, colors = ["var(--red)", "var(--blue)", "var(--yellow)", "var(--green)"]) {
  if (!el || reduceMotion()) return;
  const r = el.getBoundingClientRect();
  for (let i = 0; i < n; i++) {
    const s = document.createElement("i");
    const ang = i / n * Math.PI * 2 + Math.random() * .4, dist = 46 + Math.random() * 56;
    s.className = "spark";
    s.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px;--dx:${(Math.cos(ang) * dist).toFixed(1)}px;--dy:${(Math.sin(ang) * dist).toFixed(1)}px;background:${colors[i % colors.length]}`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 900);
  }
}
// Day/week changes slide via the View Transitions API where available
function navigate(update, dir = "fwd") {
  if (document.startViewTransition && !reduceMotion()) {
    document.documentElement.dataset.dir = dir;
    document.startViewTransition(() => { update(); render({ quiet: true }); countUp(); });
  } else { update(); render(); }
}

function setDayColor(dayId) {
  document.body.className = "day-" + (DAY_COLOR[dayId] || "slate");
}
const TAB_ORDER = ["today", "week", "progress", "guide", "settings"];
function setTab(tab) {
  if (tab === state.tab) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
  const dir = TAB_ORDER.indexOf(tab) > TAB_ORDER.indexOf(state.tab) ? "fwd" : "back";
  haptic();
  document.querySelectorAll(".tabbar button").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  navigate(() => { state.tab = tab; window.scrollTo(0, 0); }, dir);
  const btn = document.querySelector(`.tabbar [data-tab="${tab}"]`);
  flash(btn, "bounce", 450);
}
document.querySelectorAll(".tabbar button").forEach(b => b.addEventListener("click", () => setTab(b.dataset.tab)));

function setHeader(kicker, title) {
  $("#kicker").textContent = kicker;
  if ($("#title").textContent !== title) { $("#title").textContent = title; flash($("#title"), "swap", 450); }
}
function render(opts = {}) {
  const w = blockWeek(state.tab === "today" ? state.date : state.tab === "week" ? mondayOf(state.date) : todayIso());
  const [wk, label] = WEEK_SCHEME[w].label.split(" · ");
  $("#weekBadge").innerHTML = `${esc(wk)} · <b>${esc(label)}</b>`;
  ({ today: renderToday, week: renderWeek, progress: renderProgress, guide: renderGuide, settings: renderSettings })[state.tab]();
  if (opts.quiet || reduceMotion()) return;
  // staggered entrance for the new screen
  [...view.children].forEach((c, i) => c.style.setProperty("--i", Math.min(i, 6)));
  view.querySelectorAll(".checklist").forEach(l => [...l.children].forEach((c, j) => c.style.setProperty("--j", Math.min(j, 6))));
  flash(view, "enter", 800);
  countUp();
}

// ---------- Exercise stopwatch ----------
// Per exercise, per day: { acc: ms banked, run: start timestamp while running }
const fmtClock = ms => {
  const t = Math.floor(ms / 1000), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60;
  return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
};
// Hold length for stretches/holds ("60s / side", "2×30s hold", "30–45s"); minutes-long items count up instead
function holdInfo(it) {
  const txt = it.rx || it.reps || "";
  const m = txt.match(/(\d+)(?:–(\d+))?\s*s\b/);
  if (!m) return null;
  const secs = +(m[2] || m[1]);
  return secs > 0 && secs <= 120 ? { secs, sides: /\/\s*(side|leg)/.test(txt) ? 2 : 1 } : null;
}
function startHold(it) {
  const h = holdInfo(it);
  if (!h) return;
  startRest(h.secs, it.name, it.id, { kind: "hold", side: 1, sides: h.sides });
}
function clockOf(date, id) { const s = db.sessions[date]; return s && s.clock && s.clock[id]; }
const clockMs = c => c ? (c.acc || 0) + (c.run ? Date.now() - c.run : 0) : 0;
function startClock(date, id) {
  const s = session(date, true);
  s.dayId = dayFor(date).id;
  s.clock = s.clock || {};
  // only one exercise runs at a time
  Object.entries(s.clock).forEach(([k, c]) => { if (k !== id && c.run) { c.acc = (c.acc || 0) + Date.now() - c.run; c.run = null; } });
  const c = s.clock[id] = s.clock[id] || { acc: 0, run: null };
  if (!c.run) c.run = Date.now();
  markActivity(date); save(); updateClocks();
}
function stopClock(date, id) {
  const c = clockOf(date, id);
  if (c && c.run) { c.acc = (c.acc || 0) + Date.now() - c.run; c.run = null; save(); }
  updateClocks();
}
function activeClock() {
  const d = todayIso(), s = db.sessions[d];
  const hit = s && s.clock && Object.entries(s.clock).find(([, c]) => c.run);
  return hit ? { date: d, id: hit[0], c: hit[1] } : null;
}
// Refresh every visible exercise clock (called 4× a second)
function updateClocks() {
  if (state.tab !== "today") return;
  view.querySelectorAll(".ex[data-ex], .check-row[data-row]").forEach(card => {
    const id = card.dataset.ex || card.dataset.row, c = clockOf(state.date, id), btn = $("[data-clock]", card);
    if (!btn) return;
    const resting = timer && !timer.done && timer.exId === id && state.date === todayIso();
    const holding = resting && timer.kind === "hold";
    const running = !!(c && c.run), ms = clockMs(c);
    let txt, mode;
    if (resting) {
      const left = Math.max(0, Math.ceil((timer.end - Date.now()) / 1000));
      txt = `${holding ? (timer.sides > 1 ? `Side ${timer.side}` : "Hold") : "Rest"} ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
      mode = holding ? "hold" : "rest";
    }
    else if (running) { txt = fmtClock(ms); mode = "run"; }
    else if (ms > 0) { txt = fmtClock(ms); mode = "paused"; }
    else { const h = holdInfo(itemFor(id)); txt = h ? `${h.secs}s${h.sides > 1 ? " ×2" : ""}` : "Start"; mode = "idle"; }
    const lab = $("[data-clock-t]", btn);
    if (lab.textContent !== txt) lab.textContent = txt;
    if (btn.dataset.mode !== mode) {
      btn.dataset.mode = mode;
      btn.setAttribute("aria-label", mode === "idle" ? "Start exercise timer" : mode === "run" ? "Pause exercise timer" : mode === "rest" ? "Resting" : "Resume exercise timer");
    }
    card.classList.toggle("running", running && state.date === todayIso());
    const sum = $("[data-time]", card);
    if (sum) { const t = ms ? fmtClock(ms) : ""; if (sum.textContent !== t) sum.textContent = t; }
  });
}

// ---------- Rest timer ----------
const TIMER_KEY = "gymlog.timer";
const timerEl = $("#timer");
let timer = null, audioCtx = null, wakeLock = null, lastActivity = 0;
try { timer = JSON.parse(localStorage.getItem(TIMER_KEY)); } catch (e) { timer = null; }
if (timer && timer.end < Date.now() - 5000) timer = null;

function unlockAudio() {
  try {
    if (navigator.audioSession) navigator.audioSession.type = "transient";
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (e) { /* no audio */ }
}
function beep() {
  if (!audioCtx || !db.settings.sound) return;
  const t0 = audioCtx.currentTime;
  [[0, 880], [.2, 880], [.4, 1320]].forEach(([t, f]) => {
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = "sine"; o.frequency.value = f;
    g.gain.setValueAtTime(.0001, t0 + t);
    g.gain.exponentialRampToValueAtTime(.35, t0 + t + .02);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + t + .17);
    o.connect(g).connect(audioCtx.destination);
    o.start(t0 + t); o.stop(t0 + t + .18);
  });
}
async function keepAwake() {
  try { if ("wakeLock" in navigator && !wakeLock && !document.hidden) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); } } catch (e) { /* not allowed */ }
}
document.addEventListener("visibilitychange", () => { if (!document.hidden && (workoutRunning() || Date.now() - lastActivity < 45 * 60000)) keepAwake(); });

function startRest(secs, label, exId, opts = {}) {
  if (!secs) return;
  unlockAudio();
  timer = Object.assign({ end: Date.now() + secs * 1000, total: secs, label, exId, kind: "rest" }, opts);
  try { localStorage.setItem(TIMER_KEY, JSON.stringify(timer)); } catch (e) { /* ignore */ }
  const wasHidden = timerEl.hidden;
  timerEl.hidden = false; timerEl.classList.remove("go", "out");
  document.body.classList.add("has-timer");
  if (wasHidden) flash(timerEl, "in", 600); else flash(timerEl, "bump", 400);
  tickTimer();
}
function stopRest() {
  timer = null;
  try { localStorage.removeItem(TIMER_KEY); } catch (e) { /* ignore */ }
  if (activeClock() || workoutRunning()) { timerEl.classList.remove("go", "soon"); tickTimer(); return; }
  document.body.classList.remove("has-timer");
  if (timerEl.hidden) return;
  if (reduceMotion()) { timerEl.hidden = true; return; }
  timerEl.classList.add("out");
  setTimeout(() => { if (!timer) timerEl.hidden = true; timerEl.classList.remove("out"); }, 280);
}
function tickTimer() {
  if (!timer) {
    const ac = activeClock();
    if (ac) {
      // stopwatch mode: the running exercise, counting up; the ring sweeps once a minute
      const ms = clockMs(ac.c);
      if (timerEl.hidden) { timerEl.hidden = false; flash(timerEl, "in", 600); }
      timerEl.dataset.mode = "watch";
      document.body.classList.add("has-timer");
      $("#tmRing").style.strokeDashoffset = (1 - (ms % 60000) / 60000).toFixed(4);
      const t = fmtClock(ms);
      if ($("#tmTime").textContent !== t) $("#tmTime").textContent = t;
      const lbl = itemFor(ac.id).name;
      if ($("#tmLabel").textContent !== lbl) $("#tmLabel").textContent = lbl;
      return;
    }
    const ws = db.sessions[todayIso()];
    if (ws && ws.workout && ws.workout.run) {
      const ms = workoutMs(ws);
      if (timerEl.hidden) { timerEl.hidden = false; flash(timerEl, "in", 600); }
      timerEl.dataset.mode = "workout";
      document.body.classList.add("has-timer");
      $("#tmRing").style.strokeDashoffset = (1 - (ms % 60000) / 60000).toFixed(4);
      const t = fmtClock(ms);
      if ($("#tmTime").textContent !== t) $("#tmTime").textContent = t;
      const lbl = "Workout · " + dayFor(todayIso()).short;
      if ($("#tmLabel").textContent !== lbl) $("#tmLabel").textContent = lbl;
      return;
    }
    if (!timerEl.hidden && !timerEl.classList.contains("out")) stopRest();
    return;
  }
  timerEl.dataset.mode = "rest";
  timerEl.hidden = false; document.body.classList.add("has-timer");
  const left = Math.max(0, timer.end - Date.now());
  const secs = Math.ceil(left / 1000);
  $("#tmRing").style.strokeDashoffset = (1 - left / (timer.total * 1000)).toFixed(4);
  if (left > 0) {
    $("#tmTime").textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    $("#tmLabel").textContent = (timer.kind === "hold" ? (timer.sides > 1 ? `Hold side ${timer.side}/${timer.sides} · ` : "Hold · ") : "Rest · ") + timer.label;
    timerEl.classList.toggle("soon", secs <= 10);
  } else if (!timer.done && timer.kind === "hold" && timer.side < timer.sides) {
    // first side done: short switch, then the other side starts by itself
    beep(); haptic();
    const t = timer;
    timer = Object.assign({}, t, { end: Date.now() + (t.total + 3) * 1000, total: t.total + 3, side: t.side + 1 });
    try { localStorage.setItem(TIMER_KEY, JSON.stringify(timer)); } catch (e) { /* ignore */ }
    toast("Switch sides");
    flash(timerEl, "bump", 400);
  } else if (!timer.done) {
    timer.done = true;
    timerEl.classList.remove("soon"); timerEl.classList.add("go");
    $("#tmTime").textContent = timer.kind === "hold" ? "Done" : "Go";
    $("#tmLabel").textContent = timer.kind === "hold" ? "Hold complete. Tick it off." : "Rest over. Next set.";
    beep();
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    setTimeout(() => { if (timer && timer.done) stopRest(); }, 6000);
  }
}
timerEl.addEventListener("click", e => {
  const b = e.target.closest("[data-tm]");
  if (b && b.dataset.tm === "pause") {
    if (timerEl.dataset.mode === "workout") { pauseWorkout(todayIso()); return; }
    const ac = activeClock(); if (ac) { stopClock(ac.date, ac.id); haptic(); } tickTimer(); return;
  }
  if (!b || !timer) return;
  if (b.dataset.tm === "skip") return stopRest();
  timer.end = Math.max(Date.now() + 1000, timer.end + +b.dataset.tm * 1000);
  timer.total = Math.max(timer.total, Math.ceil((timer.end - Date.now()) / 1000));
  timer.done = false; timerEl.classList.remove("go");
  try { localStorage.setItem(TIMER_KEY, JSON.stringify(timer)); } catch (err) { /* ignore */ }
  tickTimer();
});

// Keep the screen on while you're training
function markActivity(date) {
  session(date, true);
  lastActivity = Date.now();
  keepAwake();
  const s = db.sessions[date];
  if (date === todayIso() && !(s.workout && (s.workout.run || s.workout.done)) && !s.hinted) {
    s.hinted = true;
    toast("Tap Start workout to time this session");
    flash($("#workout"), "nudge", 900);
  }
}

// ---------- Workout clock: you start, pause and finish it ----------
// s.workout = { acc: ms banked, run: start timestamp while running, done: finished, startedAt }
function workoutMs(s) {
  if (!s) return 0;
  if (s.workout) return (s.workout.acc || 0) + (s.workout.run ? Date.now() - s.workout.run : 0);
  return s.start && s.end ? s.end - s.start : 0;   // sessions logged before the workout button existed
}
function startWorkout(date) {
  const s = session(date, true);
  s.workout = s.workout || { acc: 0, run: null, done: false };
  if (!s.workout.run) s.workout.run = Date.now();
  s.workout.startedAt = s.workout.startedAt || Date.now();
  s.workout.done = false;
  lastActivity = Date.now();
  save(); keepAwake(); unlockAudio(); haptic();
  renderWorkout(date); tickTimer();
}
function pauseWorkout(date) {
  const s = db.sessions[date];
  if (!s || !s.workout || !s.workout.run) return;
  s.workout.acc += Date.now() - s.workout.run; s.workout.run = null;
  save(); haptic(); renderWorkout(date); tickTimer();
}
function finishWorkout(date, auto) {
  const s = db.sessions[date];
  if (!s || !s.workout) return;
  if (s.workout.run) { s.workout.acc += Date.now() - s.workout.run; s.workout.run = null; }
  s.workout.done = true;
  s.workout.endedAt = Date.now();
  const ac = activeClock(); if (ac && ac.date === date) stopClock(ac.date, ac.id);
  if (timer) stopRest();
  save(); haptic();
  renderWorkout(date); tickTimer(); renderSummary(date);
  toast(auto ? `All exercises done. Workout finished: ${fmtClock(s.workout.acc)}` : `Workout finished: ${fmtClock(s.workout.acc)}`);
}
function workoutRunning() {
  const s = db.sessions[todayIso()];
  return !!(s && s.workout && s.workout.run);
}
// Workout panel inside the session card
function renderWorkout(date) {
  const box = $("#workout");
  if (!box) return;
  const s = db.sessions[date], w = s && s.workout, isToday = date === todayIso();
  const ms = workoutMs(s);
  let state, btns;
  if (w && w.run) { state = "run"; btns = `<button class="wk-btn ghost" data-wk="pause">Pause</button><button class="wk-btn" data-wk="finish">Finish</button>`; }
  else if (w && w.done) { state = "done"; btns = isToday ? `<button class="wk-btn ghost" data-wk="start">Resume</button>` : ""; }
  else if (w && ms) { state = "paused"; btns = `<button class="wk-btn" data-wk="start">Resume</button><button class="wk-btn ghost" data-wk="finish">Finish</button>`; }
  else { state = "idle"; btns = isToday ? `<button class="wk-btn big" data-wk="start">${ICON.play}Start workout</button>` : ""; }
  if (!isToday && !ms && state === "idle") { box.hidden = true; return; }
  box.hidden = false;
  box.dataset.state = state;
  const label = { run: "Workout", paused: "Paused", done: "Finished", idle: isToday ? "Workout" : "Not timed" }[state];
  box.innerHTML = `<div class="wk-info"><span class="wk-label">${label}</span><span class="wk-time num" id="wkTime">${fmtClock(ms)}</span></div><div class="wk-btns">${btns}</div>`;
  box.querySelectorAll("[data-wk]").forEach(b => b.addEventListener("click", () => {
    const act = b.dataset.wk;
    if (act === "start") startWorkout(date);
    else if (act === "pause") pauseWorkout(date);
    else finishWorkout(date, false);
  }));
}
// After a set: rest timer, or point to the superset partner
function afterSet(it, date) {
  if (date !== todayIso()) return;
  const secs = restSeconds(it);
  if (!secs && it.ss) {
    const partner = it.day.blocks.flatMap(b => b.items).find(x => x.ss === it.ss && x.id !== it.id && x.ssLabel > it.ssLabel);
    if (partner) toast(`Now ${partner.ssLabel}: ${partner.name}`);
    return;
  }
  if (db.settings.restTimer) startRest(secs, it.name, it.id);
}

// ---------- How-to sheet ----------
const sheet = $("#sheet"), backdrop = $("#sheetBackdrop");
let sheetReturnFocus = null;
function youtube(name) { return "https://www.youtube.com/results?search_query=" + encodeURIComponent(name + " exercise form"); }
let sheetCloseTimer = null;
function presentSheet() {
  clearTimeout(sheetCloseTimer); sheetCloseTimer = null;
  sheet.classList.remove("closing"); backdrop.classList.remove("closing");
  sheet.style.transform = ""; sheet.style.transition = "";
  sheet.style.animation = "none"; void sheet.offsetWidth; sheet.style.animation = "";   // replay the slide-up
  sheetReturnFocus = document.activeElement;
  sheet.hidden = false; backdrop.hidden = false; sheet.scrollTop = 0;
  document.body.style.overflow = "hidden";
  const c = $("#sheetClose"); if (c) c.addEventListener("click", closeSheet);
}
function openHowto(id) {
  const it = itemFor(id);
  const h = HOWTO[id] || { m: "", s: [], x: [] };
  const dt = DETAILS[id] || {};
  const rx = isLogged(it) ? `${it.sets} × ${it.reps}${it.rest && it.rest !== "—" ? " · rest " + it.rest : ""}` : it.rx || "";
  $("#sheetBody").innerHTML = `
    <div class="chip day">${esc(splitName(it.day.name).short)}${it.ssLabel ? " · superset " + esc(it.ssLabel) : ""}${it.swappedFrom ? " · swap for " + esc(ALL_ITEMS[it.swappedFrom].name) : ""}</div>
    <h2 id="sheetTitle">${esc(it.name)}</h2>
    <div class="muscles"><b>Works:</b> ${esc(h.m)}</div>
    <div class="muscles num"><b>Today:</b> ${esc(rx)}</div>
    ${dt.a ? `<p class="about">${esc(dt.a)}</p>` : ""}
    ${dt.b && dt.b.length ? `<h4>Benefits</h4><ul class="benefits">${dt.b.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    ${h.s.length ? `<h4>How to do it</h4><ol class="steps">${h.s.map((x, i) => `<li style="--i:${i}"><span>${esc(x)}</span></li>`).join("")}</ol>` : ""}
    ${dt.t && dt.t.length ? `<h4>Tips</h4><ul class="tips">${dt.t.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    ${h.x && h.x.length ? `<h4>Avoid</h4><ul class="mistakes">${h.x.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    ${h.k ? `<div class="note"><b>Knee note</b>${esc(h.k)}</div>` : ""}
    ${it.cue ? `<div class="note"><b>Coach's cue</b>${esc(it.cue)}</div>` : ""}
    <div class="sheet-actions">
      <a class="btn" href="${youtube(it.name)}" target="_blank" rel="noopener">Watch videos ↗</a>
      <button class="btn primary" id="sheetClose">Got it</button>
    </div>
    <button class="link-btn req-link" id="reqFromHowto">Request a change to this exercise</button>`;
  presentSheet();
  $("#sheetClose").focus({ preventScroll: true });
  const rq = $("#reqFromHowto");
  if (rq) rq.addEventListener("click", () => { const d = it.day.id, x = it.swappedFrom || it.id; closeSheet(); setTimeout(() => openRequest(d, x), 280); });
}
function showSheet(html) {
  $("#sheetBody").innerHTML = html;
  presentSheet();
}

// ---------- PDF report sheet ----------
function openReport() {
  const periods = reportPeriods();
  let pick = "week";
  const opt = ([k, p]) => {
    const n = Object.keys(db.sessions).filter(d => d >= p.from && d <= p.to && dayStats(d) && dayStats(d).done).length;
    return `<button class="swap-opt ${k === pick ? "cur" : ""}" data-period="${k}">
      <span class="grow"><b>${p.label}</b><small class="num">${fmtDate(p.from, { day: "numeric", month: "short" })} – ${fmtDate(p.to, { day: "numeric", month: "short" })} · ${n} session${n === 1 ? "" : "s"}</small></span>
      <span class="radio" aria-hidden="true"></span></button>`;
  };
  showSheet(`
    <div class="chip day">PDF report</div>
    <h2 id="sheetTitle">Share with your trainer</h2>
    <div class="muscles">A clean report: summary, main lifts, every session, every exercise with all its sets, PRs, notes and weekly sets per muscle.</div>
    <div class="swap-list">${Object.entries(periods).map(opt).join("")}</div>
    <div class="field"><label for="repName">Name on the report</label><input id="repName" value="${esc(db.settings.name || "")}" placeholder="Your name" autocomplete="name"></div>
    <div class="sheet-actions"><button class="btn" id="sheetClose">Cancel</button><button class="btn primary" id="makePdf">Create PDF</button></div>`);
  $("#sheetBody").querySelectorAll("[data-period]").forEach(b => b.addEventListener("click", () => {
    pick = b.dataset.period; haptic();
    $("#sheetBody").querySelectorAll("[data-period]").forEach(x => x.classList.toggle("cur", x === b));
  }));
  $("#repName").addEventListener("change", e => { db.settings.name = e.target.value.trim(); saveNow(); });
  $("#makePdf").addEventListener("click", async () => {
    const btn = $("#makePdf");
    db.settings.name = $("#repName").value.trim(); saveNow();
    btn.disabled = true; btn.textContent = "Creating…";
    try {
      const res = await exportReport(pick);
      if (res !== "cancelled") { closeSheet(); toast(res === "shared" ? "Report ready" : "Report downloaded"); }
      else { btn.disabled = false; btn.textContent = "Create PDF"; }
    } catch (err) {
      btn.disabled = false; btn.textContent = "Create PDF";
      toast("Couldn't create the PDF. Open the app once online, then try again.");
    }
  });
}

// ---------- Change request sheet (back to Claude) ----------
function openRequest(preDay, preEx) {
  const kinds = ["Change an exercise", "Add an exercise", "Remove an exercise", "Something else"];
  let kind = preEx ? kinds[0] : kinds[1];
  const dayOpts = programByWeek();
  const exOpts = dayId => {
    const d = PROGRAM.find(x => x.id === dayId);
    return `<option value="">Any / new exercise</option>` + (d ? d.blocks.flatMap(b => b.items).map(it => `<option value="${it.id}" ${it.id === preEx ? "selected" : ""}>${esc(it.name)}</option>`).join("") : "");
  };
  const day0 = preDay || dayFor(state.date).id;
  showSheet(`
    <div class="chip day">Request a change</div>
    <h2 id="sheetTitle">Change the program</h2>
    <div class="muscles">Describe what you want. The app packs it with your current plan and recent logs, so Claude can update the app and push it live.</div>
    <div class="req-kinds" role="radiogroup" aria-label="Type of change">${kinds.map(k => `<button role="radio" class="req-kind" data-kind="${k}" aria-checked="${k === kind}">${k}</button>`).join("")}</div>
    <div class="req-grid">
      <label for="reqDay">Day</label>
      <select id="reqDay">${dayOpts.map(d => `<option value="${d.id}" ${d.id === day0 ? "selected" : ""}>${DOW[dowOf(d.id)]} · ${esc(d.short)}</option>`).join("")}</select>
      <label for="reqEx">Exercise</label>
      <select id="reqEx">${exOpts(day0)}</select>
    </div>
    <label class="req-label" for="reqText">What should change?</label>
    <textarea class="notes" id="reqText" placeholder="e.g. Replace hack squat with leg press, 4×8–12. Or: add calf raises to Monday, 3×12–15."></textarea>
    <details class="req-preview"><summary>Preview the message</summary><pre id="reqPreview"></pre></details>
    <div class="req-actions">
      <button class="btn primary" id="reqCopy">Copy &amp; open Claude</button>
      <button class="btn" id="reqShare">Share…</button>
      <a class="btn" id="reqIssue" target="_blank" rel="noopener">Send as GitHub issue</a>
      <button class="btn" id="sheetClose">Cancel</button>
    </div>
    <p class="small" style="margin:10px 0 0">Paste it into this project's Claude Code chat. When the change is pushed, the app updates itself.</p>`);
  const body = $("#sheetBody");
  const msg = () => buildRequestText(kind, $("#reqDay").value, $("#reqEx").value, $("#reqText").value);
  const refresh = () => {
    const m = msg();
    $("#reqPreview").textContent = m;
    const day = PROGRAM.find(d => d.id === $("#reqDay").value);
    const title = `${kind}: ${day ? day.short : ""}${$("#reqEx").value ? " · " + ALL_ITEMS[$("#reqEx").value].name : ""}`;
    $("#reqIssue").href = `${REPO_ISSUES}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(m.slice(0, 6000))}`;
  };
  body.querySelectorAll("[data-kind]").forEach(b => b.addEventListener("click", () => {
    kind = b.dataset.kind; haptic();
    body.querySelectorAll("[data-kind]").forEach(x => x.setAttribute("aria-checked", x === b));
    refresh();
  }));
  $("#reqDay").addEventListener("change", () => { $("#reqEx").innerHTML = exOpts($("#reqDay").value); refresh(); });
  $("#reqEx").addEventListener("change", refresh);
  $("#reqText").addEventListener("input", refresh);
  refresh();
  const needText = () => { if ($("#reqText").value.trim()) return true; toast("Describe the change first"); $("#reqText").focus(); return false; };
  $("#reqCopy").addEventListener("click", () => {
    if (!needText()) return;
    const m = msg();
    const done = ok => { toast(ok ? "Copied. Paste it into Claude Code" : "Select the preview text and copy it"); if (ok) window.open("https://claude.ai/code", "_blank", "noopener"); else body.querySelector(".req-preview").open = true; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(m).then(() => done(true), () => done(false));
    else done(false);
  });
  $("#reqShare").addEventListener("click", async () => {
    if (!needText()) return;
    if (navigator.share) { try { await navigator.share({ title: "Gym Log change request", text: msg() }); } catch (e) { /* cancelled */ } }
    else toast("Sharing isn't available here. Use Copy instead.");
  });
  $("#reqIssue").addEventListener("click", e => { if (!needText()) e.preventDefault(); });
}

// Swap the workouts of two dates (logged sets, timers and notes travel with their workout)
function swapDates(a, b) {
  const da = dayFor(a).id, dbId = dayFor(b).id;
  const ra = db.sessions[a], rb = db.sessions[b];
  if (ra) db.sessions[b] = ra; else delete db.sessions[b];
  if (rb) db.sessions[a] = rb; else delete db.sessions[a];
  session(b, true).dayId = da;
  session(a, true).dayId = dbId;
  saveNow();
}
function openMoveDay(date) {
  const mon = mondayOf(date), cur = dayFor(date);
  const rows = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(mon, i), day = dayFor(d), st = dayStats(d), logged = st && st.done > 0;
    return `<button class="swap-opt move-opt day-${DAY_COLOR[day.id]} ${d === date ? "cur" : ""}" data-move="${d}" ${d === date ? "disabled" : ""}>
      <span class="plate" style="--size:34px" aria-hidden="true"></span>
      <span class="grow"><b>${fmtDate(d, { weekday: "long" })} ${parseIso(d).getDate()}</b><small>${esc(day.short)}${logged ? ` · ${st.done} set${st.done === 1 ? "" : "s"} logged` : ""}${d === date ? " · this day" : ""}</small></span>
      <span class="move-arrow" aria-hidden="true">${d === date ? "" : "⇄"}</span>
    </button>`;
  }).join("");
  showSheet(`
    <div class="chip day">Move workout</div>
    <h2 id="sheetTitle">Move ${esc(cur.short)}</h2>
    <div class="muscles">Pick the day to swap with. The two workouts trade places this week only; anything already logged moves with its workout.</div>
    <div class="swap-list">${rows}</div>
    <button class="link-btn req-link" id="openSchedule">Change the schedule for every week instead</button>
    <div class="sheet-actions" style="grid-template-columns:1fr"><button class="btn" id="sheetClose">Cancel</button></div>`);
  $("#sheetBody").querySelectorAll("[data-move]").forEach(b => b.addEventListener("click", () => {
    const to = b.dataset.move, other = dayFor(to);
    swapDates(date, to); haptic(); closeSheet();
    setTimeout(() => {
      navigate(() => { state.date = to; window.scrollTo(0, 0); }, to > date ? "fwd" : "back");
      toast(`${cur.short} moved to ${fmtDate(to, { weekday: "short" })}. ${other.short} is now on ${fmtDate(date, { weekday: "short" })}`);
    }, 220);
  }));
  $("#openSchedule").addEventListener("click", () => { closeSheet(); setTimeout(openSchedule, 280); });
}
function openSchedule() {
  const draw = () => {
    const sch = schedule();
    const custom = Object.keys(db.settings.schedule || {}).length === 7;
    $("#schedRows").innerHTML = WEEK_ORDER.map(w => {
      const day = PROGRAM.find(d => d.id === sch[w]);
      return `<div class="sched-row day-${DAY_COLOR[day.id]}">
        <span class="sched-dow">${DOW[w]}</span>
        <span class="plate" style="--size:30px" aria-hidden="true"></span>
        <select data-dow="${w}" aria-label="Workout on ${DOW[w]}">${programByWeek().sort((x, y) => x.id.localeCompare(y.id)).map(d => `<option value="${d.id}" ${d.id === day.id ? "selected" : ""}>${esc(d.short)} · ${d.type === "lift" ? "lift" : "mobility"}</option>`).join("")}</select>
      </div>`;
    }).join("");
    $("#schedReset").hidden = !custom;
    $("#schedRows").querySelectorAll("select").forEach(sel => sel.addEventListener("change", () => {
      const w = +sel.dataset.dow, want = sel.value, s2 = schedule();
      const from = +Object.keys(s2).find(k => s2[k] === want);
      s2[from] = s2[w]; s2[w] = want;            // swap so each workout stays once a week
      db.settings.schedule = s2; saveNow(); haptic();
      draw(); render({ quiet: true });
      toast(`${PROGRAM.find(d => d.id === want).short} is now on ${DOW[w]}`);
    }));
    const lifts = WEEK_ORDER.map(w => PROGRAM.find(d => d.id === schedule()[w]).type === "lift");
    const backToBack = lifts.some((l, i) => l && lifts[(i + 1) % 7] && PROGRAM.find(d => d.id === schedule()[WEEK_ORDER[i]]).short.startsWith("Lower") && PROGRAM.find(d => d.id === schedule()[WEEK_ORDER[(i + 1) % 7]]).short.startsWith("Lower"));
    $("#schedWarn").hidden = !backToBack;
  };
  showSheet(`
    <div class="chip day">Weekly schedule</div>
    <h2 id="sheetTitle">Your training days</h2>
    <div class="muscles">Choose the workout for each day. Picking a workout swaps it with the day it was on, so every workout stays once a week. Applies from today on; days you've already logged keep their workout.</div>
    <div class="sched" id="schedRows"></div>
    <div class="note" id="schedWarn" hidden><b>Heads-up</b>Two lower-body days back to back. Your legs and knee recover better with a day between them.</div>
    <div class="sheet-actions"><button class="btn" id="schedReset">Reset to default</button><button class="btn primary" id="sheetClose">Done</button></div>`);
  draw();
  $("#schedReset").addEventListener("click", () => { delete db.settings.schedule; saveNow(); haptic(); draw(); render({ quiet: true }); toast("Back to the default schedule"); });
}

function openSwap(origId, date) {
  const orig = ALL_ITEMS[origId], cur = swapFor(origId, date) || origId;
  const isDefault = (db.settings.swaps || {})[origId] === (cur === origId ? undefined : cur) && cur !== origId;
  const opt = id => {
    const x = ALTS[id] || {}, it = ALL_ITEMS[id], last = lastFor(id, date);
    return `<button class="swap-opt ${id === cur ? "cur" : ""}" data-to="${id}">
      <span class="grow"><span class="opt-name"><b>${esc(it.name)}</b>${id === origId ? '<span class="tag ss">PLAN</span>' : ""}</span>
      <small>${esc(id === origId ? "The programmed exercise" : x.note || (HOWTO[id] && HOWTO[id].m) || "")}</small>
      ${last ? `<small class="num">Last: ${esc(filledSets(last.sets).map(s => `${s.w || "BW"}×${s.r || "?"}`).join("  "))}</small>` : ""}</span>
      <span class="radio" aria-hidden="true"></span>
    </button>`;
  };
  $("#sheetBody").innerHTML = `
    <div class="chip day">Swap exercise</div>
    <h2 id="sheetTitle">${esc(orig.name)}</h2>
    <div class="muscles">Same sets, reps and rest. Each exercise keeps its own history and targets.</div>
    <div class="swap-list">${[origId, ...SWAPS[origId]].map(opt).join("")}</div>
    <label class="toggle"><span><b>Use from now on</b><br><small>Otherwise the swap is for this session only</small></span><input type="checkbox" id="swapDefault" ${isDefault ? "checked" : ""}><i aria-hidden="true"></i></label>
    <div class="sheet-actions" style="grid-template-columns:1fr"><button class="btn" id="sheetClose">Cancel</button></div>`;
  presentSheet();
  $("#sheetBody").querySelectorAll("[data-to]").forEach(b => b.addEventListener("click", () => {
    const to = b.dataset.to, keep = $("#swapDefault").checked;
    const s = session(date, true);
    s.swaps = s.swaps || {};
    s.swaps[origId] = to === origId ? "" : to;
    db.settings.swaps = db.settings.swaps || {};
    if (keep && to !== origId) db.settings.swaps[origId] = to;
    else if (keep || to === origId) delete db.settings.swaps[origId];
    saveNow(); haptic(); closeSheet();
    setTimeout(() => {
      const y = window.scrollY;
      navigate(() => {}, "fwd");
      window.scrollTo(0, y);
      toast(to === origId ? `Back to ${orig.name}` : `Swapped to ${ALL_ITEMS[to].name}${keep ? " from now on" : " for this session"}`);
    }, 200);
  }));
}
function closeSheet() {
  if (sheet.hidden || sheet.classList.contains("closing")) return;
  if (document.activeElement && sheet.contains(document.activeElement)) document.activeElement.blur();
  const done = () => { sheet.hidden = true; backdrop.hidden = true; sheet.classList.remove("closing"); backdrop.classList.remove("closing"); };
  clearTimeout(sheetCloseTimer);
  if (reduceMotion()) done();
  else { sheet.classList.add("closing"); backdrop.classList.add("closing"); sheetCloseTimer = setTimeout(done, 260); }
  document.body.style.overflow = "";
  if (sheetReturnFocus) sheetReturnFocus.focus({ preventScroll: true });
}
backdrop.addEventListener("click", closeSheet);
document.addEventListener("keydown", e => { if (e.key === "Escape" && !sheet.hidden) closeSheet(); });
// swipe down to close
(() => {
  let y0 = null;
  sheet.addEventListener("touchstart", e => { y0 = sheet.scrollTop <= 0 ? e.touches[0].clientY : null; }, { passive: true });
  sheet.addEventListener("touchmove", e => {
    if (y0 == null) return;
    const dy = e.touches[0].clientY - y0;
    if (dy > 0) { sheet.style.transition = "none"; sheet.style.transform = `translateY(${dy}px)`; }
  }, { passive: true });
  sheet.addEventListener("touchend", e => {
    if (y0 == null) return;
    const dy = e.changedTouches[0].clientY - y0;
    y0 = null;
    sheet.style.transition = "transform .3s cubic-bezier(.22, 1, .36, 1)";
    if (dy > 90) {
      sheet.style.transform = "translateY(100%)";
      backdrop.classList.add("closing");
      clearTimeout(sheetCloseTimer);
      sheetCloseTimer = setTimeout(() => { sheet.style.transform = ""; sheet.style.transition = ""; sheet.hidden = true; backdrop.hidden = true; backdrop.classList.remove("closing"); document.body.style.overflow = ""; }, 280);
    }
    else { sheet.style.transform = ""; setTimeout(() => { sheet.style.transition = ""; }, 300); }
  });
})();

// ---------- Today ----------
function setLabel(it, i) { return it.kind === "main" ? (i === 0 ? "TOP" : "B" + i) : String(i + 1); }

function renderToday() {
  const date = state.date;
  const day = dayFor(date);
  const s = session(date, false);
  const w = blockWeek(date);
  const scheme = WEEK_SCHEME[w];
  const isLift = day.type === "lift";
  const nm = splitName(day.name);
  setDayColor(day.id);
  const isToday = date === todayIso();
  setHeader(isToday ? "Today" : fmtDate(date, { weekday: "long" }), fmtDate(date, { day: "numeric", month: "long" }));

  // 7-day strip
  const mon = mondayOf(date);
  let strip = `<div class="strip" role="group" aria-label="Choose a day">
    <button class="arrow" data-shift="-7" aria-label="Previous week">‹</button>`;
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i), dd = dayFor(d), pr = sessionProgress(d, dd);
    const cls = ["d", "day-" + DAY_COLOR[dd.id], d === date ? "sel" : "", d === todayIso() ? "today" : "", pr.done && pr.done >= pr.total ? "done" : ""].join(" ");
    strip += `<button class="${cls}" data-date="${d}" aria-label="${fmtDate(d, { weekday: "long", day: "numeric", month: "long" })}, ${esc(dd.short)}" ${d === date ? 'aria-current="date"' : ""}>
      <span class="w">${DOW[parseIso(d).getDay()].slice(0, 2)}</span><span class="n">${parseIso(d).getDate()}</span><span class="dot"></span></button>`;
  }
  strip += `<button class="arrow" data-shift="7" aria-label="Next week">›</button></div>`;

  Object.keys(CUR).forEach(k => delete CUR[k]);
  const items = day.blocks.flatMap(b => b.items);
  let html = strip + `
  <section class="hero">
    <div class="hero-head">
      <div class="plate" aria-hidden="true"></div>
      <div>
        <h2 class="hero-name">${esc(nm.short)}</h2>
        <div class="hero-sub">${esc(nm.sub)}</div>
      </div>
    </div>
    <div class="hero-meta">
      <span class="chip day">${isLift ? "Lift day" : "Mobility day"}</span>
      <span class="chip num">${esc(day.duration)}</span>
      <span class="chip num">${items.length} items</span>
    </div>
    ${isLift
      ? `<dl class="scheme"><dt>Main lift</dt><dd>${esc(scheme.main)}</dd><dt>Accessories</dt><dd>${esc(scheme.acc)}</dd></dl>`
      : `<dl class="scheme"><dt>Pace</dt><dd>Easy. Hold stretches 30–60s and breathe slowly. You should finish feeling better than you started.</dd></dl>`}
    <div class="workout" id="workout" hidden></div>
    <div class="meter-row"><div class="meter" id="meter" aria-hidden="true"></div><span class="meter-pct num" id="pct">0%</span></div>
    <div class="hero-foot">
      <span id="pcount"></span>
    </div>
    <div class="day-tools">
      <button class="tool-btn" id="moveDay">${ICON.swap}<span>Move to another day</span></button>
      <label class="swap" title="Do a different workout today">
        <select id="daySwap" aria-label="Do a different workout on this day">
          ${programByWeek().map(d => `<option value="${d.id}" ${d.id === day.id ? "selected" : ""}>${esc(d.short)}${d.id === defaultDayFor(date).id ? " (planned)" : ""}</option>`).join("")}
        </select>
      </label>
    </div>
  </section>`;

  day.blocks.forEach(b => {
    const logged = b.items.filter(isLogged), checks = b.items.filter(it => !isLogged(it));
    const m = b.title.match(/^(.*?)\s*\((.*)\)$/);
    const n = b.items.length;
    const rm = ((m && m[2]) || "").match(/(\d+)\s*rounds?/i);
    html += `<div class="section-head"><span class="sec-ico" aria-hidden="true">${sectionIcon(b.title)}</span><h3>${esc(m ? m[1] : b.title)}</h3>${rm ? `<span class="rounds-chip">×${rm[1]} rounds</span>` : `<span>${esc(m ? m[2] : `${n} ${n === 1 ? "exercise" : "exercises"}`)}</span>`}</div>`;
    if (rm) {
      const total = +rm[1], doneR = (s && s.rounds && s.rounds[b.title]) || 0;
      html += `<div class="rounds" data-rounds="${esc(b.title)}">
        <div class="rounds-text"><b>Go through this list ${total} times</b><span>Tap a round when you finish it</span></div>
        <div class="rounds-pills">${Array.from({ length: total }, (_, i) => `<button class="round ${i < doneR ? "on" : ""}" data-round="${i + 1}" aria-pressed="${i < doneR}">${ICON.check}<span>Round ${i + 1}</span></button>`).join("")}</div>
      </div>`;
    }
    if (checks.length) html += `<div class="checklist">${checks.map(it => checkRow(it, s)).join("")}</div>`;
    logged.forEach((it, i) => {
      const next = logged[i + 1], prev = logged[i - 1];
      const ssCls = it.ss && next && next.ss === it.ss ? "ss-first" : it.ss && prev && prev.ss === it.ss ? "ss-next" : "";
      html += exCard(eff(it, date), date, s, ssCls);
    });
  });

  html += `<div class="section-head"><h3>Notes</h3><span>sleep, energy, knee</span></div>
    <textarea class="notes" id="notes" placeholder="How did the session feel? Anything to remember next time?">${esc((s && s.notes) || "")}</textarea>
    <div id="summary"></div>`;

  view.innerHTML = html;
  bindToday(date, day);
  updateProgress(date, day);
  updateClocks();
}

function sectionIcon(title) {
  const t = title.toLowerCase();
  const svg = d => `<svg viewBox="0 0 24 24">${d}</svg>`;
  if (/warm/.test(t)) return svg('<path d="M12 21c-3.9 0-6.5-2.6-6.5-6.1 0-3.2 2.2-5 3.6-7.4.4 1.8 1.3 2.9 2.4 3.4.2-3 1.6-5.6 4.1-7.4-.3 2.9.9 4.6 2 6.4 1 1.6 1.9 3.1 1.9 5 0 3.5-3.1 6.1-7.5 6.1z"/>');
  if (/power/.test(t)) return svg('<path d="M13.5 2 5 13.5h6L10 22l9-12h-6z"/>');
  if (/strength/.test(t)) return svg('<rect x="2" y="9" width="3" height="6" rx="1"/><rect x="5.5" y="6.5" width="3" height="11" rx="1"/><rect x="8.5" y="11" width="7" height="2"/><rect x="15.5" y="6.5" width="3" height="11" rx="1"/><rect x="19" y="9" width="3" height="6" rx="1"/>');
  if (/hypertrophy|loaded/.test(t)) return svg('<rect x="3" y="8" width="4" height="8" rx="1.5"/><rect x="17" y="8" width="4" height="8" rx="1.5"/><rect x="7" y="11" width="10" height="2" rx="1"/>');
  if (/abs|core/.test(t)) return svg('<rect x="7" y="4" width="4.5" height="4.5" rx="1.2"/><rect x="12.5" y="4" width="4.5" height="4.5" rx="1.2"/><rect x="7" y="9.75" width="4.5" height="4.5" rx="1.2"/><rect x="12.5" y="9.75" width="4.5" height="4.5" rx="1.2"/><rect x="7" y="15.5" width="4.5" height="4.5" rx="1.2"/><rect x="12.5" y="15.5" width="4.5" height="4.5" rx="1.2"/>');
  if (/knee/.test(t)) return svg('<circle cx="12" cy="12" r="3.2"/><rect x="10.6" y="2" width="2.8" height="7" rx="1.4"/><rect x="10.6" y="15" width="2.8" height="7" rx="1.4"/>');
  if (/conditioning|easy|walk/.test(t)) return svg('<path d="M12 20.5s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.9c0 5.6-7.5 10-7.5 10z"/>');
  return svg('<path d="M3 15c3-6 6-6 9 0s6 6 9 0" fill="none" stroke-width="2.6" stroke-linecap="round"/>');
}

function checkRow(it, s) {
  const on = s && s.ticks && s.ticks[it.id];
  return `<div class="check-row ${on ? "on" : ""}" data-row="${it.id}">
    <button class="tick ${on ? "on" : ""}" data-tick="${it.id}" aria-pressed="${on ? "true" : "false"}" aria-label="Mark ${esc(it.name)} done">${ICON.check}</button>
    <div class="grow"><div class="t"><span>${esc(it.name)}</span></div><div class="s">${esc(it.rx || "")}<span class="row-time num" data-time></span></div></div>
    <button class="clock mini" data-clock data-mode="idle" aria-label="Start timer for ${esc(it.name)}">${ICON.watch}<span class="num" data-clock-t></span></button>
    <button class="info-dot" data-howto="${it.id}" aria-label="How to do ${esc(it.name)}">i</button>
  </div>`;
}

const PLAN_CACHE = {};
function planBlock(it, plan) {
  if (!plan) return "";
  if (plan.calibrate) {
    return plan.rpe
      ? `<div class="plan"><div class="plan-note">Work up to a top set that feels <b>RPE ${plan.rpe}</b> (${10 - plan.rpe} reps left). Targets appear here after your first log.</div></div>`
      : `<div class="plan"><div class="plan-note">Deload: 3 × 5 at about 65% of your usual top set.</div></div>`;
  }
  const work = plan.deload ? plan.work : plan.top;
  const plateHTML = w => BARBELL.has(it.id) ? globalThis.plateHTML(w) : "";
  const warm = warmups(work, it.id).map((x, k) => `<li style="--k:${k}"><span class="num"><b>${x.w === BAR ? "Bar" : fmtKg(x.w)}</b> × ${x.r}</span>${x.w > BAR ? plateHTML(x.w) : ""}</li>`).join("");
  const rows = plan.deload
    ? `<div class="plan-row"><span class="plan-k">Deload</span><span class="plan-v num"><b>${fmtKg(plan.work)}</b> × 5 <small>3 sets, easy</small></span>${plateHTML(plan.work)}</div>`
    : `<div class="plan-row"><span class="plan-k">Top</span><span class="plan-v num"><b>${fmtKg(plan.top)}</b> × ${plan.reps} <small>@ RPE ${plan.rpe}</small></span>${plateHTML(plan.top)}</div>
       <div class="plan-row"><span class="plan-k">Back-offs</span><span class="plan-v num" data-bo><b>${fmtKg(backoffWeight(plan))}</b> × ${plan.boReps}</span><span data-bo-plates>${plateHTML(backoffWeight(plan))}</span></div>`;
  return `<div class="plan">
    ${rows}
    <button class="link-btn warm-toggle" data-warm aria-expanded="false">Warm-up sets <span aria-hidden="true">▾</span></button>
    <div class="warm-wrap"><ol class="warmups">${warm}</ol></div>
  </div>`;
}

function exCard(it, date, s, ssCls) {
  CUR[it.id] = it;
  const saved = (s && s.sets && s.sets[it.id]) || [];
  const last = lastFor(it.id, date);
  const lastSets = last ? last.sets : [];
  const rows = rowCount(it, s);
  const bw = it.kind === "bw";
  const plan = it.kind === "main" ? mainPlan(it, date) : null;
  PLAN_CACHE[it.id] = plan;
  const ph = i => {
    if (plan && plan.deload) return { w: fmtKg(plan.work), r: 5 };
    if (plan && plan.top) return i === 0 ? { w: fmtKg(plan.top), r: plan.reps } : { w: fmtKg(backoffWeight(plan, saved[0] && num(saved[0].w))), r: plan.boReps };
    const prev = lastSets[i] || {};
    return { w: prev.w ?? (bw ? "BW" : "–"), r: prev.r ?? "–" };
  };
  let sets = `<div class="set-head"><span>Set</span><span>${bw ? "+kg" : "kg"}</span><span>Reps</span><span></span></div>`;
  for (let i = 0; i < rows; i++) {
    const cur = saved[i] || {}, p = ph(i);
    const lbl = setLabel(it, i);
    sets += `<div class="set ${cur.d ? "done" : ""}" data-i="${i}">
      <span class="lbl ${lbl === "TOP" ? "top" : ""}">${lbl}</span>
      <input inputmode="decimal" enterkeyhint="next" data-f="w" value="${esc(cur.w ?? "")}" placeholder="${esc(p.w)}" aria-label="${esc(it.name)} set ${i + 1} weight">
      <input inputmode="decimal" enterkeyhint="done" data-f="r" value="${esc(cur.r ?? "")}" placeholder="${esc(p.r)}" aria-label="${esc(it.name)} set ${i + 1} reps">
      <button class="chk" data-done aria-label="Set ${i + 1} done" aria-pressed="${cur.d ? "true" : "false"}">${ICON.check}</button>
    </div>`;
  }
  const lastTxt = last
    ? `<span>Last ${fmtDate(last.date, { day: "numeric", month: "short" })}</span><b class="num">${esc(filledSets(last.sets).map(x => `${x.w || (bw ? "BW" : "?")}×${x.r || "?"}`).join("  "))}</b>`
    : `<span>First time logging this one. Grey boxes will show your numbers next time.</span>`;
  const hint = it.kind !== "main" ? accHint(it, date) : "";
  const complete = saved.length >= rows && saved.slice(0, rows).every(x => x.d);
  return `<article class="ex ${ssCls} ${complete ? "complete" : ""}" data-ex="${it.id}">
    <div class="ex-top">
      <div class="grow">
        <div class="ex-name">${it.ssLabel ? `<span class="tag ss">${it.ssLabel}</span>` : ""}${it.kind === "main" ? '<span class="tag main">MAIN</span>' : ""}${esc(it.name)}</div>
        ${it.swappedFrom ? `<div class="swapped">${ICON.swap}Swapped for ${esc(ALL_ITEMS[it.swappedFrom].name)}</div>` : ""}
        <div class="ex-rx num"><span><b>${it.sets}</b> set${it.sets === 1 ? "" : "s"}</span><span><b>${esc(it.reps)}</b>${/^[\d–-]+$/.test(it.reps) ? " reps" : ""}</span>${it.rest && it.rest !== "—" ? `<span>rest <b>${esc(it.rest)}</b></span>` : it.ss ? "<span>then straight to the next exercise</span>" : ""}</div>
        <div class="ex-tools">
          <button class="clock" data-clock data-mode="idle" aria-label="Start exercise timer">${ICON.watch}<span class="num" data-clock-t>Start</span></button>
          <button class="tool-btn" data-howto="${it.id}" aria-label="How to do ${esc(it.name)}">${ICON.book}<span>How to</span></button>
          ${SWAPS[it.swappedFrom || it.id] ? `<button class="tool-btn" data-swap aria-label="Swap ${esc(it.name)}">${ICON.swap}<span>Swap</span></button>` : ""}
        </div>
      </div>
    </div>
    <div class="ex-body"><div class="ex-inner">
      ${planBlock(it, plan)}
      <div class="ex-last">${lastTxt}<span class="pr" data-pr></span></div>
      ${hint ? `<div class="hint">${hint}</div>` : ""}
      <div class="sets">${sets}</div>
      <div class="ex-actions">
        <button class="link-btn add-btn" data-add>+ Add set</button>
        <button class="link-btn quiet" data-remove>Remove set</button>
      </div>
    </div></div>
    <div class="ex-fold"><div class="ex-inner">
      <div class="ex-summary"><span class="done-dot">${ICON.check}</span><span class="num" data-summary></span><span class="ex-time num" data-time></span><button class="edit" data-edit>Edit</button></div>
    </div></div>
  </article>`;
}

function readSets(card) {
  return [...card.querySelectorAll(".set")].map(row => ({
    w: row.querySelector('[data-f="w"]').value.trim(),
    r: row.querySelector('[data-f="r"]').value.trim(),
    d: row.classList.contains("done"),
  }));
}
function persistCard(date, card) {
  const s = session(date, true);
  s.dayId = dayFor(date).id;
  const sets = readSets(card);
  while (sets.length && !sets[sets.length - 1].w && !sets[sets.length - 1].r && !sets[sets.length - 1].d) sets.pop();
  if (sets.length) s.sets[card.dataset.ex] = sets; else delete s.sets[card.dataset.ex];
  save();
  refreshCard(date, card);
}
function refreshCard(date, card) {
  const exId = card.dataset.ex;
  const sets = readSets(card);
  const cur = sets.reduce((m, x) => Math.max(m, e1rm(x.w, x.r) || 0), 0);
  const prev = bestBefore(exId, date);
  const pr = $("[data-pr]", card), prText = cur > 0 && prev > 0 && cur > prev + 0.01 ? `PR · e1RM ${fmtKg(cur)} kg` : "";
  if (prText && pr.textContent !== prText) {
    flash(pr, "pop", 1000);
    if (card.dataset.ready) burst(pr, 10, ["var(--yellow)", "var(--day)"]);
  }
  pr.textContent = prText;
  card.dataset.ready = "1";
  const complete = sets.length > 0 && sets.every(x => x.d);
  card.classList.toggle("complete", complete);
  const plan = PLAN_CACHE[exId];
  if (plan && plan.top) {
    const bo = backoffWeight(plan, num(sets[0] && sets[0].w));
    card.querySelectorAll('.set:not([data-i="0"]) [data-f="w"]').forEach(inp => { inp.placeholder = fmtKg(bo); });
    const boEl = $("[data-bo] b", card);
    if (boEl && boEl.textContent !== fmtKg(bo)) { boEl.textContent = fmtKg(bo); $("[data-bo-plates]", card).innerHTML = BARBELL.has(exId) ? plateHTML(bo) : ""; flash(boEl, "swap", 400); }
  }
  const bw = itemFor(exId).kind === "bw";
  $("[data-summary]", card).textContent = sets.map(x => `${x.w || (bw ? "BW" : "?")}×${x.r || "?"}`).join("  ");
}

function bindToday(date, day) {
  view.querySelectorAll("[data-shift]").forEach(b => b.addEventListener("click", () => navigate(() => { state.date = addDays(date, +b.dataset.shift); }, +b.dataset.shift > 0 ? "fwd" : "back")));
  view.querySelectorAll(".strip [data-date]").forEach(b => b.addEventListener("click", () => {
    if (b.dataset.date === date) return;
    haptic();
    navigate(() => { state.date = b.dataset.date; }, b.dataset.date > date ? "fwd" : "back");
  }));
  $("#daySwap").addEventListener("change", e => navigate(() => { const s = session(date, true); s.dayId = e.target.value; save(); }, "fwd"));
  $("#moveDay").addEventListener("click", () => { haptic(); openMoveDay(date); });
  $("#notes").addEventListener("input", e => { session(date, true).notes = e.target.value; save(); });
  view.querySelectorAll("[data-howto]").forEach(b => b.addEventListener("click", () => openHowto(b.dataset.howto)));
  view.querySelectorAll("[data-rounds] [data-round]").forEach(btn => btn.addEventListener("click", () => {
    const box = btn.closest("[data-rounds]"), key = box.dataset.rounds, r = +btn.dataset.round;
    const s = session(date, true);
    s.rounds = s.rounds || {};
    s.rounds[key] = (s.rounds[key] || 0) >= r ? r - 1 : r;   // tap the last finished round again to undo it
    box.querySelectorAll("[data-round]").forEach(x => {
      const on = +x.dataset.round <= s.rounds[key];
      if (on && !x.classList.contains("on")) flash(x, "just", 500);
      x.classList.toggle("on", on); x.setAttribute("aria-pressed", on);
    });
    markActivity(date); haptic(); save();
    if (s.rounds[key] === box.querySelectorAll("[data-round]").length) toast("All rounds done");
  }));

  view.querySelectorAll(".check-row [data-clock]").forEach(btn => btn.addEventListener("click", () => {
    const id = btn.closest("[data-row]").dataset.row, it = ALL_ITEMS[id], c = clockOf(date, id);
    if (c && c.run) { stopClock(date, id); if (timer && timer.exId === id) stopRest(); }
    else { startClock(date, id); if (date === todayIso()) startHold(it); }
    haptic(); tickTimer();
  }));
  view.querySelectorAll("[data-tick]").forEach(tick => tick.addEventListener("click", () => {
    const s = session(date, true); s.dayId = day.id;
    const id = tick.dataset.tick;
    if (s.ticks[id]) delete s.ticks[id]; else s.ticks[id] = true;
    const on = !!s.ticks[id];
    tick.classList.toggle("on", on); tick.setAttribute("aria-pressed", on);
    tick.closest(".check-row").classList.toggle("on", on);
    if (on) {
      flash(tick, "just", 500); markActivity(date); haptic();
      stopClock(date, id);
      if (timer && timer.exId === id) stopRest();
    }
    save(); updateProgress(date, day);
  }));

  view.querySelectorAll(".ex").forEach(card => {
    card.addEventListener("input", e => {
      if (!e.target.matches("input")) return;
      persistCard(date, card);
      const c = clockOf(date, card.dataset.ex);
      if (date === todayIso() && !(c && c.run) && !card.classList.contains("complete")) startClock(date, card.dataset.ex);
    });
    card.addEventListener("click", e => {
      const done = e.target.closest("[data-done]");
      if (done) {
        const row = done.closest(".set");
        if (!row.classList.contains("done")) {
          // Empty boxes take last session's numbers when ticked
          row.querySelectorAll("input").forEach(inp => { if (!inp.value && inp.placeholder && inp.placeholder !== "BW" && inp.placeholder !== "–") inp.value = inp.placeholder; });
        }
        row.classList.toggle("done");
        done.setAttribute("aria-pressed", row.classList.contains("done"));
        if (row.classList.contains("done")) {
          flash(row, "just", 650); markActivity(date);
          const c = clockOf(date, card.dataset.ex);
          if (date === todayIso() && !(c && c.run)) startClock(date, card.dataset.ex);
        }
        const wasOpen = card.classList.contains("open"), wasComplete = card.classList.contains("complete");
        persistCard(date, card); updateProgress(date, day);
        if (card.classList.contains("complete") && !wasComplete) {
          stopClock(date, card.dataset.ex);
          // let the tick land, then fold the card into its summary
          card.classList.add("open");
          setTimeout(() => { if (!wasOpen) card.classList.remove("open"); flash(card, "just-complete", 900); }, 550);
        }
        haptic();
        if (row.classList.contains("done")) afterSet(itemFor(card.dataset.ex), date);
        return;
      }
      if (e.target.closest("[data-edit]")) { card.classList.add("open"); return; }
      if (e.target.closest("[data-swap]")) { const it = itemFor(card.dataset.ex); openSwap(it.swappedFrom || it.id, date); return; }
      if (e.target.closest("[data-clock]")) {
        const c = clockOf(date, card.dataset.ex);
        if (c && c.run) { stopClock(date, card.dataset.ex); if (timer && timer.exId === card.dataset.ex && timer.kind === "hold") stopRest(); }
        else { startClock(date, card.dataset.ex); unlockAudio(); if (date === todayIso()) startHold(itemFor(card.dataset.ex)); }
        haptic(); tickTimer();
        return;
      }
      const warm = e.target.closest("[data-warm]");
      if (warm) {
        const plan = warm.closest(".plan"), open = !plan.classList.contains("warm-open");
        plan.classList.toggle("warm-open", open); warm.setAttribute("aria-expanded", open);
        return;
      }
      const add = e.target.closest("[data-add]"), rem = e.target.closest("[data-remove]");
      if (add || rem) {
        const s = session(date, true); s.dayId = day.id;
        const id = card.dataset.ex;
        const n = Math.max(1, rowCount(itemFor(id), s) + (add ? 1 : -1));
        s.rows = s.rows || {}; s.rows[id] = n;
        const sets = readSets(card).slice(0, n);
        if (sets.length) s.sets[id] = sets; else delete s.sets[id];
        save();
        const scroll = window.scrollY; render({ quiet: true }); window.scrollTo(0, scroll);
      }
    });
    refreshCard(date, card);
  });
}

function updateProgress(date, day) {
  const { total, done } = sessionProgress(date, day);
  const segs = Math.min(total, 30);
  const filled = total ? Math.round(done / total * segs) : 0;
  const meter = $("#meter"), first = !meter.dataset.ready;
  if (meter.children.length !== segs) meter.innerHTML = Array.from({ length: segs }, (_, i) => `<i style="--i:${i}"></i>`).join("");
  [...meter.children].forEach((c, i) => {
    const on = i < filled;
    if (on && !c.classList.contains("on")) {
      c.style.setProperty("--d", first ? `${120 + i * 20}ms` : "0ms");
      c.classList.add("on");
    } else if (!on) c.classList.remove("on");
  });
  meter.dataset.ready = "1";
  const pctEl = $("#pct"), pctTxt = `${total ? Math.round(done / total * 100) : 0}%`;
  if (pctEl && pctEl.textContent !== pctTxt) { pctEl.textContent = pctTxt; if (!first) flash(pctEl, "swap", 400); }
  // the plate turns as the session fills up
  const plate = $(".hero .plate");
  if (plate) plate.style.setProperty("--turn", total ? (done / total).toFixed(3) : 0);
  const complete = total && done >= total;
  $("#pcount").innerHTML = complete
    ? `<b>Session complete.</b> Nice work.`
    : `<b>${done}</b> / <b>${total}</b> done`;
  if (complete && !first && meter.dataset.complete !== "1") {
    const sw = db.sessions[date] && db.sessions[date].workout;
    if (db.settings.autoFinish && sw && !sw.done) setTimeout(() => finishWorkout(date, true), 900);
    flash($(".hero"), "celebrate", 1400);
    burst(plate, 18);
    toast("Session complete. Nice work.");
  }
  meter.dataset.complete = complete ? "1" : "";
  renderSummary(date);
  renderWorkout(date);
}

function updateElapsed() {
  if (state.tab === "today") {
    const t = $("#wkTime"), s = db.sessions[state.date];
    if (t && s && s.workout && s.workout.run) { const txt = fmtClock(workoutMs(s)); if (t.textContent !== txt) t.textContent = txt; }
  }
  const el = $("#elapsed");
  if (!el || state.tab !== "today") return;
  const s = session(state.date, false);
  if (!s || !s.start) { el.hidden = true; return; }
  const meter = $("#meter");
  const live = state.date === todayIso() && meter && meter.dataset.complete !== "1" && Date.now() - s.end < 3 * 3600000;
  const ms = (live ? Date.now() : s.end) - s.start;
  el.hidden = false;
  el.classList.toggle("live", !!live);
  const txt = live ? `Session ${fmtClock(ms)}` : `Took ${Math.max(1, Math.round(ms / 60000))} min`;
  if (el.textContent !== txt) el.textContent = txt;
}

function renderSummary(date) {
  const box = $("#summary");
  if (!box) return;
  const st = dayStats(date);
  if (!st || !st.done) { box.innerHTML = ""; return; }
  // compare with the previous time this session was trained
  const prevDate = Object.keys(db.sessions).filter(d => d < date && dayFor(d).id === st.day.id).sort().pop();
  const prev = prevDate && dayStats(prevDate);
  const delta = prev && prev.vol ? Math.round((st.vol - prev.vol) / prev.vol * 100) : null;
  const finished = st.done >= st.total;
  box.innerHTML = `<div class="section-head"><h3>${finished ? "Session summary" : "So far"}</h3><span>${finished ? "done" : "in progress"}</span></div>
    <div class="card summary">
      <div class="sum-grid">
        <div><div class="k">Time</div><div class="v num">${st.mins || "–"}<small>${st.mins ? " min" : ""}</small></div></div>
        <div><div class="k">Sets</div><div class="v num">${st.done}<small> / ${st.total}</small></div></div>
        <div><div class="k">Volume</div><div class="v num">${st.vol ? fmtVol(st.vol) : "–"}<small>${st.vol && st.vol < 10000 ? " kg" : ""}</small></div></div>
      </div>
      ${delta != null ? `<div class="sum-line"><span class="delta ${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}%</span> volume vs last ${esc(st.day.short)} (${fmtDate(prevDate, { day: "numeric", month: "short" })})</div>` : ""}
      ${st.prs.length ? `<div class="sum-line">${st.prs.map(p => `<span class="pr">PR · ${esc(p.name)} ${fmtKg(p.e)} kg</span>`).join(" ")}</div>` : ""}
    </div>`;
}

// ---------- Log: every day's data ----------
function dayLogHTML(d) {
  const s = db.sessions[d], st = dayStats(d);
  if (!s || !st) return "";
  const exRows = Object.entries(s.sets || {}).map(([id, sets]) => {
    const it = ALL_ITEMS[id], filled = filledSets(sets);
    if (!it || !filled.length) return "";
    const bw = it.kind === "bw";
    return `<div class="log-ex"><span class="log-name">${esc(it.name)}</span><span class="log-sets num">${filled.map(x => `<span class="${x.d ? "" : "undone"}">${esc(x.w || (bw ? "BW" : "?"))}×${esc(x.r || "?")}</span>`).join("")}</span></div>`;
  }).join("");
  const day = st.day, checks = day.blocks.flatMap(b => b.items).filter(it => !isLogged(it));
  const ticked = checks.filter(it => s.ticks && s.ticks[it.id]).length;
  const clocks = Object.entries(s.clock || {}).filter(([, c]) => clockMs(c) > 5000);
  return `<div class="log-detail">
    <div class="log-stats">
      <span><small>Time</small><b class="num">${st.mins ? fmtClock(workoutMs(s)) : "–"}</b></span>
      <span><small>Sets</small><b class="num">${st.done}/${st.total}</b></span>
      <span><small>Kg lifted</small><b class="num">${st.vol ? fmtVol(st.vol) : "–"}</b></span>
      <span><small>PRs</small><b class="num">${st.prs.length}</b></span>
    </div>
    ${exRows || `<p class="small">No sets logged.</p>`}
    ${checks.length ? `<div class="log-ex"><span class="log-name">Warm-up & mobility drills</span><span class="log-sets num"><span>${ticked}/${checks.length} done</span></span></div>` : ""}
    ${clocks.length ? `<div class="log-ex"><span class="log-name">Time per exercise</span><span class="log-sets num">${clocks.map(([id, c]) => `<span>${esc((ALL_ITEMS[id] || {}).name || id)} ${fmtClock(clockMs(c))}</span>`).join("")}</span></div>` : ""}
    ${st.prs.length ? `<div class="log-prs">${st.prs.map(p => `<span class="pr">PR · ${esc(p.name)} ${fmtKg(p.e)} kg</span>`).join("")}</div>` : ""}
    ${s.notes ? `<blockquote class="log-notes">${esc(s.notes)}</blockquote>` : ""}
    <button class="btn" data-open="${d}">Open this day</button>
  </div>`;
}

function renderWeek() {
  const mon = mondayOf(state.date);
  setDayColor("d3");
  setHeader(`Training log · ${fmtDate(mon, { day: "numeric", month: "short" })} – ${fmtDate(addDays(mon, 6), { day: "numeric", month: "short" })}`, mon === mondayOf(todayIso()) ? "This week" : `Week of ${fmtDate(mon, { day: "numeric", month: "short" })}`);
  const w = blockWeek(mon);
  let wkVol = 0, wkMs = 0, wkDone = 0;
  let rows = "";
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i), day = dayFor(d), s = db.sessions[d];
    const st = dayStats(d), hasData = st && st.done > 0;
    if (hasData) { wkVol += st.vol; wkMs += workoutMs(s); wkDone++; }
    const finished = hasData && st.done >= st.total;
    const status = finished ? "Done" : hasData ? `${st.done}/${st.total}` : d < todayIso() ? "Rest / missed" : d === todayIso() ? "Today" : "Planned";
    const line = hasData ? [st.mins ? `${st.mins} min` : null, `${st.done} set${st.done === 1 ? "" : "s"}`, st.vol ? fmtVol(st.vol) + (st.vol < 10000 ? " kg" : "") : null, st.prs.length ? `${st.prs.length} PR${st.prs.length > 1 ? "s" : ""}` : null].filter(Boolean).join(" · ") : esc(day.focus);
    const open = state.logOpen === d;
    rows += `<div class="log-day day-${DAY_COLOR[day.id]} ${hasData ? "has" : ""} ${open ? "open" : ""} ${d === todayIso() ? "is-today" : ""}">
      <button class="day-row" data-day="${d}" aria-expanded="${open}">
        <div class="plate" style="--size:40px" aria-hidden="true"></div>
        <div class="grow"><div class="when">${fmtDate(d, { weekday: "long" })} ${parseIso(d).getDate()}${d === todayIso() ? " · today" : ""}</div>
        <div class="t">${esc(day.short)}</div><div class="s num">${line}</div></div>
        <span class="status ${finished ? "done" : ""}">${status}</span>
        ${hasData ? `<span class="chev" aria-hidden="true">▾</span>` : ""}
      </button>
      ${hasData ? `<div class="log-wrap"><div class="log-inner">${dayLogHTML(d)}</div></div>` : ""}
    </div>`;
  }
  view.innerHTML = `<div class="week-nav">
    <button class="iconbtn" data-wk="-7" aria-label="Previous week">‹</button>
    <div class="range">${esc(WEEK_SCHEME[w].label)}</div>
    <button class="iconbtn" data-wk="7" aria-label="Next week">›</button>
  </div>
  <div class="card week-stats"><div class="sum-grid">
    <div><div class="k">Sessions</div><div class="v num">${wkDone}<small> / 7</small></div></div>
    <div><div class="k">Time</div><div class="v num">${wkMs ? Math.round(wkMs / 60000) : "–"}<small>${wkMs ? " min" : ""}</small></div></div>
    <div><div class="k">Volume</div><div class="v num">${wkVol ? fmtVol(wkVol) : "–"}<small>${wkVol && wkVol < 10000 ? " kg" : ""}</small></div></div>
  </div></div>
  <div class="log-actions">
    <button class="btn primary" id="openReport">${ICON.doc}Export PDF for your trainer</button>
    <button class="btn" id="logSchedule">${ICON.swap}Change training days</button>
  </div>
  <div class="checklist log">${rows}</div>
  <p class="small" style="text-align:center;margin:0">Tap a trained day to see everything you logged.</p>`;
  view.querySelectorAll("[data-wk]").forEach(b => b.addEventListener("click", () => navigate(() => { state.date = addDays(state.date, +b.dataset.wk); state.logOpen = null; }, +b.dataset.wk > 0 ? "fwd" : "back")));
  view.querySelectorAll("[data-day]").forEach(r => r.addEventListener("click", () => {
    const d = r.dataset.day, box = r.closest(".log-day");
    haptic();
    if (!box.classList.contains("has")) { state.date = d; setTab("today"); return; }
    const open = !box.classList.contains("open");
    view.querySelectorAll(".log-day.open").forEach(x => { x.classList.remove("open"); x.querySelector(".day-row").setAttribute("aria-expanded", "false"); });
    box.classList.toggle("open", open); r.setAttribute("aria-expanded", open);
    state.logOpen = open ? d : null;
  }));
  view.querySelectorAll("[data-open]").forEach(b => b.addEventListener("click", () => { state.date = b.dataset.open; setTab("today"); }));
  $("#openReport").addEventListener("click", () => { haptic(); openReport(); });
  $("#logSchedule").addEventListener("click", () => { haptic(); openSchedule(); });
}

// ---------- Progress ----------
function segHTML() {
  const v = state.progView || "overview";
  return `<div class="seg" role="tablist" data-active="${v}">
    <button role="tab" data-pv="overview" aria-selected="${v === "overview"}">Overview</button>
    <button role="tab" data-pv="records" aria-selected="${v === "records"}">Records</button>
  </div>`;
}
function bindSeg() {
  view.querySelectorAll("[data-pv]").forEach(b => b.addEventListener("click", () => {
    if ((state.progView || "overview") === b.dataset.pv) return;
    haptic();
    navigate(() => { state.progView = b.dataset.pv; }, b.dataset.pv === "records" ? "fwd" : "back");
  }));
}

function renderProgress() {
  if (state.progView === "records") return renderRecords();
  const ex = ALL_ITEMS[state.progressEx];
  setDayColor(ex.day.id);
  setHeader("Progress", "Your lifts");
  const big = ["squat", "bench", "deadlift", "ohp"];
  let html = segHTML() + weekStatsHTML() + `<div class="section-head"><h3>Main lifts</h3><span>best estimated 1RM</span></div><div class="lift-grid">` + big.map(id => {
    const best = history(id).reduce((m, x) => Math.max(m, x.best || 0), 0);
    const it = ALL_ITEMS[id];
    return `<button class="lift-tile day-${DAY_COLOR[it.day.id]} ${id === state.progressEx ? "sel" : ""}" data-lift="${id}">
      <span class="k"><i></i>${esc(it.name.replace("Conventional ", "").replace("Standing ", ""))}</span>
      <span class="v">${best ? `<span data-count="${fmtKg(best)}">${fmtKg(best)}</span>` : "–"}<small>${best ? "kg e1RM" : "no data"}</small></span>
    </button>`;
  }).join("") + `</div>`;

  html += `<select class="full" id="exPick" aria-label="Choose exercise">`;
  PROGRAM.forEach(day => {
    const items = day.blocks.flatMap(b => b.items).filter(it => it.kind === "main" || it.kind === "lift");
    if (!items.length) return;
    html += `<optgroup label="${esc(day.short)}">` + items.map(it =>
      `<option value="${it.id}" ${it.id === state.progressEx ? "selected" : ""}>${esc(it.name)}${history(it.id).length ? "" : " (no data)"}</option>`).join("") + `</optgroup>`;
  });
  const swapsLogged = Object.keys(ALTS).filter(id => ALL_ITEMS[id] && history(id).length);
  if (swapsLogged.length) html += `<optgroup label="Swaps">` + swapsLogged.map(id => `<option value="${id}" ${id === state.progressEx ? "selected" : ""}>${esc(ALL_ITEMS[id].name)}</option>`).join("") + `</optgroup>`;
  html += `</select>`;

  const h = history(state.progressEx);
  const best = h.reduce((m, x) => (x.best && (!m || x.best > m.best) ? x : m), null);
  const heaviest = h.reduce((m, x) => Math.max(m, x.top || 0), 0);
  html += `<div class="stats">
    <div class="stat"><div class="k">Best e1RM</div><div class="v">${best ? `<span data-count="${fmtKg(best.best)}">${fmtKg(best.best)}</span>` : "–"}</div><div class="u">kg</div></div>
    <div class="stat"><div class="k">Heaviest</div><div class="v">${heaviest ? `<span data-count="${fmtKg(heaviest)}">${fmtKg(heaviest)}</span>` : "–"}</div><div class="u">kg</div></div>
    <div class="stat"><div class="k">Sessions</div><div class="v"><span data-count="${h.length}">${h.length}</span></div><div class="u">logged</div></div>
  </div>`;

  const pts = h.filter(x => x.best);
  if (pts.length) {
    html += `<div class="card"><span class="eyebrow">${esc(ex.name)} · estimated 1RM (kg)</span><div class="chart" id="chart"></div></div>`;
    html += `<div class="card"><span class="eyebrow">History</span><div class="table-wrap" style="margin-top:10px"><table class="hist"><thead><tr><th>Date</th><th>Best set</th><th class="r">e1RM</th><th class="r">Volume</th></tr></thead><tbody>` +
      h.slice().reverse().slice(0, 15).map(x => `<tr><td>${fmtDate(x.date, { day: "numeric", month: "short", year: "2-digit" })}</td>
        <td>${x.bestSet ? esc(x.bestSet.w + " × " + x.bestSet.r) : "–"}</td>
        <td class="r">${fmtKg(x.best)}</td><td class="r">${Math.round(x.volume)}</td></tr>`).join("") +
      `</tbody></table></div></div>`;
  } else {
    html += `<div class="card empty"><b>No sets yet</b>Log ${esc(ex.name)} in a session and your chart will appear here.</div>`;
  }
  html += muscleHTML() + heatmapHTML();
  view.innerHTML = html;
  bindSeg();
  $("#exPick").addEventListener("change", e => { state.progressEx = e.target.value; renderProgress(); countUp(); });
  view.querySelectorAll("[data-lift]").forEach(b => b.addEventListener("click", () => { state.progressEx = b.dataset.lift; renderProgress(); countUp(); }));
  if (pts.length) drawChart($("#chart"), pts);
}

function renderRecords() {
  setDayColor("d1");
  setHeader("Progress", "Personal records");
  const recs = allRecords();
  const big = ["squat", "bench", "deadlift", "ohp"];
  const recent14 = addDays(todayIso(), -14);
  recs.sort((x, y) => {
    const bx = big.indexOf(x.id), by = big.indexOf(y.id);
    if (bx !== -1 || by !== -1) return (bx === -1 ? 9 : bx) - (by === -1 ? 9 : by);
    return (y.bestE.date).localeCompare(x.bestE.date);
  });
  let html = segHTML();
  if (!recs.length) {
    view.innerHTML = html + `<div class="card empty"><b>No records yet</b>Log weighted sets and your best lifts at 1, 3, 5, 8 and 10 reps will show up here, with every new PR on a timeline.</div>`;
    bindSeg(); return;
  }
  // timeline of the latest PRs
  const events = recs.flatMap(r => r.events).sort((x, y) => y.date.localeCompare(x.date)).slice(0, 8);
  html += `<div class="section-head"><h3>Latest PRs</h3><span>${events.length ? "newest first" : ""}</span></div>`;
  html += events.length ? `<div class="card pr-feed">${events.map(ev => {
    const it = ALL_ITEMS[ev.id];
    return `<div class="pr-ev day-${DAY_COLOR[it.day.id]}">
      <span class="pr-date num">${fmtDate(ev.date, { day: "numeric", month: "short" })}</span>
      <span class="grow"><b>${esc(it.name)}</b><span class="pr-tags">${ev.labels.map(l => `<span class="pr-tag num">${l.label} ${fmtKg(l.w)}<small>+${fmtKg(l.w - l.prev)}</small></span>`).join("")}</span></span>
    </div>`;
  }).join("")}</div>` : `<div class="card small">Beat any of your numbers below and it'll appear here.</div>`;

  html += `<div class="section-head"><h3>All records</h3><span>kg · tap for chart</span></div><div class="rec-list">`;
  html += recs.map(r => {
    const it = ALL_ITEMS[r.id];
    return `<button class="card rec day-${DAY_COLOR[it.day.id]}" data-rec="${r.id}">
      <span class="rec-head"><i class="rec-dot"></i><b>${esc(it.name)}</b><span class="rec-e num"><span data-count="${fmtKg(r.bestE.e)}">${fmtKg(r.bestE.e)}</span><small> e1RM</small></span></span>
      <span class="rec-grid">${PR_REPS.map(b => {
        const x = r.best[b];
        return `<span class="rm ${x && x.date >= recent14 ? "new" : ""}"><small>${b}RM</small><b class="num">${x ? fmtKg(x.w) : "–"}</b><em class="num">${x ? fmtDate(x.date, { day: "numeric", month: "short" }) : ""}</em></span>`;
      }).join("")}</span>
    </button>`;
  }).join("") + `</div>`;
  view.innerHTML = html;
  bindSeg();
  view.querySelectorAll("[data-rec]").forEach(b => b.addEventListener("click", () => {
    haptic();
    navigate(() => { state.progView = "overview"; state.progressEx = b.dataset.rec; window.scrollTo(0, 0); }, "back");
  }));
}

function weekStatsHTML() {
  const mon = mondayOf(todayIso());
  let sessions = 0, vol = 0, mins = 0;
  for (let i = 0; i < 7; i++) {
    const st = dayStats(addDays(mon, i));
    if (st && st.done) { sessions++; vol += st.vol; mins += st.mins; }
  }
  const streak = streakDays();
  return `<div class="card week-stats">
    <span class="eyebrow">This week</span>
    <div class="sum-grid four">
      <div><div class="k">Sessions</div><div class="v num"><span data-count="${sessions}">${sessions}</span><small> / 7</small></div></div>
      <div><div class="k">Volume</div><div class="v num">${vol ? fmtVol(vol) : "–"}<small>${vol && vol < 10000 ? " kg" : ""}</small></div></div>
      <div><div class="k">Time</div><div class="v num">${mins ? `<span data-count="${Math.round(mins / 6) / 10}">${Math.round(mins / 6) / 10}</span>` : "–"}<small>${mins ? " h" : ""}</small></div></div>
      <div><div class="k">Streak</div><div class="v num"><span data-count="${streak}">${streak}</span><small> day${streak === 1 ? "" : "s"}</small></div></div>
    </div>
  </div>`;
}

// Weekly hard sets per muscle vs the 10–20 set range research supports for growth
function muscleHTML() {
  const mon = mondayOf(todayIso());
  const done = doneMuscleSets(mon, addDays(mon, 6)), plan = plannedMuscleSets();
  const max = Math.max(22, ...MUSCLE_ORDER.map(m => Math.max(done[m] || 0, plan[m] || 0))) * 1.05;
  const pct = v => (v / max * 100).toFixed(2) + "%";
  const rows = MUSCLE_ORDER.map((m, i) => {
    const d = Math.round((done[m] || 0) * 2) / 2, pl = Math.round((plan[m] || 0) * 2) / 2;
    return `<div class="mrow">
      <span class="mname">${m}</span>
      <div class="mtrack">
        <i class="band" style="left:${pct(10)};width:${pct(10)}"></i>
        <i class="fill" style="width:${pct(d)};--i:${i}"></i>
        <i class="plan-tick" style="left:${pct(pl)}" title="Planned ${pl}"></i>
      </div>
      <span class="mval num"><b>${d}</b> / ${pl}</span>
    </div>`;
  }).join("");
  return `<div class="section-head"><h3>Sets per muscle</h3><span>this week</span></div>
  <div class="card muscles">
    ${rows}
    <div class="mlegend"><span><i class="lg-fill"></i>Done</span><span><i class="lg-tick"></i>Planned</span><span><i class="lg-band"></i>10–20 sets: growth range</span></div>
  </div>`;
}

// 12-week consistency grid, coloured by session type
function heatmapHTML() {
  const start = addDays(mondayOf(todayIso()), -77);
  let cells = "";
  for (let w = 0; w < 12; w++) for (let i = 0; i < 7; i++) {
    const d = addDays(start, w * 7 + i);
    const future = d > todayIso();
    const st = !future && dayStats(d);
    const lvl = st && st.done ? (st.done >= st.total ? "full" : "part") : "";
    const day = dayFor(d);
    cells += `<i class="hc day-${DAY_COLOR[day.id]} ${lvl} ${future ? "future" : ""} ${d === todayIso() ? "today" : ""}" title="${fmtDate(d)} · ${esc(day.short)}${st && st.done ? ` · ${st.done}/${st.total}` : ""}"></i>`;
  }
  return `<div class="section-head"><h3>Consistency</h3><span>last 12 weeks</span></div>
  <div class="card heat">
    <div class="heat-wrap">
      <div class="heat-days" aria-hidden="true"><span>M</span><span></span><span>W</span><span></span><span>F</span><span></span><span>S</span></div>
      <div class="heat-grid" role="img" aria-label="Training days over the last 12 weeks">${cells}</div>
    </div>
    <div class="mlegend"><span><i class="hc day-red full"></i>Complete</span><span><i class="hc day-red part"></i>Partial</span><span><i class="hc"></i>Rest / missed</span></div>
  </div>`;
}

function niceTicks(min, max, count = 4) {
  if (min === max) { min -= 5; max += 5; }
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw);
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const ticks = []; for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(+v.toFixed(2));
  return ticks;
}
function drawChart(el, pts) {
  const W = Math.max(280, Math.round(el.clientWidth) || 320), H = 220, L = 40, R = 12, T = 14, B = 26;
  const vals = pts.map(p => p.best);
  const ticks = niceTicks(Math.min(...vals), Math.max(...vals));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const t0 = parseIso(pts[0].date).getTime(), t1 = parseIso(pts[pts.length - 1].date).getTime();
  const x = d => pts.length === 1 ? (L + W - R) / 2 : L + (parseIso(d).getTime() - t0) / (t1 - t0) * (W - L - R);
  const y = v => T + (1 - (v - y0) / (y1 - y0 || 1)) * (H - T - B);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.best).toFixed(1)}`).join("");
  const area = pts.length > 1 ? `${line}L${x(pts[pts.length - 1].date).toFixed(1)},${H - B}L${x(pts[0].date).toFixed(1)},${H - B}Z` : "";
  const fmtShort = d => fmtDate(d, { day: "numeric", month: "short" });
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Estimated 1RM over time">
    <g class="grid">${ticks.map(t => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/>`).join("")}</g>
    <g class="axis">${ticks.map(t => `<text x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${t}</text>`).join("")}
      <text x="${x(pts[0].date)}" y="${H - 6}" text-anchor="${pts.length === 1 ? "middle" : "start"}">${fmtShort(pts[0].date)}</text>
      ${pts.length > 1 ? `<text x="${W - R}" y="${H - 6}" text-anchor="end">${fmtShort(pts[pts.length - 1].date)}</text>` : ""}</g>
    ${area ? `<path class="area" d="${area}"/>` : ""}
    <line class="cross" id="cross" y1="${T}" y2="${H - B}" style="display:none"/>
    <path class="line" pathLength="1" d="${line}"/>
    ${pts.map((p, i) => `<circle class="dot ${i === pts.length - 1 ? "last" : ""}" style="--i:${Math.min(i, 20)}" data-i="${i}" cx="${x(p.date)}" cy="${y(p.best)}" r="4"/>`).join("")}
  </svg><div class="tooltip" id="tip" style="display:none"></div>`;
  const svg = $("svg", el), tip = $("#tip", el), cross = $("#cross", el);
  function show(clientX) {
    const r = svg.getBoundingClientRect();
    const sx = (clientX - r.left) / r.width * W;
    let bi = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(x(p.date) - sx); if (d < bd) { bd = d; bi = i; } });
    const p = pts[bi];
    svg.querySelectorAll(".dot").forEach(c => c.classList.toggle("active", +c.dataset.i === bi));
    cross.setAttribute("x1", x(p.date)); cross.setAttribute("x2", x(p.date)); cross.style.display = "";
    tip.style.display = "";
    tip.innerHTML = `${fmtDate(p.date, { day: "numeric", month: "short", year: "numeric" })}<br><b>${fmtKg(p.best)} kg</b> · ${esc(p.bestSet.w)}×${esc(p.bestSet.r)}`;
    const half = tip.offsetWidth / 2, px = x(p.date) / W * r.width;
    tip.style.left = Math.min(Math.max(px, half), r.width - half) + "px";
    tip.style.top = (y(p.best) / H * r.height) + "px";
  }
  function hide() { tip.style.display = "none"; cross.style.display = "none"; svg.querySelectorAll(".dot.active").forEach(c => c.classList.remove("active")); }
  svg.addEventListener("pointermove", e => show(e.clientX));
  svg.addEventListener("pointerdown", e => show(e.clientX));
  svg.addEventListener("pointerleave", hide);
}

// ---------- Guide ----------
function renderGuide() {
  setDayColor("d3");
  setHeader("Guide", "The program");
  const order = programByWeek();
  const cw = blockWeek(todayIso());
  let html = `<div class="guide"><div class="card req-card">
    <h3>Change the program</h3>
    <p>Add, swap or remove exercises, or change sets and reps. Send a request and Claude updates the app for you.</p>
    <button class="btn primary" id="guideRequest">${ICON.edit}Request a change</button>
  </div>`;
  html += `<div class="card"><div class="card-head"><h3>Weekly plan</h3><button class="tool-btn" id="guideSchedule">${ICON.edit}<span>Change days</span></button></div>` + order.map(d =>
    `<div class="plan-row day-${DAY_COLOR[d.id]}"><div class="plate" aria-hidden="true"></div><div><div class="t">${DOW[dowOf(d.id)]} · ${esc(d.short)}</div><div class="s">${esc(d.focus)} · ${esc(d.duration)}</div></div></div>`).join("") + `</div>`;
  html += `<div class="card"><h3>4-week wave</h3>
    <div class="wave" aria-hidden="true">${[70, 80, 92, 45].map((h, i) => `<div class="${i + 1 === cw ? "cur" : ""}" style="height:${h}%">${["RPE 7", "RPE 8", "RPE 9", "Deload"][i]}</div>`).join("")}</div>
    <div class="wave-labels"><span>Week 1</span><span>Week 2</span><span>Week 3</span><span>Week 4</span></div>
    <p style="margin-top:12px">You're in <b style="color:var(--ink)">${esc(WEEK_SCHEME[cw].label)}</b>. ${esc(WEEK_SCHEME[cw].main)}.</p></div>`;
  GUIDE.forEach(g => { html += `<div class="card"><h3>${esc(g.h)}</h3>${g.p.map(p => `<p>${esc(p)}</p>`).join("")}</div>`; });
  html += `<div class="card"><h3>Research sources</h3><ul>` +
    SOURCES.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join("") + `</ul>
    <p class="small" style="margin-top:10px">This is general training guidance, not medical advice. Check anything about your knee with your physio.</p></div>`;
  view.innerHTML = html + `</div>`;
  $("#guideRequest").addEventListener("click", () => openRequest());
  $("#guideSchedule").addEventListener("click", () => openSchedule());
}

// ---------- Settings ----------
function renderSettings() {
  setDayColor("d3");
  setHeader("Settings", "Data & block");
  const nSessions = Object.keys(db.sessions).filter(d => {
    const s = db.sessions[d]; return Object.keys(s.sets || {}).length || Object.keys(s.ticks || {}).length || s.notes;
  }).length;
  view.innerHTML = `
  <div class="card">
    <h3>Training block</h3>
    <div class="field"><label for="startDate">Block started on</label><input type="date" id="startDate" value="${db.startDate}"></div>
    <p class="small" style="margin:0 0 12px">Today is <b>${esc(WEEK_SCHEME[blockWeek(todayIso())].label)}</b>. Weeks cycle 1 → 4 from this date.</p>
    <button class="btn" id="restart">Start a new block this week</button>
  </div>
  <div class="card">
    <h3>Your data</h3>
    <p class="small" style="margin:0 0 12px"><b class="num">${nSessions}</b> sessions saved on this phone, in kg. Nothing is uploaded, so export a backup every week or two.</p>
    <div class="stack">
      <button class="btn primary" id="export">Export backup</button>
      <button class="btn" id="importBtn">Import backup</button>
      <input type="file" id="importFile" accept="application/json,.json" hidden>
      <button class="btn danger" id="wipe">Delete all data</button>
    </div>
  </div>
  <div class="card">
    <h3>Program</h3>
    <p class="small" style="margin:0 0 12px">Want different exercises, sets or a new day layout? Send a request and Claude will update the app.</p>
    <div class="stack">
      <button class="btn" id="setSchedule">${ICON.swap}Change training days</button>
      <button class="btn primary" id="setRequest">${ICON.edit}Request a change</button>
      <button class="btn" id="setReport">${ICON.doc}Export PDF report</button>
    </div>
  </div>
  <div class="card">
    <h3>Appearance</h3>
    <div class="seg three" role="radiogroup" aria-label="Theme" data-active="${db.settings.theme || "auto"}">
      ${["auto", "light", "dark"].map(t => `<button role="radio" data-theme-opt="${t}" aria-checked="${(db.settings.theme || "auto") === t}">${{ auto: "Auto", light: "Light", dark: "Dark" }[t]}</button>`).join("")}
    </div>
    <p class="small" style="margin:10px 0 0">Auto follows your iPhone's setting.</p>
  </div>
  <div class="card">
    <h3>Workout</h3>
    <label class="toggle"><span><b>Finish automatically</b><br><small>Stops the workout clock when every exercise is done</small></span><input type="checkbox" id="optAutoFinish" ${db.settings.autoFinish ? "checked" : ""}><i aria-hidden="true"></i></label>
  </div>
  <div class="card">
    <h3>Rest timer</h3>
    <label class="toggle"><span><b>Start automatically</b><br><small>Counts down after each set using the exercise's rest time</small></span><input type="checkbox" id="optTimer" ${db.settings.restTimer ? "checked" : ""}><i aria-hidden="true"></i></label>
    <label class="toggle"><span><b>Sound when rest is over</b><br><small>Three short beeps. Turn up the volume.</small></span><input type="checkbox" id="optSound" ${db.settings.sound ? "checked" : ""}><i aria-hidden="true"></i></label>
  </div>
  <div class="card">
    <h3>Install on iPhone</h3>
    <p class="small" style="margin:0">In Safari tap <b>Share</b>, then <b>Add to Home Screen</b>. It opens full-screen and works offline in the gym.</p>
  </div>
  <p class="version num">Version ${APP_VERSION}</p>`;
  $("#setRequest").addEventListener("click", () => openRequest());
  $("#setSchedule").addEventListener("click", () => openSchedule());
  $("#setReport").addEventListener("click", () => openReport());
  view.querySelectorAll("[data-theme-opt]").forEach(b => b.addEventListener("click", () => {
    haptic(); setTheme(b.dataset.themeOpt);
    const seg = b.closest(".seg"); seg.dataset.active = b.dataset.themeOpt;
    seg.querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", x === b));
  }));
  $("#optAutoFinish").addEventListener("change", e => { db.settings.autoFinish = e.target.checked; saveNow(); });
  $("#optTimer").addEventListener("change", e => { db.settings.restTimer = e.target.checked; saveNow(); if (!e.target.checked) stopRest(); });
  $("#optSound").addEventListener("change", e => { db.settings.sound = e.target.checked; saveNow(); if (e.target.checked) { unlockAudio(); beep(); } });
  $("#startDate").addEventListener("change", e => { if (e.target.value) { db.startDate = mondayOf(e.target.value); saveNow(); render(); toast("Block start updated"); } });
  $("#restart").addEventListener("click", () => { db.startDate = mondayOf(todayIso()); saveNow(); render(); toast("New block started: Week 1"); });
  $("#export").addEventListener("click", exportData);
  $("#importBtn").addEventListener("click", () => $("#importFile").click());
  $("#importFile").addEventListener("change", importData);
  $("#wipe").addEventListener("click", () => {
    if (confirm("Delete ALL logged sessions on this phone? Export a backup first if you're unsure.")) {
      db = { v: 1, startDate: mondayOf(todayIso()), sessions: {}, settings: db.settings }; saveNow(); render(); toast("All data deleted");
    }
  });
}
async function exportData() {
  saveNow();
  const name = `gym-log-${todayIso()}.json`;
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
  const file = new File([blob], name, { type: "application/json" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Gym Log backup" }); return; } catch (e) { if (e.name === "AbortError") return; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function importData(e) {
  const f = e.target.files[0]; if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result);
      if (!data || typeof data.sessions !== "object") throw new Error("bad file");
      if (!confirm("Replace the data on this phone with this backup?")) return;
      db = { v: 1, startDate: data.startDate || mondayOf(todayIso()), sessions: data.sessions, settings: Object.assign({}, db.settings, data.settings || {}) };
      saveNow(); render(); toast("Backup imported");
    } catch (err) { toast("That file isn't a Gym Log backup"); }
  };
  reader.readAsText(f);
  e.target.value = "";
}

// ---------- Boot ----------
applyTheme();
$("#themeBtn").addEventListener("click", () => {
  const dark = $("#themeBtn").dataset.dark === "1";
  haptic();
  setTheme(dark ? "light" : "dark");
  toast(dark ? "Light mode" : "Dark mode");
});
render();
setInterval(() => { tickTimer(); updateElapsed(); updateClocks(); }, 250);
tickTimer();
// Updates: check whenever the app comes back to the foreground (iPhone home-screen apps resume rather than relaunch),
// and reload into the new version as soon as it takes over, unless you're typing.
if ("serviceWorker" in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let pendingReload = false;
  const tryReload = () => {
    const a = document.activeElement;
    if (pendingReload && !(a && a.matches("input, textarea, select"))) { saveNow(); location.reload(); }
  };
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadController) { pendingReload = true; tryReload(); } });
  document.addEventListener("focusout", () => setTimeout(tryReload, 300));
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then(reg => {
      document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); });
      setInterval(() => reg.update().catch(() => {}), 30 * 60000);
    }).catch(() => {});
  });
}
