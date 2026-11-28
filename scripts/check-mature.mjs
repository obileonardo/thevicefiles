// Checks the built site (dist/) for mature finds' own words and links outside their own page (owner decisions,
// 27 and 28 Nov 2026; LR83, LR84, LR85). Run after pnpm build (the build runs it): node scripts/check-mature.mjs
// - a mature find's title appears only on its own page, and there only in the <title>, the og:title, twitter:title
//   and og:image:alt tags (the share title), the <h1> (the heading), the "name" fields of its JSON-LD and the clip's
//   own label ("Play clip: <title>", "View the photo on <platform>: <title>")
// - a mature find's summary appears only in the body of its own page: never in its <head> (meta description, Open
//   Graph and Twitter descriptions, JSON-LD) and never in any other built file (pages, feeds, data, scripts)
// - a mature find's source URLs, clip URL and first finder URL appear only on its own page; the clip also by its post
//   id (in a player or thumbnail URL) and by its cached still (content/generated/clip-media.json)
// Every text file is read with entities, JSON, JavaScript and percent escapes decoded, soft hyphens and zero-width
// characters removed and inline tags (em, span, a...) dropped, then compared word by word, case and punctuation
// aside, so "sex-robot" matches "sex robot", "&#39;" matches "'" and "Killer <em>sex</em>" matches "Killer sex". The
// title is also matched with every tag read as a space, so a title split by <br>, <div> or <label> is caught too.
// What other content holds is no alarm: the shared set is content/ with every mature find left out (and the generated
// clip cache, which copies every find's clips). A summary leaks when a run of five of its words that the shared set
// does not hold shows; a summary with no such run cannot be guarded. A URL the shared set cites (a wiki page many finds
// share) is not checked. A title the shared set holds cannot be guarded either: the other entry shows it wherever it
// stands, so the check names that entry and asks for a rename or a decision instead of listing every page.
// Another mature find's own page may hold what that find shares with this one (a summary phrase, a source URL).
// Slugs (URLs, data-found) are out of scope: a slug never holds the title's first word here, so it never matches.
// Exit code 1 on any leak or anything that cannot be guarded. The test (scripts/test/mature.test.ts) runs findLeaks on
// made-up pages and on dist.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clipKey } from '../src/lib/clip.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BINARY = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.otf', '.mp4', '.webm', '.pdf', '.br', '.gz']);
const RUN = 5;

