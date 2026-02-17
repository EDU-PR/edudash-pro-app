/**
 * TTS Constants — Single Source of Truth
 *
 * All TTS rate, pitch, and timing values live here.
 * Every consumer (useVoiceTTS, DashVoiceController, tts-proxy) MUST
 * import from this module instead of defining local constants.
 *
 * @see MASTER_ENGINEERING_PLAN.md Sprint 3.1 / Sprint 8.1
 * @module lib/dash-ai/ttsConstants
 */

// ── Azure Speech Rates ──────────────────────────────────────────────
// Azure SSML <prosody rate="X%"> where 0 = normal, negative = slower.

/** Normal speech rate (0% = Azure default) */
export const AZURE_RATE_NORMAL = 0;

/** Phonics sentence-level rate: slower pacing for clarity during phonics */
export const AZURE_RATE_PHONICS = -15;

/** Phonics phoneme-level rate: applied to individual /s/, /m/ SSML tags */
export const AZURE_RATE_PHONEME = -15;

// ── Device TTS Rates ────────────────────────────────────────────────
// expo-speech rate: 1.0 = normal.

/** Device TTS normal rate */
export const DEVICE_RATE_NORMAL = 1.0;

/** Device TTS phonics rate: slightly slower for young learners */
export const DEVICE_RATE_PHONICS = 0.92;

// ── Phonics SSML Break Durations ────────────────────────────────────

/** Pause after a single phoneme marker (e.g. /s/) in ms */
export const PHONICS_MARKER_BREAK_MS = 160;

/** Pause between blend segments (/k/ - /a/ - /t/) in ms */
export const PHONICS_BLEND_SEGMENT_BREAK_MS = 180;

/** Pause after the full blend before speaking the word in ms */
export const PHONICS_BLEND_FINAL_BREAK_MS = 240;

/** Fallback pause for individual letters in ms */
export const PHONICS_FALLBACK_LETTER_BREAK_MS = 140;
