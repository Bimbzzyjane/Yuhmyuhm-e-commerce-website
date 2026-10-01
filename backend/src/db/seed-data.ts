import type { NewCategoryRow, NewProductRow } from '../repositories/types';

/**
 * Catalogue seed — the single source of truth for demo/production data.
 *
 * It is consumed by BOTH the in-memory repository (so the API has data the
 * moment it boots with `BACKEND_DATA_BACKEND=memory`) and `npm run seed`
 * (which writes the same rows into Supabase). Keeping one list means the
 * automated tests exercise exactly the data the demo shows.
 *
 * PRICES ARE IN MINOR UNITS (kobo). `naira(45000)` === ₦45,000.
 *
 * IMAGERY: URLs point at `picsum.photos`, which serves a real photograph for
 * any seed string — deterministic, never a broken link, and no API key. Swap
 * these for commissioned Yuhmyuhm photography before launch;
 * `components/ProductImage.tsx` falls back to a branded local placeholder if
 * an image ever fails to load.
 */

const naira = (major: number): number => Math.round(major * 100);

const img = (seed: string): string => `https://picsum.photos/seed/${seed}/900/900`;

export const SEED_CATEGORIES: NewCategoryRow[] = [
  {
    slug: 'cakes',
    name: 'Cakes',
    description: 'Celebration cakes, hand-finished in our kitchen and baked to order.',
    imageUrl: img('yuhmyuhm-category-cakes'),
    sortOrder: 1,
  },
  {
    slug: 'catering-equipment',
    name: 'Catering Equipment',
    description: 'Professional-grade equipment for kitchens that scale with demand.',
    imageUrl: img('yuhmyuhm-category-equipment'),
    sortOrder: 2,
  },
  {
    slug: 'baking-supplies',
    name: 'Baking Supplies',
    description: 'Everyday tools and finishing touches our own bakers reach for.',
    imageUrl: img('yuhmyuhm-category-baking'),
    sortOrder: 3,
  },
  {
    slug: 'event-essentials',
    name: 'Event Essentials',
    description: 'Elegant furniture, barware and linen to dress the room.',
    imageUrl: img('yuhmyuhm-category-events'),
    sortOrder: 4,
  },
];

