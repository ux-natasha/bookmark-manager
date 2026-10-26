import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { codeKind, itemCode, subKind } from '../lib/codes';
import { isDeadLink, kindOf, type Bookmark } from '../lib/db';
import { formatDate } from '../lib/hooks';
import { hostnameOf } from '../lib/normalize';
import { platformById } from '../lib/platform';
import { fallbackColor, usePreviewUrl } from '../lib/previews';
import { CardLink } from './BookmarkCard';

// The Contact sheet theme's grid: every item is a frame on one hairline sheet, in row order.
// Replaces the card grid (and, later, the masonry) when that theme is on.

const DEVELOP_MS = 1400;
const CARET_MS = 60_000;

const KIND_WORDS: Record<ReturnType<typeof codeKind>, string> = {
  LNK: 'Link',
  VID: 'Video',
  PST: 'Post',
  REP: 'Repository',
  QTE: 'Quote',
  PIC: 'Picture',
  NTE: 'Note',
};

interface Props {
  bookmarks: Bookmark[];
  sequence: Map<string, number>;
  // Saved this session; each develops in once when it first appears.
  arrivedIds: Set<string>;
  onEdit: (bookmark: Bookmark) => void;
  onTagClick: (tag: string) => void;
}

export function Sheet({ bookmarks, sequence, arrivedIds, onEdit, onTagClick }: Props) {
  const developing = useDevelop(arrivedIds);
  return (
    <div className="sheet" role="list">
      {bookmarks.map((b) => (
        <SheetCell
          key={b.id}
          bookmark={b}
          sequence={sequence.get(b.id) ?? 0}
          developing={developing.has(b.id)}
          onEdit={onEdit}
          onTagClick={onTagClick}
        />
      ))}
    </div>
  );
}

// Ids that should play the develop animation right now: each id once, for 1.4s after it's added.
export function useDevelop(ids: Set<string>): Set<string> {
  const [developing, setDeveloping] = useState<Set<string>>(() => new Set());
  const seen = useRef(new Set(ids));
  useEffect(() => {
    const fresh = [...ids].filter((id) => !seen.current.has(id));
    if (!fresh.length) return;
    fresh.forEach((id) => seen.current.add(id));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    setDeveloping((current) => new Set([...current, ...fresh]));
    const timer = setTimeout(() => {
      setDeveloping((current) => new Set([...current].filter((id) => !fresh.includes(id))));
    }, DEVELOP_MS);
    return () => clearTimeout(timer);
  }, [ids]);
  return developing;
}

interface CellProps {
  bookmark: Bookmark;
  sequence: number;
  developing: boolean;
  onEdit: (bookmark: Bookmark) => void;
  onTagClick: (tag: string) => void;
}

function SheetCell({ bookmark, sequence, developing, onEdit, onTagClick }: CellProps) {
  const kind = kindOf(bookmark);
  const dead = isDeadLink(bookmark);
  const previewUrl = usePreviewUrl(bookmark);
  // Media aspect ratio, known once the image loads.
  const [ratio, setRatio] = useState<number>();
  // A link waiting for its details is an unexposed frame; it develops in when they arrive.
  const unexposed = kind === 'link' && !bookmark.enrichedAt && !previewUrl;
  const wasUnexposed = useRef(unexposed);
  const [exposedNow, setExposedNow] = useState(false);
  useEffect(() => {
    if (wasUnexposed.current && !unexposed) {
      setExposedNow(true);
      const timer = setTimeout(() => setExposedNow(false), DEVELOP_MS);
      wasUnexposed.current = false;
      return () => clearTimeout(timer);
    }
  }, [unexposed]);

  const classes = ['sheet-cell', `sheet-cell-${kind}`];
  if (kind === 'quote') classes.push('span2');
  if (dead) classes.push('is-dead');
  if (developing || exposedNow) classes.push('is-developing');

  const onImageLoad = (img: HTMLImageElement) => img.naturalHeight && setRatio(img.naturalWidth / img.naturalHeight);

  return (
    <article className={classes.join(' ')} role="listitem">
      <svg aria-hidden="true" className="sheet-plus" viewBox="0 0 13 13">
        <path d="M6.5 0v13M0 6.5h13" stroke="currentColor" strokeWidth="1" />
      </svg>
      <CardLink bookmark={bookmark} onEdit={onEdit} className="sheet-link">
        <span className="visually-hidden">{KIND_WORDS[codeKind(bookmark)]}: </span>
        <span className="sheet-top">
          <span className="sheet-code" aria-hidden="true">
            {itemCode(bookmark, sequence)}
          </span>
          <span className={`sheet-corner ${dead ? 'is-accent' : ''}`}>{cornerLabel(bookmark, ratio)}</span>
        </span>

        {kind === 'link' &&
          (unexposed ? (
            <span className="sheet-media sheet-unexposed" aria-hidden="true" />
          ) : (
            <span
              className="sheet-media"
              style={{ aspectRatio: clamp(ratio ?? 1.91, 0.8, 2), background: previewUrl ? undefined : fallbackColor(bookmark) } as CSSProperties}
            >
              {previewUrl ? (
                <img src={previewUrl} alt="" loading="lazy" onLoad={(e) => onImageLoad(e.currentTarget)} />
              ) : (
                <span className="sheet-fallback">{bookmark.siteName ?? hostnameOf(bookmark.url)}</span>
              )}
              {subKind(bookmark) === 'video' && (
                <svg aria-hidden="true" className="sheet-play" width="22" height="22" viewBox="0 0 24 24">
                  <path d="M7 4v16l13-8z" fill="#fff" />
                </svg>
              )}
              <CropMarks />
            </span>
          ))}

        {kind === 'image' && (
          <>
            <span className="sheet-frames" aria-hidden="true">
              <span>{pad(sequence)}</span>
              <span>▸ {pad(sequence)}A</span>
              <span>{pad(sequence + 1)}</span>
            </span>
            {previewUrl ? (
              <span className="sheet-media" style={{ aspectRatio: ratio ?? 4 / 3 }}>
                <img src={previewUrl} alt={bookmark.title} loading="lazy" onLoad={(e) => onImageLoad(e.currentTarget)} />
                <CropMarks />
              </span>
            ) : (
              <span className="sheet-media sheet-unexposed sheet-no-negative">
                No negative · picture couldn't be downloaded
              </span>
            )}
          </>
        )}

        {kind === 'quote' && <blockquote className="sheet-quote">“{bookmark.text}”</blockquote>}

        {kind === 'note' && <NoteText bookmark={bookmark} />}

        {kind === 'link' && <span className="sheet-title">{unexposed ? hostnameOf(bookmark.url) : bookmark.title}</span>}
      </CardLink>

      <div className="sheet-meta">
        {bookmark.tags.length > 0 && <FiledTags tags={bookmark.tags} onTagClick={onTagClick} />}
        <span className={`sheet-age ${dead ? 'is-accent' : ''}`}>{ageText(bookmark, unexposed)}</span>
        <button type="button" className="sheet-edit" onClick={() => onEdit(bookmark)}>
          Edit
        </button>
      </div>
    </article>
  );
}

