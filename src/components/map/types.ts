// Data the map island receives from src/pages/map.astro, and the pure helpers that filter it.
// Kept free of content imports so the island bundle carries only what the map needs.
import type { IconName } from '../ui/icons';
import { matchesSearch } from './search.ts';
import { isUnlocked, type ChapterSetting } from '../../lib/chapter.ts';
import type { ClipVerb } from '../../lib/clip';

export type MapFind = {
  slug: string;
  title: string;
  category: string;
  categoryLabel: string; // singular, for one find
  icon: IconName;
  regionIds: string[]; // the find's regions and every region above them, for the region filter
  regionLabel: string;
  verification: string;
  spoiler: boolean;
  chapterGate: string | null; // "Chapter 3": a spoiler opens by itself once the visitor's chapter setting reaches it
  mature: boolean;
  pin: { x: number; y: number } | null;
  pinAccuracy: string | null;
  summary: string;
  where: string | null;
  area: string | null; // the find's area text, for search
  still: string | null; // the clip still of the creator's own post: YouTube (never a Short), X or Reddit; null for a mature find
  // thumb: the drawer's picture; embed: the player to load on tap (null: link to the post); verb: play, view (an X or
  // Reddit photo post, shown and linked) or read (a text post) for its labels (src/lib/media.ts mapClip).
  // A mature find's clip has no url, thumb or embed here (LR85): it plays on the find page, which the drawer links to.
  clip: { platform: string; url: string | null; creator: string | null; yt: string | null; thumb: string | null; embed: string | null; verb: ClipVerb } | null;
  sources: { type: string; url: string; creator: string | null }[]; // empty for a mature find (LR84): its page lists them
  sourceCount: number; // how many sources the find page lists
  finder: { handle: string; platform: string; url: string | null } | null; // no url for a mature find (LR85)
  updated: string | null;
  added: string | null; // for the Newest sort
  connections: number; // GTAverse connections it belongs to (the detail panel's numbers)
  games: number; // other games it crosses over with
  related: string[]; // finds that share a connection with it (the selected pin's connection lines)
};

export type MapCategory = { id: string; label: string; icon: IconName; count: number };
/** A collectible transcribed from another map (content/collectibles.json). Off the map until its layer is turned on. */
export type MapCollectible = { id: string; layer: string; number: number | null; x: number; y: number; label: string; note: string | null; url: string };
/** A collectible layer: `count` items here, `marked` of `total` on the source map. */
export type MapLayer = { id: string; label: string; count: number; marked: number; total: number; source: string; url: string };
export type MapRegion = { id: string; name: string };
export type MapMeta = { width: number; height: number; maxZoom: number; tileSize?: number; tileUrl: string; base?: string; attribution: string; frame: { x0: number; y0: number; x1: number; y1: number }; rows: { id: string; y0: number; y1: number }[]; columns: { id: string; x0: number; x1: number }[] };

export type Filters = {
  categories: string[];
  region: string; // 'all' or a region id
  verification: string; // 'all' or a verification level
  hasClip: boolean;
  spoilers: boolean;
  mature: boolean;
  hideFound: boolean; // found tracker (found.ts): hide what this visitor has found
};

export const defaultFilters: Filters = { categories: [], region: 'all', verification: 'all', hasClip: false, spoilers: false, mature: false, hideFound: false };

const STORE = 'vf-map-filters';
export const loadFilters = (): Filters => {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return defaultFilters;
    const v = JSON.parse(raw);
    return {
      categories: Array.isArray(v.categories) ? v.categories.filter((c: unknown) => typeof c === 'string') : [],
      region: typeof v.region === 'string' ? v.region : 'all',
      verification: typeof v.verification === 'string' ? v.verification : 'all',
      hasClip: v.hasClip === true,
      spoilers: v.spoilers === true,
      mature: v.mature === true,
      hideFound: v.hideFound === true,
    };
  } catch {
    return defaultFilters; // private mode or blocked storage: the defaults apply for this visit
  }
};
export const saveFilters = (f: Filters) => {
  try { localStorage.setItem(STORE, JSON.stringify(f)); } catch { /* storage blocked: the choice lasts for this page only */ }
};

