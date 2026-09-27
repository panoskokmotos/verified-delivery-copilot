import type { Delivery, WishItem } from "./types";

// Demo deliveries. The nonprofits are fictional; on Givelink they are nonprofits the platform
// already verified, and each delivery batches the gifts of several donors.
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export const DONORS: Record<string, string> = {
  maria: "Maria",
  daniel: "Daniel",
  eleni: "Eleni",
  acme: "Acme Corp CSR team",
  sofia: "Sofia",
  james: "James",
};
const donation = (donorId: string, items: Delivery["donations"][number]["items"]) => ({ donorId, donorName: DONORS[donorId], items });

const DOG_FOOD = { name: "Dry dog food, 30 lb bag", unit: "bags", price: 42 };
const PET_BLANKET = { name: "Pet blanket", unit: "blankets", price: 15 };
const NOTEBOOK = { name: "Spiral notebook", unit: "notebooks", price: 2 };
const PENCILS = { name: "Pack of 12 pencils", unit: "packs", price: 3 };
const BACKPACK = { name: "Kids backpack", unit: "backpacks", price: 18 };
const DIAPERS = { name: "Size 4 diaper pack, sealed", unit: "packs", price: 25 };
const WIPES = { name: "Baby wipes pack", unit: "packs", price: 6 };
const COAT = { name: "Adult winter coat, size M to XL", unit: "coats", price: 45 };

export const SEED: Delivery[] = [
  {
    id: "paws-of-hope",
    location: { lat: 34.0522, lon: -118.2437 }, // city center: fictional nonprofit
    orgName: "Paws of Hope Rescue (demo)",
    city: "Los Angeles, CA",
    cause: "Animals",
    supplier: "Chewy",
    orderCode: "GL-2041",
    arrivesAt: day(-3),
    status: "awaiting_photo",
    donations: [
      donation("daniel", [{ ...DOG_FOOD, quantity: 2 }]),
      donation("maria", [{ ...DOG_FOOD, quantity: 2 }, { ...PET_BLANKET, quantity: 1 }]),
      donation("eleni", [{ ...PET_BLANKET, quantity: 3 }]),
    ],
  },
  {
    id: "lantern-school",
    location: { lat: 41.8781, lon: -87.6298 }, // city center: fictional nonprofit
    orgName: "Lantern After-School Club (demo)",
    city: "Chicago, IL",
    cause: "Education",
    supplier: "Amazon",
    orderCode: "GL-2038",
    arrivesAt: day(-1),
    status: "awaiting_photo",
    donations: [
      donation("maria", [{ ...NOTEBOOK, quantity: 20 }, { ...PENCILS, quantity: 5 }]),
      donation("acme", [{ ...NOTEBOOK, quantity: 10 }, { ...PENCILS, quantity: 5 }, { ...BACKPACK, quantity: 5 }]),
    ],
  },
  {
    id: "bluebell-pantry",
    location: { lat: 30.2672, lon: -97.7431 }, // city center: fictional nonprofit
    orgName: "Bluebell Community Pantry (demo)",
    city: "Austin, TX",
    cause: "Food and basic needs",
    supplier: "Walmart",
    orderCode: "GL-2035",
    arrivesAt: day(-5),
    status: "awaiting_photo",
    donations: [
      donation("acme", [{ ...DIAPERS, quantity: 8 }]),
      donation("sofia", [{ ...DIAPERS, quantity: 4 }, { ...WIPES, quantity: 6 }]),
    ],
  },
  {
    id: "northgate-shelter",
    location: { lat: 37.8044, lon: -122.2712 }, // city center: fictional nonprofit
    orgName: "Northgate Family Shelter (demo)",
    city: "Oakland, CA",
    cause: "Housing",
    supplier: "Target",
    orderCode: "GL-2044",
    arrivesAt: day(2),
    status: "shipping",
    donations: [
      donation("maria", [{ ...COAT, quantity: 5 }]),
      donation("james", [{ ...COAT, quantity: 5 }]),
    ],
  },
];

/** The demo nonprofits, one per seeded delivery. On Givelink these are nonprofits the platform verified. */
export const ORGS = SEED.map((d) => ({ id: d.id, name: d.orgName, city: d.city, cause: d.cause, location: d.location }));

// A starting wishlist for each nonprofit, before any recall search. Products added in the app get
// their name, photo and recall result from a lookup.
const wish = (orgId: string, n: number, item: Omit<WishItem, "id" | "orgId" | "addedAt" | "given">): WishItem => ({
  id: `${orgId}-seed-${n}`,
  orgId,
  addedAt: day(-10),
  given: 0,
  ...item,
});
export const WISHLIST: Record<string, WishItem[]> = {
  "paws-of-hope": [wish("paws-of-hope", 1, { ...DOG_FOOD, quantity: 10 }), wish("paws-of-hope", 2, { ...PET_BLANKET, quantity: 12 })],
  "lantern-school": [wish("lantern-school", 1, { ...BACKPACK, quantity: 20 }), wish("lantern-school", 2, { ...NOTEBOOK, quantity: 60 })],
  "bluebell-pantry": [wish("bluebell-pantry", 1, { ...DIAPERS, quantity: 30 }), wish("bluebell-pantry", 2, { ...WIPES, quantity: 20 })],
  "northgate-shelter": [wish("northgate-shelter", 1, { ...COAT, quantity: 40 })],
};
