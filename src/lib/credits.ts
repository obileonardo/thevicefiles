// The finders credit page (/finders), generated from published content only.
// People: every first finder and every creator whose post (YouTube, X, Reddit, TikTok) a find cites, keyed by the
// source registry id (content/sources.json) so one person is one row. A first finder with no registry entry gets
// a row of their own. Outlets: the press, wikis and official pages finds cite.
// Removing someone is one edit in content (their source entry or first_finder): this page follows on the next build.
import sourcesRaw from '../../content/sources.json';
import { finds, type Find } from './content';
import { platformName } from './finds';

type RegistrySource = { id: string; name: string; handle: string | null; platform: string; role: string; url: string | null; status: string };
const registry = new Map((sourcesRaw as RegistrySource[]).map((s) => [s.id, s]));

export type Post = { find: Find; url: string | null; role: 'first' | 'clip' | 'source' };
export type Person = {
  key: string;
  name: string;
  platform: string;
  profile: string | null;
  firstFinds: number;
  clips: number;
  finds: number;
  posts: Post[];
};

const CREATOR_TYPES = new Set(['youtube', 'x', 'reddit', 'tiktok']);
/** A person's post: a platform post whose registry entry is not an official account (Rockstar's own posts are outlets). */
const isPersonPost = (s: { type: string; source_id?: string }) => CREATOR_TYPES.has(s.type) && registry.get(s.source_id ?? '')?.role !== 'official';
const norm = (h: string) => h.toLowerCase().replace(/^(@|u\/)/, '');

const people = new Map<string, Person>();
const touch = (key: string, init: () => Omit<Person, 'firstFinds' | 'clips' | 'finds' | 'posts'>) => {
  let p = people.get(key);
  if (!p) { p = { ...init(), firstFinds: 0, clips: 0, finds: 0, posts: [] }; people.set(key, p); }
  return p;
};
// Registry ids by normalized handle, so a first finder who is also a cited creator stays one row.
const byHandle = new Map<string, string>();
for (const s of registry.values()) if (s.handle) byHandle.set(norm(s.handle), s.id);

const fromRegistry = (id: string, fallbackName: string, fallbackPlatform: string) => () => {
  const r = registry.get(id);
  return { key: id, name: r?.name ?? fallbackName, platform: platformName(r?.platform ?? fallbackPlatform), profile: r?.url ?? null };
};

for (const f of finds) {
  const seen = new Set<string>();
  const add = (p: Person, post: Post) => {
    p.posts.push(post);
    if (!seen.has(p.key)) { seen.add(p.key); p.finds++; }
  };
  if (f.first_finder) {
    const ff = f.first_finder;
    const id = byHandle.get(norm(ff.handle));
    const p = id ? touch(id, fromRegistry(id, ff.handle, ff.platform)) : touch(`finder:${norm(ff.handle)}`, () => ({ key: `finder:${norm(ff.handle)}`, name: ff.handle, platform: platformName(ff.platform), profile: null }));
    p.firstFinds++;
    // A mature find's posts stay on its own page (LR85): the person is credited and the find links there, no post link.
    add(p, { find: f, url: f.mature ? null : ff.url, role: 'first' });
  }
  for (const s of f.sources) {
    if (!isPersonPost(s) || !s.source_id) continue;
    const reg = registry.get(s.source_id);
    if (reg?.status === 'blocked') continue;
    const p = touch(s.source_id, fromRegistry(s.source_id, s.creator ?? s.source_id, s.type));
    const isClip = f.clip?.url === s.url;
    if (isClip) p.clips++;
    // A mature find's sources and clip stay on its own page (LR84, LR85): the person is credited, no post link shown.
    add(p, { find: f, url: f.mature ? null : s.url, role: isClip ? 'clip' : 'source' });
  }
}

const byContribution = (a: Person, b: Person) => b.finds - a.finds || b.firstFinds - a.firstFinds || b.clips - a.clips || a.name.localeCompare(b.name);

/** Finders and creators, most finds credited first. */
export const finders: Person[] = [...people.values()].sort(byContribution);

export type Outlet = { key: string; name: string; kind: string; url: string | null; finds: number; posts: Post[] };
const outlets = new Map<string, Outlet>();
for (const f of finds) {
  const seen = new Set<string>();
  for (const s of f.sources) {
    if (isPersonPost(s) || !s.source_id) continue;
    const reg = registry.get(s.source_id);
    if (reg?.status === 'blocked') continue;
    let o = outlets.get(s.source_id);
    if (!o) {
      o = { key: s.source_id, name: reg?.name ?? s.creator ?? s.source_id, kind: s.type === 'wiki' ? 'Wiki' : s.type === 'official' || reg?.role === 'official' ? 'Official' : 'Press', url: reg?.url ?? null, finds: 0, posts: [] };
      outlets.set(s.source_id, o);
    }
    o.posts.push({ find: f, url: f.mature ? null : s.url, role: 'source' });
    if (!seen.has(o.key)) { seen.add(o.key); o.finds++; }
  }
}
/** Outlets, wikis and official pages, most finds cited first. */
export const outletCredits: Outlet[] = [...outlets.values()].sort((a, b) => b.finds - a.finds || a.name.localeCompare(b.name));

export const creditTotals = {
  people: finders.length,
  firstFinders: finders.filter((p) => p.firstFinds > 0).length,
  clipMakers: finders.filter((p) => p.clips > 0).length,
  outlets: outletCredits.length,
};
