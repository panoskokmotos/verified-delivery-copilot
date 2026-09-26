import type { Delivery } from "./types";

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
