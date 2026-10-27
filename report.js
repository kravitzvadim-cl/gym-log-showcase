"use strict";
// Training report PDF for a trainer: summary, main lifts, sessions, every exercise with all sets, PRs, notes.
// jsPDF + autotable are vendored in /vendor and loaded on first use (works offline once cached).

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error("Couldn't load " + src));
    document.head.appendChild(s);
  });
}
async function loadPdfLib() {
  if (!(window.jspdf && window.jspdf.jsPDF)) await loadScript("vendor/jspdf.umd.min.js");
  if (!window.jspdf.jsPDF.API.autoTable) await loadScript("vendor/jspdf.plugin.autotable.min.js");
  return window.jspdf.jsPDF;
}

// Report periods
function reportPeriods() {
  const t = todayIso(), mon = mondayOf(t);
  const d = parseIso(t);
  const monthStart = iso(new Date(d.getFullYear(), d.getMonth(), 1));
  const lastMonthStart = iso(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const lastMonthEnd = iso(new Date(d.getFullYear(), d.getMonth(), 0));
  return {
    week: { label: "This week", from: mon, to: addDays(mon, 6) },
    lastweek: { label: "Last week", from: addDays(mon, -7), to: addDays(mon, -1) },
    month: { label: "This month", from: monthStart, to: iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)) },
    lastmonth: { label: "Last month", from: lastMonthStart, to: lastMonthEnd },
    four: { label: "Last 4 weeks", from: addDays(mon, -21), to: addDays(mon, 6) },
  };
}

const PDF_COLORS = { red: [215, 38, 61], blue: [29, 91, 216], yellow: [196, 152, 0], green: [31, 157, 85], slate: [107, 122, 144] };
const INK = [21, 24, 27], MUTED = [110, 117, 126], LINE = [221, 225, 220], TINT = [243, 245, 242];