type Skip = keyof Filters | 'search' | null;
const NONE = new Set<string>();
/** Does a find pass the filters? `skip` leaves one group out, for counts beside that group's options. `found` is the found set. */
export const passes = (f: MapFind, flt: Filters, search: string, skip: Skip = null, found: Set<string> = NONE, chapter: ChapterSetting = 'none') => {
  if (skip !== 'categories' && flt.categories.length && !flt.categories.includes(f.category)) return false;
  if (skip !== 'region' && flt.region !== 'all' && !f.regionIds.includes(flt.region)) return false;
  if (skip !== 'verification' && flt.verification !== 'all' && f.verification !== flt.verification) return false;
  if (skip !== 'hasClip' && flt.hasClip && !f.clip) return false;
  // Spoilers show when the visitor asked for them, or when their chapter setting has reached the find's chapter
  // (src/lib/chapter.ts). Mature content is never opened by the chapter setting.
  if (skip !== 'spoilers' && !flt.spoilers && f.spoiler && !isUnlocked(f.chapterGate, chapter)) return false;
  if (skip !== 'mature' && !flt.mature && f.mature) return false;
  if (skip !== 'hideFound' && flt.hideFound && found.has(f.slug)) return false;
  if (skip !== 'search' && search && !matchesSearch(f, search)) return false; // search.ts: words, our synonyms, finders
  return true;
};

export const activeFilterCount = (flt: Filters) =>
  flt.categories.length + (flt.region !== 'all' ? 1 : 0) + (flt.verification !== 'all' ? 1 : 0) + (flt.hasClip ? 1 : 0) + (flt.spoilers ? 1 : 0) + (flt.mature ? 1 : 0) + (flt.hideFound ? 1 : 0);

export const verificationLabels: Record<string, string> = {
  'multi-source': 'Multi-source',
  'single-source': 'Single source',
  rumor: 'Rumour',
  debunked: 'Debunked',
};

export const sourceIcon = (type: string): IconName =>
  type === 'youtube' || type === 'video' ? 'clip' : type === 'wiki' ? 'explainers' : type === 'article' || type === 'news' ? 'article' : 'chat';

export const platformLabel = (p: string) => ({ youtube: 'YouTube', x: 'X', reddit: 'Reddit', tiktok: 'TikTok', twitch: 'Twitch', discord: 'Discord', instagram: 'Instagram' }[p] ?? p.charAt(0).toUpperCase() + p.slice(1));

/** Art (a clip still) shows for a find unless it is mature, or a spoiler the visitor has not opened. */
export const showArt = (f: MapFind, chapter: ChapterSetting = 'none') => !!f.still && !f.mature && (!f.spoiler || isUnlocked(f.chapterGate, chapter));

export const findUrl = (slug: string) => `/finds/${slug}`;

// One formatter for every date, made once: building it loads the locale data, which took 32 ms at 4x CPU throttling
// when the first find opened (toLocaleDateString builds a new one on every call). warmDates() makes it while idle.
let dates: Intl.DateTimeFormat | null = null;
export const warmDates = () => (dates ??= new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }));

export const formatDate = (iso: string | null) => {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return warmDates().format(d);
};

/** The printed grid cell (row letter, column number) a pin sits in, for example F5. */
export const cellOf = (pin: { x: number; y: number } | null, meta: MapMeta) => {
  if (!pin) return null;
  const r = meta.rows.find((row) => pin.y >= row.y0 && pin.y < row.y1);
  const c = meta.columns.find((col) => pin.x >= col.x0 && pin.x < col.x1);
  return r && c ? `${r.id}${c.id}` : null;
};

export const accuracyLabels: Record<string, string> = { exact: 'Exact spot', landmark: 'At a landmark', area: 'Area only' };
