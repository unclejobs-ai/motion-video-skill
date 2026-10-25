// Written by plan.mjs from a reference analysis (scripts/ref-analyze.py → analysis.json). Edit by re-running plan.mjs,
// or by hand for a first draft. Every time is in frames at `fps`.
export const PLAN = {
  "source": "plan.mjs from reference.json (36.368 s, 54.36 fps, 51 cuts)",
  "fps": 30,
  "seconds": 20,
  "open": 24,
  "hold": 10,
  "burstStep": 4,
  "burstCount": 12,
  "textbook": 165,
  "whip": {
    "outShift": 0.34,
    "inShift": 0.2,
    "outBlur": 9,
    "inBlur": 6
  },
  "refocus": [
    6,
    2,
    1.5
  ],
  "dirs": "rdurluuuuddl"
} as const;
