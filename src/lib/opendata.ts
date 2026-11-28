// Open data downloads (/data): finds, connections and collectibles as static JSON built from content at build time.
// Published records only. Every file opens with a header object: licence, attribution, how to cite, what is not
// licensed, and the content date it was built from. Every record keeps its credits (sources, finders, creators,
// Game Checklists for collectibles). Decision GS10. A mature find keeps every field, but its title reads
// "Mature find: <type>", its summary is the gate line (LR83), its sources are an empty list (LR84) and its clip and
// first finder keep the creator's name with a null url (LR85): its own words and its links stay on its own page.
import findsRaw from '../../content/finds.json';
import connectionsRaw from '../../content/connections.json';
import collectiblesRaw from '../../content/collectibles.json';
import { finds, connections, type Find } from './content';
import { gamesOf } from './games';
import { publicTitle, publicSummary, publicSources, publicFinder, publicClip } from './map-fields';

const SITE = 'https://thevicefiles.com';
const published = new Set(finds.map((f) => f.id));
const latest = (...dates: (string | undefined | null)[]) => dates.filter(Boolean).sort().at(-1) ?? null;

export const LICENCE = {
  licence: 'CC BY-NC 4.0',
  licence_url: 'https://creativecommons.org/licenses/by-nc/4.0/',
  attribution: 'The Vice Files contributors',
  how_to_cite: 'The Vice Files contributors, The Vice Files (thevicefiles.com), CC BY-NC 4.0.',
  not_licensed: 'Game names, images, logos and trademarks belong to Rockstar Games and Take-Two Interactive and are not licensed by this file. Clips and posts belong to their creators; credit them as each record does.',
  repository: 'https://github.com/obileonardo/thevicefiles',
  about: `${SITE}/data`,
};

const findRecord = (f: Find) => {
  const raw = (findsRaw as (Find & { notes?: unknown; pin_basis?: unknown; pin_accuracy?: unknown })[]).find((x) => x.id === f.id)!;
  return {
    id: f.id,
    url: `${SITE}/finds/${f.slug}`,
    title: publicTitle(f),
    category: f.category,
    verification: f.verification,
    spoiler: f.spoiler,
    mature: f.mature,
    chapter_gate: f.chapter_gate,
    area: f.area ?? null,
    region_ids: f.region_ids,
    location_description: f.location_description ?? null,
    pin: f.pin,
    pin_accuracy: raw.pin_accuracy ?? null,
    summary: publicSummary(f),
    crossover_games: f.crossover_games ?? [],
    game_ids: gamesOf(f.crossover_games ?? []).map((g) => g.id),
    related_connections: f.related_connections ?? [],
    first_finder: publicFinder(f),
    clip: publicClip(f),
    sources: publicSources(f),
    updated_at: f.updated_at ?? null,
  };
};

// Guard: the download never carries a draft or a rumour, whatever content/finds.json holds.
if (finds.some((f) => f.status !== 'published' || f.verification === 'rumor')) throw new Error('opendata: a draft or rumour find reached the finds download');

export const findsFile = () => ({
  ...LICENCE,
  title: 'The Vice Files: GTA VI finds',
  description: 'Published finds: secrets, easter eggs and references in GTA VI, each with its sources and the creator who found or filmed it. A mature find lists its sources, and links its clip and first finder, on its own page only (their url is null here). Drafts and rumours are not included.',
  content_date: latest(...finds.map((f) => f.updated_at)),
  count: finds.length,
  items: finds.map(findRecord),
});

export const connectionsFile = () => {
  const doc = connectionsRaw as { updated_at: string; confidence_notes: Record<string, string> };
  return {
    ...LICENCE,
    title: 'The Vice Files: GTAverse connections',
    description: 'Links between GTA VI and the wider Rockstar universe, each with a confidence level and its sources.',
    content_date: doc.updated_at,
    confidence_notes: doc.confidence_notes,
    count: connections.length,
    items: connections.map((c) => ({
      id: c.id,
      url: `${SITE}/gtaverse/${c.slug}`,
      title: c.title,
      type: c.type,
      confidence: c.confidence,
      games: c.games,
      game_ids: gamesOf(c.games).map((g) => g.id),
      summary: c.summary,
      related_finds: (c.related_finds ?? []).filter((id) => published.has(id)),
      sources: c.sources,
    })),
  };
};

export const collectiblesFile = () => {
  const doc = collectiblesRaw as unknown as { about: string; transcribed: string; method: string; layers: Record<string, unknown>[]; items: { id: string; layer: string; number: number | null; pin: { x: number; y: number }; pin_accuracy: string; label: string; source: { name: string; url: string; via?: string }; verification: string; notes: string | null }[] };
  return {
    ...LICENCE,
    title: 'The Vice Files: GTA VI collectible locations',
    description: 'Collectible locations transcribed from the Game Checklists collectible maps. The locations are their work: credit Game Checklists with every use.',
    credit: 'Collectible locations: Game Checklists. Transcribed by The Vice Files contributors.',
    credit_source: doc.items[0]?.source?.via ?? doc.items[0]?.source?.url ?? null,
    content_date: doc.transcribed,
    about_source: doc.about,
    method: doc.method,
    coordinates: 'Pixels of the official Leonida map image (5,775 x 7,900, origin top left). The map image itself is Rockstar Games copyright and is not included.',
    layers: doc.layers.map((l) => ({ layer: l.layer, marked: l.marked, total: l.total, transcribed: l.transcribed, numbers_unreadable: l.numbers_unreadable, source_image: l.source_image })),
    count: doc.items.length,
    items: doc.items.map((i) => ({ id: i.id, layer: i.layer, number: i.number, label: i.label, pin: i.pin, pin_accuracy: i.pin_accuracy, verification: i.verification, notes: i.notes, source: i.source })),
  };
};

export const json = (data: unknown) =>
  new Response(JSON.stringify(data, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
