// The map screen, round 2 (owner decision Q4 A; spec: the round-2 board's analysis/direction-map-r2.md).
// Desktop: the map fills the screen and everything floats over it. Felt's Legend | List panel on the left, headed by
//   Jeff christy C12's HUD (region title, objective chip, the Found checklist); the find detail as Jeff christy C08's
//   frosted panel on the right; C12's hint row along the bottom (filters, 2D | 3D, layers, zoom, credit, fit, zoom).
// Phone: Corner's clean full-bleed map with round corner buttons, a pills row and an edge-to-edge category rail over
//   the bar (list toggle and search); a tapped pin brings Hypelist's card carousel; Tide Guide's glass menus and hint.
// Every find opens from the list, so the screen works before any pin is placed. Styles: ./map.css.
import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { MapCanvas, type MapApi } from './MapCanvas';
import type { Map3DApi } from './three/Map3D';
import { useFound } from './found';
import { readUrl, writeUrl, type MapView } from './url';
import { describeSearch, searchRank, setSearchCorpus } from './search';
import { Sheet, type SnapPoint } from './Sheet';
import { DrawerContent, SheetContent } from './FindDetail';
import { BasemapMenu, FilterMenu, menuAt, type MenuAt } from './Menus';
import { Button, Icon, Tabs, Verification } from './ui';
import { Blip } from './blip';
import { RollNumber, listFlip, usePresence } from './motion';
import { activeFilterCount, defaultFilters, findUrl, loadFilters, passes, saveFilters, showArt, warmDates, type Filters, type MapCategory, type MapCollectible, type MapFind, type MapLayer, type MapMeta, type MapRegion } from './types';
import { onChapterChange, readChapter, type ChapterSetting } from '../../lib/chapter';
import './map.css';

// The 3D view (docs/MAP-3D.md) and Three.js load only when the visitor opens 3D: a separate chunk.
const Map3D = lazy(() => import('./three/Map3D'));

type Props = { finds: MapFind[]; categories: MapCategory[]; regions: MapRegion[]; meta: MapMeta; layers: MapLayer[]; collectiblesUrl: string };
type View = { basemap: 'official' | 'muted'; grid: boolean; layers: string[] };
type Sort = 'newest' | 'az';
const defaultView: View = { basemap: 'official', grid: true, layers: [] };
type Toast = { id: number; icon: 'hand' | 'link' | 'check'; text: string; persist?: boolean; action?: { label: string; run: () => void } } | null;

const PHONE = '(max-width: 767px)';
const VIEW_STORE = 'vf-map-view';
const HINT_STORE = 'vf-map-hint';
const NONE_SHOWN = '__none'; // the Legend's "None": a type list no find matches
const readJson = <T,>(key: string, fallback: T): T => { try { const v = localStorage.getItem(key); return v ? { ...fallback, ...JSON.parse(v) } : fallback; } catch { return fallback; } };
const writeJson = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage blocked: lasts for this page only */ } };
const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const headerBottom = () => (typeof document !== 'undefined' ? document.querySelector('.island')?.getBoundingClientRect().bottom ?? 56 : 56);
// The floating panels' widths (tokens --map-panel-w and --map-detail-w), for fitting and centring the map between them.
const panelW = () => Math.min(400, Math.max(320, innerWidth * 0.185));
const detailW = () => Math.min(400, Math.max(320, innerWidth * 0.21));

function Media({ find, chapter }: { find: MapFind; chapter: ChapterSetting }) {
  return (
    <span className="media" aria-hidden="true">
      {showArt(find, chapter) ? <img src={find.still!} alt="" loading="lazy" decoding="async" /> : <span className="media__glow"><span className="media__kind">{find.categoryLabel}</span></span>}
    </span>
  );
}

/**
 * A List row (Sweatpals): still, kicker, two-line title, region; the Found check sits where Sweatpals puts its star.
 * Memoised with stable handlers, so opening a find or hovering a pin re-renders two rows, not the whole list.
 */
const Row = memo(function Row({ find, selected, lit, found, chapter, onOpen, onHover, onFound }: { find: MapFind; selected: boolean; lit: boolean; found: boolean; chapter: ChapterSetting; onOpen: (f: MapFind, el: HTMLElement) => void; onHover: (slug: string | null) => void; onFound: (slug: string) => void }) {
  return (
    <li className={`frow-item${lit ? ' is-lit' : ''}`} data-key={find.slug}>
      <a
        className="frow"
        href={findUrl(find.slug)}
        aria-current={selected ? 'true' : undefined}
        data-slug={find.slug}
        onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); onOpen(find, e.currentTarget); }}
        onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(find.slug)}
        onPointerLeave={(e) => e.pointerType === 'mouse' && onHover(null)}
      >
        <Media find={find} chapter={chapter} />
        <span className="frow__text">
          <span className="frow__kicker"><Blip category={find.category} size={20} />{find.categoryLabel}</span>
          <span className="frow__title">{find.title}</span>
          <span className="frow__meta">{find.regionLabel}{find.pin ? ' · on the map' : ''}</span>
        </span>
      </a>
      <button type="button" className="frow__found" aria-pressed={found} aria-label={found ? `Found: ${find.title}. Mark as not found` : `Mark ${find.title} as found`} title={found ? 'Found' : 'Mark as found'} onClick={() => onFound(find.slug)}>
        <Icon name="check" size={18} stroke={2} />
      </button>
    </li>
  );
});

/** A collectible's card: our label, its number against the source's total, any reading note, and the credit. */
function CollectibleCard({ item, layer, onClose }: { item: MapCollectible; layer: MapLayer | undefined; onClose: () => void }) {
  return (
    <div className="ccard" role="dialog" aria-labelledby={`cc-${item.id}`}>
      <span className="ccard__kicker"><Blip category={item.layer} size={20} />{layer?.label ?? item.layer}</span>
      <h2 className="ccard__title" id={`cc-${item.id}`}>{item.label}</h2>
      <span className="ccard__line tabular">{item.number !== null && layer ? `Number ${item.number} of ${layer.total} in their checklist` : 'Checklist number not readable'}</span>
      {item.note && <span className="ccard__note">{item.note}</span>}
      <a className="ccard__credit" href={item.url} target="_blank" rel="noopener noreferrer">
        Location: Game Checklists<Icon name="arrow-up-right" size={16} />
      </a>
      <Button variant="ghost" size="m" icon="close" iconOnly label="Close" className="ccard__close" onClick={onClose} />
    </div>
  );
}

