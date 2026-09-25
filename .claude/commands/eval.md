---
description: Run the eval set, explain failures, propose one prompt fix
---
1. Run `npm run eval`. Read `eval/report.md`.
2. List every case where the verdict was wrong. For each: file, expected, got, which step caused it.
3. Group the failures by cause (vision miss, count error, integrity false alarm, rule score).
4. Propose ONE change that fixes the biggest group. Show the diff. Do not apply it yet.
5. After I approve, apply it, run `npm run eval` again, and report the before and after numbers.
