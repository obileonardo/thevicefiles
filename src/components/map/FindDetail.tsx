// One find, in two shapes.
//   Desktop: Felt's inspector at the right of the map, dressed as Jeff christy C08's frosted panel (round 2): clip on
//   top, C08's hanging tab and corner ticks, the title between two hairlines, the number box, status lines and the
//   numbers pair, Felt's icon row (Found, Share, Copy link, Open page), then the Details and Sources tabs.
//   Phone: the Apple Maps place sheet with the clip at the top (MasterClass, owner answer 4B): grabber, share and
//   close circles, centred title (C08's hairlines) and subtitle, badge, actions, C08's numbers, credits, about, sources.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ClipPlayer } from './ClipPlayer';
import { Button, Icon, Tabs, Verification } from './ui';
import { accuracyLabels, cellOf, findUrl, formatDate, platformLabel, sourceIcon, verificationLabels, type MapFind, type MapMeta } from './types';
import { blipSvg, glyphOf } from './blip';
import type { ChapterSetting } from '../../lib/chapter';

type Common = {
  find: MapFind;
  meta: MapMeta;
  onClose: () => void;
  onShowOnMap: () => void;
  onCopy: () => Promise<boolean> | void;
  onShare: () => void;
  titleId: string;
  found: boolean; // found tracker (found.ts)
  onToggleFound: () => void;
  chapter: ChapterSetting; // the visitor's chapter setting (src/lib/chapter.ts): opens spoiler clips it has reached
};

/**
 * Copy link (motion study item 11): the link icon turns away as a check arrives, holds for 1.6s, then turns back.
 * The look lives in components.css (.copy), shared with the find page. A second press while it shows "Copied"
 * copies again and keeps it there: nothing restarts. Readers hear "Link copied" once, from the live region.
 */
function CopyButton({ onCopy, label }: { onCopy: () => Promise<boolean> | void; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(0);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <button type="button" className="btn btn--ghost btn--m btn--icon copy" aria-label={label} title={label} data-copied={copied || undefined}
      onClick={async () => {
        const ok = await onCopy();
        if (ok === false) return;
        setCopied(true);
        clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setCopied(false), 1600);
      }}>
      <span className="copy__icons" aria-hidden="true">
        <Icon name="link" size={20} className="copy__from" />
        <Icon name="check" size={20} className="copy__to" />
      </span>
      <span className="sr-only" aria-live="polite">{copied ? 'Link copied' : ''}</span>
    </button>
  );
}

const hostOf = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; } };

