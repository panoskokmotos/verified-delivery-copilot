/** One product line the donor gave, e.g. 4 x "Purina Dog Chow dry dog food, 30 lb bag". */
export type NeedItem = {
  name: string;
  quantity: number;
  unit: string;
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
};

export type VisionCheck = {
  itemsSeen: string[];
  itemChecks: ItemCheck[];
  aiSuspicion: "none" | "some" | "strong"; // visual signs the image itself is AI-generated
  condition: "new" | "used" | "damaged" | "unclear";
  deliveryContext: string;
  concerns: string[];
  confidence: number; // 0..1
};

export type IntegrityCheck = {
  photoTakenAt: string | null;
  hasExif: boolean;
  /** "generated" or "edited" when the file carries an AI content label (C2PA / IPTC). */
  aiLabel: "generated" | "edited" | null;
  gps: { lat: number; lon: number } | null;
  hash: string;
  duplicateOf: string | null;
  nearDuplicateDistance: number | null;
  flags: string[];
};

export type OrgCheck = {
  ran: boolean;
  found: boolean;
  summary: string;
  sources: { title: string; url: string }[];
};

export type Decision = {
  verdict: "approve" | "review" | "reject";
  score: number; // 0..100
  reasons: string[];
  nextAction: string;
};

export type ImpactNote = {
  donorMessage: string;
  publicCaption: string;
};

export type StepEvent =
  | { type: "step"; step: StepName; status: "running" | "done" | "skipped" | "error"; model?: string; ms?: number; data?: unknown; error?: string }
  | { type: "final"; result: VerificationResult; confirmToken?: string } // token: present when the nonprofit may confirm
  | { type: "error"; error: string };

export type StepName = "intake" | "vision" | "integrity" | "org" | "decision" | "impact";

export type VerificationResult = {
  id: string;
  mode: "live" | "demo";
  need: Need;
  vision: VisionCheck;
  integrity: IntegrityCheck;
  org: OrgCheck;
  decision: Decision;
  impact: ImpactNote;
};

/** A donation waiting for, or holding, its delivery proof. */
export type Delivery = {
  id: string;
  orgName: string;
  city: string;
  cause: string;
  donorName: string;
  requestText: string; // what the nonprofit asked for, in its words
  items: NeedItem[]; // what the donor gave
  pledgedAt: string;
  status: "awaiting_photo" | Decision["verdict"];
  updatedAt?: string;
  result?: VerificationResult;
};