const entities = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', shy: '\u00ad', zwsp: '', zwnj: '', zwj: '', lsquo: "'", rsquo: "'",
  ldquo: '"', rdquo: '"', ndash: '-', mdash: '-', hellip: '...', hyphen: '-', dash: '-', sbquo: "'", bdquo: '"',
};
/** Inline elements: a tag of one of these inside a text run joins the words either side, as the page shows them. */
const INLINE = /<\/?(?:a|abbr|b|bdi|bdo|cite|code|data|del|dfn|em|font|i|ins|kbd|mark|q|s|samp|small|span|strong|sub|sup|time|u|var|wbr)(?:\s[^<>]*)?\/?>/gi;
/** Soft hyphen, zero-width and other invisible characters a word can hide behind. */
const INVISIBLE = /[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u200b-\u200f\u202a-\u202e\u2060-\u2064\u206a-\u206f\ufeff]/g;
const code = (n) => { try { return String.fromCodePoint(n); } catch { return ''; } };
const decode = (s) => s
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => code(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => code(Number(d)))
  .replace(/&([a-zA-Z]+);/g, (m, n) => entities[n.toLowerCase()] ?? m)
  .replace(/%([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

/** Text with escapes decoded (\uXXXX, \u{X}, \xXX, \/, HTML entities and percent escapes, twice, so a double-encoded
 * copy reads too) and invisible characters removed; case and markup kept. */
export const plain = (s) => decode(decode(s
  .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, h) => code(parseInt(h, 16)))
  .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/\\x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  .replace(/\\\//g, '/'))).replace(INVISIBLE, '');

const TAG = /<\/?[a-z][a-z0-9-]*(?:\s[^<>]*)?\/?>/gi;

/**
 * Lower case words only, from plain(): inline tags dropped from the text (their attributes read apart), every run of
 * other characters one space. Any other tag edge ("<" or ">") becomes a word no text holds, so words either side of a
 * block tag never read as one run ("kill you</li><li>Next"). With `{ loose: true }` every tag reads as a space
 * instead, so words either side of <br>, </div><div> or </label><label> do read as one run (used for titles only).
 */
export const words = (s, { loose = false } = {}) => {
  // A tag leaves the text; its attributes (href, aria-label...) are still read, each set on its own at the end.
  const attrs = [];
  const t = plain(s).replace(loose ? TAG : INLINE, (m) => {
    const a = m.replace(/^<\/?[a-z][a-z0-9-]*/i, '').replace(/\/?>$/, '');
    if (a.trim()) attrs.push(` < ${a} > `);
    return loose ? ' ' : '';
  });
  return ` ${(t + attrs.join(''))
    .replace(/[<>]/g, ' qqtagqq ')
    .replace(/[\u2018\u2019\u02bc]/g, "'")
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `;
};

/** Every run of RUN words of a summary (the whole summary when it is shorter). */
const runs = (summary) => {
  const w = words(summary).trim().split(' ');
  if (w.length <= RUN) return [` ${w.join(' ')} `];
  return Array.from({ length: w.length - RUN + 1 }, (_, i) => ` ${w.slice(i, i + RUN).join(' ')} `);
};

/** A URL as words, scheme and "www." left out, so an escaped or encoded copy still matches. */
const urlWords = (url) => words(url.replace(/^[a-z]+:\/\//i, '').replace(/^www\./i, ''));

/**
 * A find's own page, with the places its title may stand cut out: the share and tab tags, the heading, the JSON-LD
 * names and the clip's own label. The JSON-LD names are cut only inside JSON-LD, and a label only when it holds
 * exactly the title.
 */
const withoutAllowedTitle = (html, title) => {
  const t = words(title);
  return html
    .replace(/<title>[\s\S]*?<\/title>/, '')
    .replace(/<meta (?:property|name)="(?:og:title|twitter:title|og:image:alt)" content="[^"]*">/g, '')
    .replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/, '')
    .replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g, (_, a, json, b) =>
      a + json.replace(/"name":"((?:[^"\\]|\\.)*)"/g, (m, v) => (words(v) === t ? '' : m)) + b)
    .replace(/aria-label="(?:Play clip|View the photo on [^":]+): ([^"]*)"/g, (m, v) => (words(v) === t ? '' : m));
};

/** The post id in a clip URL (YouTube video, X status or Reddit post id; src/lib/clip.ts clipKey), or null. */
const clipId = (clip) => clipKey(clip)?.split(':')[1] ?? null;

/**
 * What a mature find links to, in groups that are checked or skipped together: each source URL, the first finder URL,
 * and the clip (its URL, its post id and its cached still). `media` is the clip cache (readClipMedia).
 */
const linksOf = (f, media = {}) => {
  const out = [];
  for (const s of f.sources ?? []) if (s.url) out.push({ what: 'source URL', urls: [s.url], id: null });
  if (f.clip?.url) {
    const key = clipKey(f.clip);
    const thumb = key ? media[key]?.thumb : null;
    out.push({ what: 'clip URL', urls: [f.clip.url, thumb].filter(Boolean), id: clipId(f.clip) });
  }
  if (f.first_finder?.url) out.push({ what: 'first finder URL', urls: [f.first_finder.url], id: null });
  // A post id is matched in the plain text as a whole token: case kept for YouTube's, whose case is part of the id.
  return out.map((l) => ({ ...l, words: l.urls.map(urlWords).filter((u) => u.trim()), idRe: l.id ? new RegExp(`(?<![\\w-])${l.id}(?![\\w-])`, f.clip.platform === 'youtube' ? '' : 'i') : null }));
};

/** Whether a link group shows in a file's words (w) or plain text (p). */
const shows = (l, w, p) => l.words.some((u) => w.includes(u)) || (l.idRe ? l.idRe.test(p) : false);

/**
 * The findings in a set of built files. `files` is [{ path, text }] with paths relative to dist; `finds` the mature
 * finds as { slug, title, summary, sources?, clip?, first_finder? }. `common(find)` returns, as words(), the text the
 * site's content holds besides every mature find (commonText); a summary run or link found there is not checked, and a
 * title found there cannot be guarded. It may carry `common.plain` (the same text from plain(), for post ids) and
 * `common.where(words)` (which content entries hold them). Without it everything is checked. `media` is the clip cache.
 * Returns [{ path, slug, what, kind }], kind "leak" or "unguardable".
 */
export function findLeaks(files, finds, { common = () => ' ', media = {} } = {}) {
  const out = [];
  const leak = (path, slug, what) => out.push({ path, slug, what, kind: 'leak' });
  const cannot = (path, slug, what) => out.push({ path, slug, what, kind: 'unguardable' });
  const read = files.map(({ path, text }) => {
    let w, l, p;
    return { path, text, get w() { return (w ??= words(text)); }, get l() { return (l ??= words(text, { loose: true })); }, get p() { return (p ??= plain(text)); } };
  });
  // Every mature find's own page, so what it shares with another mature find is no alarm there (N1 of #116's review).
  const ownPage = new Map();
  for (const f of finds) for (const path of [`finds/${f.slug}.html`, `finds/${f.slug}/index.html`]) ownPage.set(path, f);
  // A mature find's own page as { w, l, p } with what that find may show there cut: its title's allowed spots, its
  // summary and its links (source, clip and first finder URLs and its post id).
  const allowedOn = new Map();
  const allowed = (file, g) => {
    if (!allowedOn.has(file.path)) {
      const cut = withoutAllowedTitle(file.text, g.title);
      const drop = [words(g.summary).trimEnd(), ...linksOf(g, media).flatMap((x) => x.words.map((u) => u.trimEnd()))].filter((d) => d.trim());
      const strip = (t) => drop.reduce((acc, d) => acc.split(d).join(' '), t);
      const ids = linksOf(g, media).filter((x) => x.idRe);
      allowedOn.set(file.path, { w: strip(words(cut)), l: strip(words(cut, { loose: true })), p: ids.reduce((acc, x) => acc.replace(new RegExp(x.idRe.source, `${x.idRe.flags}g`), ' '), plain(cut)) });
    }
    return allowedOn.get(file.path);
  };
  for (const f of finds) {
    const title = words(f.title);
    const shared = common(f);
    const sharedPlain = common.plain ?? '';
    const all = runs(f.summary);
    const summary = all.filter((r) => !shared.includes(r));
    if (!summary.length) cannot('content/finds.json', f.slug, 'summary has no five-word run of its own, so it cannot be guarded: reword it');
    // A title other content holds shows wherever that entry shows (N2 of #116's review): one clear finding, no page list.
    const titleShared = shared.includes(title);
    if (titleShared) {
      const holders = common.where?.(title) ?? [];
      cannot(holders[0] ?? 'content/', f.slug, `title "${f.title}" is also the text of ${holders.length ? holders.join(', ') : 'other content'}, so it shows wherever that shows and cannot be hidden: rename the find or that entry, or unmark the find mature`);
    }
    const links = linksOf(f, media).filter((l) => !l.words.some((u) => shared.includes(u)) && !(l.idRe && l.idRe.test(sharedPlain)));
    const own = new Set([`finds/${f.slug}.html`, `finds/${f.slug}/index.html`]);
    for (const file of read) {
      const { path, text } = file;
      if (own.has(path)) {
        const head = text.split(/<\/head>/i)[0];
        // The summary may hold the title ("The rideshare app logo is ..."), and so may a link's slug (a Reddit post's
        // title): the body's summary and the find's own links are allowed here, so they are cut too.
        const t = allowed(file, f);
        if (!titleShared && (t.w.includes(title) || t.l.includes(title))) leak(path, f.slug, 'title outside the heading, tab, share title and clip label');
        const h = words(head);
        if (summary.some((r) => h.includes(r))) leak(path, f.slug, 'summary in the page head (meta, social or JSON-LD)');
        continue;
      }
      const other = ownPage.get(path);
      const t = other ? allowed(file, other) : file;
      if (!titleShared && (t.w.includes(title) || t.l.includes(title))) leak(path, f.slug, 'title');
      if (summary.some((r) => t.w.includes(r))) leak(path, f.slug, 'summary');
      for (const what of new Set(links.filter((l) => shows(l, t.w, t.p)).map((l) => l.what))) leak(path, f.slug, what);
    }
  }
  return out;
}

/**
 * The site's content as words, for findLeaks' `common`: every text file in content/ with every mature find left out of
 * content/finds.json, and without content/generated/ (the clip cache copies every find's clips, mature ones too).
 * Only content counts, not src/: a template that copies a mature find's words is a leak, never a reason to stop
 * guarding them. The returned function also carries `plain` (for post ids) and `where(words)` (which entries hold them).
 */
export const commonText = (dir = join(root, 'content')) => {
  const holders = [];
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      const rel = relative(dir, p).split('\\').join('/');
      if (statSync(p).isDirectory()) { if (rel !== 'generated') walk(p); }
      else if (rel === 'finds.json') {
        for (const r of JSON.parse(readFileSync(p, 'utf8'))) if (!r.mature) holders.push({ name: `content/finds.json (${r.slug})`, text: JSON.stringify(r) });
      } else if (!BINARY.has(extname(n).toLowerCase())) holders.push({ name: `content/${rel}`, text: readFileSync(p, 'utf8') });
    }
  };
  walk(dir);
  for (const h of holders) h.w = words(h.text);
  const text = holders.map((h) => h.w).join(' ');
  const common = () => text;
  common.plain = holders.map((h) => plain(h.text)).join('\n');
  common.where = (w) => holders.filter((h) => h.w.includes(w)).map((h) => h.name);
  return common;
};

/** The clip cache (content/generated/clip-media.json) as { "<platform>:<id>": { thumb, ... } }, or {} without it. */
export const readClipMedia = (file = join(root, 'content/generated/clip-media.json')) =>
  existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).clips ?? {} : {};

