# The Structural Trap: build plan (draft for Mia's approval)

No code has been written yet. This is the proposed plan, tech choice, file structure, and the open concept questions.

## 1. The experience, minute by minute (target: about 7 minutes)

| Phase | Time | What the player lives through | Essay idea |
|---|---|---|---|
| Drift in | 0:00–0:40 | Darkness, fog, a low drone. Particles drift past. One line of text fades in and out (placeholder, a few words). The cursor is a soft light. | Setting the mood |
| The first light | 0:40–1:30 | One observation arrives alone, randomized each run (e.g. cold blue steady glow vs. warm red pulse). Catching it creates the first node: heavier, brighter, slower to move. | Anchoring |
| Gathering | 1:30–4:30 | Observations drift in more often. The player catches some and lets others pass. Each catch is placed on an existing node or in empty space (new node). Threads form; heavy nodes pull the web toward them. The confirmation filter starts quiet and grows with the web. | Web of belief, supporting chorus, confirmation bias |
| Friction | woven into Gathering | Catching a contradicting observation makes the web strain (threads hum, tension sound). The player must resolve it: adjust a small node (cheap) or revise a heavy one (collapse). | Revision has a cost |
| Pressure | 4:30–6:00 | The world floods with contradicting evidence. A sealed web renders most of it as near-invisible fast ghosts. | Self-sealing |
| Reveal | 6:00–7:30 | Fog lifts. Your web with the anchor highlighted; every missed contradiction drawn where it passed; the "other web"; a few stats; your closing line. Option to replay with the fog lifted. | Awareness and humility |

## 2. Proposed hidden world model (needs your OK, see question 1)

Every observation has **two visible features** and **one outcome**:

- **Hue**: warm (red/amber) or cold (blue/teal). This is the loud, salient feature.
- **Rhythm**: steady glow or pulsing. This is the quiet feature.
- **Outcome**: what happens when you catch it. It *resonates* (a consonant tone, it brightens) or it *fractures* (a dissonant tone, it scatters a little).

**The hidden truth** (data-driven in `config.js`): the outcome depends on **rhythm**, not hue. For example, pulsing lights fracture 85% of the time, steady lights resonate 85% of the time, and hue is noise.

**The anchor** is always chosen so that hue *looks* like the explanation. Example: the first light is cold, steady, and resonates, so the natural first belief is "cold lights resonate." Half of all players get the warm version instead.

**Beliefs** are nodes that group observations ("these belong together, they behave the same"). The web therefore makes a prediction for any new observation: which node would it join, and what outcome does that node expect? An observation is **consistent** if the web predicts its outcome correctly and **contradicting** if not. This gives a precise definition the confirmation filter, the stats, and the log can all use.

**An open player** who revises toward rhythm ends with a web that predicts well (low drift). **An anchored player** keeps a hue-based web that is coherent but wrong about 50% of the time, while the filter hides most of the evidence of that.

**Drift from truth** = the share of all observations (seen or not) the final web would predict wrongly. Simple to explain in the reveal and in the write-up.

## 3. Interaction (no form UI)

- The cursor is a small light. Observations drift toward you; **press and hold** on one to catch it (it slows and orbits your light). Ignore it and it drifts past and out.
- **Drag** a caught observation onto a node to attach it (a thread forms) or release it in empty space to start a new node.
- **Revision**: when a contradiction is caught, the web strains and two places glow: the small node it could become an exception to (cheap) and the heavy node it actually contradicts (costly). Drag it to one. The costly choice snaps threads, dims dependent nodes, and lets part of the web fall into the fog.
- Touch works the same way (bonus for mobile).

## 4. Tech options

| Option | Visuals | Sound | Build | Verdict |
|---|---|---|---|---|
| **A (recommended)** | Three.js with bloom post-processing, instanced particles, layered fog sprites | Tone.js (synths, reverb, filters, easy drones) | No build step: plain ES modules + import map loading pinned versions from a CDN | Fastest to iterate, deploys anywhere as static files, and I can publish each stage as a private preview link you just click |
| B | Same as A | Same as A | Vite bundler | Slightly faster load and offline-capable, but you'd need Node to run it locally |
| C | Plain Canvas 2D + hand-made glow | Raw Web Audio API | None | Fewer dependencies, but bloom, depth fog and smooth particles at this quality are much more work and slower |

