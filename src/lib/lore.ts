// The lore timeline. Every Rockstar connection is one moment, placed at the release year of the earliest game it
// appears in (release years are public facts, listed here once). Moments in the same year keep content order.
import { connections, findBySlug, type Connection, type Find } from './content';
import { findStill, showcaseable } from './media';

export const releaseYear: Record<string, number> = {
  GTA: 1997,
  'GTA 2': 1999,
  'GTA III': 2001,
  'GTA Vice City': 2002,
  Manhunt: 2003,
  'GTA San Andreas': 2004,
  'GTA Liberty City Stories': 2005,
  'The Warriors': 2005,
  'GTA Vice City Stories': 2006,
  Bully: 2006,
  'GTA IV': 2008,
  'GTA IV: The Lost and Damned': 2009,
  'GTA IV: The Ballad of Gay Tony': 2009,
  'GTA Chinatown Wars': 2009,
  'Red Dead Redemption': 2010,
  'Red Dead Redemption: Undead Nightmare': 2010,
  'L.A. Noire': 2011,
  'Max Payne 3': 2012,
  'GTA V': 2013,
  'GTA Online': 2013,
  'Red Dead Redemption 2': 2018,
  'GTA III - The Definitive Edition': 2021,
  'GTA VI': 2026,
};

export const confidenceLabel: Record<string, string> = { canon: 'Canon', strong: 'Strong', speculative: 'Speculative', debunked: 'Debunked' };
export const typeLabel: Record<string, string> = {
  'real-world': 'Real world', location: 'Place', character: 'Character', brand: 'Brand', theory: 'Theory',
  mystery: 'Mystery', memorial: 'Memorial', prediction: 'Prediction',
};

export type Moment = {
  index: number;
  slug: string;
  title: string;
  summary: string;
  year: number;
  firstGame: string;
  games: string[];
  type: string;
  confidence: string;
  sources: Connection['sources'];
  finds: Find[];
  /** The clip shown in the polaroid: the first related find with a clip that is not mature (its clip stays on its page, LR85). */
  clipFind: Find | null;
  still: string | null;
};

const firstGame = (c: Connection) =>
  [...c.games].sort((a, b) => (releaseYear[a] ?? 9999) - (releaseYear[b] ?? 9999))[0] ?? 'GTA VI';

export const moments: Moment[] = connections
  .map((c, order) => {
    const game = firstGame(c);
    const related = (c.related_finds ?? []).map((id) => findBySlug(id)).filter((f): f is Find => !!f);
    const clipFind = related.find((f) => f.clip && !f.mature) ?? null;
    return {
      order,
      slug: c.slug,
      title: c.title,
      summary: c.summary,
      year: releaseYear[game] ?? 2026,
      firstGame: game,
      games: [...c.games].sort((a, b) => (releaseYear[a] ?? 9999) - (releaseYear[b] ?? 9999)),
      type: c.type,
      confidence: c.confidence,
      sources: c.sources,
      finds: related,
      clipFind,
      still: clipFind && showcaseable(clipFind) ? findStill(clipFind)?.src ?? null : null,
    };
  })
  .sort((a, b) => a.year - b.year || a.order - b.order)
  .map(({ order: _o, ...m }, index) => ({ ...m, index }));

export const years = (() => {
  const first = moments[0]?.year ?? 1997;
  const last = moments[moments.length - 1]?.year ?? 2026;
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
})();

/** Desktop track geometry (Grok label spacing 185px a year, widened where a year holds many moments). */
export const trackLayout = (yearWidth = 185, momentGap = 28, pad = 24) => {
  let x = 0;
  const yearX: Record<number, number> = {};
  const momentX: number[] = [];
  for (const y of years) {
    const inYear = moments.filter((m) => m.year === y);
    const w = Math.max(yearWidth, inYear.length * momentGap + pad * 2);
    yearX[y] = x;
    inYear.forEach((m, i) => { momentX[m.index] = x + pad + (i + 0.5) * ((w - pad * 2) / inYear.length); });
    x += w;
  }
  return { width: x, yearX, momentX };
};
