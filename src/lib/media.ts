// Stills for finds. The only art we show is the creator's own post, served by its platform (decision 8: embed,
// never re-host): the YouTube thumbnail, or the poster or first photo of an X or Reddit post, read from the cache
// that `pnpm clips:resolve` writes. Shorts are skipped: their thumbnails are portrait and crop badly.
// A find without a still falls back to the sunrise glow (--glow-hero) in the components.
import { categoryById, type Find } from './content';
import { categorySingular } from './map-fields';
import { clipKey, clipStill, clipEmbed, clipVerb, clipLabels, youtubeId, ytThumb, type ClipMedia, type ClipRef, type Still } from './clip';
import type { IconName } from '../components/ui/icons';

export type { Still };

// The resolved X and Reddit posts. Optional: without the file (or for a clip it does not list yet) the clip keeps
// the link to the post, as before. The glob returns nothing when the file is missing instead of failing the build.
const cacheFile = Object.values(import.meta.glob<{ default: { clips?: Record<string, ClipMedia> } }>('../../content/generated/clip-media.json', { eager: true }))[0];
const clipCache: Record<string, ClipMedia> = cacheFile?.default?.clips ?? {};

/** The cached post behind a clip (X and Reddit only), or null. */
export const clipMediaOf = (clip: ClipRef | null | undefined): ClipMedia | null => {
  const key = clip ? clipKey(clip) : null;
  return key ? clipCache[key] ?? null : null;
};
export const clipMedia = (f: Find) => clipMediaOf(f.clip);

/** The still of a find's clip, or null. Every surface that shows clip art reads it from here. */
export const findStill = (f: Find): Still | null => clipStill(f.clip, clipMedia(f));

/** The labels for a find's clip ("Play clip", "View photo", "Read the post"; src/lib/clip.ts clipLabels). */
export const findClipLabels = (f: Find) => clipLabels(f.clip ? clipVerb(f.clip, clipMedia(f)) : 'play');

/** The player URL of a find's clip (dark theme; the client swaps the theme on tap), or null when it has none. */
export const findEmbed = (f: Find) => (f.clip ? clipEmbed(f.clip, clipMedia(f)) : null);

/**
 * A find's clip as the map's island needs it (MapFind.clip): the thumbnail for the drawer (YouTube's even for a
 * Short, as Clip.astro shows it), the player to load on tap, and its verb (play, view a photo, read a post).
 * A mature find's clip plays on its own page only (owner decision, 28 Nov 2026; LR85): the map gets its platform,
 * creator and verb, and no post link, player, thumbnail or video id, since a post's URL or still can name the topic.
 */
export const mapClip = (f: Find) => {
  if (!f.clip) return null;
  const media = clipMediaOf(f.clip);
  if (f.mature) return { platform: f.clip.platform, url: null, creator: f.clip.creator ?? null, yt: null, thumb: null, embed: null, verb: clipVerb(f.clip, media) };
  const yt = f.clip.platform === 'youtube' ? youtubeId(f.clip.url) : null;
  return {
    platform: f.clip.platform,
    url: f.clip.url,
    creator: f.clip.creator ?? null,
    yt,
    thumb: yt ? ytThumb(yt) : clipStill(f.clip, media)?.thumb ?? null,
    embed: clipEmbed(f.clip, media),
    verb: clipVerb(f.clip, media),
  };
};

/** Finds that are safe to show as art on open pages: no spoiler, no mature flag, a still to show. */
export const showcaseable = (f: Find) => !f.spoiler && !f.mature && findStill(f) !== null;

// The singular category label and the region label live with the map's search fields (map-fields.ts), so the map,
// the home page's example questions and their test read one implementation.
export { categorySingular, regionLabel, publicTitle, publicSummary, publicSources, publicFinder, publicClip, mapFinder, pageDescription, MATURE_GATE } from './map-fields';
export const categoryLabel = (f: Find) => categorySingular(f.category);

// Category glyphs (src/components/ui/icons.ts) and short plural chip labels for the map's chip row.
export const categoryIcons: Record<string, IconName> = {
  'easter-egg': 'egg', npc: 'person', 'secret-location': 'keyhole', 'real-world-reference': 'globe', vehicle: 'car',
  memorial: 'candle', weapon: 'crosshair', 'rockstar-crossover': 'star', collectible: 'gem', activity: 'flag',
  glitch: 'bolt', paranormal: 'ghost',
};
export const categoryIcon = (id: string): IconName => categoryIcons[id] ?? 'pin';
const chips: Record<string, string> = {
  'easter-egg': 'Easter eggs', npc: 'Characters', 'secret-location': 'Secret spots', 'real-world-reference': 'Real world',
  vehicle: 'Vehicles', memorial: 'Memorials', weapon: 'Weapons', 'rockstar-crossover': 'Crossovers', collectible: 'Collectibles',
  activity: 'Activities', glitch: 'Glitches', paranormal: 'Paranormal',
};
export const categoryChipLabel = (id: string) => chips[id] ?? categoryById(id)?.label ?? id;