export const SEED_PRODUCTS: NewProductRow[] = [
  // --- Cakes ---------------------------------------------------------------
  {
    slug: 'chocolate-delight-cake',
    name: 'Chocolate Delight Cake',
    description:
      'Three layers of dark cocoa sponge with whipped ganache and a mirror-glaze finish. Serves 12–16.',
    categorySlug: 'cakes',
    price: naira(45000),
    imageUrl: img('chocolate-delight-cake'),
    badge: 'Best Seller',
    isFeatured: true,
    stockQuantity: 24,
    sortOrder: 1,
  },
  {
    slug: 'vanilla-dream-cake',
    name: 'Vanilla Dream Cake',
    description:
      'Madagascan vanilla bean sponge, silky buttercream and edible gold leaf. Our house signature.',
    categorySlug: 'cakes',
    price: naira(75000),
    imageUrl: img('vanilla-dream-cake'),
    badge: 'New',
    isFeatured: true,
    stockQuantity: 18,
    sortOrder: 2,
  },
  {
    slug: 'red-velvet-celebration-cake',
    name: 'Red Velvet Celebration Cake',
    description: 'Classic red velvet with tangy cream cheese frosting and a velvet crumb.',
    categorySlug: 'cakes',
    price: naira(62000),
    imageUrl: img('red-velvet-celebration-cake'),
    isFeatured: true,
    stockQuantity: 15,
    sortOrder: 3,
  },
  {
    slug: 'marble-fudge-cake',
    name: 'Marble Fudge Cake',
    description: 'Vanilla and chocolate batters marbled together under a thick fudge glaze.',
    categorySlug: 'cakes',
    price: naira(52000),
    imageUrl: img('marble-fudge-cake'),
    isFeatured: true,
    stockQuantity: 20,
    sortOrder: 4,
  },
  {
    slug: 'coconut-cream-cake',
    name: 'Coconut Cream Cake',
    description: 'Toasted coconut, coconut milk sponge and a light chantilly cream.',
    categorySlug: 'cakes',
    price: naira(38500),
    imageUrl: img('coconut-cream-cake'),
    stockQuantity: 16,
    sortOrder: 5,
  },
  {
    slug: 'lemon-drizzle-loaf',
    name: 'Lemon Drizzle Loaf',
    description: 'A zesty loaf cake soaked in fresh lemon syrup. Serves 8–10.',
    categorySlug: 'cakes',
    price: naira(28000),
    imageUrl: img('lemon-drizzle-loaf'),
    stockQuantity: 30,
    sortOrder: 6,
  },

  // --- Catering Equipment --------------------------------------------------
  {
    slug: 'stainless-steel-chafing-dish',
    name: 'Stainless Steel Chafing Dish',
    description:
      'A mirror-polished 9 litre chafer with a roll-top lid and water pan. Keeps food service-hot for hours.',
    categorySlug: 'catering-equipment',
    price: naira(120000),
    imageUrl: img('stainless-steel-chafing-dish'),
    isFeatured: true,
    stockQuantity: 40,
    sortOrder: 1,
  },
  {
    slug: 'kitchenaid-stand-mixer',
    name: 'KitchenAid Stand Mixer',
    description: 'A 6.9 L bowl-lift mixer with a 1.3 HP motor — the workhorse of our own kitchen.',
    categorySlug: 'catering-equipment',
    price: naira(350000),
    imageUrl: img('kitchenaid-stand-mixer'),
    isFeatured: true,
    stockQuantity: 12,
    sortOrder: 2,
  },
  {
    slug: 'insulated-food-transport-carrier',
    name: 'Insulated Food Transport Carrier',
    description: 'Holds 90 litres at temperature for up to six hours. Stackable and wheeled.',
    categorySlug: 'catering-equipment',
    price: naira(185000),
    imageUrl: img('insulated-food-transport-carrier'),
    stockQuantity: 22,
    sortOrder: 3,
  },
  {
    slug: 'banquet-serving-trolley',
    name: 'Banquet Serving Trolley',
    description: 'A three-tier stainless trolley on locking castors for plated service.',
    categorySlug: 'catering-equipment',
    price: naira(240000),
    imageUrl: img('banquet-serving-trolley'),
    stockQuantity: 9,
    sortOrder: 4,
  },
  {
    slug: 'commercial-rice-cooker-20l',
    name: 'Commercial Rice Cooker 20L',
    description: 'A non-stick 20 litre rice cooker that holds 40+ portions without sticking.',
    categorySlug: 'catering-equipment',
    price: naira(165000),
    imageUrl: img('commercial-rice-cooker-20l'),
    badge: 'New',
    stockQuantity: 14,
    sortOrder: 5,
  },
  {
    slug: 'portable-gas-burner-set',
    name: 'Portable Gas Burner Set',
    description: 'Twin high-output burners with hose, regulator and a carry case.',
    categorySlug: 'catering-equipment',
    price: naira(95000),
    imageUrl: img('portable-gas-burner-set'),
    stockQuantity: 26,
    sortOrder: 6,
  },

  // --- Baking Supplies -----------------------------------------------------
  {
    slug: 'professional-cake-turntable',
    name: 'Professional Cake Turntable',
    description: 'An aluminium 30 cm turntable with a smooth, wobble-free bearing.',
    categorySlug: 'baking-supplies',
    price: naira(42000),
    imageUrl: img('professional-cake-turntable'),
    stockQuantity: 35,
    sortOrder: 1,
  },
  {
    slug: 'stainless-piping-tip-set-24',
    name: 'Stainless Piping Tip Set (24 pcs)',
    description: 'Seamless stainless nozzles with couplers and a storage case.',
    categorySlug: 'baking-supplies',
    price: naira(18500),
    imageUrl: img('stainless-piping-tip-set'),
    badge: 'Best Seller',
    stockQuantity: 60,
    sortOrder: 2,
  },
  {
    slug: 'silicone-cake-mould-bundle',
    name: 'Silicone Cake Mould Bundle',
    description: 'Food-grade non-stick moulds in six shapes, oven and freezer safe.',
    categorySlug: 'baking-supplies',
    price: naira(26000),
    imageUrl: img('silicone-cake-mould-bundle'),
    stockQuantity: 48,
    sortOrder: 3,
  },
  {
    slug: 'edible-gold-leaf-pack',
    name: 'Edible Gold Leaf Pack',
    description: 'Twenty-five sheets of 24-carat transfer leaf for finishing celebration cakes.',
    categorySlug: 'baking-supplies',
    price: naira(34000),
    imageUrl: img('edible-gold-leaf-pack'),
    badge: 'Limited',
    // Deliberately out of stock: exercises the OUT_OF_STOCK checkout guard.
    stockQuantity: 0,
    sortOrder: 4,
  },
  {
    slug: 'wooden-rolling-pin-set',
    name: 'Wooden Rolling Pin Set',
    description: 'Beech pins with and without guides for even, repeatable thickness.',
    categorySlug: 'baking-supplies',
    price: naira(15000),
    imageUrl: img('wooden-rolling-pin-set'),
    stockQuantity: 52,
    sortOrder: 5,
  },

  // --- Event Essentials ----------------------------------------------------
  {
    slug: 'chiavari-chair-gold',
    name: 'Chiavari Chair (Gold)',
    description: 'Stackable gold resin Chiavari chairs with padded seat cushions.',
    categorySlug: 'event-essentials',
    price: naira(55000),
    imageUrl: img('chiavari-chair-gold'),
    stockQuantity: 120,
    sortOrder: 1,
  },
  {
    slug: 'round-banquet-table-6-seater',
    name: 'Round Banquet Table (6-seater)',
    description: 'A 152 cm folding round table with a height-adjustable pedestal.',
    categorySlug: 'event-essentials',
    price: naira(130000),
    imageUrl: img('round-banquet-table'),
    stockQuantity: 30,
    sortOrder: 2,
  },
  {
    slug: 'elegant-barware-set',
    name: 'Elegant Barware Set',
    description: 'Crystal shaker, jigger, strainer and stirrer in a presentation box.',
    categorySlug: 'event-essentials',
    price: naira(88000),
    imageUrl: img('elegant-barware-set'),
    badge: 'New',
    stockQuantity: 19,
    sortOrder: 3,
  },
  {
    slug: 'luxe-table-linen-set',
    name: 'Luxe Table Linen Set',
    description: 'Wrinkle-resistant cotton-blend cloth and napkins for ten covers.',
    categorySlug: 'event-essentials',
    price: naira(45000),
    imageUrl: img('luxe-table-linen-set'),
    stockQuantity: 44,
    sortOrder: 4,
  },
  {
    slug: 'candelabra-centrepiece',
    name: 'Candelabra Centrepiece',
    description: 'A five-arm gold candelabra that anchors a banquet table.',
    categorySlug: 'event-essentials',
    price: naira(62000),
    imageUrl: img('candelabra-centrepiece'),
    stockQuantity: 27,
    sortOrder: 5,
  },
];
