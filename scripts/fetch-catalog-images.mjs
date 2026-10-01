// ===========================================================================
// scripts/fetch-catalog-images.mjs
// ===========================================================================
// Downloads one photograph per catalogue item so every product card actually
// shows the product it names.
//
//   node scripts/fetch-catalog-images.mjs            # fetch anything missing
//   node scripts/fetch-catalog-images.mjs --force    # re-fetch everything
//
// Source: the Openverse API (https://api.openverse.engineering), which
// aggregates CC-licensed images from Flickr, Wikimedia and others. It is used
// rather than a stock-photo CDN because every result carries an explicit
// licence and the query is subject-matched enough to return a chafing dish for
// "chafing dish".
//
// Only commercially usable licences are accepted (`license_type=commercial`),
// so nothing here blocks commercial use. Credits are written to
// ATTRIBUTIONS.md — keep that file with the project.
//
// Images land in frontend/public/images/catalog/ and are referenced from the
// seed data as `/images/catalog/<slug>.jpg`, so the storefront never depends
// on a third-party image host at runtime.
// ===========================================================================

import { mkdir, writeFile, readFile, access, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT_DIR = join(ROOT, 'frontend', 'public', 'images', 'catalog');
const ATTRIBUTIONS = join(ROOT, 'ATTRIBUTIONS.md');

const API = 'https://api.openverse.org/v1/images/';
const USER_AGENT = 'YuhmyuhmCatalogImageFetcher/1.0 (catalogue imagery)';
const FORCE = process.argv.includes('--force');

/**
 * `--candidates` writes the top N results for each slug into `.image-review/`
 * so they can be eyeballed, and prints a manifest. A normal run then downloads
 * only the index recorded in PINNED. Keyword screening alone cannot tell that
 * "sushi turntable" is not a cake turntable — looking at the pictures can.
 */
const CANDIDATES_MODE = process.argv.includes('--candidates');
const CANDIDATE_COUNT = 4;
const REVIEW_DIR = join(ROOT, '.image-review');

/** `--only=chafing` restricts a run to matching slugs, so earlier pins survive. */
const ONLY = process.argv
  .find((argument) => argument.startsWith('--only='))
  ?.slice('--only='.length);

/**
 * slug -> index of the chosen candidate (0-based), filled in after review.
 * Populated by looking at the candidates, not by trusting the search rank.
 */
const PINNED = {
  'chocolate-delight-cake': 0,
  'vanilla-dream-cake': 2,
  'red-velvet-celebration-cake': 3,
  'marble-fudge-cake': 0,
  'coconut-cream-cake': 2,
  'lemon-drizzle-loaf': 2,
  'stainless-steel-chafing-dish': 0,
  'kitchenaid-stand-mixer': 1,
  'insulated-food-transport-carrier': 0,
  'banquet-serving-trolley': 0,
  'commercial-rice-cooker-20l': 1,
  'hero-cake': 0,
};

/**
 * Slugs whose chosen image cannot be re-derived from a search, because the
 * query that finds it is unhelpfully specific. These are used verbatim and are
 * still credited in ATTRIBUTIONS.md.
 */
const MANUAL = {
  'portable-gas-burner-set': {
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/dd/Utilization_of_A_gas_cartridge_camping_stove.jpg',
    title: 'Utilization of a gas cartridge camping stove',
    author: 'Bjoertvedt',
    licence: 'by-sa',
    licenceVersion: '4.0',
    source:
      'https://commons.wikimedia.org/wiki/File:Utilization_of_A_gas_cartridge_camping_stove.jpg',
    provider: 'wikimedia commons',
  },
};

/** Openverse rate-limits anonymous clients, so every request is spaced out. */
const REQUEST_DELAY_MS = 1200;

/**
 * Search terms, chosen so the photo matches the product name. These are
 * deliberately literal: "vanilla cake" returns vanilla cakes, "cake" returns
 * editorial shots that read poorly on a 300px card.
 */
const CATALOG = [
  // --- Cakes ---------------------------------------------------------------
  ['chocolate-delight-cake', 'chocolate cake', 'openverse'],
  ['vanilla-dream-cake', 'vanilla wedding cake', 'openverse'],
  ['red-velvet-celebration-cake', 'red velvet cake', 'openverse'],
  ['marble-fudge-cake', 'marble cake', 'openverse'],
  ['coconut-cream-cake', 'coconut cake', 'openverse'],
  ['lemon-drizzle-loaf', 'lemon cake loaf', 'openverse'],

  // --- Catering equipment --------------------------------------------------
  // Commercial catering kit is barely represented on Openverse (searching
  // "stand mixer" returns antique glass bowls), but Wikimedia Commons has
  // photographed museum and hotel equipment for decades. Hence the split.
  ['stainless-steel-chafing-dish', 'chafing dish', 'commons'],
  ['kitchenaid-stand-mixer', 'KitchenAid', 'commons'],
  ['insulated-food-transport-carrier', 'Cambro food container', 'commons'],
  ['banquet-serving-trolley', 'serving cart restaurant', 'commons'],
  ['commercial-rice-cooker-20l', 'rice cooker', 'commons'],
  ['portable-gas-burner-set', 'camping stove', 'commons'],

  // --- Baking supplies -----------------------------------------------------
  ['professional-cake-turntable', 'cake turntable decorating', 'openverse'],
  ['stainless-piping-tip-set-24', 'piping nozzle cake decorating', 'commons'],
  ['silicone-cake-mould-bundle', 'cake mould pan baking', 'commons'],
  ['edible-gold-leaf-pack', 'cake gold leaf', 'openverse'],
  ['wooden-rolling-pin-set', 'rolling pin', 'openverse'],

  // --- Event essentials ----------------------------------------------------
  ['chiavari-chair-gold', 'banquet chair gold', 'openverse'],
  ['round-banquet-table-6-seater', 'round banquet table', 'commons'],
  ['elegant-barware-set', 'cocktail bar glasses', 'commons'],
  ['luxe-table-linen-set', 'tablecloth', 'openverse'],
  ['candelabra-centrepiece', 'candelabra', 'commons'],

  // --- Category tiles ------------------------------------------------------
  ['category-cakes', 'wedding cake tiered', 'openverse'],
  ['category-catering-equipment', 'buffet food service restaurant', 'commons'],
  ['category-baking-supplies', 'baking tray kitchen', 'openverse'],
  ['category-event-essentials', 'wedding reception table setting', 'openverse'],

  // --- Brand imagery -------------------------------------------------------
  ['hero-cake', 'wedding cake tiered', 'openverse'],
  ['cta-cake', 'birthday cake candles', 'openverse'],
  ['auth-cake', 'decorating cake icing', 'openverse'],
];

/**
 * Keyword screens applied to each result's TITLE.
 *
 * Keyword search over an open image archive is reliably subject-matched and
 * unreliably *specific*: "chocolate cake" happily returns Lego cupcakes, and
 * "food service trolley" returns a sightseeing trolley. Screening the title
 * catches those without having to eyeball 150 photographs.
 *
 *   must    : reject anything that does not mention the subject at all
 *   reject  : reject known false friends for that term
 */
const SCREEN = {
  'chocolate-delight-cake': {
    must: /chocolate/i,
    reject: /lego|cupcake|minecraft|cookie|hot.?chocolate/i,
  },
  'vanilla-dream-cake': { must: /vanilla|wedding/i, reject: /lego|cupcake|minecraft/i },
  'red-velvet-celebration-cake': { must: /red.?velvet/i, reject: /lego|cupcake|minecraft/i },
  'marble-fudge-cake': { must: /marble/i, reject: /lego|cupcake|minecraft/i },
  'coconut-cream-cake': { must: /coconut/i, reject: /lego|cupcake|minecraft|oil/i },
  'lemon-drizzle-loaf': { must: /lemon|citrus/i, reject: /lego|cupcake|minecraft/i },

  'stainless-steel-chafing-dish': { must: /chafing/i, reject: /minecraft|lego/i },
  'kitchenaid-stand-mixer': { must: /mixer|mixing/i, reject: /minecraft|lego|cement/i },
  'insulated-food-transport-carrier': {
    must: /container|cooler|insulat|transport/i,
    reject: /minecraft|lego/i,
  },
  'banquet-serving-trolley': {
    must: /trolley|cart|service/i,
    reject: /tour|tram|street|minecraft|lego/i,
  },
  'commercial-rice-cooker-20l': { must: /rice/i, reject: /minecraft|lego/i },
  'portable-gas-burner-set': { must: /stove|burner|camp/i, reject: /minecraft|lego/i },

  'professional-cake-turntable': { must: /turntable|cake/i, reject: /lego|minecraft|award|tongs/i },
  'stainless-piping-tip-set-24': { must: /pip|decorat|cake/i, reject: /lego|minecraft/i },
  'silicone-cake-mould-bundle': { must: /mould|mold|pan|baking/i, reject: /lego|minecraft/i },
  'edible-gold-leaf-pack': {
    must: /gold|cake/i,
    reject: /statue|buddha|religious|temple|lego|minecraft/i,
  },
  'wooden-rolling-pin-set': { must: /rolling|pin/i, reject: /lego|minecraft|maple.*map/i },

  'chiavari-chair-gold': { must: /chair|chiavari/i, reject: /lego|minecraft|wheel/i },
  'round-banquet-table-6-seater': { must: /table|dining/i, reject: /lego|minecraft/i },
  'elegant-barware-set': { must: /bar|cocktail|glass/i, reject: /lego|minecraft/i },
  'luxe-table-linen-set': { must: /tablecloth|table|linen/i, reject: /lego|minecraft/i },
  'candelabra-centrepiece': { must: /candelabra|candle/i, reject: /flower|plant|lego|minecraft/i },

  'category-cakes': { must: /cake/i, reject: /lego|cupcake|minecraft|octonaut/i },
  'category-catering-equipment': {
    must: /kitchen|equipment|restaurant|oven|stove|commercial/i,
    reject: /lego|minecraft/i,
  },
  'category-baking-supplies': { must: /baking|oven|flour|bread|tray/i, reject: /lego|minecraft/i },
  'category-event-essentials': {
    must: /table|reception|wedding|event|banquet|decor/i,
    reject: /lego|minecraft/i,
  },

  'hero-cake': { must: /cake/i, reject: /lego|cupcake|minecraft|octonaut|cupcake/i },
  'cta-cake': { must: /cake/i, reject: /lego|cupcake|minecraft|octonaut/i },
  'auth-cake': { must: /cak|decor|icing|pastry/i, reject: /lego|cupcake|minecraft|octonaut/i },
};

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Commercial-use licences only; `0` is the most permissive. */
function licenceRank(licence = '') {
  if (licence === 'cc0' || licence === 'pdm') return 0;
  if (licence === 'by') return 1;
  if (licence === 'by-sa') return 2;
  return 9;
}

const plain = (value = '') =>
  String(value)
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** GET with one retry, because 429 is expected on an anonymous client. */
async function getJson(url, attempt = 0) {
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  });

  if (response.status === 429 || response.status >= 500) {
    if (attempt >= 3) throw new Error(`HTTP ${response.status}`);
    await sleep(REQUEST_DELAY_MS * 3 * (attempt + 1));
    return getJson(url, attempt + 1);
  }

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function searchOpenverse(term) {
  const url = new URL(API);
  url.search = new URLSearchParams({
    q: term,
    // `commercial` excludes the non-commercial (NC) licences.
    license_type: 'commercial',
    page_size: '20',
    mature: 'false',
  });

  const json = await getJson(url.toString());
  return (json?.results ?? []).map((result) => ({
    title: plain(result.title) || 'Untitled',
    // Openverse's own thumbnail is a server-side resize: right size for a
    // product card and small enough to keep in the repo.
    url: result.thumbnail ?? result.url,
    licence: String(result.license ?? '').toLowerCase(),
    licenceVersion: result.license_version ?? '',
    author: plain(result.creator) || 'Unknown',
    source: result.foreign_landing_url ?? result.url ?? '',
    provider: result.provider ?? '',
  }));
}

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
/** Commons throttles anonymous clients far harder than Openverse does. */
const COMMONS_DELAY_MS = 4000;

