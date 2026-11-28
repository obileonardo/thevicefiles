// The fields of a find that map search (src/components/map/search.ts) and the map's filter (types.ts, passes) read,
// built in one place for the map page (src/pages/map.astro), the home page's example questions (src/lib/ask.ts) and
// their test (scripts/test/ask.test.ts), so a check of what /map lists sees exactly what the map sees.
// Node's test runner loads this file, so it reads content JSON with import attributes and imports nothing that only
// Astro understands (import.meta.glob, plain JSON imports).
import regionsRaw from '../../content/regions.json' with { type: 'json' };
import categoriesRaw from '../../content/categories.json' with { type: 'json' };
import type { Find, Region, Category } from './content';

const regions = regionsRaw as Region[];
const categories = categoriesRaw as Category[];
const regionById = (id: string) => regions.find((r) => r.id === id);

// Category labels in content are plural ("Easter eggs"); one find reads better in the singular.
const singular: Record<string, string> = {
  'easter-egg': 'Easter egg', npc: 'Character', 'secret-location': 'Secret location', 'real-world-reference': 'Real-world reference',
  vehicle: 'Rare vehicle', memorial: 'Memorial', weapon: 'Unique weapon', 'rockstar-crossover': 'Rockstar crossover',
  collectible: 'Collectible', activity: 'Hidden activity', glitch: 'Glitch', paranormal: 'Paranormal',
};
export const categorySingular = (id: string) => singular[id] ?? categories.find((c) => c.id === id)?.label ?? id;

export const regionLabel = (f: Pick<Find, 'region_ids'>) => (f.region_ids[0] ? regionById(f.region_ids[0])?.name ?? f.region_ids[0] : 'Leonida');

// Mature finds outside their own page (owner decision, 27 Nov 2026; LR83). Every list, card, feed, data file and the
// map read the title and summary from here, so no surface prints a mature find's own words. The find's own page keeps
// its title in the heading, the tab and the share title, and its summary in the body only (pageDescription).
/** The gate line that stands in for a mature find's summary (feeds, cards, the map, open data). */
export const MATURE_GATE = 'Mature content: open the find to read it.';

/**
 * The title a find shows anywhere but its own page: "Mature find: <type>" for a mature find, the type being its
 * category's singular label. Use it for visible text and accessible names alike.
 */
export const publicTitle = (f: Pick<Find, 'title' | 'mature' | 'category'>) => (f.mature ? `Mature find: ${categorySingular(f.category)}` : f.title);

/** The summary a find shows anywhere but its own page: the gate line for a mature find. Spoilers are gated separately. */
export const publicSummary = (f: Pick<Find, 'summary' | 'mature'>) => (f.mature ? MATURE_GATE : f.summary);

/** The meta, social and structured-data description of a find's own page: never a mature find's summary. */
export const pageDescription = (f: Pick<Find, 'summary' | 'mature' | 'category' | 'region_ids'>) =>
  f.mature ? `${categorySingular(f.category)} in ${regionLabel(f)}. ${MATURE_GATE}` : f.summary;

/**
 * The sources a find lists anywhere but its own page: none for a mature find, whose source URLs can name the topic
 * (owner decision, 27 Nov 2026; LR84). The field keeps its type (an empty list); the own page lists and credits them.
 */
export const publicSources = <S>(f: { mature: boolean; sources: S[] }): S[] => (f.mature ? [] : f.sources);

/**
 * The first finder a find shows anywhere but its own page: a mature find keeps the person's name and platform, with no
 * link to their post, which can name the topic (owner decision, 28 Nov 2026; LR85). A null url is already how content
 * says a finder has no post, so every reader handles it.
 */
export const publicFinder = <F extends { url: string | null }>(f: { mature: boolean; first_finder: F | null }) =>
  f.first_finder && f.mature ? { ...f.first_finder, url: null } : f.first_finder;

/**
 * The clip a find shows anywhere but its own page: a mature find keeps its platform and creator, with no link to the
 * post (LR85). Its player, thumbnail and still stay on its own page too (src/lib/media.ts mapClip, src/pages/map.astro).
 */
export const publicClip = <C extends { url: string }>(f: { mature: boolean; clip: C | null }) =>
  f.clip && f.mature ? { ...f.clip, url: null } : f.clip;

/** A region and every region it sits in, innermost first. */
export const regionAncestors = (id: string): string[] => {
  const out: string[] = [];
  for (let r = regionById(id); r; r = r.parent ? regionById(r.parent) : undefined) out.push(r.id);
  return out;
};

/** The map's first finder (MapFind.finder): no post link for a mature find (publicFinder). */
export const mapFinder = (f: Find) => {
  const ff = publicFinder(f);
  return ff ? { handle: ff.handle, platform: ff.platform, url: ff.url ?? null } : null;
};

/**
 * What search and the filter read. map.astro spreads this and adds the rest (icon, still, pin, related finds), and
 * replaces `clip` with the player's data (mapClip), whose `creator` is the same value.
 */
export const searchFields = (f: Find) => ({
  slug: f.slug,
  title: publicTitle(f),
  category: f.category,
  categoryLabel: categorySingular(f.category),
  regionIds: [...new Set(f.region_ids.flatMap(regionAncestors))].filter((id) => id !== 'leonida'),
  regionLabel: regionLabel(f),
  verification: f.verification,
  spoiler: f.spoiler,
  mature: f.mature,
  summary: publicSummary(f),
  where: f.location_description ?? null,
  area: f.area ?? null,
  clip: f.clip ? { creator: f.clip.creator ?? null } : null,
  sources: publicSources(f).map((s) => ({ type: s.type, url: s.url, creator: s.creator ?? null })),
  sourceCount: f.sources.length, // the number the map shows, true even when a mature find's sources stay on its page
  finder: mapFinder(f),
  chapterGate: f.chapter_gate ?? null,
});
