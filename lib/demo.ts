import type { Delivery } from "./types";

// Demo donations waiting for a delivery photo. The nonprofits are fictional.
// On Givelink, these come from real requests by nonprofits the platform already verified.
export const SEED: Delivery[] = [
  {
    id: "coats-oakland",
    orgName: "Northgate Family Shelter (demo)",
    city: "Oakland, CA",
    cause: "Housing",
    donorName: "Maria",
    requestText: "We need 40 new winter coats, adult sizes M to XL, for our overnight shelter before Dec 15.",
    items: [{ name: "Adult winter coat, size M to XL, new with tags", quantity: 10, unit: "coats" }],
    pledgedAt: "2026-09-20T10:00:00Z",
    status: "awaiting_photo",
  },
  {
    id: "diapers-austin",
    orgName: "Bluebell Community Pantry (demo)",
    city: "Austin, TX",
    cause: "Food and basic needs",
    donorName: "Acme Corp CSR team",
    requestText: "Food pantry needs 12 packs of size 4 diapers, sealed, any brand.",
    items: [{ name: "Size 4 diaper pack, sealed", quantity: 12, unit: "packs" }],
    pledgedAt: "2026-09-21T10:00:00Z",
    status: "awaiting_photo",
  },
  {
    id: "dogfood-la",
    orgName: "Paws of Hope Rescue (demo)",
    city: "Los Angeles, CA",
    cause: "Animals",
    donorName: "Daniel",
    requestText: "Please send 10 bags of dry dog food, 30 lb bags, unopened.",
    items: [{ name: "Dry dog food, 30 lb bag, unopened", quantity: 4, unit: "bags" }],
    pledgedAt: "2026-09-22T10:00:00Z",
    status: "awaiting_photo",
  },
  {
    id: "school-chicago",
    orgName: "Lantern After-School Club (demo)",
    city: "Chicago, IL",
    cause: "Education",
    donorName: "Maria",
    requestText: "Our 30 kids start the school year without supplies. Notebooks, pencils and backpacks would help most.",
    items: [
      { name: "Spiral notebook", quantity: 30, unit: "notebooks" },
      { name: "Pack of 12 pencils", quantity: 10, unit: "packs" },
      { name: "Kids backpack", quantity: 5, unit: "backpacks" },
    ],
    pledgedAt: "2026-09-23T10:00:00Z",
    status: "awaiting_photo",
  },
];