async function searchCommons(term) {
  const url = new URL(COMMONS_API);
  url.search = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${term}`,
    gsrnamespace: '6',
    gsrlimit: '12',
    prop: 'imageinfo',
    iiprop: 'url|mime|extmetadata',
    iiurlwidth: '900',
    format: 'json',
  });

  const response = await getJson(url.toString());
  const pages = Object.values(response?.query?.pages ?? {});
  return pages.map((page) => {
    const info = page.imageinfo?.[0] ?? {};
    const meta = info.extmetadata ?? {};
    // thumb.wikimedia.org is an alias; upload.wikimedia.org is the canonical
    // host and the more reliable of the two. The `?utm_*` tracking suffix the
    // API appends is dropped for consistency with the other provider.
    const url_ = (info.thumburl ?? info.url ?? '')
      .replace('//thumb.wikimedia.org/', '//upload.wikimedia.org/')
      .split('?')[0];

    return {
      title: plain(String(page.title ?? '').replace(/^File:/, '')) || 'Untitled',
      url: url_,
      licence: stripLicenseShortName(meta.LicenseShortName?.value ?? ''),
      licenceVersion: meta.License?.value ?? '',
      author: plain(meta.Artist?.value ?? '') || 'Unknown',
      source: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title ?? '')}`,
      provider: 'wikimedia commons',
      mime: info.mime ?? '',
    };
  });
}

