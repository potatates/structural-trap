// RUN LOG: every meaningful moment of a playthrough, with a timestamp.
// Stage 8 saves this to localStorage and exports it for the study; for now it
// only collects. Each entry is { t: seconds since start, type, ...details }.

export function createLog() {
  const start = performance.now();
  const events = [];
  return {
    events,
    now: () => (performance.now() - start) / 1000,
    add(type, details = {}) {
      events.push({ t: +((performance.now() - start) / 1000).toFixed(2), type, ...details });
    },
  };
}
