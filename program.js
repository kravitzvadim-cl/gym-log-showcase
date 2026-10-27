// Training program: strength-first combined plan. 4 lifting days (heavy lower day, power/volume lower day,
// upper strength, upper volume) + easy aerobic work placed after upper days and on its own days,
// with mobility, flexibility and knee work kept every week.
// Main lifts use a 4-week wave (RPE 7 → 8 → 9 → deload). Accessories use double progression.
// kind: "main" (top set + back-offs, logged), "lift" (logged kg × reps), "bw" (reps/time, optional kg), "mob" (checklist)

const WEEK_SCHEME = {
  1: { label: "Week 1 · Build", main: "Top set @ RPE 7, back-offs at −10%", acc: "Leave 2–3 reps in reserve (RIR 2–3)" },
  2: { label: "Week 2 · Push", main: "Top set @ RPE 8, back-offs at −10%", acc: "RIR 1–2" },
  3: { label: "Week 3 · Peak", main: "Top set @ RPE 9 (reps at low end), back-offs at −8%", acc: "RIR 0–1 on the last set" },
  4: { label: "Week 4 · Deload", main: "No top set. 3×5 @ ~65% (RPE 5–6), crisp technique", acc: "Half the sets, RIR 3+. Mobility as normal" },
};

const PROGRAM = [
  {
    id: "d1", dow: 1, short: "Lower A", name: "Lower A — Heavy Squat + Deadlift", type: "lift", duration: "75–85 min",
    focus: "Heaviest lower day: squat and deadlift top sets, quads, knee resilience. No cardio today",
    blocks: [
      { title: "Warm-up (6–8 min)", items: [
        { id: "wu_bike", name: "Bike", kind: "mob", rx: "3 min easy" },
        { id: "spanish_iso", name: "Spanish squat hold + band TKE", kind: "mob", rx: "2×30s hold, 2×15 TKE / leg", cue: "Heavy band behind both knees anchored to a rack, sit back with vertical shins to ~90°. Then terminal knee extensions to wake up the VMO. Primes the knee with low joint stress." },
      ]},
      { title: "Strength", items: [
        { id: "squat", name: "Back Squat", kind: "main", sets: 4, reps: "4–6 top, 5 back-offs", rest: "3 min",
          cue: "The heaviest squat of the week. Ramp up in 3–4 warm-up sets (bar ×8, 50% ×5, 70% ×3, 85% ×1). Brace 360°, knees track over toes, controlled descent. One top set, then 3 back-off sets." },
        { id: "deadlift", name: "Conventional Deadlift", kind: "main", sets: 3, reps: "3–5 top, 4 back-offs", rest: "3 min",
          cue: "Heavy hinge, done fresh after squats. Bar over mid-foot, pull the slack out, wedge in, push the floor away. Reset every rep. One top set, then 2 back-off sets." },
      ]},
      { title: "Hypertrophy", items: [
        { id: "bss", name: "Bulgarian Split Squat (DB)", kind: "lift", sets: 3, reps: "8–10 / leg", rest: "90s", cue: "Log the weight per dumbbell. Let the front knee travel forward. Controlled, full range builds knee tolerance." },
        { id: "leg_ext", name: "Leg Extension", kind: "lift", ss: "A", sets: 3, reps: "12–15", rest: "—", cue: "Superset with seated leg curl. 3s lowering, 1s squeeze at the top. Great for VMO and patellar tendon health." },
        { id: "seated_curl", name: "Seated Leg Curl", kind: "lift", ss: "A", sets: 3, reps: "10–12", rest: "90s after pair", cue: "Seated beats lying for hamstring growth (trained at a longer length). Lean forward." },
      ]},
      { title: "Abs", items: [
        { id: "cable_crunch", name: "Kneeling Cable Crunch", kind: "lift", sets: 3, reps: "10–12", rest: "60s", cue: "Flex the spine (ribs to pelvis), don't hinge from the hips." },
      ]},
    ],
  },
  {
    id: "d2", dow: 2, short: "Upper A", name: "Upper A — Heavy Bench + Back", type: "lift", duration: "60 min + 35–45 min cardio",
    focus: "Upper-body strength: heavy bench, weighted pull-ups, then easy cardio",
    blocks: [
      { title: "Warm-up (5 min)", items: [
        { id: "pullaparts", name: "Band pull-aparts + external rotations", kind: "mob", rx: "2×15 each" },
      ]},
      { title: "Strength", items: [
        { id: "bench", name: "Bench Press", kind: "main", sets: 4, reps: "3–5 top, 5 back-offs", rest: "3 min",
          cue: "Ramp up in 3–4 sets. Shoulder blades back and down, leg drive, touch the lower chest, brief pause. One top set, then 3 back-off sets." },
        { id: "wpullup", name: "Weighted Pull-up", kind: "lift", sets: 3, reps: "5–8", rest: "2 min", cue: "Log the added weight only. Full dead hang to chest-to-bar." },
      ]},
      { title: "Hypertrophy", items: [
        { id: "incline_db", name: "Incline DB Press (30°)", kind: "lift", ss: "A", sets: 3, reps: "8–10", rest: "—", cue: "Superset with the chest-supported row. Weight per dumbbell. Deep stretch at the bottom." },
        { id: "cs_row", name: "Chest-Supported Row", kind: "lift", ss: "A", sets: 3, reps: "8–12", rest: "90s after pair", cue: "Full protraction at the bottom, drive the elbows back." },
        { id: "lat_raise", name: "Seated DB Lateral Raise", kind: "lift", sets: 3, reps: "12–20", rest: "60s", cue: "Lead with the elbows, slight forward lean. Make the last set a drop set." },
        { id: "ez_curl", name: "EZ-Bar Curl", kind: "lift", ss: "B", sets: 3, reps: "8–12", rest: "—" },
        { id: "oh_tri", name: "Overhead Cable Triceps Extension", kind: "lift", ss: "B", sets: 3, reps: "10–15", rest: "60s after pair", cue: "The long-head stretch overhead drives growth." },
      ]},
      { title: "Abs", items: [
        { id: "ab_wheel", name: "Ab Wheel Rollout", kind: "bw", sets: 3, reps: "8–12", rest: "60s", cue: "Posterior pelvic tilt and ribs down. Only roll as far as you can without the lower back arching." },
      ]},
      { title: "Easy cardio (after lifting, 35–45 min)", items: [
        { id: "cardio_tue", name: "Easy cardio: bike / incline walk / elliptical", kind: "mob", rx: "35–45 min, conversational pace", cue: "Bike, incline walk, elliptical or rower. Conversational pace: you can speak in full sentences. Do it after lifting, never before." },
      ]},
    ],
  },
  {
    id: "d3", dow: 3, short: "Cardio + Mobility A", name: "Cardio + Mobility A — Aerobic Base, Hips, Knees, Ankles", type: "mobility", duration: "40–50 min cardio + 40 min mobility",
    focus: "Aerobic base day (easy, not a test), then lower-body mobility, knee work and core",
    blocks: [
      { title: "Easy cardio (40–50 min)", items: [
        { id: "cardio_wed", name: "Easy cardio or a long brisk walk", kind: "mob", rx: "40–50 min, conversational pace", cue: "This is an aerobic-base day, not a test. Keep the effort sustainable; bike or incline walk keeps the knees happy." },
      ]},
      { title: "Hip mobility (loaded where possible)", items: [
        { id: "m_9090", name: "90/90 hip switches", kind: "mob", rx: "2×8 / side", cue: "Tall spine. Progress by switching without your hands." },
        { id: "m_couch", name: "Couch stretch", kind: "mob", rx: "2×60s / side", cue: "Squeeze the glute of the down leg. Opens the hip flexors and quads." },
        { id: "m_goblet_hold", name: "Deep goblet squat hold", kind: "bw", sets: 3, reps: "45s", cue: "Use a kettlebell or dumbbell as a counterweight. Pry the knees out with the elbows." },
        { id: "m_cossack", name: "Cossack squat", kind: "bw", sets: 2, reps: "8 / side", cue: "Light load. Adductor and hip range, knee control." },
      ]},
      { title: "Knee resilience", items: [
        { id: "m_stepup", name: "Poliquin / slant-board step-down", kind: "bw", sets: 3, reps: "15 / leg", cue: "Heel elevated, slow lowering, knee travels over the toes. Builds VMO and patellar tendon strength." },
        { id: "m_rev_nordic", name: "Reverse Nordic", kind: "bw", sets: 3, reps: "6–8", cue: "From kneeling, lean back with a straight line from knees to head. Eccentric quad strength. Use a band for help." },
        { id: "m_backwalk", name: "Backward treadmill walk (incline)", kind: "bw", sets: 1, reps: "5 min", cue: "Slow treadmill: 2–3 km/h at a 6–10% incline, holding the side rails, facing backward. Low-impact quad work that builds the knees without soreness." },
        { id: "m_ankle", name: "Knee-to-wall ankle dorsiflexion", kind: "mob", rx: "2×10 / side", cue: "Better ankle mobility means less stress on the knee in squats." },
      ]},
      { title: "Posterior chain", items: [
        { id: "m_pancake", name: "Seated pancake / straddle reach", kind: "mob", rx: "2×60s" },
        { id: "m_jefferson", name: "Jefferson curl (light)", kind: "bw", sets: 2, reps: "8", cue: "Only 5–10 kg, very slow, one vertebra at a time. Skip it if your back is irritated." },
      ]},
      { title: "Abs", items: [
        { id: "dead_bug", name: "Dead bug", kind: "bw", sets: 3, reps: "10 / side" },
        { id: "side_plank", name: "Side plank", kind: "bw", sets: 3, reps: "30–45s / side" },
        { id: "copenhagen", name: "Copenhagen plank", kind: "bw", sets: 2, reps: "20s / side", cue: "Adductor strength gives inner-knee stability. Short lever (knee on bench) to start." },
      ]},
    ],
  },
  {
    id: "d4", dow: 4, short: "Lower B", name: "Lower B — Power + Volume", type: "lift", duration: "70–80 min",
    focus: "Lower power and volume: jumps, speed squats, second hinge, glutes and hamstrings. No cardio today",
    blocks: [
      { title: "Warm-up (6 min)", items: [
        { id: "wu_bike2", name: "Bike / rower", kind: "mob", rx: "3 min" },
        { id: "glute_bridge", name: "Glute bridge + band abduction", kind: "mob", rx: "1×15 each" },
      ]},
      { title: "Power (fresh, low fatigue)", items: [
        { id: "box_jump", name: "Box Jump (step down)", kind: "bw", sets: 3, reps: "3", rest: "60s", cue: "A small power dose before the main work. Jump up onto a mid-height box, land softly, step down. Stop the moment height or landing quality drops. Skip it on any day the knee isn't 100%." },
      ]},
      { title: "Strength (speed + volume)", items: [
        { id: "speed_squat", name: "Speed Squat (back squat)", kind: "lift", sets: 6, reps: "2 @ 65–70%", rest: "60–90s", cue: "Second squat exposure of the week, light and fast. Controlled descent, then drive up as fast as possible. End the set if the bar slows. Quality and intent, not fatigue." },
        { id: "rdl", name: "Romanian Deadlift", kind: "lift", sets: 3, reps: "6–8", rest: "2 min", cue: "Second hinge exposure. Hips back, soft knees, bar against thighs. Stop when the hamstrings are fully stretched." },
      ]},
      { title: "Hypertrophy", items: [
        { id: "hack_squat", name: "Hack Squat (or Front Squat)", kind: "lift", sets: 3, reps: "8–12", rest: "2 min", cue: "Controlled 3s descent. Use a full pain-free depth; the machine lets the quads work hard with a stable knee." },
        { id: "hip_thrust", name: "Barbell Hip Thrust", kind: "lift", ss: "A", sets: 3, reps: "8–10", rest: "—", cue: "Superset with Nordics. Chin tucked, ribs down, 1s squeeze at lockout." },
        { id: "nordic", name: "Nordic Ham Curl (or Lying Leg Curl)", kind: "bw", ss: "A", sets: 3, reps: "5–8", rest: "90s after pair", cue: "Slow eccentric. Strong hamstrings protect the knee." },
        { id: "calf_seat", name: "Seated Calf Raise", kind: "lift", ss: "B", sets: 3, reps: "12–15", rest: "—", cue: "Pause 2s in the stretch." },
        { id: "spanish_squat", name: "Spanish Squat (banded)", kind: "bw", ss: "B", sets: 3, reps: "15", rest: "60s after pair", cue: "Quad pump work at low joint stress." },
      ]},
      { title: "Abs", items: [
        { id: "suitcase", name: "Suitcase Carry", kind: "lift", sets: 3, reps: "30 m / side", rest: "60s", cue: "Heavy dumbbell in one hand, stay perfectly upright. Obliques and anti-lateral flexion." },
      ]},
    ],
  },
  {
    id: "d5", dow: 5, short: "Upper B", name: "Upper B — Bench Volume + Overhead Press", type: "lift", duration: "65 min + 35–45 min cardio",
    focus: "Upper-body volume: paused bench, overhead press, back, delts, arms, then easy cardio",
    blocks: [
      { title: "Warm-up (5 min)", items: [
        { id: "band_disl", name: "Band dislocates + face pulls", kind: "mob", rx: "2×15 each" },
      ]},
      { title: "Strength", items: [
        { id: "paused_bench", name: "Paused Bench Press", kind: "lift", sets: 4, reps: "5–6", rest: "2–3 min", cue: "Second bench exposure: volume and bench-specific practice. 1-second dead pause on the chest every rep, about 75–80 percent of your top-set weight, RPE 7–8." },
        { id: "ohp", name: "Standing Overhead Press", kind: "main", sets: 4, reps: "4–6 top, 6 back-offs", rest: "3 min",
          cue: "Glutes tight, bar path close to the face, head through at lockout. One top set, then 3 back-off sets." },
        { id: "bb_row", name: "Barbell Row (Pendlay)", kind: "lift", sets: 3, reps: "6–8", rest: "2 min", cue: "Torso near parallel, explode the bar to the lower chest." },
      ]},
      { title: "Hypertrophy", items: [
        { id: "pulldown", name: "Neutral-Grip Lat Pulldown", kind: "lift", sets: 3, reps: "10–12", rest: "90s", cue: "Full stretch at the top, elbows to the hips." },
        { id: "lat_raise_b", name: "Cable Lateral Raise", kind: "lift", ss: "B", sets: 3, reps: "12–15", rest: "—" },
        { id: "rear_delt", name: "Reverse Pec Deck", kind: "lift", ss: "B", sets: 3, reps: "15–20", rest: "60s after pair" },
        { id: "inc_curl", name: "Incline DB Curl", kind: "lift", ss: "C", sets: 3, reps: "10–12", rest: "—", cue: "Long-length biceps stretch." },
        { id: "pushdown", name: "Rope Triceps Pushdown", kind: "lift", ss: "C", sets: 3, reps: "12–15", rest: "60s after pair" },
      ]},
      { title: "Abs", items: [
        { id: "hlr", name: "Hanging Leg Raise", kind: "bw", sets: 3, reps: "10–15", rest: "60s", cue: "Curl the pelvis up at the top. No swinging." },
      ]},
      { title: "Easy cardio (after lifting, 35–45 min)", items: [
        { id: "cardio_fri", name: "Easy cardio: bike / incline walk / elliptical", kind: "mob", rx: "35–45 min, conversational pace", cue: "Bike, incline walk, elliptical or rower. Conversational pace: you can speak in full sentences. Do it after lifting, never before." },
      ]},
    ],
  },
  {
    id: "d6", dow: 6, short: "Cardio + Mobility B", name: "Cardio + Mobility B — Aerobic, Upper-Body Mobility + Abs", type: "mobility", duration: "30–45 min cardio + 35 min mobility",
    focus: "Easy aerobic work, thoracic spine and shoulder mobility, loaded stretching, core",
    blocks: [
      { title: "Conditioning (30–45 min)", items: [
        { id: "zone2", name: "Easy cardio (incline walk / bike)", kind: "mob", rx: "30–45 min, conversational pace", cue: "Low-impact for the knees; builds the aerobic base that helps recovery between sets and sessions." },
        { id: "intervals", name: "Optional: intervals instead (6 × 1 min hard / 2 min easy)", kind: "mob", rx: "Every 7–10 days, only after 3–4 good weeks", cue: "Hard but controlled, on a bike or rower, not sprints or running. Only if Monday's squats and deadlifts, your sleep and your joints all feel normal; otherwise keep it easy." },
      ]},
      { title: "Thoracic & shoulders", items: [
        { id: "m_openbook", name: "Open book rotations", kind: "mob", rx: "2×10 / side" },
        { id: "m_tspine", name: "Foam roller T-spine extension", kind: "mob", rx: "2×10" },
        { id: "m_hang", name: "Dead hang", kind: "bw", sets: 3, reps: "30–60s", cue: "Decompresses the spine and opens the shoulders. Builds grip too." },
        { id: "m_wallslide", name: "Wall slides", kind: "mob", rx: "2×12" },
        { id: "m_sleeper", name: "Cross-body / sleeper stretch", kind: "mob", rx: "2×45s / side" },
      ]},
      { title: "Loaded stretching", items: [
        { id: "m_pullover", name: "DB Pullover (lat stretch)", kind: "lift", sets: 3, reps: "10–12", rest: "60s", cue: "Pause 2s in the stretch. Lats and thoracic extension." },
        { id: "m_deficit_pu", name: "Deficit push-up (deep stretch)", kind: "bw", sets: 2, reps: "12–15", cue: "Hands on plates, sink the chest below the hands." },
      ]},
      { title: "Abs", items: [
        { id: "hkr", name: "Hanging knee raise / L-sit", kind: "bw", sets: 3, reps: "max", rest: "60s" },
        { id: "rev_crunch", name: "Reverse crunch", kind: "bw", sets: 3, reps: "15", rest: "45s" },
        { id: "plank_reach", name: "Plank with reach", kind: "bw", sets: 3, reps: "30s", rest: "45s" },
      ]},
    ],
  },
  {
    id: "d7", dow: 0, short: "Mobility C", name: "Mobility C — Rest, Walk + Full-Body Flow", type: "mobility", duration: "45–60 min, all easy",
    focus: "Recovery, full-body flexibility, knee stability, breathing",
    blocks: [
      { title: "Easy movement", items: [
        { id: "walk", name: "Outdoor walk", kind: "bw", sets: 1, reps: "20–30 min" },
      ]},
      { title: "Flow (2 rounds)", items: [
        { id: "m_wgs", name: "World's greatest stretch", kind: "mob", rx: "5 / side" },
        { id: "m_pigeon", name: "Pigeon stretch", kind: "mob", rx: "60s / side" },
        { id: "m_frog", name: "Frog stretch", kind: "mob", rx: "60s" },
        { id: "m_catcow", name: "Cat-cow", kind: "mob", rx: "10" },
        { id: "m_child", name: "Child's pose lat stretch", kind: "mob", rx: "45s / side" },
        { id: "m_pike", name: "Seated pike (hamstrings)", kind: "mob", rx: "60s" },
      ]},
      { title: "Knee stability", items: [
        { id: "m_tke2", name: "Band TKE", kind: "mob", rx: "2×20 / leg" },
        { id: "m_balance", name: "Single-leg balance (on pad, eyes closed for progression)", kind: "mob", rx: "3×30s / leg", cue: "Proprioception training is a cornerstone of meniscus rehab." },
        { id: "m_tib2", name: "Tibialis raise", kind: "mob", rx: "2×20" },
      ]},
      { title: "Core & breathing", items: [
        { id: "bird_dog", name: "Bird dog", kind: "bw", sets: 2, reps: "10 / side" },
        { id: "m_9090breath", name: "90/90 breathing (feet on wall)", kind: "mob", rx: "3×5 breaths", cue: "Full exhale, ribs down. Resets posture and lowers stress." },
      ]},
    ],
  },
];