/** Commons reports "CC BY-SA 4.0" style labels; normalise to the Openverse form. */
function stripLicenseShortName(value) {
  const text = plain(value);
  if (/public domain|^pd\b/i.test(text)) return 'pdm';
  if (/^cc0/i.test(text)) return 'cc0';
  if (/cc by-sa/i.test(text)) return 'by-sa';
  if (/cc by/i.test(text)) return 'by';
  return '';
}

const PROVIDERS = { openverse: searchOpenverse, commons: searchCommons };

function pickCandidate(slug, results) {
  const screen = SCREEN[slug];

  return (
    results
      .filter((c) => c.url && licenceRank(c.licence) < 9)
      // Commons reports a MIME type; Openverse pre-filters to images.
      .filter((c) => !c.mime || /^image\/(jpeg|jpg|png)$/i.test(c.mime))
      // Title screens, when this slug defines them.
      .filter((c) => !screen || screen.must.test(c.title))
      .filter((c) => !screen?.reject || !screen.reject.test(c.title))
      .sort((a, b) => licenceRank(a.licence) - licenceRank(b.licence))
  );
}

async function download(url, destination, attempt = 0) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });

  if (response.status === 429 || response.status >= 500) {
    if (attempt >= 3) throw new Error(`download failed (${response.status})`);
    await sleep(10000 * (attempt + 1));
    return download(url, destination, attempt + 1);
  }

  if (!response.ok) throw new Error(`download failed (${response.status})`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 4000) throw new Error('suspiciously small file — skipping');
  await writeFile(destination, bytes);
  return bytes.length;
}