export default function MapApp({ finds, categories, regions, meta, layers, collectiblesUrl }: Props) {
  setSearchCorpus(finds); // search.ts: words that match no find are left out of a question
  const [phone, setPhone] = useState(false);
  const [filters, setFiltersState] = useState<Filters>(defaultFilters);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('newest');
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null); // phone: the pin whose card shows in the carousel
  const [hovered, setHovered] = useState<string | null>(null); // a list row under the pointer: its pin rises
  const [pinHover, setPinHover] = useState<string | null>(null); // a pin under the pointer: its row lights up
  const pinnedTotal = useMemo(() => finds.filter((f) => f.pin).length, [finds]);
  const [tab, setTab] = useState(pinnedTotal ? 'legend' : 'list'); // List first while nothing is pinned (MP1)
  const [menu, setMenu] = useState<'filters' | 'basemap' | 'sort' | null>(null);
  const [menuPos, setMenuPos] = useState<MenuAt | null>(null);
  const menuOpener = useRef<HTMLElement | null>(null);
  const [view, setView] = useState<View>(defaultView);
  const [picked, setPicked] = useState<string | null>(null); // the open collectible
  const [collectibles, setCollectibles] = useState<MapCollectible[]>([]); // fetched once, when a layer is first turned on
  const collectiblesState = useRef<'idle' | 'loading' | 'ready'>('idle');
  const [listSnap, setListSnap] = useState('closed');
  const [findSnap, setFindSnap] = useState('closed');
  const [toast, setToast] = useState<Toast>(null);
  const [instant, setInstant] = useState(false);
  const [, setTick] = useState(0);
  const [mode, setMode] = useState<MapView>('2d'); // 2D or 3D (?view=3d)
  const [start3d, setStart3d] = useState<{ x: number; y: number; zoom: number } | null>(null);
  const [open3dInstant, setOpen3dInstant] = useState(false); // opened from the keyboard: no tilt-in animation
  const [chapter, setChapter] = useState<ChapterSetting>('none');
  const [onlyInView, setOnlyInView] = useState(false);
  const [inView, setInView] = useState<Set<string> | null>(null);
  const { found, toggle: toggleFound, merge: mergeFound } = useFound();

  const api = useRef<MapApi>(null);
  const api3 = useRef<Map3DApi>(null);
  const mapApi = (): MapApi | null => (mode === '3d' ? api3.current : api.current);
  const opener = useRef<HTMLElement | null>(null);
  const keyboard = useRef(false);
  const drawerRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const zoomRef = useRef<HTMLSpanElement>(null);
  const scaleRef = useRef<HTMLSpanElement>(null);
  const toastTimer = useRef(0);

  // Platform, saved filters and view, the deep link, the chapter setting. After hydration so the static HTML matches.
  useEffect(() => {
    const mq = matchMedia(PHONE);
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener('change', on);
    // A link with ?q, ?category or ?region shows exactly that view (from the defaults, so spoilers stay hidden);
    // otherwise the filters saved on this device apply (url.ts). ?layer turns those collectible layers on.
    const known = new Set(layers.map((l) => l.id));
    const url = readUrl({ categories: new Set(categories.map((c) => c.id)), regions: new Set(regions.map((r) => r.id)), finds: new Set(finds.map((f) => f.slug)), layers: known });
    if (url.hasFilters) { setFiltersState({ ...defaultFilters, categories: url.categories, region: url.region }); setSearch(url.q); }
    else setFiltersState(loadFilters());
    const v = readJson(VIEW_STORE, defaultView);
    const saved = Array.isArray(v.layers) ? v.layers.filter((id) => known.has(id)) : [];
    setView({ ...v, layers: url.hasLayers ? url.layers : saved });
    if (url.find) { setSelected(url.find); setFindSnap('full'); }
    if (url.view === '3d') setMode('3d');
    setChapter(readChapter());
    onChapterChange(setChapter);
    const kd = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') keyboard.current = true;
      // "/" focuses the search (no animation: a keyboard action).
      if (e.key === '/' && !(e.target as HTMLElement).closest('input, textarea, [contenteditable]')) { e.preventDefault(); searchRef.current?.focus(); }
    };
    const pd = () => { keyboard.current = false; };
    addEventListener('keydown', kd, true);
    addEventListener('pointerdown', pd, true);
    return () => { mq.removeEventListener('change', on); removeEventListener('keydown', kd, true); removeEventListener('pointerdown', pd, true); };
  }, []);

  const setFilters = (f: Filters) => {
    flip.capture(listRef.current);
    // Every type on is the same as no type filter.
    const all = categories.every((c) => f.categories.includes(c.id));
    const next = all ? { ...f, categories: [] } : f;
    setFiltersState(next);
    saveFilters(next);
  };
  const setSearchFlip = (q: string) => { flip.capture(listRef.current); setSearch(q); if (q && !phone) setTab('list'); };
  const setViewSaved = (v: View) => { setView(v); writeJson(VIEW_STORE, v); };
  const setLayersOn = (ids: string[]) => {
    setViewSaved({ ...view, layers: ids });
    if (pickedItem && !ids.includes(pickedItem.layer)) setPicked(null);
  };
  useEffect(() => {
    if (!view.layers.length || collectiblesState.current !== 'idle') return;
    collectiblesState.current = 'loading';
    fetch(collectiblesUrl)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<MapCollectible[]>; })
      .then((items) => { collectiblesState.current = 'ready'; setCollectibles(items); })
      .catch(() => { collectiblesState.current = 'idle'; showToast({ id: Date.now(), icon: 'hand', text: 'Collectibles did not load. Turn the layer off and on to try again.' }, 5000); });
  }, [view.layers.length]);
  const shownCollectibles = useMemo(() => collectibles.filter((c) => view.layers.includes(c.layer)), [collectibles, view.layers]);
  const pickedItem = picked ? collectibles.find((c) => c.id === picked) ?? null : null;
  const closePicked = () => { setPicked(null); const back = opener.current; if (back?.isConnected) back.focus({ preventScroll: true }); };
  const resetFilters = () => { setFilters(defaultFilters); setSearch(''); };
  const toggleFoundFlip = (slug: string) => { if (filters.hideFound) flip.capture(listRef.current); toggleFound(slug); };

  const visible = useMemo(() => {
    const list = finds.filter((f) => passes(f, filters, search, null, found, chapter));
    const rank = search.trim() ? new Map(list.map((f) => [f.slug, searchRank(f, search)])) : null;
    const byNew = (a: MapFind, b: MapFind) => (b.added ?? '').localeCompare(a.added ?? '');
    const sorted = [...list].sort((x, y) =>
      (rank ? rank.get(y.slug)! - rank.get(x.slug)! : 0) // best matches first (search.ts)
      || (sort === 'az' ? x.title.localeCompare(y.title) : byNew(x, y)));
    return sorted;
  }, [finds, filters, search, found, chapter, sort]);
  const pinned = useMemo(() => visible.filter((f) => f.pin), [visible]);
  const listed = useMemo(() => (onlyInView && inView ? visible.filter((f) => f.pin && inView.has(f.slug)) : visible), [visible, onlyInView, inView]);
  const current = selected ? finds.find((f) => f.slug === selected) ?? null : null;
  const lastFind = useRef<MapFind | null>(null);
  if (current) lastFind.current = current;
  const previewFind = preview ? finds.find((f) => f.slug === preview) ?? null : null;
  // Exits: each surface stays mounted while it leaves the way it came in, at 60 to 75% of its entrance
  // (map.css: [data-state='closing']), and reverses from where it is if it is opened again.
  const drawerP = usePresence(!phone ? current : null, 180);
  const cdrawerP = usePresence(!phone && !current ? pickedItem : null, 180);
  const carouselP = usePresence(phone && previewFind && !selected ? previewFind : null, 180);
  const ccardP = usePresence(phone && pickedItem && !selected ? pickedItem : null, 180);
  const toastP = usePresence(toast, 260);
  // Filters: rows keep their place while the list changes.
  const listRef = useRef<HTMLUListElement>(null);
  const flip = useRef(listFlip()).current;
  useLayoutEffect(() => { flip.play(listRef.current, keyboard.current); }, [listed]);

  const showToast = useCallback((t: NonNullable<Toast>, ms = 2600) => {
    clearTimeout(toastTimer.current);
    setToast(t);
    if (!t.persist) toastTimer.current = window.setTimeout(() => setToast(null), ms);
  }, []);

  // Idle work the first opened find would otherwise pay for: the date formatter's locale data (types.ts).
  useEffect(() => {
    if (typeof requestIdleCallback !== 'function') { const t = window.setTimeout(warmDates, 1500); return () => clearTimeout(t); }
    const id = requestIdleCallback(() => warmDates(), { timeout: 4000 });
    return () => cancelIdleCallback(id);
  }, []);

  // First visit hint (Tide Guide toast), once per device. With no pins yet it says so and offers the collectibles,
  // so the map is not empty.
  useEffect(() => {
    let seen = false;
    try { seen = localStorage.getItem(HINT_STORE) === '1'; } catch { /* no storage: show it this visit */ }
    if (seen) return;
    const t = window.setTimeout(() => showToast(pinnedTotal
      ? { id: 1, icon: 'hand', text: 'Tap a pin to open a find, or pick one from the list.', persist: true }
      : { id: 1, icon: 'hand', text: 'Pins are placed by hand from each clip. Every find opens from the list for now.', persist: true, action: layers.length ? { label: 'Show collectibles', run: () => setLayersOnRef.current([layers[0].id]) } : undefined }), 900);
    return () => clearTimeout(t);
  }, []);
  const setLayersOnRef = useRef(setLayersOn);
  setLayersOnRef.current = setLayersOn;
  const dismissToast = () => {
    if (toast?.id === 1) { try { localStorage.setItem(HINT_STORE, '1'); } catch { /* ignore */ } }
    setToast(null);
  };

  // Keep the URL in step with the view, so it can be shared and survives a reload (url.ts).
  const urlReady = useRef(false);
  useEffect(() => {
    if (!urlReady.current) { urlReady.current = true; return; }
    writeUrl({ q: search, categories: filters.categories.filter((c) => c !== NONE_SHOWN), region: filters.region, view: mode, find: selected, layers: view.layers });
  }, [search, filters.categories, filters.region, mode, selected, view.layers]);

  // 2D and 3D: 3D opens on the spot and scale the 2D map shows, and hands its spot back when it closes.
  const switchMode = (next: MapView) => {
    if (next === mode) return;
    setPreview(null);
    if (next === '3d') { setStart3d(api.current?.getView() ?? null); setOpen3dInstant(keyboard.current); setMode('3d'); return; }
    const back = api3.current;
    const finish = () => {
      const v = back?.getView();
      setMode('2d');
      if (v) requestAnimationFrame(() => api.current?.setView(v));
    };
    if (back && !keyboard.current) back.close(finish); else finish();
  };

  // Room the floating parts take, so the map centres a pin in the free area between them.
  const covered = () => phone ? { left: 0, right: 0, top: 120, bottom: 300 } : { left: panelW() + 32, right: selected || picked ? detailW() + 32 : 16, top: 96, bottom: 116 };
  const fly = (f: MapFind) => {
    if (!f.pin) return;
    const c = covered();
    if (phone) mapApi()?.flyTo(f, { offsetY: (c.bottom - c.top) / 2 });
    else mapApi()?.flyTo(f, { offsetX: (detailW() + 32 - c.left) / 2 });
  };

  const openFind = (f: MapFind, from?: HTMLElement | null) => {
    opener.current = from ?? (document.activeElement as HTMLElement | null);
    setInstant(keyboard.current);
    setPreview(null);
    setPicked(null);
    setSelected(f.slug);
    setFindSnap('full');
    // The panel mounts and lays out in this frame; focus moves and the flight starts in the next one. Together they
    // made one 50 to 70 ms frame at 4x CPU throttling (the flight's first steps and a focus() that forced a style
    // pass over the new panel); one frame apart, focus() finds the styles clean and each frame stays short.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!phone) drawerRef.current?.focus({ preventScroll: true });
      fly(f);
    }));
  };
  const closeFind = () => {
    const keys = keyboard.current;
    setInstant(keys);
    setSelected(null);
    setFindSnap('closed');
    const back = opener.current;
    // Focus goes back to the row or pin that opened it, after the panel has left (at once from the keyboard).
    if (back && back.isConnected) window.setTimeout(() => requestAnimationFrame(() => back.focus({ preventScroll: true })), keys || phone ? 0 : 180);
  };

  // Escape: the open menu first (handled by the menu), then the collectible, then the find, then the phone card.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || menu) return;
      if (document.querySelector('[data-menu="open"]')) return; // the site menu has it
      if (picked) { e.preventDefault(); closePicked(); }
      else if (selected) { e.preventDefault(); closeFind(); }
      else if (preview) { e.preventDefault(); const back = opener.current; setPreview(null); back?.focus({ preventScroll: true }); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  // A pin: on desktop it opens the detail panel; on phone its card comes up in the carousel (Hypelist).
  const onPin = (slug: string, el: HTMLElement) => {
    const f = finds.find((x) => x.slug === slug);
    if (!f) return;
    opener.current = el;
    if (!phone) { openFind(f, el); return; }
    if (selected === slug) return;
    setPicked(null);
    setSelected(null);
    setFindSnap('closed');
    setPreview(slug);
    fly(f); // the pin sits above the card that comes up
  };
  const onCollectible = (id: string, el: HTMLElement) => {
    opener.current = el;
    setPreview(null);
    if (selected) { setSelected(null); setFindSnap('closed'); }
    setPicked(id);
  };
  // Pin hovered: light its row and scroll it into view only if it is out of view (no jump otherwise).
  const onPinHover = (slug: string | null) => {
    setPinHover(slug);
    if (!slug) return;
    const row = listRef.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(slug)}"]`);
    const box = row?.closest('.mpanel__scroll');
    if (!row || !box) return;
    const r = row.getBoundingClientRect(), b = box.getBoundingClientRect();
    if (r.top < b.top || r.bottom > b.bottom) row.scrollIntoView({ block: 'nearest', behavior: reduce() ? 'auto' : 'smooth' });
  };

  // quiet: the copy button shows (and announces) "Copied" itself, so no toast.
  const copyLink = async (f: MapFind, quiet = false) => {
    const url = `${location.origin}/map?find=${f.slug}`;
    try { await navigator.clipboard.writeText(url); if (!quiet) showToast({ id: Date.now(), icon: 'link', text: 'Link copied' }); return true; }
    catch { showToast({ id: Date.now(), icon: 'link', text: url }, 5000); return false; }
  };
  const share = async (f: MapFind) => {
    const url = `${location.origin}/map?find=${f.slug}`;
    if (navigator.share) { try { await navigator.share({ title: f.title, url }); return; } catch { return; } }
    copyLink(f);
  };
  const showOnMap = (f: MapFind) => {
    if (!f.pin) return;
    if (phone) setFindSnap('medium');
    fly(f);
  };

  // Types. The Legend rows hide or show one type each (Felt's layer toggles); the phone rail picks types (Corner).
  const shownTypes = new Set(filters.categories.length ? filters.categories : categories.map((c) => c.id));
  const legendToggle = (id: string) => {
    const now = new Set(shownTypes);
    if (now.has(id)) now.delete(id); else now.add(id);
    now.delete(NONE_SHOWN);
    setFilters({ ...filters, categories: now.size ? [...now] : [NONE_SHOWN] });
  };
  const railToggle = (id: string) => {
    const has = filters.categories.includes(id);
    setFilters({ ...filters, categories: has ? filters.categories.filter((c) => c !== id) : [...filters.categories.filter((c) => c !== NONE_SHOWN), id] });
  };
  const typeCount = filters.categories.filter((c) => c !== NONE_SHOWN).length;
  const oneType = typeCount === 1 ? categories.find((c) => c.id === filters.categories[0]) : null;
  const typeLabel = filters.categories.includes(NONE_SHOWN) ? 'No types' : !typeCount ? 'All types' : oneType ? oneType.label : `${typeCount} types`;
  const filterCount = activeFilterCount({ ...filters, categories: filters.categories.filter((c) => c !== NONE_SHOWN) });
  const otherFilters = activeFilterCount({ ...filters, categories: [] });

  // Menus open from whichever control asked, placed beside it (Menus.tsx, menuAt).
  const openMenu = (which: 'filters' | 'basemap' | 'sort', e: React.MouseEvent<HTMLElement>) => {
    if (menu === which) { setMenu(null); return; }
    menuOpener.current = e.currentTarget;
    setMenuPos(menuAt(e.currentTarget));
    setMenu(which);
  };
  const closeMenu = (restore: boolean) => { setMenu(null); if (restore) menuOpener.current?.focus(); };
  const openFoundCode = (e: React.MouseEvent<HTMLElement>) => {
    openMenu('filters', e);
    requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById('map-found')?.scrollIntoView({ block: 'start' })));
  };

  // The HUD's zoom level and scale bar (one printed grid cell), written straight to the page as the map moves.
  const cellPx = (zoom: number) => 600 * 2 ** (zoom - meta.maxZoom);
  const onMove = () => {
    const z = mapApi()?.zoom?.() ?? null;
    if (z === null) return;
    if (zoomRef.current) zoomRef.current.textContent = `${z.toFixed(1)}z`;
    if (scaleRef.current) scaleRef.current.style.width = `${Math.round(Math.min(160, Math.max(12, cellPx(z))))}px`;
  };
  // "In view" (Sweatpals' heading): which pinned finds are on screen, after each move ends.
  const measureInView = useCallback(() => {
    const a = mapApi();
    if (!a || !pinned.length) { setInView(null); return; }
    const w = innerWidth, h = innerHeight, c = covered();
    const set = new Set(pinned.filter((f) => { const p = a.pointOf(f); return p && p.x > c.left && p.x < w - c.right && p.y > 0 && p.y < h; }).map((f) => f.slug));
    // Same finds in view: keep the old set, so nothing re-renders (this runs while a find's flight is still moving).
    setInView((old) => (old && old.size === set.size && [...set].every((s) => old.has(s)) ? old : set));
  }, [pinned, mode, phone, selected, picked]);
  useEffect(() => {
    if (!pinned.length) return;
    let t = 0;
    const tick = () => { clearTimeout(t); t = window.setTimeout(measureInView, 160); };
    const el = document.querySelector('.map-stage');
    el?.addEventListener('pointerup', tick);
    el?.addEventListener('wheel', tick, { passive: true });
    tick();
    return () => { clearTimeout(t); el?.removeEventListener('pointerup', tick); el?.removeEventListener('wheel', tick); };
  }, [measureInView]);

  // Sheets (phone). Snap tops are measured from the map's top edge; the top snap sits just under the header.
  const listSnaps = useMemo<SnapPoint[]>(() => [
    { id: 'full', top: () => headerBottom() + 8 },
    { id: 'half', top: (h) => Math.round(h * 0.48) },
    { id: 'closed', top: (h) => h },
  ], []);
  const findSnaps = useMemo<SnapPoint[]>(() => [
    { id: 'full', top: () => headerBottom() + 8 },
    { id: 'medium', top: (h) => Math.round(h * 0.46) },
    { id: 'closed', top: (h) => h },
  ], []);
  const onFindSnap = (id: string) => { setFindSnap(id); if (id === 'closed') closeFind(); };

  // Phone carousel (Hypelist): the tapped find and the other pinned finds near it; swiping pans the map to each.
  const carouselRef = useRef<HTMLDivElement>(null);
  const carousel = useMemo(() => {
    const f = carouselP.item;
    if (!f?.pin) return f ? [f] : [];
    const near = pinned.filter((x) => x.slug !== f.slug).sort((a, b) => Math.hypot(a.pin!.x - f.pin!.x, a.pin!.y - f.pin!.y) - Math.hypot(b.pin!.x - f.pin!.x, b.pin!.y - f.pin!.y)).slice(0, 7);
    return [f, ...near];
  }, [carouselP.item?.slug, pinned]);
  const onCarouselScroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth - 24));
    const f = carousel[i];
    if (f && f.slug !== preview) { setPreview(f.slug); fly(f); }
  };

  const fitPadding = phone ? { top: 130, right: 16, bottom: 240, left: 16 } : { top: 96, right: 16, bottom: 116, left: Math.round((typeof innerWidth === 'number' ? panelW() : 320) + 32) };
  const shown = lastFind.current;
  const countText = <><RollNumber value={listed.length} instant={keyboard.current} /> {listed.length === 1 ? 'find' : 'finds'}</>;
  const layersOn = view.layers.length;
  const credit = `${meta.attribution}.`;

  const empty = (
    <div className="map-empty">
      <span className="map-empty__icon"><Icon name="filter" size={24} /></span>
      <p className="map-empty__title">No finds match</p>
      <p className="map-empty__text">Try fewer filters{search ? ' or another search' : ''}.</p>
      <Button variant="secondary" size="m" onClick={resetFilters}>Reset filters</Button>
    </div>
  );

  const rowActs = useRef({ openFind, toggleFoundFlip });
  rowActs.current = { openFind, toggleFoundFlip };
  const onRowOpen = useCallback((f: MapFind, el: HTMLElement) => rowActs.current.openFind(f, el), []);
  const onRowFound = useCallback((slug: string) => rowActs.current.toggleFoundFlip(slug), []);
  const rows = (list: MapFind[]) => list.map((f) => <Row key={f.slug} find={f} selected={f.slug === selected} lit={f.slug === pinHover} found={found.has(f.slug)} chapter={chapter} onOpen={onRowOpen} onHover={setHovered} onFound={onRowFound} />);
  const onMapRows = listed.filter((f) => f.pin);
  const offMapRows = listed.filter((f) => !f.pin);
  const list = (
    <ul className="frows" role="list" ref={listRef}>
      {pinnedTotal > 0 && onMapRows.length > 0 ? (
        <>
          {rows(onMapRows)}
          {offMapRows.length > 0 && <li className="frows__group" aria-hidden="true">Not on the map yet</li>}
          {rows(offMapRows)}
        </>
      ) : rows(listed)}
    </ul>
  );

  const sortControl = (
    <span className="msort">
      <button type="button" className="msort__btn" aria-haspopup="true" aria-expanded={menu === 'sort'} aria-controls="map-sort" onClick={(e) => openMenu('sort', e)}>
        Sort: {sort === 'newest' ? 'Newest' : 'A to Z'}<Icon name="chevron-down" size={16} className="msort__chev" />
      </button>
    </span>
  );

  // How a question was read (search.ts), shown under the count: a money question says how the list is sorted, and
  // words that were left out are named, so "how do I make money fast" shows it searched for money only.
  const read = search.trim() ? describeSearch(search) : null;
  const searchNote = read && (read.money || read.ignored.length > 0) && (
    <p className="mlist__note">
      {read.money && <>Finds that pay money, biggest amount first. </>}
      {read.ignored.length > 0 && <>Left out: <strong>{read.ignored.join(', ')}</strong>.</>}
    </p>
  );

  const listTab = (
    <>
      <div className="mlist__head">
        <h3 className="mlist__h" aria-live="polite">
          {countText} {onlyInView ? 'in view' : 'in Leonida'}
        </h3>
        {sortControl}
      </div>
      {searchNote}
      {pinnedTotal > 0 && (
        <label className="mswitch mlist__inview">
          <input type="checkbox" role="switch" checked={onlyInView} onChange={() => setOnlyInView(!onlyInView)} />
          <span className="mswitch__track" aria-hidden="true" />
          Only in view{inView ? ` (${inView.size})` : ''}
        </label>
      )}
      {listed.length ? list : empty}
    </>
  );

  const legendTab = (
    <div className="legend">
      <section className="lgroup" aria-labelledby="lg-finds">
        <h3 className="lgroup__h" id="lg-finds"><Icon name="finds" size={20} />Finds
          <span className="lgroup__acts">
            <button type="button" onClick={() => setFilters({ ...filters, categories: [] })}>All</button>
            <button type="button" onClick={() => setFilters({ ...filters, categories: [NONE_SHOWN] })}>None</button>
          </span>
        </h3>
        <p className="lgroup__about">Placed by hand from each clip. {pinnedTotal} of {finds.length} pinned so far.</p>
        <ul className="lrows" role="list">
          {categories.map((c) => {
            const on = shownTypes.has(c.id);
            return (
              <li key={c.id}>
                <button type="button" className="lrow" aria-pressed={on} onClick={() => legendToggle(c.id)}>
                  <Blip category={c.id} size={24} state={on ? 'default' : 'dim'} />
                  <span className="lrow__label">{c.label}</span>
                  <span className="lrow__count tabular">{c.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      {layers.length > 0 && (
        <section className="lgroup lgroup--layers" aria-labelledby="lg-layers">
          <h3 className="lgroup__h" id="lg-layers">Collectible layers</h3>
          <p className="lgroup__about">Off until you turn one on. Numbers are their checklist numbers.</p>
          <ul className="lrows" role="list">
            {layers.map((l) => {
              const on = view.layers.includes(l.id);
              return (
                <li key={l.id}>
                  <label className="lrow mswitch">
                    <Blip category={l.id} size={24} />
                    <span className="lrow__label">{l.label}</span>
                    <span className="lrow__count tabular" title={`${l.count} on the map, ${l.total} in their checklist`}>{l.count}/{l.total}</span>
                    <input type="checkbox" role="switch" checked={on} onChange={() => setLayersOn(on ? view.layers.filter((x) => x !== l.id) : [...view.layers, l.id])} aria-label={`${l.label}: ${l.count} on the map of ${l.total}`} />
                    <span className="mswitch__track" aria-hidden="true" />
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="lgroup__credit">Collectible locations: <a href={layers[0].url} target="_blank" rel="noopener noreferrer">Game Checklists<Icon name="arrow-up-right" size={16} /></a></p>
        </section>
      )}
      <section className="lgroup lgroup--last" aria-label="Verification">
        <p className="lgroup__dotrow"><span className="ldot" aria-hidden="true" />Verification</p>
        <p className="lgroup__badges">
          <Verification level="multi-source" /><Verification level="single-source" /><Verification level="rumor" /><Verification level="debunked" />
        </p>
      </section>
    </div>
  );

  const segView = (
    <div className="seg" role="group" aria-label="Map view">
      <button type="button" className="seg__btn" aria-pressed={mode === '2d'} onClick={() => switchMode('2d')}>2D</button>
      <button type="button" className="seg__btn" aria-pressed={mode === '3d'} onClick={() => switchMode('3d')}>3D</button>
    </div>
  );
  const fitBtn = <Button variant="glass" size="m" icon="map" iconOnly label={pinnedTotal ? 'Fit every pin' : 'Show all of Leonida'} className="map-ctrl" onClick={() => { const c = covered(); mapApi()?.fit({ top: c.top, right: c.right, bottom: c.bottom, left: c.left }); }} />;
  const foundTotal = finds.filter((f) => found.has(f.slug)).length;

  return (
    <section className={`map-app vf-map${phone ? ' is-phone' : ''}`} data-list={listSnap} data-find={selected ? findSnap : 'closed'} data-view={mode} data-carousel={carouselP.item && !carouselP.closing ? 'open' : undefined} aria-label="Map of Leonida">
      <h1 className="sr-only map-h1">Map of Leonida</h1>

      {/* The map, full bleed under everything */}
      <div className="map-stage">
        <MapCanvas ref={api} meta={meta} finds={pinned} selected={selected ?? preview} hovered={hovered} found={found} basemap={view.basemap} grid={view.grid} fitPadding={fitPadding} covered={{ left: 0, right: !phone && (selected || picked) ? detailW() + 32 : 16 }} onPin={onPin} onPinHover={onPinHover} collectibles={shownCollectibles} selectedCollectible={picked} onCollectible={onCollectible} onMove={onMove} onReady={() => {
          setTick((t) => t + 1);
          onMove();
          // A shared link to a find lands on its pin (no flight: it is the page arriving, not an action).
          const f = selected ? finds.find((x) => x.slug === selected) : null;
          if (f?.pin) { const c = covered(); api.current?.flyTo(f, phone ? { instant: true, offsetY: (c.bottom - c.top) / 2 } : { instant: true, offsetX: (detailW() + 32 - c.left) / 2 }); }
        }} />
        {mode === '3d' && (
          <Suspense fallback={<div className="map3d map3d--loading" role="status"><p className="map3d__fail">Loading the 3D map</p></div>}>
            <Map3D ref={api3} meta={meta} finds={pinned} selected={selected ?? preview} hovered={hovered} basemap={view.basemap} start={start3d} instant={open3dInstant} onPin={onPin} collectibles={shownCollectibles} selectedCollectible={picked} onCollectible={onCollectible} onMove={onMove} onReady={() => setTick((t) => t + 1)} />
          </Suspense>
        )}
        <span className="map-vignette" aria-hidden="true" />
      </div>

      {/* Desktop: Felt's Legend | List panel, headed by Jeff christy C12's HUD */}
      {!phone && (
        <aside className="mpanel" aria-label="Finds">
          <div className="mpanel__scroll">
            <header className="mhud">
              <p className="mhud__title"><span className="mhud__region">Leonida</span> <span className="mhud__count"><RollNumber value={visible.length} instant={keyboard.current} /></span></p>
              <span className="mhud__rule" aria-hidden="true" />
              <button type="button" className="mobj" aria-expanded={menu === 'filters'} aria-controls="map-filters" onClick={(e) => openMenu('filters', e)}>
                <span className="mobj__plate">{oneType ? <Blip category={oneType.id} size={32} /> : <span className="mobj__glyph"><Icon name="filter" size={18} /></span>}</span>
                <span className="mobj__label">{typeLabel}{otherFilters ? ` + ${otherFilters}` : ''}</span>
                <Icon name="chevron-down" size={16} className="mobj__chev" />
              </button>
              <ol className="mcheck">
                <li className={foundTotal ? 'is-done' : undefined}><span className="mcheck__dot" aria-hidden="true" /><span className="mcheck__text">Found <span className="tabular">{foundTotal}</span> of <span className="tabular">{finds.length}</span></span></li>
                <li className={filters.hideFound ? 'is-done' : undefined}><span className="mcheck__dot" aria-hidden="true" /><button type="button" className="mcheck__btn" aria-pressed={filters.hideFound} onClick={() => setFilters({ ...filters, hideFound: !filters.hideFound })}>Hide found</button></li>
                <li><span className="mcheck__dot" aria-hidden="true" /><button type="button" className="mcheck__btn" aria-controls="map-filters" onClick={openFoundCode}>Export or import</button></li>
              </ol>
            </header>
            <label className="msearch">
              <Icon name="search" size={20} />
              <span className="sr-only">Search finds</span>
              <input ref={searchRef} type="search" placeholder="Search or ask a question" value={search} enterKeyHint="search" autoComplete="off" onChange={(e) => setSearchFlip(e.target.value)} />
              {search && <button type="button" className="msearch__clear" aria-label="Clear search" onClick={() => { setSearchFlip(''); searchRef.current?.focus(); }}><Icon name="close" size={18} /></button>}
            </label>
            <Tabs id="mappanel" label="Map panel" selected={tab} onSelect={setTab} tabs={[{ id: 'legend', label: 'Legend' }, { id: 'list', label: 'List' }]}>
              {(t) => (t === 'list' ? listTab : legendTab)}
            </Tabs>
          </div>
        </aside>
      )}

      {/* Desktop: Jeff christy C12's hint row along the bottom, Felt's bottom corners */}
      {!phone && (
        <div className="mbar">
          <div className="mbar__left">
            <div className="mbar__hints">
              <button type="button" className="hint" aria-expanded={menu === 'filters'} aria-controls="map-filters" onClick={(e) => openMenu('filters', e)}>
                <span className="hint__glyph"><Icon name="filter" size={16} /></span>Filters: {filterCount ? `${filterCount} on` : 'All'}
              </button>
              {segView}
              <button type="button" className="hint" aria-expanded={menu === 'basemap'} aria-controls="map-basemap" onClick={(e) => openMenu('basemap', e)}>
                <span className="hint__glyph"><Icon name="layers" size={16} /></span>Layers: {layersOn ? `${layersOn} on` : 'Off'}
              </button>
            </div>
            <p className="mbar__meta">
              <span className="mbar__zoom tabular" ref={zoomRef}>0.0z</span>
              <span className="mbar__scale"><span className="mbar__bar" ref={scaleRef} aria-hidden="true" />1 cell</span>
              <span className="mbar__credit">{credit}{layersOn > 0 && <> Collectible locations: <a href={layers[0].url} target="_blank" rel="noopener noreferrer">Game Checklists</a>.</>}</span>
            </p>
          </div>
          <div className="mbar__right" role="group" aria-label="Map controls">
            {fitBtn}
            <Button variant="glass" size="m" icon="minus" iconOnly label="Zoom out" className="map-ctrl" onClick={() => mapApi()?.zoomBy(-0.5)} />
            <Button variant="glass" size="m" icon="plus" iconOnly label="Zoom in" className="map-ctrl" onClick={() => mapApi()?.zoomBy(0.5)} />
          </div>
        </div>
      )}

      {/* Desktop: the find, as Jeff christy C08's frosted panel (Felt's inspector place) */}
      {drawerP.item && (() => { const df = drawerP.item; return (
        <article ref={drawerRef} className="drawer" role="dialog" aria-modal="false" aria-labelledby="drawer-title" tabIndex={-1} data-instant={instant || undefined} data-state={drawerP.closing ? 'closing' : undefined} inert={drawerP.closing}>
          <div className="drawer__content" key={df.slug}>
            <DrawerContent find={df} meta={meta} titleId="drawer-title" onClose={closeFind} onShowOnMap={() => showOnMap(df)} onCopy={() => copyLink(df, true)} onShare={() => share(df)} found={found.has(df.slug)} onToggleFound={() => toggleFoundFlip(df.slug)} chapter={chapter} />
          </div>
        </article>
      ); })()}
      {/* Desktop: a collectible's card in the same slot */}
      {cdrawerP.item && (
        <div className="drawer drawer--c" data-state={cdrawerP.closing ? 'closing' : undefined} inert={cdrawerP.closing}>
          <CollectibleCard item={cdrawerP.item} layer={layers.find((l) => l.id === cdrawerP.item!.layer)} onClose={closePicked} />
        </div>
      )}

      {/* Phone: Corner's round buttons in the top corners, under the island */}
      {phone && (
        <>
          <Button variant="glass" size="m" icon="layers" iconOnly label={layersOn ? `Basemap and layers, ${layersOn} on` : 'Basemap and layers'} aria-expanded={menu === 'basemap'} aria-controls="map-basemap" className="mcorner mcorner--left" onClick={(e) => openMenu('basemap', e)} />
          <span className="mcorner mcorner--right">
            <Button variant="glass" size="m" icon="filter" iconOnly label={otherFilters ? `Filters, ${otherFilters} on` : 'Filters'} aria-expanded={menu === 'filters'} aria-controls="map-filters" className="map-ctrl" onClick={(e) => openMenu('filters', e)} />
            {otherFilters > 0 && <span className="mcorner__badge tabular" aria-hidden="true">{otherFilters}</span>}
          </span>
          {otherFilters + typeCount > 0 && (
            <div className="mtoprow" role="group" aria-label="Active filters">
              {filters.categories.filter((c) => c !== NONE_SHOWN).map((id) => { const c = categories.find((x) => x.id === id); return c ? <button key={id} type="button" className="mchip" onClick={() => railToggle(id)} aria-label={`Remove ${c.label}`}><Blip category={id} size={20} />{c.label}<Icon name="close" size={16} /></button> : null; })}
              {filters.verification !== 'all' && <button type="button" className="mchip" onClick={() => setFilters({ ...filters, verification: 'all' })}>{filters.verification === 'multi-source' ? 'Multi-source' : filters.verification}<Icon name="close" size={16} /></button>}
              {filters.region !== 'all' && <button type="button" className="mchip" onClick={() => setFilters({ ...filters, region: 'all' })}>{regions.find((r) => r.id === filters.region)?.name}<Icon name="close" size={16} /></button>}
              {filters.hasClip && <button type="button" className="mchip" onClick={() => setFilters({ ...filters, hasClip: false })}>With a clip<Icon name="close" size={16} /></button>}
              {filters.spoilers && <button type="button" className="mchip" onClick={() => setFilters({ ...filters, spoilers: false })}>Spoilers<Icon name="close" size={16} /></button>}
              {filters.mature && <button type="button" className="mchip" onClick={() => setFilters({ ...filters, mature: false })}>Mature<Icon name="close" size={16} /></button>}
            </div>
          )}
        </>
      )}

      <FilterMenu open={menu === 'filters'} onClose={closeMenu} at={menuPos} finds={finds} filters={filters} setFilters={setFilters} regions={regions} search={search} onReset={resetFilters} categories={categories} found={found} onImport={mergeFound} chapter={chapter} />
      <BasemapMenu open={menu === 'basemap'} onClose={closeMenu} at={menuPos} basemap={view.basemap} setBasemap={(b) => setViewSaved({ ...view, basemap: b })} grid={view.grid} setGrid={(g) => setViewSaved({ ...view, grid: g })} layers={layers} layersOn={view.layers} setLayersOn={setLayersOn} />
      {menu === 'sort' && <SortMenu at={menuPos} sort={sort} onPick={(s) => { setSort(s); closeMenu(true); }} onClose={closeMenu} />}

      {/* Tide Guide's hint toast, above the bottom controls */}
      {toastP.item && (
        <div className="toast" role="status" key={toastP.item.id} data-state={toastP.closing ? 'closing' : undefined}>
          <Icon name={toastP.item.icon} size={22} />
          <span className="toast__text">{toastP.item.text}</span>
          {toastP.item.action && <button type="button" className="toast__action" onClick={() => { toastP.item!.action!.run(); dismissToast(); }}>{toastP.item.action.label}</button>}
          <button type="button" className="toast__close" aria-label="Dismiss" onClick={dismissToast} tabIndex={toastP.closing ? -1 : undefined}><Icon name="close" size={18} /></button>
        </div>
      )}

      {/* Phone: the list sheet */}
      {phone && (
        <Sheet snaps={listSnaps} snap={listSnap} onSnap={setListSnap} closedId="closed" enabled inert={listSnap === 'closed'} className="map-list" label="Finds">
          <div className="map-list__handle" data-sheet-handle>
            <span className="grabber" aria-hidden="true" />
            <p className="map-list__count" aria-live="polite">{countText}</p>
          </div>
          <div className="map-list__scroll">
            <div className="mlist__head mlist__head--phone">{sortControl}</div>
            {searchNote}
            {listed.length ? list : empty}
          </div>
        </Sheet>
      )}

      {/* Phone: the collectible's card in the carousel's place */}
      {ccardP.item && (
        <div className="pcard pcard--c" data-state={ccardP.closing ? 'closing' : undefined} inert={ccardP.closing}>
          <CollectibleCard item={ccardP.item} layer={layers.find((l) => l.id === ccardP.item!.layer)} onClose={closePicked} />
        </div>
      )}

      {/* Phone: Hypelist's card carousel replaces the rail while a pin is chosen */}
      {carouselP.item && (
        <div className="pcarousel" data-state={carouselP.closing ? 'closing' : undefined} inert={carouselP.closing}>
          <div className="pcarousel__track" ref={carouselRef} onScroll={onCarouselScroll} role="group" aria-label="Finds near this pin">
            {carousel.map((cf) => (
              <div className="pcard2" key={cf.slug}>
                <button type="button" className="pcard2__open" onClick={(e) => openFind(cf, e.currentTarget)} aria-label={`Open ${cf.title}`}>
                  <span className="pcard2__art" aria-hidden="true">{showArt(cf, chapter) ? <img src={cf.still!} alt="" loading="lazy" decoding="async" /> : <span className="media__glow" />}</span>
                  <span className="pcard2__thumb" aria-hidden="true"><Blip category={cf.category} size={32} /></span>
                  <span className="pcard2__text">
                    {/* Two lines at most: a long title is shortened in text (a clamp would leave hidden lines in the card) */}
                    <span className="pcard2__title">{cf.title.length > 54 ? `${cf.title.slice(0, 52).trimEnd()}…` : cf.title}</span>
                    <span className="pcard2__meta">{cf.categoryLabel} · {cf.regionLabel}</span>
                    <span className="pcard2__credit">{cf.finder ? <><span className="pcard2__avatar" aria-hidden="true">{cf.finder.handle.replace(/^(?:@|u\/)/, '').slice(0, 1).toUpperCase()}</span>Found by {cf.finder.handle}</> : 'First finder not known yet'}</span>
                  </span>
                </button>
                <button type="button" className="pcard2__found" aria-pressed={found.has(cf.slug)} aria-label={found.has(cf.slug) ? 'Found. Mark as not found' : 'Mark as found'} onClick={() => toggleFoundFlip(cf.slug)}><Icon name="check" size={20} stroke={2} /></button>
              </div>
            ))}
          </div>
          <Button variant="glass" size="m" icon="close" iconOnly label="Close" className="pcarousel__close" onClick={() => { setPreview(null); opener.current?.focus({ preventScroll: true }); }} />
        </div>
      )}

      {/* Phone: Corner's bottom stack: the pills row, the category rail, then the bar (list toggle and search) */}
      {phone && (
        <div className="map-bottom">
          <div className="mpills">
            <button type="button" className="mpill" aria-pressed={filters.hideFound} onClick={() => setFilters({ ...filters, hideFound: !filters.hideFound })} aria-label={`Found ${foundTotal} of ${finds.length}. ${filters.hideFound ? 'Show' : 'Hide'} found finds`}>
              <Icon name="check" size={16} stroke={2} />Found <span className="tabular">{foundTotal}/{finds.length}</span>
            </button>
            {segView}
            <span className="mpills__fit">{fitBtn}</span>
          </div>
          <div className="mrail" role="group" aria-label="Find types">
            <button type="button" className="mrail__item" aria-pressed={!typeCount} onClick={() => setFilters({ ...filters, categories: [] })}>
              <span className="mrail__all" aria-hidden="true"><Icon name="grid" size={18} /></span><span className="mrail__label">All</span>
            </button>
            {categories.map((c) => (
              <button key={c.id} type="button" className="mrail__item" aria-pressed={filters.categories.includes(c.id)} onClick={() => railToggle(c.id)}>
                <Blip category={c.id} size={32} state={filters.categories.includes(c.id) ? 'selected' : 'default'} /><span className="mrail__label">{c.label}</span>
              </button>
            ))}
          </div>
          <div className="map-bar">
            <div className="map-toggle" role="group" aria-label="View">
              <button type="button" className="map-toggle__btn" aria-pressed={listSnap !== 'closed'} aria-label="List" onClick={() => setListSnap('full')}><Icon name="grid" size={22} solid={listSnap !== 'closed'} /></button>
              <button type="button" className="map-toggle__btn" aria-pressed={listSnap === 'closed'} aria-label="Map" onClick={() => { setListSnap('closed'); searchRef.current?.blur(); }}><Icon name="map" size={22} solid={listSnap === 'closed'} /></button>
            </div>
            <label className="map-search">
              <Icon name="search" size={22} />
              <span className="sr-only">Search finds</span>
              <input ref={searchRef} type="search" placeholder="Search or ask" value={search} enterKeyHint="search" autoComplete="off" onFocus={() => setListSnap('full')} onChange={(e) => setSearchFlip(e.target.value)} />
              {search && <button type="button" className="map-search__clear" aria-label="Clear search" onClick={() => { setSearchFlip(''); searchRef.current?.focus(); }}><Icon name="close" size={18} /></button>}
            </label>
          </div>
          <p className="map-credit">{credit}{layersOn > 0 && ' Collectible locations: Game Checklists.'}</p>
        </div>
      )}

      {/* Phone: Apple Maps sheet, clip at the top */}
      {phone && (
        <Sheet snaps={findSnaps} snap={findSnap} onSnap={onFindSnap} closedId="closed" enabled inert={!selected} className="fsheet" label={shown ? shown.title : 'Find'} role="dialog">
          {shown && <SheetContent key={shown.slug} find={shown} meta={meta} titleId="sheet-title" onClose={closeFind} onShowOnMap={() => showOnMap(shown)} onCopy={() => copyLink(shown)} onShare={() => share(shown)} found={found.has(shown.slug)} onToggleFound={() => toggleFoundFlip(shown.slug)} chapter={chapter} />}
        </Sheet>
      )}
    </section>
  );
}

/** Hypelist's sort popover: two rows, the option left and its glyph right, growing out of its trigger. */
function SortMenu({ at, sort, onPick, onClose }: { at: MenuAt | null; sort: Sort; onPick: (s: Sort) => void; onClose: (restore: boolean) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: PointerEvent) => { const t = e.target as Element; if (!box.current?.contains(t) && !t.closest?.('[aria-controls="map-sort"]')) onClose(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(true); } };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    requestAnimationFrame(() => box.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true }));
    return () => { document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('keydown', onKey, true); };
  }, []);
  const opts: { id: Sort; label: string; icon: 'arrow-down' | 'grid' }[] = [{ id: 'newest', label: 'Newest', icon: 'arrow-down' }, { id: 'az', label: 'A to Z', icon: 'grid' }];
  return (
    <div ref={box} id="map-sort" className="popover popover--sort" role="menu" aria-label="Sort finds" data-up={at?.up || undefined} data-right={at?.right || undefined} style={at ? ({ '--mx': `${at.x}px`, '--my': `${at.y}px` } as React.CSSProperties) : undefined}>
      {opts.map((o) => (
        <button key={o.id} type="button" role="menuitemradio" aria-checked={sort === o.id} className="msortrow" onClick={() => onPick(o.id)}>
          <span>{o.label}</span><Icon name={o.icon} size={18} />
        </button>
      ))}
    </div>
  );
}
