// ─────────────────────────────────────────────────────────────────────────────
// CONFIG: every tunable value in the game lives here.
//
// Change numbers here to adjust the feel without touching the systems.
// Colors are hex numbers (0xRRGGBB). Times are in seconds unless noted.
// Later stages add their own sections (observations, web, bias, revision,
// world model, phases, ending, logging) to this same file.
// ─────────────────────────────────────────────────────────────────────────────

export const CONFIG = {
  // ── Rendering and performance ──────────────────────────────────────────────
  render: {
    maxPixelRatio: 2,       // cap for sharp screens; lower = faster
    bloomStrength: 0.7,     // how much bright things bleed light
    bloomRadius: 0.25,      // how far the bleed spreads (lower = crisper)
    bloomThreshold: 0.35,   // brightness at which things start to glow (higher = only the brightest)
    bloomResolution: 0.75,  // bloom computed at this fraction of screen size
    exposure: 1.0,
  },

  // ── The void ───────────────────────────────────────────────────────────────
  space: {
    background: 0x03040a,   // the darkness itself (very deep blue-black)
    fogColor: 0x05070f,     // distance fog color (things far away melt into it)
    fogDensity: 0.02,       // higher = the world closes in
  },

  // ── The forest (the world your light reveals) ─────────────────────────────
  // Faceted low-poly pines around a still pool, lit by cold moonlight.
  // Your structure's warm light, and the moonlight, grow as the structure grows.
  forest: {
    floorHeight: -7,        // where the water lies
    waterColor: 0x4a5866,   // the pool's tint (below 0x808080 = darker water)
    reflectionQuality: 0.5, // reflection resolution as a fraction of the screen's real pixels (lower = faster)
    reflectionBlur: 0.006,  // how soft the reflection is (0 = sharp mirror)
    trunkColor: 0x7d9cb8,   // bark (reads blue in moonlight, amber near your light)
    leafColor: 0x1d4652,    // needles
    trees: 240,
    area: [90, 110],        // width and depth of the forest
    clearing: 12,           // radius of the open space around your base
    pathWidth: 4,           // half-width of the open path winding away from the clearing
    pathWind: 7,            // how much the path curves left and right
    moundColor: 0x1d2e2b,   // the mossy mounds mushrooms grow on
    stoneColor: 0x8a929a,   // flat stepping stones along the path
    plantColors: [0x12e0b8, 0x3f63ff, 0x9a3dff], // glowing mushrooms: saturated, so their light stays colored
    plantSize: 1.3,
    plantSleepColor: 0x141c24, // a mushroom's cap while asleep
    wakeTime: 1.2,          // seconds for one mushroom to fully light up (about as quick as a placed light)
    plantGlow: 2.2,         // how bright a lit cap glows (above 1 blooms)
    plantHalo: 1.6,         // size of the colored glow around each cap
    wakeLag: 10,            // mushrooms wake roughly nearest first, shuffled over this much distance so they light one by one
    wakeFirst: 3,           // mushrooms lit by your first light...
    wakeEach: 2,            // ...plus this many for each light after it...
    wakeGrowth: 0.15,       // ...a few more with every light, so a big structure lights much of the forest
    spillSize: 7,           // the colored glow a ring of mushrooms spills on the water
    spillStrength: 0.8,
    plantLights: 6,         // real colored lights given to the brightest rings (they tint the trees)
    plantLightStrength: 30,
    plantLightReach: 12,
    plantSpacing: 3.2,      // distance between mushroom rings along the path
    extraPlants: 22,        // mushroom rings scattered elsewhere on the forest floor
    swarms: 7,              // swarms of fireflies over the path
    fireflyColor: 0xf4ffb0,
    blossomColor: 0xbfd6ff, // the great tree at the end of the path
    greatTreeAt: 0.8,       // how full your light must be before the great tree blooms
    beyondColor: 0x9fc6ff,  // the pale glow at the far end of the path
    trunkRadius: [0.3, 0.7],
    treeHeight: [14, 26],
    moonlight: 0x7ab8ff,    // cold key light
    moonStrength: [1.5, 3.2],   // [in the dark, fully lit]
    skyColor: 0x25425e,     // faint blue fill from above
    skyStrength: 0.7,
    lightColor: 0xffa648,   // the warm light your structure casts
    lightStrength: [10, 240],   // [one light, full structure]
    lightReach: [10, 70],   // how far it reaches [one light, full structure]
  },

  // ── Drifting dust (the ambient particles you move through) ────────────────
  dust: {
    count: 3200,
    volume: [70, 36, 90],   // width, height, depth of the field around the camera
    size: 0.28,             // base particle size (small and crisp: sparkles, not blobs)
    color: 0xc4e2ff,        // icy pale blue
    opacity: 1.0,
    drift: 0.12,            // how much each mote wanders on its own
    fall: 0.12,             // a slow settle toward the floor (gravity); 0 = weightless
    twinkle: 0.9,           // 0 = steady, 1 = strong shimmer
  },

  // ── Fog banks (large soft clouds that slowly roll past) ───────────────────
  fogBanks: {
    count: 30,
    size: [22, 46],         // min/max size of each bank
    opacity: 0.06,          // per bank; they stack, so keep this low
    color: 0x4f7aa0,
    roll: 0.02,             // slow spin of each bank (radians per second)
    drift: 0.25,            // sideways wander speed
    flow: 0.5,              // how fast the fog rolls toward you
    lowerTo: -3,            // banks gather a little toward the floor (center height)
    spread: 12,             // how far above/below that height they wander
  },

  // ── Far lights (a few distant points glimpsed through the fog) ────────────
  farLights: {
    count: 0,               // off in the forest (they looked like catchable lights)
    distance: [45, 80],
    size: [4, 8],
    colors: [0xc8d6ff, 0xaab8e0, 0xb7c3ea], // kept pale and neutral so they never look like observations
    breathe: 0.15,          // how slowly they brighten and dim
  },

  // ── Camera drift (slow, dreamlike movement through the void) ──────────────
  camera: {
    fov: 60,
    height: 0,              // eye height (the floor sits at ground.height)
    pitch: -0.14,           // looks down a little, toward the ground where your light will stand
    forwardSpeed: 0,        // units per second gliding forward (0: you stay with your structure)
    swayAmount: 0.7,        // how far it floats side to side and up/down
    swaySpeed: 0.05,
    rollAmount: 0.015,      // gentle tilt (radians)
    pointerParallax: 1.0,   // how much the view leans toward the cursor
    pointerEase: 0.025,     // how lazily it follows (lower = heavier)
  },

  // ── The player's presence (the soft light under the cursor) ──────────────
  presence: {
    color: 0xdfe8ff,
    size: 1.0,
    distance: 12,           // how far in front of the camera it floats
    ease: 0.12,             // how smoothly it follows the pointer
    breathe: 0.35,          // slow pulse of the presence light
    trail: 3,               // sparkles shed per frame while moving (0 = no trail)
    trailLife: 1.4,         // seconds each sparkle lives
  },

  // ── Observations (the lights that drift toward you) ───────────────────────
  observations: {
    colors: [0xdfe9ff, 0xeef3ff, 0xd2e2ff], // cool white while free; they turn amber once they are part of your structure
    size: [0.8, 1.2],       // random size range
    firstDelay: 9,          // seconds after starting before the first light appears
    firstSpeed: 0.45,       // the first light comes slowly (it is alone)
    firstDistance: 24,      // ...and appears much closer than the rest, so you can't miss it
    gap: [2.4, 4.2],        // seconds between later lights (random range)
    maxAlive: 5,            // never more than this many drifting at once
    spawnDistance: 45,      // how far ahead they appear
    speed: [1.4, 2.2],      // how fast they drift toward you
    spreadX: 10,            // how far left/right of center they travel
    spreadY: [-4, 4.5],     // how low/high they travel
  },

  // ── Catching and carrying ─────────────────────────────────────────────────
  catching: {
    reach: 0.075,           // how close (fraction of screen) your light must be to touch one
    holdTime: 0.6,          // seconds of holding to catch
    carryEase: 0.18,        // how closely a carried light follows your pointer
    lostFloat: 1.2,         // a light let go away from the structure floats up and fades
    hintPlacements: 4,      // for the first few lights, the structure shows where to bring them
  },

  // ── The structure (your light: everything rests on what came before) ──────
  // Essay link: beliefs are held up by the beliefs beneath them. The first light
  // becomes the base, and every later light rests on one already there.
  structure: {
    base: [0, -6.2, -13],   // where the first light settles, just above the water ahead of you
    reach: 3.0,             // how close to a light you must bring a new one to rest it there
    below: 0.8,             // a light may rest at most this far BELOW the one holding it
    nodeSize: 1.0,
    baseSize: 1.5,
    color: 0xffa83c,        // every light in your structure glows this amber
    stemColor: 0xffb45a,
    stemOpacity: 0.9,
    spacing: 1.5,           // lights in the structure never sit closer than this, so each stays distinct
    beadGap: 0.32,          // spacing of the glowing beads along each stem
    linkReach: 3.2,         // a new light also links to other lights this close, knitting the structure into a web
    maxLinks: 4,            // most lights a new light can rest on (its main one plus side links)
    linkStrength: 0.6,      // side links glow a little fainter than the main thread
    fallsWhen: 'all',       // pulling a light drops what rests on it when: 'all' its supports are gone, 'any' is gone, or 'first' (links only look)
    sway: 0.06,             // gentle breathing movement of the whole structure
    murkColor: 0x3d2b4d,    // the dark, bruised color a cracked light's murk turns things
    crackMurk: 0.85,        // how murky a cracked light gets (0 = clear, 1 = dark)
    murkSpread: 0.18,       // how fast murk creeps up into what rests on a cracked light
    murkCost: 1.15,         // how much a murky light stops counting toward waking mushrooms (1 = in proportion to its murk)
    sourFrom: 0.25,         // murk below this is too faint to see, so the music ignores it
    fallGravity: 6,
    crackColor: 0xc8358c,   // a cracked light turns this bruised magenta (and flickers)
    crackedBrightness: 1.0,
    fractureOpacity: 0.95,  // the dark fracture lines over a cracked light
    smokeColor: 0x2b2036,   // the dark smoke that rises from a cracked light
    smokeOpacity: 0.55,
    smokeEvery: 0.35,       // seconds between puffs
  },

  // ── Cracks (when lights turn out to be unsound) ───────────────────────────
  cracks: {
    startAfter: 4,          // no cracks until the structure holds this many lights
    every: [12, 20],        // seconds between new cracks (random range)
    maxActive: 3,           // at most this many cracked lights at once
    minAge: 6,              // a light must have stood this long before it can crack
    cracksBeforeBase: 4,    // the base never cracks before the player has met this many smaller cracks
    baseAfterLights: 13,    // late game: the base cracks once the structure reaches this size...
    baseAfterTime: 240,     // ...or this many seconds after the base was planted, whichever is first
    pullTime: 1.3,          // seconds of holding on a light in the structure to pull it out
  },

  // ── The arc of a run (see src/core/arc.js) ─────────────────────────────
  // gathering → cracking (at cracks.startAfter lights) → base (the base cracks,
  // at cracks.baseAfterLights or cracks.baseAfterTime) → ended
  arc: {
    lateGapScale: 3,        // once the base cracks, new lights come this many times more rarely
    baseSpread: 0.35,       // ...and dimness creeps this much slower, so it builds as dread
    shudder: 1.6,           // seconds the whole structure trembles when the base cracks
    endAfterFall: 4,        // seconds after pulling the cracked base before the run ends (let the fall be heard)
    darkAt: 0.8,            // holding on: the run ends once the structure is this soured...
    darkHold: 12,           // ...for this many seconds
    maxAfterBase: 150,      // ...or this long after the base cracked, whichever comes first
  },

  // ── The reveal at the end (see src/ui/reveal.js) ────────────────────────
  reveal: {
    after: 4,               // seconds into the fade before the ghosts appear
    ghostsIn: 2.5,            // seconds for every light you placed to reappear
    basePause: 1,         // the cracked base glows alone this long
    waveStep: 0.45,         // seconds for the wave to climb one thread
    linesAfter: 1.5,        // seconds after the wave before the first line
    lineGap: 2.6,           // seconds between lines
    statGap: 0.7,           // seconds between rows of the full record
    againAfter: 2,          // then "touch to begin again"
  },

  // ── The study (see src/study/) ──────────────────────────────────────────
  study: {
    version: 'collapse-0.7',  // saved with each run, so runs from different builds can be told apart
    saveEvery: 10,            // seconds between saves while playing (an unfinished run is still kept)
    endpoint: 'https://script.google.com/macros/s/AKfycbzkH7Ny8qHyUO7r1mjSrPMmvM3eYfSKcnP55dpzYk9kPt-KbHdmR3g5mAcDqebqkpPeYA/exec',             // Google Apps Script web app URL that collects runs from anywhere (see tools/collect.gs); empty = this computer only
    notice: 'your play is recorded anonymously for a study.', // shown under "touch the dark" when runs are sent away
  },

  // ── How your light changes the world ──────────────────────────────────────
  // 0 lights = nearly black, thick fog, thin sound. `fullAt` lights = clear and full.
  light: {
    fullAt: 16,
    fogDensity: [0.045, 0.011],     // [in the dark, fully lit]: how far you can see
    fogBankOpacity: [0.45, 1.0],    // multiplier on the fog banks (mist is only visible once there is light)
    background: [0x02060b, 0x061522], // night sky / deep fog color
    farLights: [0.25, 1.2],         // how visible the distant glows are
  },

  // ── Sound (dreamy, airy, always shifting) ──────────────────────────────────
  audio: {
    masterVolume: -4,       // decibels
    fadeIn: 6,              // seconds for the world to swell in after starting
    // Pad: soft chords that slowly drift from one to the next (D major / Lydian).
    pad: {
      chords: [
        ['D3', 'A3', 'C#4', 'E4', 'F#4'],   // Dmaj9
        ['B2', 'F#3', 'A3', 'D4', 'E4'],    // Bm11
        ['G2', 'D3', 'F#3', 'B3', 'C#4'],   // Gmaj7#11 (the dreamy, floating one)
        ['A2', 'E3', 'B3', 'C#4', 'E4'],    // Asus2/add6
      ],
      every: 18,            // seconds between chords (each fades in and out, leaving gaps)
      voices: 3,            // how many notes of each chord sound (fewer = more subtle)
      volume: -29,
      brightness: 1100,     // Hz; higher = airier pad
    },
    // Sub: a very soft low root underneath for warmth (not a drone).
    sub: { volume: -36 },
    // Sprinkles: little bell-like notes, alone or in small runs, scattered in space.
    sprinkles: {
      notes: ['D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'E6', 'F#6', 'A6'],
      volume: -21,
      everyMin: 0.5,        // seconds between sprinkles (random range)
      everyMax: 2.2,
      runChance: 0.5,      // chance a sprinkle becomes a little run of 2 to 5 notes
      echo: 0.35,           // ping-pong echo amount (more = more space)
    },
    // Touch: moving the pointer scatters sprinkles. Higher on screen = higher notes,
    // left/right = where you hear it, faster movement = brighter and more notes.
    touch: {
      volume: -19,
      distance: 0.09,       // how far the pointer travels (in screen widths) per note
      minGap: 0.07,         // seconds; never faster than this
    },
    // Events: the sounds of catching, placing and losing a light.
    events: {
      volume: -14,
      placeNotes: ['D4', 'F#4', 'A4', 'C#5', 'E5'], // a light settling into the structure: a warm open tone
      threadNote: ['A5', 'D6', 'E6'],               // the caught chime
      lostVolume: -22,                              // a light let go into the dark: a soft falling breath
      crackVolume: -14,                             // a light cracking: a dull crunch, then a long hiss
      crackHiss: 2.2,                               // seconds the hiss lasts
      pullVolume: -26,                              // the breath of air that rises while you pull a light
    },
    // Fullness: how your light changes the music. [in the dark, fully lit]
    fullness: {
      padBoost: [-14, 0],     // extra decibels on the pad
      voices: [1, 4],         // notes per chord
      sprinkleRate: [0.3, 1.3], // how often sprinkles happen (multiplier)
    },
    // Rot: how the music goes bad as murk spreads through the structure (all at 0 while it is sound)
    rot: {
      sprinkleWarble: 0.45,   // sprinkles wobble out of tune, like a warped tape
      padWarble: 0.18,        // the chords wobble too, more gently
      warbleRate: 4.5,        // how fast they wobble
      grit: 0.5,              // how grainy the sound gets
      gritWet: 0.45,
      darkTo: 1400,           // Hz: the sound grows muffled and dull
      wrongNotes: 0.5,        // chance (at fully soured) that a note lands a semitone off
    },
    // Air: a faint high shimmer of noise, like breath.
    air: {
      volume: -40,
      bandBase: 2500,
      bandSweep: 3500,
      rate: 0.05,
    },
    reverb: { decay: 12, wet: 0.6 },
  },

  // ── Text fragments (sparse, a few words, placeholders for Mia's writing) ──
  text: {
    begin: 'touch the dark',
    opening: 'gather what light you can.', // placeholder for Mia's line
    openingDelay: 4,        // seconds after starting before the line appears
    openingHold: 6,         // how long it stays before fading
    letGo: 'sometimes we have to let go of a light to save the rest.', // shown once, when a crack's dimness first spreads
    letGoMurk: 0.35,        // ...that is, when a light around a cracked one has dimmed this much
    letGoDelay: 1,          // seconds after that
    letGoHold: 7,
    endFade: 10,            // seconds for the world (and its music) to fade at the end
    // The reveal's lines (placeholders for Mia's writing). {total} = lights placed in
    // the whole run, {onBase} = lights in the structure whose base cracked,
    // {letGo} = lights the player pulled out, {fell} = lights that fell.
    reveal: {
      count: '{total} lights.',
      allOnBase: 'every one of them rested on the base.',
      someOnBase: '{onBase} of them rested on the base.',
      pulled: 'when it went, everything on it fell.',
      dark: 'you held on, and the dark took them all.',
      closing: "we don't keep a belief because it's true, but because so much rests on it.",
      again: 'touch to begin again',
    },
    // one question after the reveal (placeholder wording); the answer is logged
    question: {
      ask: 'did you know everything rested on your first light?',
      answers: ['yes, while I was playing', 'only at the end', 'no'],
    },
    // the full record of the run, shown beside the replay
    stats: {
      gathered: 'lights gathered',
      cracks: 'lights that cracked',
      livedWith: 'cracks you lived with',
      letGo: 'lights you let go',
      fellWith: 'lights that fell with them',
      heldOn: 'held on after the base cracked',
      runTime: 'time in the forest',
    },
  },
};
