# The Structural Trap (interactive prototype)

An abstract, atmospheric browser game based on Mia's essay "The Structural Trap: Why False Beliefs Resist Revision." The player isn't told the argument; the game quietly applies anchoring and confirmation bias to them, then reveals how their web of belief sealed itself.

See `PLAN.md` for the design and decisions.

## Run it locally

It is a static site with no build step. Browsers block ES modules from `file://`, so serve the folder:

```
cd belief-web
python3 -m http.server 8000
```

Then open http://localhost:8000. Add `?debug` to the URL to show the frame rate; with it, press **E** to jump straight to the ending.

Controls: click (or tap) to begin, move the pointer to lean, press and hold on a light to catch it, keep holding to carry it, release near your structure to rest it there. Press and hold on a light already in your structure to pull it out (everything resting on it trembles first, then falls). Press **M** to mute.

## Running the study

- Each player's run is saved automatically in this browser on this computer. Add `?p=NAME` to the URL to label a player; otherwise players are numbered P01, P02 and so on.
- **Ctrl+Shift+E** (Cmd+Shift+E on a Mac), at any point in the game, downloads every saved run as JSON (all events) plus a CSV (one row per run).
- Open `results.html` (for example http://localhost:8000/results.html) to see summary cards and a table of every run. You can also export from there, or import another laptop's JSON to combine them.
- Runs live in the browser's storage, so export after each session before clearing browser data.

### Collecting runs from players elsewhere

1. Make a new Google Sheet. Open **Extensions > Apps Script**, delete what's there, and paste in `tools/collect.gs`. Save.
2. Click **Deploy > New deployment**, choose the type **Web app**, set **Execute as: Me** and **Who has access: Anyone**, then click **Deploy**. Allow the permissions it asks for.
3. Copy the web app URL (it ends in `/exec`) into `endpoint` in the `study` section of `src/config.js`.

Each player then adds one row to the sheet's `runs` tab when they finish, and again after they answer the question. Players who leave early are sent too. Online players get codes like `W-k3x9q`. The start screen tells them their play is recorded anonymously; that wording is `CONFIG.study.notice`.

## Tune it

Every tunable value is in `src/config.js`: fog density, particle counts, colors, camera drift, bloom, sound levels, and the text fragments.

## Deploy

Upload the whole folder to any static host (GitHub Pages, Netlify, Vercel). Libraries are vendored in `vendor/`, so nothing depends on a CDN except the font.

`tools/make-preview.py` writes `preview.html`, the copy used for Claude artifact previews.

## Essay-to-code map (grows each stage)

| Essay idea | Where it lives |
|---|---|
| The world before belief (undifferentiated experience) | `src/world/atmosphere.js` |
| The player as a point of attention in that world | `src/input/presence.js`, `src/world/drift.js` |
| The forest your light reveals (moonlit pines, a still pool) | `src/world/forest.js` |
| A sparkle trail behind the player's light | `src/input/trail.js` |
| Sound as part of perception | `src/audio/audio.js` |
| Accepting an experience and fitting it onto what you already believe | `src/input/catch.js` |
| Observations: experiences drifting out of the dark | `src/world/observations.js` |
| The structure: every belief rests on the ones beneath it (and links to its neighbors, forming a web); the first is the base | `src/structure/structure.js` |
| Why we build: our beliefs are our light (the forest appears, fog clears, music fills) | `CONFIG.light`, `CONFIG.forest`, `src/world/forest.js`, `src/world/atmosphere.js`, `src/audio/audio.js` |
| A path to discover: plants along it wake only where your light reaches | `CONFIG.forest` (path*, plant*, wakeReach), `src/world/forest.js` |
| New evidence: a light cracks, favoring lights that hold others up; late on, the base itself | `CONFIG.cracks`, `src/structure/cracks.js` |
| A false belief's murk spreads into everything resting on it, and the music goes bad (`CONFIG.audio.rot`) | `CONFIG.structure` (murk*), `structure.update` in `src/structure/structure.js` |
| The cost of revision: pulling a light drops everything that rests on it | `structure.pull` / `wouldFall`, pulling in `src/input/catch.js`, `collapse` in `src/audio/audio.js` |
| The arc of a run: build, cracks, the base cracks, the end (pull the base, or hold on until the dark) | `CONFIG.arc`, `src/core/arc.js` |
| The reveal: every light you placed returns, and a wave from the cracked base shows they all rested on it; then the run's full record | `CONFIG.reveal`, `CONFIG.text.reveal`, `CONFIG.text.stats`, `src/ui/reveal.js` |
| What players choose: hesitation, cracks kept or let go, the end question | `src/input/catch.js` (pull_started), `src/core/arc.js` (crack_kept), `CONFIG.text.question` |
| Saving, export and results across players | `src/study/store.js`, `src/study/summary.js`, `results.html` |
| Run log for the study | `src/core/log.js` |
