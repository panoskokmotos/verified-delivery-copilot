# Feedback on Nebius and NVIDIA tools

Required for the Devpost submission. Log each item when it happens. Format: date, step, what happened, what would fix it.

## Nebius Token Factory

- 2026-09-26, model setup: `/v1/models` returns no modality info, so the only way to find a vision model was to send a test image to each one. Fix: add `input_modalities` to the models response.

- 2026-09-26, vision latency: `google/gemma-3-27b-it` took 59s, 16s and 2.7s on the same small image within a few minutes. `openbmb/MiniCPM-V-4_5` took 0.8s. The 59s call nearly hit our 60s route limit. Fix: publish latency or queue status per model.

- 2026-09-26, object grounding: we wanted to draw a box around each donated item in the delivery photo. Neither vision model on Token Factory could do it. Asked for boxes around 3 products, `google/gemma-3-27b-it` (87s) and `openbmb/MiniCPM-V-4_5` (4s) both returned boxes on the wall and an empty carton, not on the products. Fix: host a grounding-capable vision model (Nemotron Nano Omni, or a Qwen-VL class model) on Token Factory.

## Nebius AI Cloud

## NVIDIA Nemotron 3 Nano Omni (vision)

- 2026-09-26, model setup: Nano Omni is not on our Token Factory account. The 4 Nemotron models listed (Nano 30B, Super 120B, Ultra 550B, 3.5 Lightning) all return 400 "This model does not support image input". Fix: list Nano Omni on Token Factory, or document how to get access for hackathon teams.

## NVIDIA Nemotron 3 Super (reasoning)

- 2026-10-27, decision step: the reviewer may keep the rule verdict or make it stricter. For a genuine photo where the vision step saw 1 of 1 items and the rule score was 93, Super still changed "approve" to "review", citing "the brand label is not clearly visible", "seal integrity" and "size not readable". It only receives the vision results as text, so it had no evidence for any of these. We added an explicit instruction that unreadable labels are never a reason to be stricter; it kept doing it. Fix: better instruction following for "only use these reasons" constraints, or a documented way to constrain a field to a fixed list of grounds.

- 2026-10-27, structured output: asked for `reasons` as an array of strings, the model sometimes returned one plain string. Our UI then showed the first letter ("T") as the reason. We now normalise it in code. Fix: enforce the JSON schema server side (strict structured output) on Token Factory.

- 2026-10-27, evaluation: the same 23 labelled photos gave different verdicts on back-to-back runs with the same code. Approved real photos went 3, then 4, then 3 of 7; stripped AI fakes rejected went 1, then 2 of 8. Single runs can't measure a one-line prompt change. Fix: document how to get reproducible outputs (a supported `seed`, or which parameters make runs deterministic).

- 2026-09-26, latency: Nemotron 3 reasons before answering unless told not to. Our thank-you note took 811 output tokens and 10.6 s until we found `chat_template_kwargs.enable_thinking: false`, which cut it to about 70 tokens and 1.1 s. Fix: put the thinking switch in the Token Factory model page and quickstart.

## NVIDIA Nemotron 3 Nano (writing)

- 2026-09-26, model setup: the ID is `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`, while Super is `nvidia/nemotron-3-super-120b-a12b`. The naming is inconsistent across the family, so our guessed ID was wrong. Fix: one naming scheme.

## Would we build with them again?
