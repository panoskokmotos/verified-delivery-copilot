export type Need = {
  item: string;
  quantity: number;
  unit: string;
  condition: "new" | "gently_used" | "any";
  category: string;
  deadline: string | null;
  mustHave: string[];
};

export type VisionCheck = {
  itemsSeen: string[];
  matchesNeed: boolean;
  estimatedCount: number | null;
  countConfidence: "low" | "medium" | "high";
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
  | { type: "final"; result: VerificationResult }
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