/**
 * `--apply` publishes the images that were actually reviewed: it copies the
 * chosen candidate out of `.image-review-approved/` into the storefront and
 * writes ATTRIBUTIONS.md. It never re-runs a search, so the published files are
 * exactly the ones that were looked at.
 */
const APPLY = process.argv.includes('--apply');
const APPROVED_DIR = join(ROOT, '.image-review-approved');

/** slug -> index of the candidate that was reviewed and approved. */
const APPROVED = {
  // Cakes
  'chocolate-delight-cake': 0,
  'vanilla-dream-cake': 2,
  'red-velvet-celebration-cake': 3,
  'marble-fudge-cake': 0,
  'coconut-cream-cake': 2,
  'lemon-drizzle-loaf': 2,

  // Catering equipment
  'stainless-steel-chafing-dish': 0,
  'kitchenaid-stand-mixer': 1,
  'insulated-food-transport-carrier': 0,
  'banquet-serving-trolley': 0,
  'commercial-rice-cooker-20l': 1,
  'portable-gas-burner-set': 0,

  // Baking supplies
  // `stainless-piping-tip-set-24` is deliberately absent: the only photograph
  // found was a museum piece whose licence could not be verified, and shipping
  // an unattributed image is worse than shipping none. That one card falls back
  // to the branded placeholder in `components/ProductImage.tsx`.
  'professional-cake-turntable': 0,
  'silicone-cake-mould-bundle': 0,
  'edible-gold-leaf-pack': 0,
  'wooden-rolling-pin-set': 0,

  // Event essentials
  'chiavari-chair-gold': 0,
  'round-banquet-table-6-seater': 0,
  'elegant-barware-set': 0,
  'luxe-table-linen-set': 0,
  'candelabra-centrepiece': 0,

  // Category tiles
  'category-cakes': 0,
  'category-catering-equipment': 0,
  'category-baking-supplies': 1,
  'category-event-essentials': 0,

  // Brand imagery
  'hero-cake': 0,
  'cta-cake': 1,
  'auth-cake': 1,
};

