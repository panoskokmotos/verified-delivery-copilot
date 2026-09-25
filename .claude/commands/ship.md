---
description: Build, check for secrets, commit, push, deploy
---
1. Run `npm run build`. Stop if it fails.
2. Search the staged diff for anything that looks like an API key. Stop if found.
3. Commit with a short message that says what changed and why.
4. Push to origin main.
5. Run `vercel --prod` and print the URL.
6. Hit `/api/health` on the new URL and confirm `"mode": "live"`.
