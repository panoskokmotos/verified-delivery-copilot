// On the deployed site a missing setting must stop the check with a clear message. Without a Nebius key
// the pipeline falls back to simulated results, and without a receipt secret or a Blob store every
// serverless instance signs and saves on its own, so "Send" fails and saved proofs vanish.
export function missingSettings(): string[] {
  if (!process.env.VERCEL) return []; // local dev may run in demo mode on purpose
  const missing: string[] = [];
  if (!process.env.NEBIUS_API_KEY) missing.push("NEBIUS_API_KEY");
  if (!process.env.RECEIPT_SECRET) missing.push("RECEIPT_SECRET");
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) missing.push("a connected Blob store");
  return missing;
}

export function notConfigured(): Response | null {
  const missing = missingSettings();
  if (!missing.length) return null;
  return Response.json(
    { error: `This site isn't fully set up yet, so it can't check photos. Missing: ${missing.join(", ")}.` },
    { status: 503 },
  );
}