/**
 * Credits for files that were fetched directly rather than through a search, so
 * there is no candidate index to look up. `author` is left to the file page
 * where the API did not supply one; the link is the attribution that matters.
 */
const MANUAL_CREDITS = {
  'portable-gas-burner-set': {
    title: 'Utilization of a gas cartridge camping stove',
    author: 'Bjoertvedt',
    licence: 'by-sa',
    licenceVersion: '4.0',
    source:
      'https://commons.wikimedia.org/wiki/File:Utilization_of_A_gas_cartridge_camping_stove.jpg',
  },
  'professional-cake-turntable': {
    title: 'Cake Stand (The Metropolitan Museum of Art)',
    author: 'The Metropolitan Museum of Art',
    licence: 'cc0',
    licenceVersion: '1.0',
    source: 'https://commons.wikimedia.org/wiki/File:Cake_Stand_MET_DP236713.jpg',
  },
  'chiavari-chair-gold': {
    title: 'Chivari Fruitwood Ballroom Chairs',
    author: 'See Wikimedia Commons file page',
    licence: 'by',
    licenceVersion: '3.0',
    source: 'https://commons.wikimedia.org/wiki/File:Chivari_Fruitwood_Ballroom_Chairs.JPG',
  },
  'round-banquet-table-6-seater': {
    title: 'Table setting in a restaurant',
    author: 'See Wikimedia Commons file page',
    licence: 'pdm',
    licenceVersion: '',
    source: 'https://commons.wikimedia.org/wiki/File:Table_setting_in_a_restaurant.JPG',
  },
  'luxe-table-linen-set': {
    title:
      'White tablecloth on restaurant table at Amantaka luxury Resort & Hotel in Luang Prabang Laos',
    author: 'See Wikimedia Commons file page',
    licence: 'by-sa',
    licenceVersion: '4.0',
    source:
      'https://commons.wikimedia.org/wiki/File:White_tablecloth_on_restaurant_table_at_Amantaka_luxury_Resort_%26_Hotel_in_Luang_Prabang_Laos.jpg',
  },
  'candelabra-centrepiece': {
    title: 'Candelabra (The Metropolitan Museum of Art)',
    author: 'The Metropolitan Museum of Art',
    licence: 'cc0',
    licenceVersion: '1.0',
    source: 'https://commons.wikimedia.org/wiki/File:Candelabra_MET_sf127328.jpg',
  },
};