/** Every text file under dist as { path, text }. */
export const readDist = (dist = join(root, 'dist')) => {
  const out = [];
  const walk = (dir) => {
    for (const n of readdirSync(dir)) {
      const p = join(dir, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (!BINARY.has(extname(n).toLowerCase())) out.push({ path: relative(dist, p).split('\\').join('/'), text: readFileSync(p, 'utf8') });
    }
  };
  walk(dist);
  return out;
};

/** The published mature finds in content/finds.json. */
export const matureFinds = () =>
  JSON.parse(readFileSync(join(root, 'content/finds.json'), 'utf8')).filter((f) => f.status === 'published' && f.mature);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dist = join(root, 'dist');
  if (!existsSync(join(dist, 'index.html'))) { console.log('Mature check: no build in dist/; run pnpm build first.'); process.exit(1); }
  const files = readDist(dist);
  const finds = matureFinds();
  const found = findLeaks(files, finds, { common: commonText(), media: readClipMedia() });
  console.log(`Mature check: ${finds.length} mature finds, ${files.length} text files in dist`);
  const leaks = found.filter((l) => l.kind === 'leak');
  const cannot = found.filter((l) => l.kind === 'unguardable');
  if (cannot.length) {
    console.log(`\n${cannot.length} cannot be guarded (a content choice to fix, not a page leak):`);
    for (const l of cannot) console.log(`  fail ${l.path}: ${l.slug} ${l.what}`);
  }
  if (leaks.length) {
    console.log(`\n${leaks.length} leak(s):`);
    for (const l of leaks.slice(0, 50)) console.log(`  fail ${l.path}: ${l.slug} ${l.what}`);
    if (leaks.length > 50) console.log(`  ...and ${leaks.length - 50} more`);
  }
  if (found.length) process.exit(1);
  console.log('OK: no mature title, summary, source, clip or first finder link outside its own page.');
}
