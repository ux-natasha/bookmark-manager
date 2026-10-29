import { useState, type CSSProperties, type ReactNode, type SyntheticEvent } from 'react';
import { Favicon } from '../components/Favicon';
import { ageLabel, sourcePrefix } from '../lib/age';
import { markOpened } from '../lib/bookmarks';
import { coverColors } from '../lib/covers';
import { isDeadLink, kindOf, type Bookmark } from '../lib/db';
import { formatDate } from '../lib/hooks';
import { hostnameOf } from '../lib/normalize';
import { platformById } from '../lib/platform';
import { fallbackColor, usePreviewUrl } from '../lib/previews';
import { useTheme } from '../lib/theme';
import { useItemAge } from './ageContext';
import { copyFor } from './copy';
import { useItemColor } from './Field';
import { FiledUnderLine } from './FiledUnderLine';

interface Props {
  bookmark: Bookmark;
  onEdit: (bookmark: Bookmark) => void;
  onTagClick: (tag: string) => void;
  // Saved this session from the library, so it plays the arrive animation.
  arriving?: boolean;
  // Which way an aged card tilts: neighbours in a column lean opposite ways.
  side?: 1 | -1;
}

export function BookmarkCard({ bookmark, onEdit, onTagClick, arriving, side = 1 }: Props) {
  const kind = kindOf(bookmark);
  const dead = isDeadLink(bookmark);
  // Colour field: the card glows in the item's colour.
  const glow = useItemColor(bookmark.id);
  const age = useItemAge(bookmark);
  const ageing = copyFor(useTheme()).ageing;
  const classes = ['card', `card-kind-${kind}`];
  if (dead) classes.push('is-dead');
  if (arriving) classes.push('is-arriving');
  if (age.faded) classes.push('is-faded');
  if (age.delay !== undefined) classes.push('is-reviving');
  // "dusted off just now" for the rest of the session, until the page looks ahead.
  const revivedText = age.revived && !age.lookingAhead ? ageing.revived(age.revived.months, age.revived.batch) : undefined;
  const label = ageLabel(bookmark, age.now);

  return (
    <article
      className={classes.join(' ')}
      data-item-id={bookmark.id}
      style={{ ...age.style, '--side': side, ...(glow && { '--glow': glow }) } as CSSProperties}
    >
      {glow && !dead && <span className="card-halo" aria-hidden="true" />}
      <CardLink bookmark={bookmark} onEdit={onEdit}>
        {kind === 'link' && <LinkContent bookmark={bookmark} />}
        {kind === 'image' && <ImageContent bookmark={bookmark} />}
        {kind === 'quote' && <QuoteContent bookmark={bookmark} />}
        {kind === 'note' && <NoteContent bookmark={bookmark} />}
      </CardLink>
      <footer className="card-footer">
        {bookmark.tags.length > 0 && <FiledUnderLine tags={bookmark.tags} onTagClick={onTagClick} />}
        <div className="card-meta small muted">
          <span className={`card-age${!revivedText && label.danger ? ' is-danger' : ''}`} title={ageTitle(bookmark)}>
            {revivedText ?? `${sourcePrefix(bookmark)} · ${label.text}`}
          </span>
          {age.canDust && (
            <button type="button" className="dust-button" onClick={age.dust}>
              {ageing.dust}
            </button>
          )}
          <button className="link small" onClick={() => onEdit(bookmark)}>
            Edit
          </button>
        </div>
      </footer>
    </article>
  );
}

// "Saved Oct 3 · last opened Oct 20": the full dates behind the age text.
function ageTitle(b: Bookmark): string {
  const saved = `Saved ${formatDate(b.createdAt)}`;
  if (kindOf(b) === 'note') return `${saved} · edited ${formatDate(b.updatedAt)}`;
  return b.lastOpenedAt ? `${saved} · last opened ${formatDate(b.lastOpenedAt)}` : `${saved} · never opened`;
}

