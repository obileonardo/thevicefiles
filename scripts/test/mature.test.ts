// Mature finds keep their own words, sources, clip and finder links on their own page (owner decisions, 27 and 28 Nov
// 2026; LR83, LR84, LR85).
// Run: pnpm test. The helpers every surface reads (src/lib/map-fields.ts), the leak check the build runs
// (scripts/check-mature.mjs) on made-up pages, and the same check on the real content and the last build in dist/ when
// there is one. Nothing here needs a given number of mature finds in the content: 0, 1 or many all pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publicTitle, publicSummary, publicSources, publicFinder, publicClip, pageDescription, searchFields, categorySingular, MATURE_GATE } from '../../src/lib/map-fields.ts';
import { findLeaks, readDist, matureFinds, words, commonText, readClipMedia } from '../check-mature.mjs';
import type { Find } from '../../src/lib/content.ts';

const real = matureFinds() as Find[];
const src = [
  { type: 'article', url: 'https://news.example.com/neon-velvet-lounge-back-room/', creator: 'Example News' },
  { type: 'wiki', url: 'https://wiki.example.org/Easter_Eggs', creator: 'Example wiki' },
];
const fake = { slug: 'neon-lounge', title: 'The neon velvet lounge', summary: "A back room behind the bar shows things we would rather not describe on a card, as Marcy's sign warns.", mature: true, category: 'secret-location', region_ids: [] as string[], sources: src, clip: null as null | { url: string }, first_finder: null };
const page = (head: string, body: string) => `<!doctype html><html><head>${head}</head><body>${body}</body></html>`;
const ownHead = (f: typeof fake, desc: string) =>
  `<title>${f.title} | The Vice Files</title><meta name="description" content="${desc}"><meta property="og:title" content="${f.title}"><meta property="og:image:alt" content="${f.title}, on a The Vice Files card"><meta name="twitter:title" content="${f.title}"><script type="application/ld+json">${JSON.stringify({ '@type': 'ItemPage', name: f.title, description: desc, citation: f.sources.map((s) => s.url) })}</script>`;
