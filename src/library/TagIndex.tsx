import { useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { GreasePencil } from '../components/GreasePencil';
import { HOLLOW_FADE, tagName, type IndexEntry, type IndexGroup, type TagIndex as Index, type TidyThreshold } from '../lib/tags';
import { useTheme } from '../lib/theme';
import { TIDY_THRESHOLDS } from '../lib/tidyThreshold';
import { copyFor, tidySpan } from './copy';
import { slotStyle } from './tagLook';

// The open tag index (docs/design/library-interactions.md, 6.6 and 6.7): tall letters, entries with leaders,
// indented sub-entries, tags used once run in. Contact sheet lays the letters out as cells on a hairline grid;
// Covers sets it as the index page at the back of a book. Same data and behaviour in all three.

interface Props {
  id: string;
  index: Index;
  query: string;
  onQuery: (query: string) => void;
  threshold: TidyThreshold;
  onThreshold: (threshold: TidyThreshold) => void;
  untagged: { count: number; selected: boolean; tag: string };
  // keepOpen when Shift, Ctrl or Cmd was held.
  onPick: (tag: string, keepOpen: boolean) => void;
  onArchive: (tags: string[]) => void;
  onUnarchive: (tags: string[]) => void;
  onClose: () => void;
}

export function TagIndex({ id, index, query, onQuery, threshold, onThreshold, untagged, onPick, onArchive, onUnarchive, onClose }: Props) {
  const theme = useTheme();
  const copy = copyFor(theme).index;
  const [showArchived, setShowArchived] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  // Shift, Ctrl or Cmd with a click or with Enter picks and keeps the index open.
  const pick = (tag: string) => ({
    onClick: (e: MouseEvent) => onPick(tag, e.shiftKey || e.ctrlKey || e.metaKey),
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || !(e.shiftKey || e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      onPick(tag, true);
    },
  });
  // The button that was pressed goes away with what it acted on, so focus moves to the tag search.
  const thenFocusSearch = (run: () => void) => () => {
    run();
    search.current?.focus();
  };
  const q = query.trim().toLowerCase();
  const showUntagged = untagged.count > 0 && (!q || 'untagged'.includes(q));
  const empty = index.groups.length === 0 && !showUntagged;
  const allArchived = index.liveCount === 0 && index.archived.length > 0;
  const book = theme === 'covers';
  const grid = theme === 'contact';

  // Esc clears the tag search first, then closes the index.
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    if (query) onQuery('');
    else onClose();
  };

  const jump = (e: MouseEvent, letterId: string) => {
    e.preventDefault();
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById(`ix-${letterId}`)?.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
    document.getElementById(`ix-${letterId}-h`)?.focus({ preventScroll: true });
  };

  const tidyBar = threshold > 0 && index.stale.length > 0 && (
    <div className="ix-tidy-bar">
      {book && <span className="ix-erratum-label">Erratum</span>}
      <span className="ix-tidy-count">{copy.staleLine(index.stale.length, tidySpan(threshold))}</span>
      <span className="ix-tidy-explainer">{copy.staleExplainer}</span>
      <button type="button" className="primary ix-archive" onClick={thenFocusSearch(() => onArchive(index.stale))}>
        {copy.archive(index.stale.length)}
      </button>
    </div>
  );

  const archivedNames = (
    <span className="ix-archived-names">
      {index.archived.map((tag, i) => (
        <span key={tag}>
          {i > 0 && ', '}
          <button
            type="button"
            className="ix-word"
            aria-label={`Bring back ${tagName(tag)}`}
            onClick={index.archived.length === 1 ? thenFocusSearch(() => onUnarchive([tag])) : () => onUnarchive([tag])}
          >
            {tagName(tag)}
          </button>
        </span>
      ))}
    </span>
  );

  const archived = index.archived.length > 0 && (
    <p className="ix-archived">
      {book ? (
        <>
          <span className="ix-archived-lead">Out of print: </span>
          {archivedNames}
          {'. '}
          <button type="button" className="link" onClick={thenFocusSearch(() => onUnarchive(index.archived))}>
            {copy.bringBack}
          </button>
        </>
      ) : (
        <>
          {copy.archivedLine(index.archived.length)}{' '}
          <button type="button" className="link" onClick={thenFocusSearch(() => onUnarchive(index.archived))}>
            {copy.bringBack}
          </button>
          {' · '}
          <button type="button" className="link" aria-expanded={showArchived} onClick={() => setShowArchived((s) => !s)}>
            {showArchived ? 'Hide' : 'Show'}
          </button>
          {showArchived && <span className="ix-archived-list">{archivedNames}</span>}
        </>
      )}
    </p>
  );

  const body = (
    <>
      {empty && <p className="ix-empty">{allArchived && !q ? copy.allArchived : 'No tag matches that.'}</p>}
      <div className="ix-groups">
        {index.groups.map((g) => (
          <Group key={g.id} group={g} threshold={threshold} grid={grid} book={book} onceLabel={copy.onceLabel} pick={pick} />
        ))}
        {showUntagged && (
          <section className="ix-group ix-untagged" aria-label="Untagged">
            <button type="button" className="ix-entry" aria-pressed={untagged.selected} {...pick(untagged.tag)}>
              <span className="ix-name">
                untagged
                {grid && untagged.selected && <GreasePencil />}
              </span>
              <span className="ix-comma" aria-hidden="true">
                ,
              </span>
              <span className="ix-leader" aria-hidden="true" />
              <span className="ix-count">{untagged.count}</span>
            </button>
          </section>
        )}
      </div>
    </>
  );

  return (
    <section id={id} className="tag-index" aria-label="Tag index" onKeyDown={onKeyDown}>
      <div className="ix-controls">
        <label className="ix-search">
          <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            ref={search}
            type="search"
            aria-label="Find a tag"
            placeholder="Find a tag"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
          />
        </label>
        <span className="ix-hint">{copy.hint}</span>
        <span className="ix-tidy-lead" id={`${id}-tidy`}>
          {copy.tidyLead}
        </span>
        <div className="segmented ix-tidy" role="group" aria-labelledby={`${id}-tidy`}>
          {TIDY_THRESHOLDS.map((months, i) => (
            <button key={months} type="button" aria-pressed={threshold === months} onClick={() => onThreshold(months)}>
              {copy.tidyOptions[i]}
            </button>
          ))}
        </div>
      </div>

      {!book && tidyBar}

      <nav className="ix-letters" aria-label="Jump to a letter">
        {index.letters.map((l) =>
          l.present ? (
            <a key={l.id} className="ix-letter" href={`#ix-${l.id}`} onClick={(e) => jump(e, l.id)}>
              {l.letter}
            </a>
          ) : (
            <span key={l.id} className="ix-letter is-absent" aria-hidden="true">
              {l.letter}
            </span>
          ),
        )}
      </nav>

      {book ? (
        <div className="ix-page">
          <header className="ix-page-header">
            <span className="ix-page-title">Index</span>
            <span className="ix-page-note">Numbers are how many things carry each tag</span>
          </header>
          {tidyBar}
          {body}
          {archived}
          <footer className="ix-folio" aria-hidden="true">
            <span>Bookmarks · Index</span>
            <span>— {300 + index.groups.length} —</span>
          </footer>
        </div>
      ) : (
        <>
          {body}
          {archived}
        </>
      )}
    </section>
  );
}