Performance plan for laptops: instanced particles (one draw call), half-resolution bloom, a quality setting in `config.js`, and a cap on visible nodes.

## 5. File structure

All code lives in `/mnt/project-files/belief-web` for now (a static site). It can move to a GitHub repo whenever you like.

```
belief-web/
  index.html              the game
  results.html            the study summary page (averages, simple charts)
  README.md               how to run, deploy, tune; essay-to-code map for your write-up
  PLAN.md                 this file
  src/
    config.js             EVERY tunable value: bias strength, weights, timing, colors, hidden rules, phases
    main.js               boots the scene, audio, and game loop
    core/
      state.js            single game state object (web, observations, phase, log)
      loop.js             frame loop and timing
    world/
      atmosphere.js       darkness, fog layers, particles, camera drift        (mood)
      worldModel.js       the hidden truth: rules that generate observations   (the world as it is)
      observations.js     spawning, drifting, appearance of observations       (experience)
    web/
      nodes.js            belief nodes: creation, glow, physics               (web of belief)
      threads.js          luminous connections, strain                        (supporting chorus)
      weight.js           weight from connections, pull, inertia              (supporting chorus)
      anchor.js           first-node bonus weight and faster growth            (anchoring)
      predict.js          what the web expects; consistent vs. contradicting
    bias/
      confirmationFilter.js  fades, blurs, muffles, speeds up contradictions  (confirmation bias)
    revision/
      revision.js         peripheral vs. core choice and its cost             (revision has a cost)
      collapse.js         thread snapping and cascade animation
    director/
      phases.js           pacing, phase changes, late-game flood           (self-sealing)
    ending/
      reveal.js           fog lift, missed observations, highlights
      otherWeb.js         simulated web from the opposite anchor
      stats.js            revisions, misses, drift from truth
    audio/
      audio.js            drone, node tones, tension, collapse sounds
    input/
      interaction.js      catch, drag, attach, release (mouse and touch)
    log/
      logger.js           records every event as JSON in localStorage
      export.js           hidden key / URL flag to download all runs
  results/
    summary.js            reads an exported JSON and draws the charts
```

Each system file opens with a short comment naming the essay idea it represents.

## 6. Stages and check-ins

Each stage ends with a preview link, how to run it locally, what to look at, and a question about feel.

1. **Atmosphere**: dark space, fog, particles, drone, camera drift. A sound-on gesture to start (browsers require a click before audio).
2. **Observations and nodes**: drifting lights, catch, attach, new node, threads.
3. **Weight and the anchor**: supporting chorus, pull, anchor bonus.
4. **Confirmation filter**: subtle fade that scales with the web, plus a hidden debug toggle so you can see it working.
5. **Revision**: the cheap vs. costly choice and the collapse.
6. **Hidden world model and late-game pressure.** (The basic rules exist from stage 2 so observations have features; this stage tunes the truth, prediction, and the flood.)
7. **Ending and reveal**, including the "other web" and fog-lifted replay.
8. **Logging, export, and results page.**

Debug tools throughout: `?debug` in the URL shows hidden features, consistency, and the filter strength, and allows skipping phases.

## 7. Decisions so far (2026-10-20)

