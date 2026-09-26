#!/usr/bin/env bash
# Runs the eval (scripts/eval.mjs) as a Nebius Serverless AI Job against the deployed app.
# The labelled photos live in a private Nebius Object Storage bucket, mounted into the job at /app/eval,
# so they never go into the repo or a container image. The report is written back to the bucket.
#
# Needs: the Nebius CLI, logged in (nebius auth login), an AWS CLI profile for Nebius Object Storage,
# and the deployed app live with VDC_API_KEYS set. Each photo costs 3 or 4 Token Factory calls on the
# deployed app's key; the job itself is one small CPU VM for a few minutes.
#
#   BUCKET=vdc-eval S3_PROFILE=nebius EVAL_URL=https://verified-delivery-copilot.vercel.app \
#   EVAL_KEY_SECRET=vdc-eval-key scripts/nebius-eval-job.sh
#
# EVAL_KEY_SECRET names a SecretStash secret (create it in the Nebius console) whose payload key is
# EVAL_API_KEY and whose value is one of the deployed app's VDC_API_KEYS. The key never touches this script.
# Written from docs.nebius.com/serverless/jobs/manage; check the platform and preset names on your project first.
set -euo pipefail

: "${BUCKET:?set BUCKET to a private Nebius Object Storage bucket}"
: "${S3_PROFILE:?set S3_PROFILE to the AWS CLI profile for Nebius Object Storage}"
: "${EVAL_URL:?set EVAL_URL to the deployed app, e.g. https://verified-delivery-copilot.vercel.app}"
: "${EVAL_KEY_SECRET:?set EVAL_KEY_SECRET to the SecretStash secret holding EVAL_API_KEY}"
REGION="${REGION:-eu-north1}"
PLATFORM="${PLATFORM:-cpu-d3}"   # list yours with: nebius compute platform list
PRESET="${PRESET:-2vcpu-8gb}"
EVAL_MAX="${EVAL_MAX:-40}"       # hard cap on photos, so on model calls (about 4 per photo)

cd "$(dirname "$0")/.."
# Only the labelled sets; eval/report.md comes back from the job.
aws s3 sync eval "s3://$BUCKET" --profile "$S3_PROFILE" --endpoint-url "https://storage.$REGION.nebius.cloud" \
  --exclude "*" --include "real/*" --include "fake/*"

nebius ai job create \
  --name "vdc-eval-$(date +%Y%m%d-%H%M)" \
  --image node:22-slim \
  --platform "$PLATFORM" --preset "$PRESET" \
  --inject-file "scripts/eval.mjs:/app/eval.mjs" \
  --volume "s3://$BUCKET:/app/eval:rw:$S3_PROFILE" \
  --working-dir /app \
  --container-command node --args "/app/eval.mjs" \
  --env "EVAL_URL=$EVAL_URL" --env "EVAL_MAX=$EVAL_MAX" \
  --env-secret "EVAL_API_KEY=$EVAL_KEY_SECRET" \
  --timeout 1h

echo "Follow it with: nebius ai job logs <job ID> --follow"
echo "Then fetch the report: aws s3 cp s3://$BUCKET/report.md eval/report.md --profile $S3_PROFILE --endpoint-url https://storage.$REGION.nebius.cloud"
