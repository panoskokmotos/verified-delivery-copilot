# Feedback on Nebius and NVIDIA tools

Required for the Devpost submission. Log each item when it happens. Format: date, step, what happened, what would fix it.

## Nebius Token Factory

- 2026-09-26, model setup: `/v1/models` returns no modality info, so the only way to find a vision model was to send a test image to each one. Fix: add `input_modalities` to the models response.

## Nebius AI Cloud

## NVIDIA Nemotron 3 Nano Omni (vision)

- 2026-09-26, model setup: Nano Omni is not on our Token Factory account. The 4 Nemotron models listed (Nano 30B, Super 120B, Ultra 550B, 3.5 Lightning) all return 400 "This model does not support image input". Fix: list Nano Omni on Token Factory, or document how to get access for hackathon teams.

## NVIDIA Nemotron 3 Super (reasoning)

## NVIDIA Nemotron 3 Nano (writing)

- 2026-09-26, model setup: the ID is `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`, while Super is `nvidia/nemotron-3-super-120b-a12b`. The naming is inconsistent across the family, so our guessed ID was wrong. Fix: one naming scheme.

## Would we build with them again?