- Other web: simulate a player with the opposite anchor (Mia: a).
- Study: players use Mia's laptop for now (localStorage + export). Logger is written so a remote "send results" step can be added later (Mia: a, may need b).
- Opening: one poetic line plus a wordless catch hint (Mia: a).
- Open: which abstract "meaning" model to use (section 2 is one option); how to split "saw but let pass" from "never noticed" (proposal: cursor proximity).
- Goal the player feels: "gather the lights that last." Every kept light is a small belief; web is layered (edge lights, middle patterns, core rules), ~25-40 nodes.
- Beliefs shown without words: a node looks like what it believes (general = simpler/purer); nodes reach threads toward lights they expect.
- Placement is automatic (light joins the node that reached for it). A light that burns out after catching dims the web slightly, so catching is a bet (Mia: both recs, 08:09).
- Features: color, pulse, size (drift dropped). Natural brightness variation so the filter never gives itself away.
- Proposed (awaiting OK): hidden truth is noisy/partial (pulse ~75% predictive), framed as "less wrong" not "right". Three separate visual languages: a light's fate (world), node brightness (web weight), clarity of incoming lights (filter).

## 8. Refocus: "Collapse" (2026-10-21, supersedes the web/color/pulse design above)

Mia found the multi-idea version confusing and chose one idea: **the cost of revising a core belief**.

- **Incentive:** your structure is your light. The world starts nearly black with thin sound. Caught lights settle onto a glowing structure that grows up from the ground. More structure = fog clears, you see farther, music gets fuller.
- **Growth:** each light rests on one already in the structure; the first light caught is the base. Everything rests on it directly or indirectly.
- **Dilemma:** partway through, some lights crack (flicker), and the flicker slowly dims everything resting on them. Leave it (keep height, light grows murky, music sours) or pull it out (clear light returns, everything resting on it falls). Edge = cheap, base = most of the structure. Late game the base itself cracks.
- **Point:** players patch around a cracked base rather than rebuild. Ending shows how much of your light stood on a cracked foundation.
- Dropped: color/pulse/size rules, the visible web of patterns, the confirmation-filter mechanic.
- New stage plan: A) grow your light (catch, carry, place, light opens the world) · B) cracks, spreading dimness, pull-out and collapse · C) late-game base crack and pacing · D) ending/reveal · E) logging, export, results page.
- Status (2026-10-21): A approved. The forest now has an open path with glowing plants that wake only within your light's reach, and a pale glow at the end of the path. B built: cracks start once the structure holds 6 lights (every 16 to 26 s, weighted toward lights holding others up, at most 2 at once). Murk spreads up from a cracked light. Press and hold on a structure light to pull it, with what would fall trembling first. The base cracks once at 13 lights or 4 minutes (an early version of C). Next: pacing (C), then the ending (D).
- Status (2026-10-21, later): C built in src/core/arc.js. Phases: gathering, then cracking (at 6 lights), then base (the base cracks at 13 lights or 4 min: the structure shudders, a deep crack sounds, new lights come 3x more rarely, and dimness creeps slower), then ended. The run ends when the cracked base is pulled ('pulled_base') or when the structure stays >80% soured for 12 s, or 150 s after the base crack ('went_dark'). For now the end fades to dark with a placeholder line; the reveal is D. Mia confirmed this ending rule.
- Status (2026-10-21, later): D built in src/ui/reveal.js. When a run ends, the world fades and every light placed in the last structure returns as a ghost. Lights that fell come back as rings. The cracked base pulses, then a wave climbs every thread, turning each light bruised magenta. Then come lines (count, all rested on the base, an ending-specific line, and a placeholder for Mia's closing line), a full record of the run (Mia chose full stats), and "touch to begin again", which reloads. All wording is in CONFIG.text.reveal and CONFIG.text.stats as placeholders. Next: E (logging, export, results page).
- Status (2026-10-21, later): E built. Every run is saved in localStorage (src/study/store.js) as raw events plus a summary row (src/study/summary.js). Saves happen at the start, every 10 s, at the end, on answering the question, and on leaving. The participant comes from ?p=NAME or is numbered P01, P02 and so on. Ctrl/Cmd+Shift+E silently downloads every run as JSON plus a CSV summary. results.html shows cards for endings, cracks let go vs lived with, hesitation, time held on after the base cracked, and answers, plus a full table, with export and import to merge laptops. Also added: murky lights wake fewer mushrooms (structure.murkCost); hesitation logging (pull_started with sinceCrack, crack_kept); one question after the reveal (CONFIG.text.question). Line options were drafted for Mia to pick.
