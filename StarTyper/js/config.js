/* ========================================
   STAR TYPER - CONFIG
   Constants and configuration values
======================================== */

const DEFAULT_WORDS = [
  "temple", "wilds", "ancient", "compass", "whisper", 
  "starlight", "meadow", "journey", "sapphire", "summit", 
  "lantern", "quest", "guardian", "voyage", "echo", 
  "timber", "harbor", "mystic", "horizon", "sanctum"
];

const SAVE_KEY = 'star-typer-v1';
const AUTOSAVE_INTERVAL_MS = 10000;
const WORD_DURATION_MS = 6000;

const BASE_GOLDEN_CHANCE = 0.05;
const BASE_SENTENCE_CHANCE = 0.02; // 1/50 = 0.02
const BASE_COMBO_STEP = 0.1;
const BASE_MAX_MULTIPLIER = 5.0;

// Word bank multipliers
const WORD_BANK_MULTIPLIERS = {
  easy: 1,
  medium: 2,
  hard: 4,
  veryhard: 8,
  expert: 16
};