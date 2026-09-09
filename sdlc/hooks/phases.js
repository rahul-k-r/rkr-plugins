// The story-state.json phase vocabulary, shared by validate-state.js (legality
// on every write) and session-start.js (what counts as finished at announce time).
const PHASES = new Set([
  'DESIGN', 'INTAKE', 'PLAN', 'IMPLEMENT',
  'FINAL_REVIEW', 'READY_FOR_PR', 'PR_OPENED',
  'AUTO_REVIEW', 'AUTO_FIX', 'AWAITING_CI', 'MERGED', 'CLOSED', // --bypass tail (story-run.md)
  'PUBLISHED', // standalone design-run's terminal phase (design-run.md)
  'PAUSED',
]);

// Terminal for announcement purposes: nothing left for --resume to do.
const DONE = new Set(['PR_OPENED', 'PUBLISHED', 'CLOSED']);

module.exports = { PHASES, DONE };