const ownBody = (f: typeof fake) => `<h1 class="find__title">${f.title}</h1><p class="find__synopsis">${f.summary.replace(/'/g, '&#39;')}</p><ul>${f.sources.map((s) => `<li><a href="${s.url}">${s.creator}</a></li>`).join('')}</ul>`;
const ownOk = page(ownHead(fake, pageDescription(fake as unknown as Find)), ownBody(fake));
const what = (files: { path: string; text: string }[], finds: unknown[] = [fake], opts?: object) => findLeaks(files, finds, opts).map((l: { what: string }) => l.what);
/** A content folder for commonText: finds.json plus other files, removed after `run`. */
const withContent = (files: Record<string, unknown>, run: (dir: string) => void) => {
  const dir = mkdtempSync(join(tmpdir(), 'vf-mature-'));
  try {
    for (const [name, data] of Object.entries(files)) {
      mkdirSync(join(dir, name, '..'), { recursive: true });
      writeFileSync(join(dir, name), typeof data === 'string' ? data : JSON.stringify(data));
    }
    run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test('outside its own page a mature find reads "Mature find: <type>", the gate line, no sources and no clip or finder link', () => {
  const f = fake as unknown as Find;
  assert.equal(publicTitle(f), 'Mature find: Secret location');
  assert.equal(publicSummary(f), MATURE_GATE);
  assert.equal(MATURE_GATE, 'Mature content: open the find to read it.');
  assert.equal(pageDescription(f), `Secret location in Leonida. ${MATURE_GATE}`);
  assert.deepEqual(publicSources(f), []);
  const linked = { ...fake, clip: { platform: 'youtube', url: 'https://www.youtube.com/watch?v=abc123xyz00', creator: 'Someone' }, first_finder: { handle: 'u/finder', platform: 'reddit', url: 'https://www.reddit.com/r/GTA6/comments/1abcd2/neon_velvet_lounge/' } };
  assert.deepEqual(publicClip(linked), { platform: 'youtube', url: null, creator: 'Someone' });
  assert.deepEqual(publicFinder(linked), { handle: 'u/finder', platform: 'reddit', url: null });
  assert.equal(publicClip({ ...linked, mature: false }), linked.clip);
  assert.equal(publicFinder({ ...linked, mature: false }), linked.first_finder);
  assert.equal(publicClip(fake), null);
  const safe = { ...fake, mature: false } as unknown as Find;
  assert.equal(publicTitle(safe), safe.title);
  assert.equal(publicSummary(safe), safe.summary);
  assert.equal(pageDescription(safe), safe.summary);
  assert.equal(publicSources(safe), safe.sources);
});

test('the map and search data of every real mature find hold neither its title, summary nor sources (any number of them)', () => {
  for (const f of real) {
    const m = searchFields(f);
    assert.equal(m.title, `Mature find: ${categorySingular(f.category)}`, f.slug);
    assert.equal(m.summary, MATURE_GATE, f.slug);
    assert.deepEqual(m.sources, [], f.slug);
    assert.equal(m.sourceCount, f.sources.length, f.slug);
    assert.equal(m.finder?.url ?? null, null, f.slug);
    assert.deepEqual(Object.keys(m.clip ?? {}), f.clip ? ['creator'] : [], f.slug);
  }
  const files = real.map((f) => ({ path: 'map.html', text: JSON.stringify(searchFields(f)) }));
  assert.deepEqual(findLeaks(files, real, { common: commonText(), media: readClipMedia() }), []);
});

test('leak check: the own page may hold its title in the heading, tab, share title, JSON-LD names and clip label, its summary in the body and its sources', () => {
  assert.deepEqual(what([{ path: `finds/${fake.slug}.html`, text: ownOk }]), []);
  const clip = `<button class="clip-play" aria-label="Play clip: ${fake.title}"></button><a class="clip__photo" aria-label="View the photo on X: ${fake.title}"></a>`;
  const withClip = page(ownHead(fake, MATURE_GATE), ownBody(fake) + clip);
  assert.deepEqual(what([{ path: `finds/${fake.slug}/index.html`, text: withClip }]), []);
});

test('leak check: the summary in the own page\'s meta or JSON-LD is caught', () => {
  const bad = page(ownHead(fake, fake.summary), ownBody(fake));
  assert.deepEqual(what([{ path: `finds/${fake.slug}.html`, text: bad }]), ['summary in the page head (meta, social or JSON-LD)']);
});

test('leak check: the title in the own page\'s body outside the allowed spots is caught', () => {
  for (const extra of [
    `<button aria-label="Found it: ${fake.title}"></button>`,
    `<button aria-label="Play clip: ${fake.title} and more"></button>`,
    `<p>{"name":"${fake.title}"}</p>`,
  ]) {
    const bad = page(ownHead(fake, MATURE_GATE), ownBody(fake) + extra);
    assert.deepEqual(what([{ path: `finds/${fake.slug}.html`, text: bad }]), ['title outside the heading, tab, share title and clip label'], extra);
  }
});

test('leak check: a title anywhere else is caught, however it is written', () => {
  const cases = [
    ['finds/other.html', `<a class="card" href="/finds/${fake.slug}"><span class="card__title">${fake.title}</span></a>`],
    ['rss.xml', `<title>${fake.title.replace(/ /g, '&#32;')}</title>`],
    ['data/finds.json', JSON.stringify({ title: fake.title.replace('neon', '\\u006eeon') })],
    ['_astro/a.js', `"${fake.title.replace(/ /g, '\\x20')}"`],
    ['share.html', `<a href="?t=${encodeURIComponent(encodeURIComponent(fake.title))}">`],
    // Split by inline markup, a soft hyphen or a zero-width character (N1).
    ['finds/a.html', '<p>The <em>neon</em> velvet <strong>lounge</strong></p>'],
    ['finds/b.html', '<h3><span>The</span> <span>neon</span> <span>velvet</span> <span>lounge</span></h3>'],
    ['finds/c.html', '<p>The ne<span class="x">on</span> velvet lounge</p>'],
    ['finds/d.html', '<p>The ne­on vel&shy;vet lounge</p>'],
    ['finds/e.html', '<p>The ne​on velvet&#x200B; lou⁠nge</p>'],
    ['finds/f.html', '<p>THE NEON <a href="/x">VELVET</a> LOUNGE</p>'],
    // Split by block tags or labels (N3 of #116's review).
    ['finds/h.html', '<p>The neon<br>velvet lounge</p>'],
    ['finds/i.html', '<div>The neon</div><div>velvet lounge</div>'],
    ['finds/j.html', '<label>The neon</label><label>velvet</label> <label>lounge</label>'],
  ] as const;
  for (const [path, text] of cases) assert.deepEqual(what([{ path, text }]), ['title'], path);
});

test('leak check: a summary run is caught anywhere else, unless the content holds it elsewhere (N2)', () => {
  const cases = [
    ['llms.txt', `- [x](/finds/x): ${fake.summary.slice(30, 80)}`],
    ['_astro/map.js', `{"summary":"Marcy\\u2019s sign warns."} ${fake.summary.toUpperCase()}`],
    ['finds/g.html', '<p>shows things <em>we would</em> rather not</p>'],
  ] as const;
  for (const [path, text] of cases) assert.deepEqual(what([{ path, text }]), ['summary'], path);
  // "A back room behind the bar" is common in the content (another find or a connection says it): no alarm for it,
  // while a phrase only this summary holds still fails.
  const common = () => words('Somewhere in town, a back room behind the bar is where the band plays.');
  assert.deepEqual(what([{ path: 'finds/other.html', text: '<p>Try a back room behind the bar tonight.</p>' }], [fake], { common }), []);
  assert.deepEqual(what([{ path: 'finds/other.html', text: '<p>it shows things we would rather not see</p>' }], [fake], { common }), ['summary']);
  // A summary every run of which the content holds elsewhere cannot be guarded, and says so.
  const none = findLeaks([], [fake], { common: () => words(fake.summary) });
  assert.deepEqual(none.map((l: { kind: string }) => l.kind), ['unguardable']);
  assert.match(none[0].what, /no five-word run of its own, so it cannot be guarded/);
});

test('leak check: a title other content holds cannot be guarded, and the finding names the entry instead of every page (N2)', () => {
  withContent({ 'finds.json': [fake], 'connections.json': [{ slug: 'lounge-link', title: 'The Neon Velvet Lounge', summary: 'A link.' }] }, (dir) => {
    const files = [{ path: 'gtaverse/lounge-link.html', text: '<h1>The Neon Velvet Lounge</h1>' }, { path: 'map.html', text: '"The neon velvet lounge"' }];
    const out = findLeaks(files, [fake], { common: commonText(dir) });
    assert.equal(out.length, 1);
    assert.equal(out[0].kind, 'unguardable');
    assert.match(out[0].what, /is also the text of content\/connections\.json.*rename the find or that entry, or unmark the find mature/);
  });
});

test('leak check: a source URL is caught outside the own page, unless other content cites it', () => {
  const article = src[0].url;
  for (const text of [`<a href="${article}">`, JSON.stringify({ url: article }).replace(/\//g, '\\/'), `share?u=${encodeURIComponent(article)}`, article.replace('https://', 'http://www.')])
    assert.deepEqual(what([{ path: 'map.html', text }]), ['source URL'], text);
  // The wiki page is cited by other finds too: it names no topic, so it is not checked.
  const common = () => words(`{"url":"${src[1].url}"}`);
  assert.deepEqual(what([{ path: 'finds/other.html', text: `<a href="${src[1].url}">` }], [fake], { common }), []);
});

test('leak check: the clip (its URL, post id or cached still) and the first finder URL are caught outside the own page (LR85)', () => {
  const yt = 'https://www.youtube.com/watch?v=Ab_c-12xyZ9';
  const reddit = 'https://www.reddit.com/r/GTA6/comments/1q2w3e/the_neon_velvet_lounge_is_wild/';
  const ytFind = { ...fake, clip: { platform: 'youtube', url: yt, creator: 'Someone' }, sources: [...src, { type: 'youtube', url: yt, creator: 'Someone' }] };
  const redditFind = { ...fake, clip: { platform: 'reddit', url: reddit, creator: 'u/someone' }, first_finder: { handle: 'u/finder', platform: 'reddit', url: 'https://www.reddit.com/r/GTA6/comments/9z8y7x/found_it/' } };
  const media = { 'reddit:1q2w3e': { kind: 'photo', thumb: 'https://preview.redd.it/the-neon-velvet-lounge-is-wild-v0-abc.jpeg?width=640' } };
  const clipOnly = (finds: unknown[], text: string) => findLeaks([{ path: 'map.html', text }], finds, { media }).map((l: { what: string }) => l.what);
  assert.deepEqual(clipOnly([ytFind], `{"clip":{"url":"${yt}"}}`), ['source URL', 'clip URL']);
  assert.deepEqual(clipOnly([ytFind], '<iframe src="https://www.youtube-nocookie.com/embed/Ab_c-12xyZ9?autoplay=1">'), ['clip URL']);
  assert.deepEqual(clipOnly([ytFind], '<img src="https://i.ytimg.com/vi/Ab_c-12xyZ9/hqdefault.jpg">'), ['clip URL']);
  assert.deepEqual(clipOnly([ytFind], '{"yt":"ab_c-12xyz9","other":"xAb_c-12xyZ9"}'), [], 'case and token edges count for a YouTube id');
  assert.deepEqual(clipOnly([redditFind], 'https://embed.reddit.com/r/GTA6/comments/1q2w3e/?embed=true'), ['clip URL']);
  // A Reddit still's URL carries the post's title slug, here the find's title too: both are caught.
  assert.deepEqual(clipOnly([redditFind], '{"thumb":"https://preview.redd.it/the-neon-velvet-lounge-is-wild-v0-abc.jpeg?width=640"}'), ['title', 'clip URL']);
  assert.deepEqual(clipOnly([redditFind], `<a href="${redditFind.first_finder.url}">`), ['first finder URL']);
  // On its own page every link is allowed.
  assert.deepEqual(findLeaks([{ path: `finds/${fake.slug}.html`, text: page(ownHead(fake, MATURE_GATE), ownBody(fake) + `<a href="${reddit}"></a><a href="${redditFind.first_finder.url}"></a>`) }], [redditFind], { media }), []);
  // A clip another (not mature) find also plays is not checked: it shows on that find's surfaces.
  const common = Object.assign(() => words(JSON.stringify({ clip: { url: yt } })), { plain: JSON.stringify({ clip: { url: yt } }) });
  assert.deepEqual(findLeaks([{ path: 'map.html', text: '<img src="https://i.ytimg.com/vi/Ab_c-12xyZ9/hqdefault.jpg">' }], [ytFind], { common }), []);
});

test('leak check: the masked label, the gate line and the slug are not leaks; block tags never join words', () => {
  const text = `<a href="/finds/${fake.slug}" data-found="${fake.slug}"><span>${publicTitle(fake as unknown as Find)}</span><p>${MATURE_GATE}</p></a>`;
  assert.deepEqual(what([{ path: 'finds.html', text }]), []);
  assert.ok(!words('<li>behind the bar</li><li>shows things</li>').includes(' bar shows '));
  assert.ok(words('<a>behind the bar</a> <b>shows things</b>').includes(' bar shows '));
});

test('leak check: mature finds that share a phrase or a source each keep it on their own page, and a leak of it is caught (N1)', () => {
  const kotaku = { type: 'article', url: 'https://kotaku.example.com/neon-velvet-lounge-back-room-2000758848', creator: 'Kotaku' };
  const one = { ...fake, sources: [...src, kotaku] };
  const other = { ...fake, slug: 'neon-annex', title: 'The neon annex upstairs', summary: 'Upstairs, a back room behind the bar holds a second, quieter lounge for regulars only tonight.', sources: [kotaku] };
  const safe = { ...fake, slug: 'safe-one', mature: false, title: 'A safe find', summary: 'Nothing to see in this one at all, honestly, it is a plain wall.', sources: [src[1]] };
  withContent({ 'finds.json': [one, other, safe], 'generated/clip-media.json': { clips: { note: kotaku.url } } }, (dir) => {
    const common = commonText(dir);
    const finds = [one, other];
    const own = [
      { path: `finds/${one.slug}.html`, text: page(ownHead(one, MATURE_GATE), ownBody(one)) },
      { path: `finds/${other.slug}.html`, text: page(ownHead(other, MATURE_GATE), ownBody(other)) },
    ];
    assert.deepEqual(findLeaks(own, finds, { common }), []);
    const leaked = [...own, { path: 'finders.html', text: `<a href="${kotaku.url}">Original post</a><p>a back room behind the bar holds</p>` }];
    assert.deepEqual(findLeaks(leaked, finds, { common }).map((l: { path: string; slug: string; what: string }) => `${l.path} ${l.slug} ${l.what}`), [
      `finders.html ${one.slug} summary`,
      `finders.html ${one.slug} source URL`,
      `finders.html ${other.slug} summary`,
      `finders.html ${other.slug} source URL`,
    ]);
    assert.deepEqual(findLeaks(own, [], { common }), [], 'no mature finds: nothing to guard');
  });
});

test('commonText: every mature find and the generated clip cache are left out, the rest of the content is kept', () => {
  const other = { slug: 'other', title: 'Another place', summary: 'A back room behind the bar again.', sources: [{ url: src[1].url }] };
  const second = { ...fake, slug: 'second', title: 'Second secret', summary: 'Only the second secret says this.', sources: [{ url: 'https://example.com/second-secret' }] };
  withContent({ 'finds.json': [fake, other, second], 'connections.json': [{ summary: 'Players chase the neon sign trophy.' }], 'generated/clip-media.json': { clips: { x: { thumb: 'https://cdn.example.com/neon-velvet-lounge.jpg' } } } }, (dir) => {
    const common = commonText(dir);
    const c = common(fake);
    assert.equal(common(second), c, 'the same set for every mature find');
    for (const gone of [words(fake.title), ' rather not describe on ', ' neon velvet lounge back room ', ' second secret ', ' example com second secret ', ' cdn example com ']) assert.ok(!c.includes(gone), gone);
    assert.ok(c.includes(' back room behind the bar again ') && c.includes(' neon sign trophy ') && c.includes(' wiki example org easter eggs '));
    assert.deepEqual(common.where(' back room behind the bar again '), ['content/finds.json (other)']);
    assert.deepEqual(common.where(' neon sign trophy '), ['content/connections.json']);
  });
});

test('the built site (dist/) has no mature title, summary or source outside its own page', (t) => {
  if (!existsSync(new URL('../../dist/index.html', import.meta.url))) { t.skip('no build in dist/: run pnpm build'); return; }
  const files = readDist();
  assert.ok(files.length > 200, 'dist holds the whole site');
  assert.deepEqual(findLeaks(files, real, { common: commonText(), media: readClipMedia() }), []);
});
