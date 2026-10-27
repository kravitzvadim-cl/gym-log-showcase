# Gym Log

A mobile-first training app and log for an experienced lifter:
**Strength-first combined plan: 4 lifting days, about 190 min/week of easy low-impact cardio placed away from the leg days, and mobility/flexibility every week**, with abs and knee-strengthening work built in.
Lifting sessions run about 60–70 min: one heavy main lift, 3–4 accessories (mostly supersets) and one abs exercise.

| Day | Session |
|-----|---------|
| Mon | Lower A, heavy: back squat + deadlift top sets, split squats, leg ext/curl, abs (no cardio) |
| Tue | Upper A, heavy: bench, weighted pull-ups, press/row, delts, arms, abs + 35–45 min easy cardio |
| Wed | Easy cardio 40–50 min + Mobility A: hips, knees, ankles, core |
| Thu | Lower B, power + volume: box jumps, speed squats, RDL, hack squat, glutes/hams, abs (no cardio) |
| Fri | Upper B, volume: paused bench, overhead press, rows, pulldown, delts, arms, abs + 35–45 min easy cardio |
| Sat | Easy cardio 30–45 min (optional intervals later) + Mobility B: thoracic/shoulders, loaded stretching, abs |
| Sun | Walk + Mobility C: full-body stretching flow, knee stability, breathing |

Main lifts run a 4-week wave (RPE 7 → 8 → 9 → deload). Accessories use double progression.

## Features
- Log kg × reps per set, tap ✓ to complete (an empty row fills with last session's numbers)
- Last session's numbers shown on every exercise, plus a 🏆 badge for an e1RM PR
- Smart targets for main lifts: top set from your last log and this week's RPE, back-off weights, warm-up ramp and plates per side
- Rest timer that starts when you tick a set (sound at zero, keeps the screen awake)
- Session summary (time, sets, volume, PRs, change vs last time); weekly stats, sets per muscle vs the 10–20 range, 12-week consistency grid
- Exercise swaps: 2–3 alternatives per lift (with how-to), for one session or from now on; each keeps its own history
- Personal records: 1/3/5/8/10-rep maxes and best e1RM per exercise, plus a timeline of new PRs
- Workout clock you control: Start / Pause / Finish (finishes automatically when every exercise is done)
- Log tab: each day's time, sets, volume, PRs, every set logged, drills, time per exercise and notes
- Light / Dark / Auto theme (header button or Settings)
- PDF training report for your trainer (this/last week, this/last month, last 4 weeks): summary, main lifts, sessions, every exercise with all sets, PRs, notes, sets per muscle
- Request a change: describe a program change in the app; it's packaged with your plan and recent logs to paste into Claude Code or file as a GitHub issue
- Move a workout to another day this week (logged sets move with it), or rearrange the weekly schedule (Settings, Log or Guide)
- Progress tab: estimated-1RM chart, best/heaviest sets, history table
- "How to" sheet for every exercise: what it is, benefits, muscles worked, numbered steps, tips, common mistakes, knee notes and a link to form videos (`howto.js`, `details.js`)
- Days colour-coded with competition plate colours; finished exercises collapse to a one-line summary
- Guide tab: programming principles, knee notes, nutrition, research sources
- Installable PWA (Safari → Share → Add to Home Screen), works offline
- Data stays on the device (localStorage) with JSON export/import backup

## Develop
No build step. It's plain HTML/CSS/JS:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

To try it on your iPhone on the same Wi-Fi, open `http://<your-computer-ip>:8000`.
Edit `program.js` to change exercises, sets or reps, and `howto.js` for the technique guides.

## Third-party
`vendor/` contains jsPDF 2.5.2 and jspdf-autotable 3.8.4 (MIT, licences included), loaded only when a report is created.

## Deploy
Static site. Deploys on Vercel with zero config (`vercel.json` only sets headers).