async function applyReviewed() {
  const manifestPath = join(REVIEW_DIR, 'manifest.json');
  const manifest = (await exists(manifestPath))
    ? JSON.parse(await readFile(manifestPath, 'utf8'))
    : [];
  const bySlot = new Map(manifest.map((entry) => [`${entry.slug}:${entry.slot}`, entry]));

  await mkdir(OUT_DIR, { recursive: true });

  const rows = [];
  const missing = [];

  for (const [slug, slot] of Object.entries(APPROVED)) {
    const source = join(APPROVED_DIR, slug, `${slot}.jpg`);
    if (!(await exists(source))) {
      missing.push(slug);
      continue;
    }

    await copyFile(source, join(OUT_DIR, `${slug}.jpg`));

    const credit = MANUAL_CREDITS[slug] ?? bySlot.get(`${slug}:${slot}`);
    if (!credit) {
      missing.push(`${slug} (no credit found)`);
      continue;
    }

    const licence = credit.licenceVersion
      ? `CC ${String(credit.licence).toUpperCase()} ${credit.licenceVersion}`
      : `CC ${String(credit.licence).toUpperCase()}`;

    rows.push(
      `| \`catalog/${slug}.jpg\` | ${credit.title} | ${credit.author} | ${licence} | [source](${credit.source}) |`,
    );
  }

  await writeFile(
    ATTRIBUTIONS,
    [
      '# Image attributions',
      '',
      'Every catalogue photograph ships inside the repository at',
      '`frontend/public/images/catalog/`, so the storefront renders with no',
      'third-party image host. All of them were chosen by downloading candidate',
      'results from [Openverse](https://openverse.org) and',
      '[Wikimedia Commons](https://commons.wikimedia.org), then looking at them:',
      'search alone returned a cement mixer for a stand mixer and a\nsightseeing bus for a serving trolley.',
      '',
      'Only commercially usable CC licences were accepted. Several of these',
      'require attribution, so **keep this file with the project**.',
      '',
      'Regenerate the candidate pool with:',
      '',
      '```bash',
      'node scripts/fetch-catalog-images.mjs --candidates',
      '```',
      '',
      '| File | Work | Author | Licence | Source |',
      '| --- | --- | --- | --- | --- |',
      ...rows,
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Published ${rows.length} reviewed images to frontend/public/images/catalog/`);
  if (missing.length > 0) {
    console.warn(`Missing: ${missing.join(', ')}`);
    process.exitCode = 1;
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const credits = [];
  let downloaded = 0;
  let kept = 0;
  let failed = 0;
  const manifest = [];

  const entries = ONLY ? CATALOG.filter(([slug]) => slug.includes(ONLY)) : CATALOG;

  for (const [index, entry] of entries.entries()) {
    const [slug, term, provider] = entry;
    try {
      const candidates = pickCandidate(slug, await PROVIDERS[provider](term));

      if (CANDIDATES_MODE) {
        const dir = join(REVIEW_DIR, slug);
        await mkdir(dir, { recursive: true });

        const chosen = candidates.slice(0, CANDIDATE_COUNT);
        for (const [slot, candidate] of chosen.entries()) {
          // Downloaded so the pictures can actually be looked at; a title alone
          // cannot tell a mixer from a mixing bowl.
          await download(candidate.url, join(dir, `${slot}.jpg`));
          manifest.push({ slug, slot, ...candidate });
        }

        console.log(`  ~ ${slug}: ${chosen.length} candidates`);
      } else {
        const destination = join(OUT_DIR, `${slug}.jpg`);
        if (!FORCE && (await exists(destination))) {
          kept += 1;
          console.log(`  = ${slug}.jpg (already present)`);
          continue;
        }

        const slot = PINNED[slug] ?? 0;
        const candidate = candidates[slot] ?? candidates[0];
        if (!candidate) throw new Error('no commercially licensed result');

        const size = await download(candidate.url, destination);
        downloaded += 1;
        credits.push({ slug, term, slot, ...candidate, size });
        console.log(`  + ${slug}.jpg (${Math.round(size / 1024)} KB) [${slot}] ${candidate.title}`);
      }
    } catch (error) {
      failed += 1;
      console.warn(`  ! ${slug} — ${error.message}`);
    }

    // Pace every iteration, including failures, so we stay under the limit.
    if (index < entries.length - 1) {
      await sleep(provider === 'commons' ? COMMONS_DELAY_MS : REQUEST_DELAY_MS);
    }
  }

  if (CANDIDATES_MODE) {
    await mkdir(REVIEW_DIR, { recursive: true });
    await writeFile(join(REVIEW_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');
    console.log(`\nReview candidates under .image-review/, then set PINNED.`);
    return;
  }

  if (credits.length > 0) {
    const rows = credits
      .map(
        (c) =>
          `| \`catalog/${c.slug}.jpg\` | ${c.title} | ${c.author} | CC ${c.licence.toUpperCase()} ${c.licenceVersion} | [source](${c.source}) |`,
      )
      .join('\n');

    await writeFile(
      ATTRIBUTIONS,
      [
        '# Image attributions',
        '',
        'Catalogue photography sourced from the [Openverse](https://openverse.org)',
        'aggregator. Only commercially usable CC licences were accepted.',
        '',
        'Keep this file alongside the project: every image is used under the',
        'licence listed, which requires attribution.',
        '',
        '| File | Work | Author | Licence | Source |',
        '| --- | --- | --- | --- | --- |',
        rows,
        '',
        'Re-fetch with `node scripts/fetch-catalog-images.mjs --force`.',
        '',
      ].join('\n'),
      'utf8',
    );
  }

  console.log(`\nDone: ${downloaded} downloaded, ${kept} present, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

const run = APPLY ? applyReviewed : main;

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
