import { useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { coverFor } from '../lib/covers';
import { isDeadLink, kindOf, type Bookmark } from '../lib/db';
import { formatDate } from '../lib/hooks';
import { linkShows, useLinksShow } from '../lib/linksShow';
import { platformById } from '../lib/platform';
import { usePreviews, usePreviewUrlOfKind } from '../lib/previews';
import { useTheme } from '../lib/theme';
import { useItemAge } from './ageContext';
import { CardLink } from './BookmarkCard';
import { copyFor } from './copy';
import { Cover } from './Cover';
import { FiledUnderLine } from './FiledUnderLine';
import { useFinished, useFresh } from './useFresh';

// The Covers theme's layout: rows of 3:4 covers standing on shelves, in sort order,
// so reading and keyboard order run row by row (docs/design/theme-covers.md, 3).

const COVER_MIN = 210;
const GAP = 28;
const MAX_COLUMNS = 6;
const PRESS_MS = 900;

interface Props {
  bookmarks: Bookmark[];
  plates: Map<string, number>;
  // Saved this session; each slides up onto the shelf once when it first appears.
  arrivedIds: Set<string>;
  onEdit: (bookmark: Bookmark) => void;
  onTagClick: (tag: string) => void;
}

export function Rack({ bookmarks, plates, arrivedIds, onEdit, onTagClick }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const columns = useColumns(ref);
  const pressing = useFresh(arrivedIds, PRESS_MS);
  const rows: Bookmark[][] = [];
  for (let i = 0; i < bookmarks.length; i += columns) rows.push(bookmarks.slice(i, i + columns));

  return (
    <div className="rack" ref={ref} role="list" style={{ '--rack-columns': columns } as CSSProperties}>
      {rows.map((row) => (
        <div className="rack-shelf" key={row[0].id}>
          <div className="rack-row">
            {row.map((b) => (
              <RackItem key={b.id} bookmark={b} plate={plates.get(b.id)} pressing={pressing.has(b.id)} onEdit={onEdit} onTagClick={onTagClick} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Blank boards on a shelf while the library loads. No shimmer.
export function RackLoading() {
  return (
    <div className="rack" aria-hidden="true" style={{ '--rack-columns': 4 } as CSSProperties}>
      <div className="rack-shelf">
        <div className="rack-row">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="rack-item">
              <div className="cover cover--blank" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// n = max(1, floor((width + gap) / (cover + gap))), capped at 6; two per shelf on narrow screens.
export function columnsFor(width: number): number {
  if (width < 720) return width >= 2 * 150 + GAP ? 2 : 1;
  return Math.min(MAX_COLUMNS, Math.max(1, Math.floor((width + GAP) / (COVER_MIN + GAP))));
}

function useColumns(ref: RefObject<HTMLElement>): number {
  const [columns, setColumns] = useState(4);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setColumns(columnsFor(el.clientWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return columns;
}

interface ItemProps {
  bookmark: Bookmark;
  plate: number | undefined;
  pressing: boolean;
  onEdit: (bookmark: Bookmark) => void;
  onTagClick: (tag: string) => void;
}

function RackItem({ bookmark, plate, pressing, onEdit, onTagClick }: ItemProps) {
  const kind = kindOf(bookmark);
  const spec = coverFor(bookmark);
  const linksShow = useLinksShow();
  const previews = usePreviews(bookmark.id);
  // Pictures always show themselves; links show a preview only when asked to, and only one that exists.
  const shows = kind === 'image' ? 'image' : kind === 'link' ? linkShows(bookmark.previewPreference, linksShow) : 'cover';
  const usesPreview = shows !== 'cover' && spec.template !== 'dead' && spec.template !== 'proof';
  const imageUrl = usePreviewUrlOfKind(previews, usesPreview ? shows : undefined);
  // A proof is replaced by the real cover with the press animation.
  const printed = useFinished(spec.template === 'proof', PRESS_MS);
  const age = useItemAge(bookmark);
  const ageing = copyFor(useTheme()).ageing;

  const classes = ['rack-item', `rack-item-${kind}`];
  if (spec.template === 'dead') classes.push('is-dead');
  if (spec.template === 'proof') classes.push('is-proof');
  if (pressing || printed) classes.push('is-pressing');
  // Taken down: the lean and fading clear, then the red band slides in.
  if (age.delay !== undefined) classes.push('is-reviving');

  const name = kind === 'link' ? (spec.template === 'proof' ? spec.host : bookmark.title) : truncate(spec.title || bookmark.title, 140);

  return (
    <article className={classes.join(' ')} role="listitem" data-item-id={bookmark.id} style={age.style}>
      <CardLink bookmark={bookmark} onEdit={onEdit} className="rack-link" ariaLabel={`${name}, ${spec.kindWord}`}>
        <Cover
          spec={spec}
          imageUrl={imageUrl}
          platformLabel={platformById(bookmark.platform)?.label}
          plate={plate}
          createdAt={bookmark.createdAt}
          backInPrint={!!age.revived}
        />
        {kind === 'link' && <span className="rack-title">{spec.template === 'proof' ? 'Details on the way' : bookmark.title}</span>}
      </CardLink>
      {bookmark.tags.length > 0 && <FiledUnderLine tags={bookmark.tags} onTagClick={onTagClick} />}
      <div className="rack-meta">
        <span className="rack-age">
          {age.revived && !age.lookingAhead ? ageing.revived(age.revived.months, age.revived.batch) : ageText(bookmark, spec.template === 'proof')}
        </span>
        {age.canDust && (
          <button type="button" className="dust-button" onClick={age.dust}>
            {ageing.dust}
          </button>
        )}
        <button type="button" className="rack-edit" onClick={() => onEdit(bookmark)}>
          Edit
        </button>
      </div>
    </article>
  );
}

function ageText(b: Bookmark, proof: boolean): string {
  if (isDeadLink(b)) return b.lastCheckedAt ? `stopped answering ${formatDate(b.lastCheckedAt)}` : 'stopped answering';
  if (proof) return 'details on the way';
  if (kindOf(b) === 'note') return `written ${formatDate(b.updatedAt)}`;
  return b.lastOpenedAt ? `opened ${formatDate(b.lastOpenedAt)}` : 'never opened';
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
}