const GUIDE = [
  { h: "How the week works", p: [
    "Strength first, with easy cardio added around it. Mon Lower A (heavy) · Tue Upper A + easy cardio · Wed easy cardio + Mobility A · Thu Lower B (power + volume) · Fri Upper B + easy cardio · Sat easy cardio + Mobility B · Sun walk + Mobility C.",
    "Each lift trains twice a week, once heavy and once for volume or speed: squat heavy on Monday and fast on Thursday, deadlift on Monday and RDL on Thursday, bench heavy on Tuesday and paused on Friday.",
    "There's no cardio on the two leg days, and the hardest cardio sits after upper-body work, so you arrive at the leg sessions with fresh legs.",
    "Lifting volume stays about the same as before: roughly 10–14 hard sets per muscle per week, inside the 10–20 range research supports for growth.",
  ]},
  { h: "Cardio without losing strength", p: [
    "Adding cardio doesn't meaningfully reduce maximal strength or muscle growth. It can slightly blunt explosive power, mostly when cardio and lifting share the same session. So the plan protects the leg days and keeps cardio easy and low-impact.",
    "Lift first, cardio after, and only after upper-body days. Bike, incline walk, elliptical or rower beat running while your legs are the limiting resource.",
    "Easy means conversational. That's about 190 minutes a week in total, above the 150-minute health guideline. Most of it should feel repeatable.",
    "Intervals are optional and come later: one short session every 7–10 days, only after 3–4 stable weeks, for example 6 × 1 min hard / 2 min easy on a bike.",
    "If performance, sleep, motivation and leg freshness are all worse for about two weeks: drop the intervals first, then trim cardio time, and only then reduce lifting. If things are stable, add cardio slowly, 10–15 minutes to one session at a time.",
  ]},
  { h: "Powerbuilding: main lifts", p: [
    "Squat, bench, deadlift and overhead press use one heavy top set followed by back-off sets. The top set is your heaviest set of the day. Back-off sets are the lighter sets after it (about 10% lighter, 8% in Week 3).",
    "The app calculates your targets: it estimates your max from your last top set, then suggests today's top set, the back-off weight, warm-up sets and the plates for each side of the bar.",
    "4-week wave: W1 RPE 7 → W2 RPE 8 → W3 RPE 9 → W4 deload. After the deload, add 2.5 kg (upper) or 2.5–5 kg (lower) to the top-set target if Week 3 felt ≤ RPE 9.",
    "Power work (box jumps, speed squats) is about speed and intent. End a set as soon as the bar or your jump slows down.",
  ]},
  { h: "Accessories: double progression", p: [
    "Work inside the rep range (e.g. 8–12). When every set hits the top of the range with good form, add the smallest jump in weight next time.",
    "Accessories go close to failure (0–2 RIR). Prioritize long-muscle-length training: deep stretches under load (RDL, incline curl, overhead triceps, seated leg curl).",
  ]},
  { h: "Your knee (healed meniscus)", p: [
    "The program builds the knee from every angle: quads (leg extension, Spanish squat, step-downs, reverse Nordic, backward treadmill walking), hamstrings (Nordics, curls), adductors (Copenhagen), shins (tibialis raise) and balance work.",
    "Box jumps are kept small and you always step down. Skip them on any day the knee isn't 100%. Low-impact cardio (bike, incline walk) protects the knee.",
    "Pain up to 3/10 that settles within 24h is usually acceptable. Stop and see a physio if you notice sharp pain, locking or catching, giving way, or swelling.",
  ]},
  { h: "Mobility & flexibility", p: [
    "Mobility stays in every week: hips, knees and ankles on Wednesday, thoracic spine and shoulders on Saturday, and a full-body stretching flow on Sunday.",
    "On those days do the cardio first, then the mobility while you're warm. Hold static stretches 30–60s, 2 rounds, and breathe slowly.",
    "Strength training through a full range of motion also improves flexibility, which is why the lifts use deep ranges and loaded stretches.",
  ]},
  { h: "Recovery & nutrition", p: [
    "Adding cardio raises your energy needs. Eat enough to stay in a small surplus (about 200–300 kcal) so the strength block doesn't turn into a deficit. Carbs around leg days and intervals help performance.",
    "Protein: 1.6–2.2 g per kg of bodyweight per day, spread over 3–5 meals. Sleep 7–9 hours. Creatine monohydrate at 3–5 g/day is the best-supported supplement.",
    "Get medical advice before hard intervals or max testing if you have chest pain on exertion, fainting, unusual breathlessness, uncontrolled blood pressure or a heart condition.",
  ]},
  { h: "Using the log", p: [
    "Enter kg and reps per set and tap ✓ when a set is done. Grey numbers show what you did last time, so beat them.",
    "For dumbbell lifts, log the weight of one dumbbell. For weighted pull-ups, log only the added weight. Cardio and mobility are ticked off; use the timer pill to time them.",
    "Your data lives on this phone. Use Settings → Export backup regularly.",
  ]},
];