function Credits({ find }: { find: MapFind }) {
  const cards: { name: string; role: string; url: string | null; icon: 'person' | 'clip' }[] = [];
  if (find.finder) cards.push({ name: find.finder.handle, role: `First found it, on ${platformLabel(find.finder.platform)}`, url: find.finder.url, icon: 'person' });
  if (find.clip?.creator) cards.push({ name: find.clip.creator, role: `Clip, on ${platformLabel(find.clip.platform)}`, url: find.clip.url, icon: 'clip' });
  if (!cards.length) cards.push({ name: 'Not credited yet', role: 'The first finder is not known', url: null, icon: 'person' });
  return (
    <ul className="credits" role="list">
      {cards.map((c) => {
        const body = (
          <>
            <span className="credits__avatar" aria-hidden="true">{c.name === 'Not credited yet' ? <Icon name={c.icon} size={22} /> : c.name.replace(/^u\//, '').slice(0, 1).toUpperCase()}</span>
            <span className="credits__text"><span className="credits__name">{c.name}</span><span className="credits__role">{c.role}</span></span>
            {c.url && <Icon name="arrow-up-right" size={20} className="credits__go" />}
          </>
        );
        return <li key={c.name + c.role}>{c.url ? <a className="credits__card" href={c.url} target="_blank" rel="noopener">{body}</a> : <div className="credits__card">{body}</div>}</li>;
      })}
    </ul>
  );
}

// A mature find's sources stay on its own page (LR84): one chip says how many and opens the page.
function Sources({ find, scroll }: { find: MapFind; scroll?: boolean }) {
  return (
    <ul className={`sources${scroll ? ' sources--scroll' : ''}`} role="list">
      {find.mature && !find.sources.length && find.sourceCount > 0 && (
        <li>
          <a className="source" href={findUrl(find.slug)}>
            <span className="source__icon"><Icon name={sourceIcon('article')} size={16} /></span>
            <span className="source__label">{find.sourceCount} {find.sourceCount === 1 ? 'source' : 'sources'} on the find page</span>
            <Icon name="arrow-right" size={16} className="source__go" />
          </a>
        </li>
      )}
      {find.sources.map((s) => (
        <li key={s.url}>
          <a className="source" href={s.url} target="_blank" rel="noopener">
            <span className="source__icon"><Icon name={sourceIcon(s.type)} size={16} /></span>
            <span className="source__label">{s.creator ?? hostOf(s.url)}</span>
            <Icon name="arrow-up-right" size={16} className="source__go" />
          </a>
        </li>
      ))}
    </ul>
  );
}

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="field">
    <dt className="field__label">{label}</dt>
    <dd className="field__well">{children}</dd>
  </div>
);

function pinText(find: MapFind, meta: MapMeta) {
  if (!find.pin) return 'Not placed yet';
  const cell = cellOf(find.pin, meta);
  return [find.pinAccuracy ? accuracyLabels[find.pinAccuracy] ?? find.pinAccuracy : null, cell ? `cell ${cell}` : null].filter(Boolean).join(', ');
}

/**
 * Jeff christy C08's numbers, filled with ours: the number box (sources), the verification and pin status lines
 * (his objectives) and the "rewards" pair (GTAverse connections and crossover games) around a tiny boxed plus.
 */
export function FindNumbers({ find, meta }: { find: MapFind; meta: MapMeta }) {
  const cell = cellOf(find.pin, meta);
  const acc = find.pinAccuracy ? (accuracyLabels[find.pinAccuracy] ?? find.pinAccuracy).replace(/ only$/, '') : 'placed';
  const pinned = find.pin ? `Pinned: ${acc}${cell ? `, ${cell}` : ''}` : 'Not pinned yet';
  return (
    <div className="dnums">
      <p className="dnum"><span className="dnum__box tabular">{find.sourceCount}</span><span className="dnum__label">{find.sourceCount === 1 ? 'Source' : 'Sources'}</span></p>
      <ul className="dstatus" role="list">
        <li className={find.verification === 'multi-source' ? 'is-accent' : undefined}>{verificationLabels[find.verification] ?? find.verification}</li>
        <li className="is-quiet">{pinned}</li>
      </ul>
      <dl className="dpair">
        <div><dt>{find.connections === 1 ? 'Connection' : 'Connections'}</dt><dd className="tabular">{find.connections}</dd></div>
        <span className="dpair__plus" aria-hidden="true" />
        <div><dt>{find.games === 1 ? 'Game' : 'Games'}</dt><dd className="tabular">{find.games}</dd></div>
      </dl>
    </div>
  );
}

/** The summary in three lines with "More" (C08's body). Whole lines are hidden, so no glyph is ever cut. */
function Summary({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > 150;
  return (
    <div className="dsum">
      <p className={`dsum__text${long && !open ? ' is-clamped' : ''}`}>{text}</p>
      {long && <button type="button" className="dsum__more" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? 'Less' : 'More'}</button>}
    </div>
  );
}

export function DrawerContent({ find, meta, onClose, onCopy, onShare, titleId, found, onToggleFound, chapter }: Common) {
  const [tab, setTab] = useState<'details' | 'sources'>('details');
  return (
    <>
      <ClipPlayer find={find} variant="drawer" chapter={chapter} />
      <Button variant="glass" size="m" icon="close" iconOnly label="Close" onClick={onClose} className="drawer__close" />
      <div className="drawer__body">
        {/* C08's hanging tab (the find's blip plate grown into a tab, holding its type glyph) and the corner ticks */}
        <span className="dtab" aria-hidden="true" dangerouslySetInnerHTML={{ __html: blipSvg(glyphOf(find.category), { size: 24, uid: `dtab-${find.slug}` }) }} />
        <span className="dticks" aria-hidden="true"><i /><i /><i /><i /></span>
        <p className="dkicker">{find.categoryLabel} · {find.regionLabel}</p>
        <h2 className="dtitle" id={titleId}>{find.title}</h2>
        <FindNumbers find={find} meta={meta} />
        <Summary text={find.summary} />
        <div className="drawer__actions">
          <Button variant="ghost" size="m" icon="check" iconOnly label={found ? 'Found. Mark as not found' : 'Mark as found'} aria-pressed={found} onClick={onToggleFound} className="found-toggle" />
          <Button variant="ghost" size="m" icon="share" iconOnly label="Share this find" onClick={onShare} />
          <CopyButton onCopy={onCopy} label="Copy link to this find" />
          <Button variant="ghost" size="m" icon="arrow-right" iconOnly label="Open the find page" href={findUrl(find.slug)} />
        </div>
        <div className="drawer__tabs">
          <Tabs id="drawer" label="Find" selected={tab} onSelect={(t) => setTab(t as 'details' | 'sources')} tabs={[{ id: 'details', label: 'Details' }, { id: 'sources', label: `Sources (${find.sourceCount})` }]}>
            {(t) => t === 'details' ? (
              <>
                <dl className="fields">
                  {find.where && <Field label="Where">{find.where}</Field>}
                  <Field label="Region">{find.regionLabel}</Field>
                  <Field label="Pin">{pinText(find, meta)}</Field>
                  {formatDate(find.updated) && <Field label="Updated">{formatDate(find.updated)}</Field>}
                </dl>
                <h3 className="drawer__label">Credits</h3>
                <Credits find={find} />
              </>
            ) : <Sources find={find} />}
          </Tabs>
        </div>
      </div>
    </>
  );
}

export function SheetContent({ find, meta, onClose, onShowOnMap, onShare, titleId, found, onToggleFound, chapter }: Common) {
  return (
    <>
      <div className="fsheet__top" data-sheet-handle>
        <ClipPlayer find={find} variant="sheet" chapter={chapter} />
        <span className="grabber" aria-hidden="true" />
        <Button variant="glass" size="l" icon="share" iconOnly label="Share this find" onClick={onShare} className="fsheet__corner fsheet__corner--left" />
        <Button variant="glass" size="l" icon="close" iconOnly label="Close" onClick={onClose} className="fsheet__corner fsheet__corner--right" />
      </div>
      <div className="fsheet__body">
        <header className="fsheet__head" data-sheet-handle>
          <h2 className="fsheet__title dtitle" id={titleId}>{find.title}</h2>
          <p className="fsheet__sub">{find.categoryLabel} · {find.regionLabel}</p>
          <p className="fsheet__badge"><Verification level={find.verification} /></p>
        </header>
        <div className="fsheet__actions">
          <Button variant="primary" stack icon="arrow-right" href={findUrl(find.slug)}>Find page</Button>
          <Button variant="secondary" stack icon="pin" onClick={onShowOnMap} disabled={!find.pin}>{find.pin ? 'Map' : 'No pin yet'}</Button>
          <Button variant="secondary" stack icon="check" onClick={onToggleFound} aria-pressed={found} className="found-toggle">Found</Button>
          <Button variant="secondary" stack icon="share" onClick={onShare}>Share</Button>
        </div>
        <FindNumbers find={find} meta={meta} />
        <section className="fsheet__section" aria-labelledby={`${titleId}-credits`}>
          <h3 className="fsheet__label" id={`${titleId}-credits`}>Credits</h3>
          <Credits find={find} />
        </section>
        <section className="fsheet__section" aria-labelledby={`${titleId}-about`}>
          <h3 className="fsheet__h" id={`${titleId}-about`}>About</h3>
          <p className="fsheet__text">{find.summary}</p>
          {find.where && <p className="fsheet__text fsheet__where"><Icon name="pin" size={20} /><span>{find.where}</span></p>}
        </section>
        <section className="fsheet__section" aria-labelledby={`${titleId}-sources`}>
          <h3 className="fsheet__h" id={`${titleId}-sources`}>Sources</h3>
          <Sources find={find} scroll />
        </section>
      </div>
    </>
  );
}