function CropMarks() {
  return (
    <>
      <span className="crop tl" aria-hidden="true" />
      <span className="crop tr" aria-hidden="true" />
      <span className="crop bl" aria-hidden="true" />
      <span className="crop br" aria-hidden="true" />
    </>
  );
}

// Notes are typed in this theme. One saved in the last minute shows a blinking caret after its last character.
function NoteText({ bookmark }: { bookmark: Bookmark }) {
  const [caret, setCaret] = useState(() => Date.now() - bookmark.createdAt < CARET_MS);
  useEffect(() => {
    if (!caret) return;
    const timer = setTimeout(() => setCaret(false), Math.max(0, bookmark.createdAt + CARET_MS - Date.now()));
    return () => clearTimeout(timer);
  }, [caret, bookmark.createdAt]);
  return (
    // A span, since notes open in a button and a button can't hold a paragraph.
    <span className="sheet-note">
      {bookmark.text || bookmark.title}
      {caret && <span className="sheet-caret" aria-hidden="true" />}
    </span>
  );
}

// "FILED · WORK / READING +3". Nested tags show only their leaf.
function FiledTags({ tags, onTagClick }: { tags: string[]; onTagClick: (tag: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? tags : tags.slice(0, 2);
  return (
    <span className="sheet-tags">
      Filed ·{' '}
      {shown.map((tag, i) => (
        <span key={tag}>
          {i > 0 && ' / '}
          <button type="button" className="sheet-tag" aria-label={`Filter by ${tag}`} onClick={() => onTagClick(tag)}>
            {tag.split('/').pop()}
          </button>
        </span>
      ))}
      {!expanded && tags.length > 2 && (
        <button type="button" className="sheet-tag" aria-label={`Show ${tags.length - 2} more tags`} onClick={() => setExpanded(true)}>
          {' '}
          +{tags.length - 2}
        </button>
      )}
    </span>
  );
}

function cornerLabel(b: Bookmark, ratio: number | undefined): string {
  if (isDeadLink(b)) return b.linkStatus === 'gone' ? 'Gone' : `No answer ×${b.checkFailures ?? 2}`;
  switch (kindOf(b)) {
    case 'link':
      return platformById(b.platform)?.label ?? b.siteName ?? hostnameOf(b.url);
    case 'quote':
      return b.url ? hostnameOf(b.url) : '';
    case 'image':
      return ratio ? ratioLabel(ratio) : '';
    case 'note':
      return isToday(b.createdAt) ? 'Today' : formatDate(b.createdAt);
  }
}

function ageText(b: Bookmark, unexposed: boolean): string {
  if (isDeadLink(b)) return b.lastCheckedAt ? `stopped ${formatDate(b.lastCheckedAt)}` : 'stopped answering';
  if (unexposed) return 'details on the way';
  if (kindOf(b) === 'note') return `written ${formatDate(b.updatedAt)}`;
  return b.lastOpenedAt ? `opened ${formatDate(b.lastOpenedAt)}` : 'never opened';
}

// "4 : 5", or "1.91 : 1" when the picture's sides don't reduce to small whole numbers.
export function ratioLabel(ratio: number): string {
  for (let h = 1; h <= 16; h++) {
    const w = ratio * h;
    if (Math.abs(w - Math.round(w)) < 0.02 && Math.round(w) <= 16) return `${Math.round(w)} : ${h}`;
  }
  return `${ratio.toFixed(2)} : 1`;
}

function isToday(timestamp: number): boolean {
  return new Date(timestamp).toDateString() === new Date().toDateString();
}

function pad(n: number): string {
  return String(n).padStart(3, '0');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