// Links, pictures and quotes open the page they're from; notes (and anything without a page) open for editing.
export function CardLink({
  bookmark,
  onEdit,
  className = 'card-link',
  ariaLabel,
  children,
}: {
  bookmark: Bookmark;
  onEdit: (b: Bookmark) => void;
  className?: string;
  // Set when the visible content is decoration (a typeset cover) rather than a readable name.
  ariaLabel?: string;
  children: ReactNode;
}) {
  const href = bookmark.url || bookmark.imageUrl;
  if (!href) {
    return (
      <button type="button" className={className} data-card-link aria-label={ariaLabel} onClick={() => onEdit(bookmark)}>
        {children}
      </button>
    );
  }
  const open = () => markOpened(bookmark.id);
  return (
    <a
      className={className}
      data-card-link
      aria-label={ariaLabel}
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={open}
      // Middle-click opens in a background tab and should count as opening it too.
      onAuxClick={(e) => e.button === 1 && open()}
    >
      {children}
    </a>
  );
}

// Shapes of previews already loaded, so a card that mounts again starts at its real height
// and the masonry doesn't jump.
const ratios = new Map<string, number>();

function useMediaRatio(bookmark: Bookmark, min: number, max: number) {
  const key = `${bookmark.id}:${bookmark.previewPreference ?? ''}`;
  const [ratio, setRatio] = useState(() => ratios.get(key));
  const onLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    if (!w || !h) return;
    const next = Math.min(max, Math.max(min, w / h));
    ratios.set(key, next);
    setRatio(next);
  };
  return { style: ratio ? ({ '--ratio': ratio } as CSSProperties) : undefined, onLoad };
}

// The glow behind a link's or picture's media: its dominant colour, else the site's, else one from the hostname.
// Colour field draws its own halo behind the whole card.
function Halo({ bookmark }: { bookmark: Bookmark }) {
  return <span className="card-halo card-halo-media" style={{ '--glow': bookmark.color || fallbackColor(bookmark) } as CSSProperties} aria-hidden="true" />;
}

function LinkContent({ bookmark }: { bookmark: Bookmark }) {
  const previewUrl = usePreviewUrl(bookmark);
  // Between 4:5 and 2:1, so a full-page screenshot doesn't make a card a column long.
  const media = useMediaRatio(bookmark, 0.8, 2);
  const platform = platformById(bookmark.platform);
  const source = platform?.label ?? bookmark.siteName ?? hostnameOf(bookmark.url);
  const dead = isDeadLink(bookmark);
  const field = useTheme() === 'field';

  // Designed fallback for pages with no image: the site's colour with its name and the title typeset on it.
  const cover = coverColors(bookmark.color || fallbackColor(bookmark));
  const previewStyle = previewUrl ? media.style : ({ '--ratio': 1.91 } as CSSProperties);

  return (
    <>
      <div className="card-lift">
        {!field && !dead && <Halo bookmark={bookmark} />}
        <div className="card-preview" style={previewStyle}>
          {previewUrl ? (
            <img className="card-preview-image" src={previewUrl} alt="" loading="lazy" onLoad={media.onLoad} />
          ) : (
            <div className="card-fallback" style={{ background: cover.background, color: cover.ink }}>
              <span className="card-fallback-name">{source}</span>
            </div>
          )}
          {platform && <span className="card-platform">{platform.label}</span>}
          {previewUrl && VIDEO_PLATFORMS.has(bookmark.platform ?? '') && <span className="card-play" aria-hidden="true" />}
        </div>
        {dead && (
          <span className="card-dead" title={bookmark.linkStatus === 'gone' ? 'The site says this page no longer exists' : "The site hasn't answered in two checks"}>
            MAY BE DEAD
          </span>
        )}
      </div>
      <div className="card-body">
        <h3 className="card-title">{bookmark.title}</h3>
        {field && (
          <p className="small muted truncate card-host">
            <KindTag kind="link" word={dead ? 'may be dead' : linkKind(bookmark)} />
            <Favicon url={bookmark.url} />
            {bookmark.siteName && bookmark.siteName !== platform?.label ? `${bookmark.siteName} · ` : ''}
            {hostnameOf(bookmark.url)}
          </p>
        )}
        {bookmark.note ? (
          <p className="card-note small">{bookmark.note}</p>
        ) : (
          bookmark.description && <p className="card-description small muted">{bookmark.description}</p>
        )}
      </div>
    </>
  );
}

