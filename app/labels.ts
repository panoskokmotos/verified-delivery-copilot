import type { Delivery } from "../lib/types";

// How each side sees a delivery's status. The donor never sees a nonprofit's rejected photo,
// only that proof is still pending.
export const NONPROFIT_STATUS: Record<Delivery["status"], string> = {
  awaiting_photo: "Photo needed",
  approve: "Confirmed",
  review: "Retake needed",
  reject: "Not accepted, try again",
};
export const DONOR_STATUS: Record<Delivery["status"], string> = {
  awaiting_photo: "On its way",
  approve: "Delivered and confirmed",
  review: "Delivered, confirming",
  reject: "Delivered, confirming",
};

export const itemsLine = (d: Delivery) => d.items.map((i) => `${i.quantity} × ${i.name}`).join(", ");