async function buildReport(periodKey) {
  const JsPDF = await loadPdfLib();
  const per = reportPeriods()[periodKey];
  const dates = Object.keys(db.sessions).filter(d => d >= per.from && d <= per.to).sort();
  const days = dates.map(d => ({ d, s: db.sessions[d], st: dayStats(d) })).filter(x => x.st && (x.st.done > 0 || x.s.notes));
  const doc = new JsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth(), M = 40;
  const fmtD = (d, o = { weekday: "short", day: "numeric", month: "short" }) => parseIso(d).toLocaleDateString("en-GB", o);
  const range = `${fmtD(per.from, { day: "numeric", month: "short", year: "numeric" })} – ${fmtD(per.to, { day: "numeric", month: "short", year: "numeric" })}`;
  const name = (db.settings.name || "").trim();

  // ---- header band ----
  doc.setFillColor(...INK); doc.rect(0, 0, W, 92, "F");
  doc.setFillColor(...PDF_COLORS.red); doc.circle(W - M - 22, 46, 22, "F");
  doc.setFillColor(...INK); doc.circle(W - M - 22, 46, 6, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(22);
  doc.text("TRAINING REPORT", M, 42);
  doc.setFont("helvetica", "normal"); doc.setFontSize(11);
  doc.text(`${per.label} · ${range}${name ? " · " + name : ""}`, M, 62);
  doc.setFontSize(9); doc.setTextColor(190, 196, 204);
  doc.text("Powerbuilding 4 lift + 3 mobility days · weights in kg · e1RM = estimated 1-rep max (Epley)", M, 78);
  let y = 118;

  const h2 = (txt, color = INK) => {
    if (y > 760) { doc.addPage(); y = 50; }
    doc.setFillColor(...color); doc.rect(M, y - 11, 4, 14, "F");
    doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
    doc.text(txt.toUpperCase(), M + 12, y);
    y += 12;
  };
  const table = (head, body, opts = {}) => {
    doc.autoTable(Object.assign({
      startY: y, head: [head], body, margin: { left: M, right: M },
      styles: { font: "helvetica", fontSize: 9, cellPadding: 5, textColor: INK, lineColor: LINE, lineWidth: .5, overflow: "linebreak" },
      headStyles: { fillColor: TINT, textColor: MUTED, fontStyle: "bold", fontSize: 8 },
      alternateRowStyles: { fillColor: [251, 252, 251] },
    }, opts));
    y = doc.lastAutoTable.finalY + 22;
  };

  if (!days.length) {
    doc.setTextColor(...MUTED); doc.setFontSize(12);
    doc.text("No training logged in this period.", M, y);
    return { doc, per };
  }

  // ---- summary tiles ----
  const tot = days.reduce((a, x) => ({ ms: a.ms + workoutMs(x.s), vol: a.vol + x.st.vol, sets: a.sets + x.st.done, prs: a.prs + x.st.prs.length }), { ms: 0, vol: 0, sets: 0, prs: 0 });
  const lifted = days.filter(x => x.st.day.type === "lift").length, mob = days.length - lifted;
  const tiles = [["Sessions", `${days.length}`, `${lifted} lift · ${mob} mobility`], ["Training time", tot.ms ? `${Math.round(tot.ms / 60000)} min` : "–", "timed workouts"], ["Volume", `${Math.round(tot.vol).toLocaleString("en-GB")} kg`, "weight × reps"], ["Sets done", `${tot.sets}`, "incl. drills ticked"], ["PRs", `${tot.prs}`, "new e1RM bests"]];
  const tw = (W - 2 * M - 4 * 8) / 5;
  tiles.forEach(([k, v, sub], i) => {
    const x = M + i * (tw + 8);
    doc.setFillColor(...TINT); doc.setDrawColor(...LINE); doc.roundedRect(x, y - 4, tw, 58, 6, 6, "FD");
    doc.setTextColor(...MUTED); doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); doc.text(k.toUpperCase(), x + 8, y + 10);
    doc.setTextColor(...INK); doc.setFontSize(15); doc.text(v, x + 8, y + 30);
    doc.setTextColor(...MUTED); doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.text(sub, x + 8, y + 44);
  });
  y += 80;

  // ---- main lifts ----
  h2("Main lifts", PDF_COLORS.red);
  const prevFrom = addDays(per.from, -(Math.round((parseIso(per.to) - parseIso(per.from)) / 864e5) + 1));
  const mainRows = ["squat", "bench", "deadlift", "ohp"].map(id => {
    const h = history(id), inP = h.filter(x => x.date >= per.from && x.date <= per.to), before = h.filter(x => x.date >= prevFrom && x.date < per.from);
    if (!inP.length) return [ALL_ITEMS[id].name, "–", "–", "–", "not trained"];
    const best = inP.reduce((m, x) => (x.best > (m ? m.best : 0) ? x : m), null);
    const prevBest = before.reduce((m, x) => Math.max(m, x.best || 0), 0);
    const heavy = inP.reduce((m, x) => Math.max(m, x.top || 0), 0);
    const delta = prevBest ? `${best.best - prevBest >= 0 ? "+" : ""}${fmtKg(best.best - prevBest)} kg` : "first log";
    return [ALL_ITEMS[id].name, `${fmtKg(best.best)} kg`, delta, `${fmtKg(heavy)} kg`, `${best.bestSet.w}×${best.bestSet.r} (${fmtD(best.date, { day: "numeric", month: "short" })})`];
  });
  table(["Lift", "Best e1RM", "vs previous period", "Heaviest", "Best set"], mainRows, { columnStyles: { 0: { fontStyle: "bold" } } });

  // ---- sessions ----
  h2("Sessions", PDF_COLORS.blue);
  table(["Date", "Session", "Time", "Sets", "Volume", "Notes"], days.map(x => [
    fmtD(x.d), x.st.day.short, workoutMs(x.s) ? fmtClock(workoutMs(x.s)) : "–", `${x.st.done}/${x.st.total}`,
    x.st.vol ? `${Math.round(x.st.vol).toLocaleString("en-GB")}` : "–", x.s.notes || "",
  ]), { columnStyles: { 0: { cellWidth: 70 }, 1: { cellWidth: 70, fontStyle: "bold" }, 2: { cellWidth: 48 }, 3: { cellWidth: 40 }, 4: { cellWidth: 52 } } });

  // ---- every exercise with all sets ----
  h2("Exercises · all sets", PDF_COLORS.green);
  y += 10;
  const ADDED_WEIGHT = new Set(["wpullup", "dips", "chinup"]);   // logged as added weight: e1RM isn't meaningful
  const order = [];
  PROGRAM.forEach(d => d.blocks.forEach(b => b.items.forEach(it => { if (isLogged(it)) { order.push(it.id); (SWAPS[it.id] || []).forEach(a => order.push(a)); } })));
  const seen = new Set();
  order.filter(id => !seen.has(id) && seen.add(id)).forEach(id => {
    const rows = days.map(x => {
      const sets = filledSets((x.s.sets || {})[id]);
      if (!sets.length) return null;
      const it = ALL_ITEMS[id], bw = it.kind === "bw";
      let best = null, vol = 0;
      sets.forEach(s => { const e = e1rm(s.w, s.r); if (e && (!best || e > best.e)) best = { e, s }; if (!bw) vol += (num(s.w) || 0) * (num(s.r) || 0); });
      const replaced = it.alt ? Object.entries(x.s.swaps || {}).find(([, a]) => a === id) : null;
      return [fmtD(x.d) + (replaced ? `\nfor ${ALL_ITEMS[replaced[0]].name}` : ""), sets.map(s => `${s.w || (bw ? "BW" : "?")}×${s.r || "?"}${s.d ? "" : " (skipped)"}`).join("   "), best ? `${best.s.w}×${best.s.r}` : "–", best && !bw && !ADDED_WEIGHT.has(id) ? fmtKg(best.e) : "–", vol && !ADDED_WEIGHT.has(id) ? Math.round(vol).toString() : "–"];
    }).filter(Boolean);
    if (!rows.length) return;
    const it = ALL_ITEMS[id], color = PDF_COLORS[DAY_COLOR[it.day.id]] || INK;
    if (y > 740) { doc.addPage(); y = 50; }
    doc.setFillColor(...color); doc.circle(M + 4, y - 4, 4, "F");
    doc.setTextColor(...INK); doc.setFont("helvetica", "bold"); doc.setFontSize(10.5);
    doc.text(it.name, M + 14, y);
    const nameW = doc.getTextWidth(it.name);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(...MUTED);
    doc.text(it.alt ? "swap exercise (used in place of a planned one)" : `plan ${it.sets} × ${it.reps}${it.rest && it.rest !== "—" ? " · rest " + it.rest : ""}${ADDED_WEIGHT.has(id) ? " · kg = added weight" : ""}`, M + 14 + nameW + 10, y);
    y += 7;
    table(["Date", "Sets (kg × reps)", "Best set", "e1RM", "Volume"], rows, { columnStyles: { 0: { cellWidth: 70 }, 2: { cellWidth: 56 }, 3: { cellWidth: 44 }, 4: { cellWidth: 48 } }, styles: { font: "helvetica", fontSize: 8.5, cellPadding: 4, textColor: INK, lineColor: LINE, lineWidth: .5 } });
    y -= 6;
  });
  y += 8;

  // ---- PRs ----
  const prs = days.flatMap(x => x.st.prs.map(p => [fmtD(x.d), p.name, `${fmtKg(p.e)} kg`]));
  if (prs.length) { h2("Personal records", PDF_COLORS.yellow); table(["Date", "Exercise", "New best e1RM"], prs); }

  // ---- weekly sets per muscle ----
  const weeks = Math.max(1, Math.round((parseIso(per.to) - parseIso(per.from)) / (7 * 864e5)));
  const done = doneMuscleSets(per.from, per.to), plan = plannedMuscleSets();
  h2("Hard sets per muscle", PDF_COLORS.slate);
  table(["Muscle", "Done in period", "Per week (avg)", "Planned per week", "Growth range"], MUSCLE_ORDER.map(m => {
    const d = Math.round((done[m] || 0) * 2) / 2, pw = Math.round((done[m] || 0) / weeks * 2) / 2;
    return [m, `${d}`, `${pw}`, `${Math.round((plan[m] || 0) * 2) / 2}`, "10–20 / week"];
  }));

  // ---- program context ----
  h2("Program context", PDF_COLORS.slate);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...INK);
  const ctx = [
    `Block started ${fmtD(db.startDate, { day: "numeric", month: "short", year: "numeric" })}. Main lifts run a 4-week wave: W1 RPE 7, W2 RPE 8, W3 RPE 9, W4 deload; top set then back-offs at -10% (-8% in W3).`,
    "Accessories use double progression. Lifter has a healed meniscus tear; program includes knee-strengthening work (Spanish squats, step-downs, reverse Nordics, TKEs, tibialis raises, Copenhagen planks).",
    Object.keys(db.settings.swaps || {}).length ? `Default swaps: ${Object.entries(db.settings.swaps).map(([o, a]) => `${ALL_ITEMS[o].name} → ${ALL_ITEMS[a].name}`).join(", ")}.` : "",
  ].filter(Boolean);
  ctx.forEach(t => { const lines = doc.splitTextToSize(t, W - 2 * M); if (y + lines.length * 12 > 800) { doc.addPage(); y = 50; } doc.text(lines, M, y); y += lines.length * 12 + 6; });

  // ---- footer on every page ----
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text(`Gym Log · ${per.label} · generated ${fmtD(todayIso(), { day: "numeric", month: "short", year: "numeric" })}`, M, 822);
    doc.text(`${i} / ${pages}`, W - M, 822, { align: "right" });
  }
  return { doc, per };
}