function ImageContent({ bookmark }: { bookmark: Bookmark }) {
  const pictureUrl = usePreviewUrl(bookmark);
  const media = useMediaRatio(bookmark, 2 / 3, 2.5);
  const field = useTheme() === 'field';
  return (
    <>
      <div className="card-lift">
        {!field && <Halo bookmark={bookmark} />}
        <div className="card-picture" style={pictureUrl ? media.style : undefined}>
          {pictureUrl ? (
            <img src={pictureUrl} alt={bookmark.title} loading="lazy" onLoad={media.onLoad} />
          ) : (
            <span className="small muted">Picture couldn't be downloaded</span>
          )}
          {field && <span className="card-platform">Picture</span>}
        </div>
      </div>
      {(field || bookmark.note) && (
        <div className="card-body">
          {/* The meta line names the source in the other themes, so the title isn't repeated. */}
          {field && <h3 className="card-title">{bookmark.title}</h3>}
          {field && <SourceLine bookmark={bookmark} />}
          {bookmark.note && <p className="card-note small">{bookmark.note}</p>}
        </div>
      )}
    </>
  );
}

function QuoteContent({ bookmark }: { bookmark: Bookmark }) {
  const field = useTheme() === 'field';
  return (
    <div className="card-body">
      <blockquote className={`card-quote${(bookmark.text ?? '').length > 60 ? ' is-long' : ''}`}>{bookmark.text}</blockquote>
      <p className="small card-quote-title truncate">{bookmark.title}</p>
      {field && <SourceLine bookmark={bookmark} kindTag />}
      {bookmark.note && <p className="card-note small">{bookmark.note}</p>}
    </div>
  );
}

function NoteContent({ bookmark }: { bookmark: Bookmark }) {
  // Untitled notes are titled by their first line, so it isn't repeated underneath.
  const [firstLine, ...rest] = (bookmark.text ?? '').split('\n');
  const body = firstLine.trim() === bookmark.title ? rest.join('\n').trim() : bookmark.text;
  const field = useTheme() === 'field';
  return (
    <div className="card-body">
      {field ? (
        <p className="small muted card-host">
          <KindTag kind="note" word="note" />
        </p>
      ) : (
        <p className="card-note-top">your note · {formatDate(bookmark.createdAt)}</p>
      )}
      <h3 className="card-title">{bookmark.title}</h3>
      {body && <p className="card-note-text small">{body}</p>}
    </div>
  );
}

function SourceLine({ bookmark, kindTag }: { bookmark: Bookmark; kindTag?: boolean }) {
  if (!bookmark.url) return null;
  return (
    <p className="small muted truncate card-host">
      {kindTag && <KindTag kind="quote" word="quote" />}
      <Favicon url={bookmark.url} />
      from {platformById(bookmark.platform)?.label ?? hostnameOf(bookmark.url)}
    </p>
  );
}

const VIDEO_PLATFORMS = new Set(['youtube', 'vimeo']);
const REPO_PLATFORMS = new Set(['github', 'gitlab', 'codeberg']);
const ARTICLE_PLATFORMS = new Set(['substack', 'medium', 'devto', 'ghost', 'beehiiv', 'wikipedia']);

// Colour field names what kind of link it is on the card's pill.
function linkKind(b: Bookmark): string {
  const platform = b.platform ?? '';
  if (VIDEO_PLATFORMS.has(platform)) return 'video';
  if (b.details?.recipe) return 'recipe';
  if (REPO_PLATFORMS.has(platform)) return 'repo';
  if (platformById(platform)?.social) return 'post';
  if (ARTICLE_PLATFORMS.has(platform)) return 'article';
  return 'link';
}

// An outline pill in the kind's colour (Colour field 2.2). The word says the kind, so colour isn't the only cue.
function KindTag({ kind, word }: { kind: 'link' | 'quote' | 'note'; word: string }) {
  return <span className={`kind-tag kind-tag-${kind}`}>{word}</span>;
}
