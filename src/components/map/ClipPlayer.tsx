// The click-to-load clip (same behaviour as src/components/Clip.astro): the creator's thumbnail first, the player
// only when tapped (youtube-nocookie, or the X or Reddit post embed, which then grows the frame to the post's height),
// spoiler clips behind a reveal. A mature clip plays on its own find page only (LR85): here its gate is a link there.
// An X or Reddit photo post shows its photo with a link to the post; any other clip opens the creator's post. A find
// with no clip shows the sunrise glow with its type in display caps.
import { useEffect, useRef, useState } from 'react';
import { clipLabels, embedForTheme, postEmbedOrigins, postHeight } from '../../lib/clip';
import { Icon } from './ui';
import { findUrl, platformLabel, type MapFind } from './types';
import { isUnlocked, type ChapterSetting } from '../../lib/chapter';

export function ClipPlayer({ find, variant, chapter = 'none' }: { find: MapFind; variant: 'drawer' | 'sheet'; chapter?: ChapterSetting }) {
  // A spoiler clip opens by itself once the visitor's chapter setting reaches its chapter (src/lib/chapter.ts). A find
  // with no clip has nothing to hide, so it shows no gate (LR84 for mature, LR85 for spoiler). A mature clip never
  // plays here: the map holds no link or player for it, and its gate opens the find page (LR85).
  const away = find.mature && !!find.clip;
  const hidden = !!find.clip && !away && find.spoiler && !isUnlocked(find.chapterGate, chapter);
  const [revealed, setRevealed] = useState(!hidden);
  const [playing, setPlaying] = useState(false);
  const [postH, setPostH] = useState<number | null>(null);
  const player = useRef<HTMLIFrameElement>(null);
  useEffect(() => { setRevealed(!hidden); setPlaying(false); setPostH(null); }, [find.slug, hidden]);

  const clip = find.clip;
  const embed = clip?.embed ?? null;
  const isPost = !!embed && !clip?.yt;
  // A post embed reports its height; the frame follows it (until then it keeps its 16:9 box).
  useEffect(() => {
    if (!playing || !isPost) return;
    const onMessage = (e: MessageEvent) => {
      if (!postEmbedOrigins.includes(e.origin) || e.source !== player.current?.contentWindow) return;
      const h = postHeight(e.data);
      if (h) setPostH(h);
    };
    addEventListener('message', onMessage);
    return () => removeEventListener('message', onMessage);
  }, [playing, isPost]);

  const theme = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  const labels = clipLabels(clip?.verb ?? 'play');
  const noun = labels.noun;
  return (
    <figure className={`clip-frame clip-frame--${variant}`} style={postH ? { aspectRatio: 'auto', height: Math.ceil(postH) } : undefined}>
      {playing && embed ? (
        <iframe
          ref={player}
          className="clip-frame__player"
          src={isPost ? embedForTheme(embed, theme) : embed}
          title={`Clip: ${find.title}`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <>
          <div className="clip-frame__art" aria-hidden="true">
            {revealed && clip?.thumb ? <img src={clip.thumb} alt="" loading="lazy" decoding="async" /> : <span className="clip-frame__glow"><span className="clip-frame__kind">{find.categoryLabel}</span></span>}
          </div>
          {away ? (
            <a className="clip-frame__reveal btn btn--glass btn--m" href={findUrl(find.slug)}>
              <Icon name="clip" size={20} />
              <span className="btn__label">{`Show mature ${noun} on the find page`}</span>
            </a>
          ) : !revealed ? (
            <button type="button" className="clip-frame__reveal btn btn--glass btn--m" onClick={() => setRevealed(true)}>
              <Icon name="clip" size={20} />
              <span className="btn__label">{`Reveal spoiler ${noun}`}</span>
            </button>
          ) : embed ? (
            <button type="button" className="clip-frame__play" onClick={() => setPlaying(true)} aria-label={`Play clip: ${find.title}`}>
              <span className="clip-frame__playdisc"><Icon name="play" size={28} /></span>
            </button>
          ) : clip?.url ? (
            <a className="clip-frame__reveal btn btn--glass btn--m" href={clip.url} target="_blank" rel="noopener">
              <span className="btn__label">{labels.on} {platformLabel(clip.platform)}</span>
              <Icon name="arrow-up-right" size={20} />
            </a>
          ) : null}
        </>
      )}
      {hidden && !revealed && <figcaption className="sr-only">This {noun} is hidden because it is marked spoiler.</figcaption>}
      {away && <figcaption className="sr-only">This {noun} is marked mature, so it is on the find page only.</figcaption>}
    </figure>
  );
}