async function exportReport(periodKey) {
  const { doc, per } = await buildReport(periodKey);
  const fname = `gym-report-${per.from}-to-${per.to}.pdf`;
  const blob = doc.output("blob");
  const file = new File([blob], fname, { type: "application/pdf" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: "Training report" }); return "shared"; }
    catch (e) { if (e.name === "AbortError") return "cancelled"; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = fname;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "downloaded";
}

// ---------- Change requests back to Claude ----------
const REPO_ISSUES = "https://github.com/kravitzvadim-cl/gym-log-showcase/issues/new";
function buildRequestText(kind, dayId, exId, text) {
  const day = PROGRAM.find(d => d.id === dayId);
  const lines = [];
  lines.push(`Gym Log change request (app ${APP_VERSION}, ${todayIso()})`);
  lines.push(`Type: ${kind}`);
  if (day) lines.push(`Day: ${DOW[dowOf(day.id)]} · ${day.name}`);
  if (exId) lines.push(`Exercise: ${ALL_ITEMS[exId].name} (id: ${exId})`);
  lines.push("", "What I want:", text.trim() || "(no description)");
  if (day) {
    lines.push("", `Current ${day.short}:`);
    day.blocks.forEach(b => lines.push(`- ${b.title}: ` + b.items.map(it => isLogged(it) ? `${it.name} ${it.sets}×${it.reps}${it.rest && it.rest !== "—" ? " (rest " + it.rest + ")" : ""}` : `${it.name} ${it.rx || ""}`.trim()).join("; ")));
    const recent = Object.keys(db.sessions).filter(d => dayFor(d).id === dayId && dayStats(d) && dayStats(d).done).sort().slice(-2);
    recent.forEach(d => {
      const s = db.sessions[d];
      const sets = Object.entries(s.sets || {}).map(([id, arr]) => `${(ALL_ITEMS[id] || {}).name || id} ${filledSets(arr).map(x => `${x.w || "BW"}×${x.r || "?"}`).join(" ")}`).filter(x => /\d/.test(x));
      lines.push(`- Logged ${d}: ${sets.join("; ") || "no sets"}${s.notes ? ` | notes: ${s.notes}` : ""}`);
    });
  }
  const sw = Object.entries(db.settings.swaps || {});
  if (sw.length) lines.push("", "Default swaps: " + sw.map(([o, a]) => `${ALL_ITEMS[o].name} → ${ALL_ITEMS[a].name}`).join(", "));
  const sch = schedule();
  if (db.settings.schedule) lines.push("", "My schedule: " + WEEK_ORDER.map(w => `${DOW[w]} ${PROGRAM.find(d => d.id === sch[w]).short}`).join(", "));
  lines.push("", "Please update the program in the Gym-app repo and deploy.");
  return lines.join("\n");
}
