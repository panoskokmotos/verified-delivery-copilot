/** One product line the donor gave, e.g. 4 x "Purina Dog Chow dry dog food, 30 lb bag". */
export type NeedItem = {
  name: string;
  quantity: number;
  unit: string;
  price?: number; // USD per unit, for display
};

export type Need = {
  items: NeedItem[];
  condition: "new" | "gently_used" | "any";
  category: string;
  deadline: string | null;
  mustHave: string[];
};

/** What the photo shows for one line of the gift. */
export type ItemCheck = {
  name: string;
  expected: number;
  seen: number | null; // null when the count can't be read from the photo
  status: "seen" | "partial" | "missing" | "unclear";
  note: string; // one short sentence, e.g. "4 bags visible, brand label readable on 3"
  where: string; // where the item sits in the photo, e.g. "front left, blue label"
};

export type VisionCheck = {
  itemsSeen: string[];
  itemChecks: ItemCheck[];
  aiSuspicion: "none" | "some" | "strong"; // visual signs the image itself is AI-generated
  condition: "new" | "used" | "damaged" | "unclear";
  deliveryContext: string;
  concerns: string[];
  confidence: number; // 0..1
  model?: string; // the vision model that answered (the fallback, if the primary timed out)
};

export type IntegrityCheck = {
  photoTakenAt: string | null;
  hasExif: boolean;
  /** "generated" or "edited" when the file carries an AI content label (C2PA / IPTC). */
  aiLabel: "generated" | "edited" | null;
  // Distances only, never coordinates: km from the nonprofit's address to where the photo says it was
  // taken (camera GPS) and to where the phone was at upload (shared with permission). null when unknown.
  location: { photoKm: number | null; uploadKm: number | null };
  notes: string[]; // worth telling the nonprofit, not a sign of a fake
  hash: string;
  duplicateOf: string | null;
  nearDuplicateDistance: number | null;
  flags: string[];
};

export type Decision = {
  verdict: "approve" | "review" | "reject";
  score: number; // 0..100
  reasons: string[];
  nextAction: string;
  model?: string; // which model made the final call
};

export type ImpactNote = {
  donorMessage: string;
  publicCaption: string;
};

export type StepEvent =
  | { type: "step"; step: StepName; status: "running" | "done" | "skipped" | "error"; model?: string; ms?: number; data?: unknown; error?: string }
  | { type: "final"; result: VerificationResult; confirmToken?: string } // token: present when the nonprofit may confirm
  | { type: "error"; error: string };

export type StepName = "intake" | "vision" | "integrity" | "decision" | "impact";

export type VerificationResult = {
  id: string;
  mode: "live" | "demo";
  models?: { vision: string; reasoning: string; writer: string; escalation?: string }; // model IDs configured, for the receipt
  need: Need;
  vision: VisionCheck;
  integrity: IntegrityCheck;
  decision: Decision;
  impact: ImpactNote;
};

/** One donor's part of a batched delivery. */
export type Donation = {
  donorId: string;
  donorName: string;
  items: NeedItem[];
};

/**
 * One shipment to a nonprofit, batching the gifts of several donors, like a Givelink delivery.
 * status: shipping (on its way), awaiting_photo (arrived, needs proof), then the check's verdict.
 */
export type Delivery = {
  id: string;
  orgName: string;
  city: string;
  cause: string;
  supplier: string;
  orderCode: string;
  arrivesAt: string; // ISO date the supplier gave
  donations: Donation[];
  status: "shipping" | "awaiting_photo" | Decision["verdict"];
  updatedAt?: string;
  result?: VerificationResult;
  thankYouNote?: string; // written by the nonprofit when it shares the proof
  location?: { lat: number; lon: number }; // the nonprofit's address, from its verified profile
  photoSha256?: string; // of the stored photo, so a receipt can be checked against it later
};