interface GroupProps {
  group: IndexGroup;
  threshold: TidyThreshold;
  grid: boolean;
  book: boolean;
  onceLabel: string;
  pick: (tag: string) => { onClick: (e: MouseEvent) => void; onKeyDown: (e: KeyboardEvent) => void };
}

function Group({ group, threshold, grid, book, onceLabel, pick }: GroupProps) {
  const headingId = `ix-${group.id}-h`;
  // Contact sheet tints a letter's cell by how many of its tags are stale.
  const style = grid && threshold > 0 && group.tagCount ? slotStyle(undefined, { '--stale-share': group.staleCount / group.tagCount }) : undefined;
  return (
    <section className="ix-group" id={`ix-${group.id}`} aria-labelledby={headingId} style={style}>
      {grid && <span className="ix-crosshair" aria-hidden="true" />}
      <h3 className="ix-head" id={headingId} tabIndex={-1}>
        {group.letter}
        {grid && <span className="ix-head-count">{group.tagCount === 1 ? '1 tag' : `${group.tagCount} tags`}</span>}
      </h3>
      {group.entries.map((e) => (
        <div key={e.tag} className="ix-entry-block">
          <Entry entry={e} threshold={threshold} grid={grid} book={book} pick={pick} />
          {e.children.map((c) => (
            <Entry key={c.tag} entry={c} parentSlot={e.slot} sub threshold={threshold} grid={grid} book={book} pick={pick} />
          ))}
        </div>
      ))}
      {group.once.length > 0 && (
        <p className="ix-runin">
          <span className="ix-once">{onceLabel}</span>
          {group.once.map((e, i) => (
            <span key={e.tag}>
              {i > 0 && ', '}
              <button
                type="button"
                className={`ix-word${e.stale ? ' is-stale' : ''}`}
                aria-pressed={e.selected}
                style={slotStyle(e.slot, { '--fade': e.fade })}
                {...pick(e.tag)}
              >
                {e.name}
                {book && e.stale && <span className="ix-dagger"> †</span>}
                {grid && e.selected && <GreasePencil />}
              </button>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}

interface EntryProps {
  entry: IndexEntry;
  parentSlot?: number;
  sub?: boolean;
  threshold: TidyThreshold;
  grid: boolean;
  book: boolean;
  pick: (tag: string) => { onClick: (e: MouseEvent) => void; onKeyDown: (e: KeyboardEvent) => void };
}

function Entry({ entry: e, parentSlot, sub, threshold, grid, book, pick }: EntryProps) {
  // With tidy-up on, the number becomes time since last use. The book keeps counts and daggers the stale.
  const months = Math.floor(e.monthsUnused);
  const right = threshold > 0 && !book ? (months === 0 ? 'now' : `${months} mo`) : String(e.count);
  const classes = ['ix-entry'];
  if (sub) classes.push('ix-sub');
  if (e.stale) classes.push('is-stale');
  return (
    <button
      type="button"
      className={classes.join(' ')}
      aria-pressed={e.selected}
      style={slotStyle(sub ? parentSlot : e.slot, { '--fade': e.fade })}
      {...pick(e.tag)}
    >
      {!sub && <span className={`ix-sq${e.slot === undefined ? ' is-blank' : e.fade > HOLLOW_FADE ? ' is-hollow' : ''}`} aria-hidden="true" />}
      <span className="ix-name">
        {sub && (
          <span className="ix-dash" aria-hidden="true">
            —{' '}
          </span>
        )}
        {e.name}
        {grid && e.selected && <GreasePencil />}
      </span>
      <span className="ix-comma" aria-hidden="true">
        ,
      </span>
      <span className="ix-leader" aria-hidden="true" />
      <span className="ix-count">
        {right}
        {book && e.stale && <span className="ix-dagger"> †</span>}
      </span>
    </button>
  );
}