const SOURCES = [
  ["Schoenfeld et al. — training frequency meta-analysis (2× per week)", "https://www.strongerbyscience.com/frequency-muscle/"],
  ["Training volume & hypertrophy — weekly sets", "https://pmc.ncbi.nlm.nih.gov/articles/PMC6724585"],
  ["Strength training vs stretching for range of motion (meta-analysis)", "https://estudogeral.uc.pt/handle/10316/104612"],
  ["Spanish squat — quad loading with lower joint stress", "https://www.mendcolorado.com/physical-therapy-blog/2025/9/29/the-power-of-the-spanish-squat-for-knee-pain/"],
  ["Reverse Nordic exercise technique", "https://pure.cardiffmet.ac.uk/en/publications/the-reverse-nordic/"],
  ["Meniscus rehab principles", "https://www.hingehealth.com/gb/en/resources/articles/meniscus-tear-exercises/"],
  ["Concurrent aerobic + strength training meta-analysis (2022)", "https://pubmed.ncbi.nlm.nih.gov/34757594/"],
  ["Concurrent training by sex and training status (2024)", "https://pmc.ncbi.nlm.nih.gov/articles/PMC10933151/"],
  ["Order of strength and endurance work (meta-analysis)", "https://pubmed.ncbi.nlm.nih.gov/28783467/"],
  ["Periodization and 1RM strength (meta-analysis)", "https://pubmed.ncbi.nlm.nih.gov/35044672/"],
  ["CDC adult activity guidelines", "https://www.cdc.gov/physical-activity-basics/guidelines/adults.html"],
  ["Cardiorespiratory fitness and health outcomes (2024)", "https://pmc.ncbi.nlm.nih.gov/articles/PMC11103301/"],
];
