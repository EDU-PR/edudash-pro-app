# Voice Benchmark Corpus

This folder defines the fixed corpus for dictation parity runs against Wispr Flow.

## Files

- `manifest.v1.json`: corpus metadata and schema.
- `reference_transcripts.v1.jsonl`: canonical reference utterances (`120` total).
- `templates/head_to_head_template.csv`: capture template for manual side-by-side runs.

## Language Mix

- `en`: 48
- `af`: 24
- `zu`: 24
- `xh`: 24

## Categories

- `short`
- `medium`
- `long`
- `command`
- `names_acronyms`

## Usage

1. Use the template CSV for both Our app and Wispr captures.
2. Keep device/network/settings controlled.
3. Fill `observed_text`, `first_text_latency_ms`, `final_commit_latency_ms`, and `status` (`ok|failed|skipped`).
4. Feed CSV outputs into benchmark scripts under `scripts/voice`.
