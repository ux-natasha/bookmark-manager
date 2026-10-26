import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { NoteForm } from '../components/NoteForm';
import { ToastView } from '../components/ToastView';
import { exportBackup, restoreBackup } from '../lib/backup';
import { deleteBookmark, restoreBookmark } from '../lib/bookmarks';
import { isDeadLink, kindOf, type Bookmark, type ItemKind } from '../lib/db';
import { useBookmarks, useEnrichProgress, useTagCounts, useToast } from '../lib/hooks';
import { saveSequence } from '../lib/codes';
import { sendToBackground } from '../lib/messages';
import { platformById } from '../lib/platform';
import { pickForgotten } from '../lib/resurface';
import { THEMES, ThemeContext, useThemeSetting, type Theme } from '../lib/theme';
import { AppearanceToggle, useAppearance } from './AppearanceToggle';
import { BookmarkCard } from './BookmarkCard';
import { copyFor } from './copy';
import { EditDialog } from './EditDialog';
import { ImportDialog } from './ImportDialog';
import { JotNote } from './JotNote';
import { MoreMenu } from './MoreMenu';
import { PostDialog } from './PostDialog';
import { Sheet } from './Sheet';

type Sort = 'newest' | 'oldest' | 'recently-opened' | 'never-opened';

const PAGE_SIZE = 120;
const RESURFACE_COUNT = 6;
const UNTAGGED = '__untagged__';
const OTHER_SITES = '__other__';
// The source select's option for dead links, which sets deadOnly rather than platformFilter.
const DEAD_LINKS = '__dead__';

// The Contact sheet theme names kinds by their catalogue code.
const KIND_CODES: Record<ItemKind, string> = { link: 'LNK', image: 'PIC', quote: 'QTE', note: 'NTE' };

const KIND_LABELS: Record<ItemKind, [singular: string, plural: string]> = {
  link: ['link', 'Links'],
  image: ['picture', 'Pictures'],
  quote: ['quote', 'Quotes'],
  note: ['note', 'Notes'],
};

function useKindCounts(bookmarks: Bookmark[] | undefined) {
  return useMemo(() => {
    const counts = new Map<ItemKind, number>();
    for (const b of bookmarks ?? []) counts.set(kindOf(b), (counts.get(kindOf(b)) ?? 0) + 1);
    return (Object.keys(KIND_LABELS) as ItemKind[]).filter((k) => counts.has(k)).map((kind) => ({ kind, count: counts.get(kind)! }));
  }, [bookmarks]);
}

function usePlatformCounts(bookmarks: Bookmark[] | undefined) {
  return useMemo(() => {
    const counts = new Map<string, number>();
    // Notes aren't from any site.
    for (const b of bookmarks ?? []) {
      if (!b.url) continue;
      const key = b.platform ?? OTHER_SITES;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts]
      .map(([id, count]) => ({ id, label: id === OTHER_SITES ? 'Other websites' : (platformById(id)?.label ?? id), count }))
      .sort((a, b) => (a.id === OTHER_SITES ? 1 : b.id === OTHER_SITES ? -1 : b.count - a.count));
  }, [bookmarks]);
}

export function Library() {
  const { theme, setTheme } = useThemeSetting();
  return (
    <ThemeContext.Provider value={theme}>
      <LibraryPage theme={theme} setTheme={setTheme} />
    </ThemeContext.Provider>
  );
}

function LibraryPage({ theme, setTheme }: { theme: Theme; setTheme: (theme: Theme) => void }) {
  const bookmarks = useBookmarks();
  const tagCounts = useTagCounts(bookmarks);
  const platformCounts = usePlatformCounts(bookmarks);
  const kindCounts = useKindCounts(bookmarks);
  const progress = useEnrichProgress();
  const { toast, showToast, hideToast } = useToast();
  const { appearance, isDark, toggle: toggleAppearance, setAppearance } = useAppearance();
  const copy = copyFor(theme);
  const contact = theme === 'contact';

  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>('newest');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  const [deadOnly, setDeadOnly] = useState(false);
  const [kindFilter, setKindFilter] = useState<ItemKind | null>(null);
  // null when closed; otherwise the text the New note dialog opens with.
  const [writingNote, setWritingNote] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [addingFromPost, setAddingFromPost] = useState(false);
  const [resurfacedIds, setResurfacedIds] = useState<string[] | null>(null);
  const [arrivedIds, setArrivedIds] = useState<Set<string>>(() => new Set());
  const restoreInput = useRef<HTMLInputElement>(null);

  // Everything but the kind filter, so the kind pills can count what each kind would show.
  const matching = useMemo(() => {
    if (!bookmarks) return [];
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return bookmarks.filter((b) => {
      if (selectedTags.includes(UNTAGGED) && b.tags.length > 0) return false;
      if (!selectedTags.every((t) => t === UNTAGGED || b.tags.includes(t))) return false;
      if (platformFilter && (!b.url || (b.platform ?? OTHER_SITES) !== platformFilter)) return false;
      if (deadOnly && !isDeadLink(b)) return false;
      if (!words.length) return true;
      const platformLabel = platformById(b.platform)?.label ?? '';
      // Tags are searched with dashes read as spaces too, so "weeknight dinners" finds "weeknight-dinners".
      const tagText = b.tags.join(' ');
      const haystack =
        `${b.title} ${b.url} ${b.note} ${b.text ?? ''} ${tagText} ${tagText.replace(/-/g, ' ')} ${b.description ?? ''} ${b.siteName ?? ''} ${b.author ?? ''} ${b.foundInTitle ?? ''} ${platformLabel}`.toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
  }, [bookmarks, query, selectedTags, platformFilter, deadOnly]);

  const matchingKindCounts = useMemo(() => {
    const counts = new Map<ItemKind, number>();
    for (const b of matching) counts.set(kindOf(b), (counts.get(kindOf(b)) ?? 0) + 1);
    return counts;
  }, [matching]);

  const filtered = useMemo(() => {
    const result = kindFilter ? matching.filter((b) => kindOf(b) === kindFilter) : [...matching];
    switch (sort) {
      case 'oldest':
        return result.reverse();
      case 'recently-opened':
        return result.sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0));
      case 'never-opened':
        return result.filter((b) => b.openCount === 0);
      default:
        return result;
    }
  }, [matching, kindFilter, sort]);

  // Looked up from the live list so the dialog updates when details are refreshed.
  const editing = editingId ? bookmarks?.find((b) => b.id === editingId) : undefined;
  const deadCount = useMemo(() => bookmarks?.filter(isDeadLink).length ?? 0, [bookmarks]);
  const sequence = useMemo(() => saveSequence(bookmarks ?? []), [bookmarks]);
  const filtersActive = selectedTags.length > 0 || kindFilter !== null || platformFilter !== null || deadOnly;
  const clearFilters = () => {
    setSelectedTags([]);
    setKindFilter(null);
    setPlatformFilter(null);
    setDeadOnly(false);
    setQuery('');
    setVisible(PAGE_SIZE);
  };

  // Looked up from the live list so edits and deletes show up in the resurfaced row too.
  const resurfaced = useMemo(
    () => resurfacedIds?.map((id) => bookmarks?.find((b) => b.id === id)).filter((b): b is Bookmark => !!b),
    [resurfacedIds, bookmarks],
  );

  const toggleTag = (tag: string) => {
    setSelectedTags((tags) => (tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]));
    setVisible(PAGE_SIZE);
  };

  const refreshMemory = () => {
    if (!bookmarks?.length) return;
    setResurfacedIds(pickForgotten(bookmarks, RESURFACE_COUNT).map((b) => b.id));
  };

  const handleDelete = async (bookmark: Bookmark) => {
    setEditingId(null);
    await deleteBookmark(bookmark.id);
    showToast({ message: `Deleted “${bookmark.title}”`, action: { label: 'Undo', run: () => restoreBookmark(bookmark.id) } });
  };

  const handleRestore = async (file: File | undefined) => {
    if (!file) return;
    try {
      const { added, merged } = await restoreBackup(file);
      sendToBackground({ type: 'enrich-pending' });
      showToast({ message: `Backup restored: ${added} added, ${merged} merged with existing` });
    } catch (err) {
      showToast({ message: (err as Error).message });
    }
  };

  const recheckLinks = () => {
    sendToBackground({ type: 'recheck-all' });
    showToast({ message: 'Checking all links again in the background' });
  };

  const sourceValue = deadOnly ? DEAD_LINKS : (platformFilter ?? '');
  const pickSource = (value: string) => {
    setDeadOnly(value === DEAD_LINKS);
    setPlatformFilter(value && value !== DEAD_LINKS ? value : null);
    setVisible(PAGE_SIZE);
  };

  const cardProps = { onEdit: (b: Bookmark) => setEditingId(b.id), onTagClick: toggleTag };
  const isEmpty = bookmarks?.length === 0;
  const searching = query.trim() !== '';
  const allTags = tagCounts.map((t) => t.tag);
  const fetching = progress?.running ? progress.total - progress.done : 0;
  const renderItems = (items: Bookmark[]) =>
    contact ? (
      <Sheet bookmarks={items} sequence={sequence} arrivedIds={arrivedIds} {...cardProps} />
    ) : (
      <div className="grid">
        {items.map((b) => (
          <BookmarkCard key={b.id} bookmark={b} arriving={arrivedIds.has(b.id)} {...cardProps} />
        ))}
      </div>
    );

  return (
    <div className="library">
      <header className="library-header">
        {contact && (
          <p className="header-summary">
            {bookmarks?.length ?? 0} kept{fetching > 0 && ` · ${fetching} fetching`}
          </p>
        )}
        <p className="wordmark">Bookmarks</p>
        <div className="header-actions">
          <MoreMenu
            items={[
              { label: 'New note', run: () => setWritingNote('') },
              { label: 'Import favorites', run: () => setImporting(true) },
              { label: 'Check links', run: recheckLinks, disabled: !bookmarks?.length || progress?.running },
              { label: 'Back up', run: exportBackup, disabled: !bookmarks?.length },
              { label: 'Restore', run: () => restoreInput.current?.click() },
              ...(appearance !== 'system' ? [{ label: 'Match system', run: () => setAppearance('system') }] : []),
              ...THEMES.map(({ id, label }, i) => ({
                label,
                ariaLabel: `Theme: ${label}`,
                groupLabel: i === 0 ? 'Theme' : undefined,
                checked: theme === id,
                run: () => setTheme(id),
              })),
            ]}
          />
          <AppearanceToggle isDark={isDark} onToggle={toggleAppearance} />
          <button type="button" className="primary header-add" onClick={() => setAddingFromPost(true)}>
            <span className="label-long">Add from a post</span>
            <span className="label-short">Add from post</span>
          </button>
        </div>
        <input
          ref={restoreInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            handleRestore(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </header>

      <section className="hero">
        <div className="hero-main">
          {/* The Contact sheet theme moves these into the header and the kind list. */}
          {!contact && !!bookmarks?.length && <p className="summary-line">{summaryLine(bookmarks.length, kindCounts)}</p>}
          {!contact && progress?.running && progress.total > 0 && (
            <div className="enrich-progress" role="status">
              <span>
                Fetching previews and details… {progress.done} of {progress.total}
              </span>
              <progress value={progress.done} max={progress.total} />
            </div>
          )}
          <h1 className="headline">
            {copy.headline[0]}
            {copy.headlineBreak && <br />}
            <em>{copy.headline[1]}</em>.
          </h1>
          <div className="hero-fields">
            <label className="search-field">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                aria-label="Search everything you kept"
                placeholder="Search links, quotes, pictures, notes…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setVisible(PAGE_SIZE);
                }}
                onKeyDown={(e) => {
                  if (e.key !== 'Escape') return;
                  e.preventDefault();
                  if (query) {
                    setQuery('');
                    setVisible(PAGE_SIZE);
                  } else e.currentTarget.blur();
                }}
              />
            </label>
            <JotNote
              onSaved={(b) => setArrivedIds((ids) => new Set(ids).add(b.id))}
              onExpand={(text) => setWritingNote(text)}
            />
          </div>
        </div>
        {/* Becomes the Look ahead panel in phase 3; until then it keeps today's "From a while ago" row. */}
        {!isEmpty && (
          <div className="hero-side">
            {contact && kindCounts.length > 0 && (
              <ul className="kind-list">
                {kindCounts.map(({ kind, count }) => (
                  <li key={kind}>
                    <span aria-hidden="true">{KIND_CODES[kind]} · </span>
                    {count} {count === 1 ? KIND_LABELS[kind][0] : KIND_LABELS[kind][1].toLowerCase()}
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="ghost-button" onClick={refreshMemory} disabled={!bookmarks?.length}>
              Refresh my memory
            </button>
          </div>
        )}
      </section>

      {resurfaced && resurfaced.length > 0 && (
        <section className="resurfaced">
          <div className="section-heading">
            <h2>From a while ago</h2>
            <button className="link" onClick={refreshMemory}>
              Shuffle
            </button>
            <button className="link" onClick={() => setResurfacedIds(null)}>
              Close
            </button>
          </div>
          {renderItems(resurfaced)}
        </section>
      )}

      {isEmpty ? (
        <section className="empty">
          <h2>{copy.emptyTitle}</h2>
          <p className="muted">
            Click the extension icon or press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> on any page to save it.
            Right-click a link to save it without opening it, a picture to keep it, or selected text to save it as a
            quote.
          </p>
          <button className="primary" onClick={() => setImporting(true)}>
            Import your Edge favorites
          </button>
        </section>
      ) : (
        bookmarks && (
          <main className="library-main">
            {selectedTags.length > 0 && (
              <FiledUnder lead={copy.filedUnderLead} tags={selectedTags} onRemove={toggleTag} onClear={() => setSelectedTags([])} />
            )}

            <div className="filter-row">
              {kindCounts.length > 1 && (
                <div className="kind-pills" role="group" aria-label="Kinds">
                  <KindPill
                    label="Everything"
                    code={contact ? 'All' : undefined}
                    count={matching.length}
                    pressed={kindFilter === null}
                    onClick={() => setKindFilter(null)}
                  />
                  {kindCounts.map(({ kind }) => (
                    <KindPill
                      key={kind}
                      label={KIND_LABELS[kind][1]}
                      code={contact ? KIND_CODES[kind] : undefined}
                      count={matchingKindCounts.get(kind) ?? 0}
                      pressed={kindFilter === kind}
                      onClick={() => {
                        setKindFilter(kind);
                        setVisible(PAGE_SIZE);
                      }}
                    />
                  ))}
                </div>
              )}
              <div className="filter-selects">
                {/* Stands in for the tag strip and index until phase 4. Picking adds to the selection. */}
                <LabelledSelect label="Tags" showLabel={contact} value="" onChange={(value) => value && toggleTag(value)}>
                  <option value="">Tags…</option>
                  {!selectedTags.includes(UNTAGGED) && <option value={UNTAGGED}>untagged</option>}
                  {tagCounts
                    .filter(({ tag }) => !selectedTags.includes(tag))
                    .map(({ tag, count }) => (
                      <option key={tag} value={tag}>
                        {tag} ({count})
                      </option>
                    ))}
                </LabelledSelect>
                {(platformCounts.length > 1 || deadCount > 0) && (
                  <LabelledSelect label="Source" showLabel={contact} value={sourceValue} onChange={pickSource}>
                    <option value="">All sources</option>
                    {platformCounts.map(({ id, label, count }) => (
                      <option key={id} value={id}>
                        {label} ({count})
                      </option>
                    ))}
                    {deadCount > 0 && <option value={DEAD_LINKS}>Links that may be dead ({deadCount})</option>}
                  </LabelledSelect>
                )}
                <LabelledSelect label="Sort" showLabel={contact} value={sort} onChange={(value) => setSort(value as Sort)}>
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="recently-opened">Recently opened</option>
                  <option value="never-opened">Never opened</option>
                </LabelledSelect>
              </div>
            </div>

            {(filtersActive || searching) && filtered.length > 0 && (
              <p className="result-count">
                {filtered.length} {countNoun(filtered.length, kindFilter, kindCounts.length > 1, copy.itemNoun)}
                {' · '}
                <button className="link" onClick={clearFilters}>
                  clear filters
                </button>
              </p>
            )}

            {filtered.length === 0 ? (
              <div className="no-results">
                {contact && (
                  <p className="no-results-filters">
                    {[
                      `0 ${copy.itemNoun[1]}`,
                      kindFilter && KIND_CODES[kindFilter],
                      selectedTags.length > 0 && `filed under ${selectedTags.map(tagLabel).join(', ')}`,
                      platformFilter && (platformCounts.find((p) => p.id === platformFilter)?.label ?? platformFilter),
                      deadOnly && 'may be dead',
                      searching && `“${query.trim()}”`,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
                <p>{copy.noResults}</p>
                <button className="link" onClick={clearFilters}>
                  clear filters
                </button>
              </div>
            ) : (
              renderItems(filtered.slice(0, visible))
            )}

            {filtered.length > visible && (
              <button className="ghost-button show-more" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Show more · {filtered.length - visible} left
              </button>
            )}
          </main>
        )
      )}

      {editing && (
        <EditDialog
          key={editing.id}
          bookmark={editing}
          allTags={allTags}
          onClose={() => setEditingId(null)}
          onDelete={handleDelete}
        />
      )}
      {writingNote !== null && (
        <NoteDialog
          allTags={allTags}
          initialText={writingNote}
          onClose={(saved) => {
            setWritingNote(null);
            if (saved) showToast({ message: 'Note saved' });
          }}
        />
      )}
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
      {addingFromPost && <PostDialog allTags={allTags} onClose={() => setAddingFromPost(false)} />}
      <ToastView toast={toast} onDone={hideToast} />
    </div>
  );
}

// In the Contact sheet theme the pill shows the kind's code; the full name stays for screen readers.
function KindPill({
  label,
  code,
  count,
  pressed,
  onClick,
}: {
  label: string;
  code?: string;
  count: number;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="kind-pill" aria-pressed={pressed} onClick={onClick}>
      {code ? (
        <>
          <span aria-hidden="true">{code}</span>
          <span className="visually-hidden">{label}</span>
        </>
      ) : (
        label
      )}
      <span className="kind-pill-count">{count}</span>
    </button>
  );
}

// A filter select. The Contact sheet theme shows its name before it ("SOURCE · All sources").
function LabelledSelect({
  label,
  showLabel,
  value,
  onChange,
  children,
}: {
  label: string;
  showLabel: boolean;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  const select = (
    <select
      className="pill-select"
      aria-label={showLabel ? undefined : label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {children}
    </select>
  );
  if (!showLabel) return select;
  return (
    <label className="labelled-select">
      <span className="labelled-select-name">{label} ·</span>
      {select}
    </label>
  );
}

// "Showing things filed under WORK and READING  clear". Each name removes that tag.
function FiledUnder({
  lead,
  tags,
  onRemove,
  onClear,
}: {
  lead: string;
  tags: string[];
  onRemove: (tag: string) => void;
  onClear: () => void;
}) {
  return (
    <p className="filed-under-filter" aria-live="polite">
      <span className="filed-under-lead">{lead}</span>{' '}
      {tags.map((tag, i) => (
        <span key={tag}>
          {i > 0 && (i === tags.length - 1 ? ' and ' : ', ')}
          <button type="button" className="filed-under-tag" aria-label={`Remove filter: ${tagLabel(tag)}`} onClick={() => onRemove(tag)}>
            {tagLabel(tag)}
            <svg className="filed-under-x" aria-hidden="true" width="9" height="9" viewBox="0 0 10 10">
              <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </button>
        </span>
      ))}{' '}
      <button type="button" className="link filed-under-clear" onClick={onClear}>
        clear
      </button>
    </p>
  );
}

function tagLabel(tag: string): string {
  return tag === UNTAGGED ? 'untagged' : tag;
}

// "18 kept · 8 links · 3 quotes · 4 pictures · 3 notes", over the whole library. Kinds with nothing are left out.
function summaryLine(total: number, kindCounts: { kind: ItemKind; count: number }[]): string {
  const kinds = kindCounts.map(({ kind, count }) => `${count} ${count === 1 ? KIND_LABELS[kind][0] : KIND_LABELS[kind][1].toLowerCase()}`);
  return [`${total} kept`, ...kinds].join(' · ');
}

function countNoun(count: number, kind: ItemKind | null, mixed: boolean, itemNoun: [string, string]): string {
  if (kind) {
    const [singular, plural] = KIND_LABELS[kind];
    return count === 1 ? singular : plural.toLowerCase();
  }
  if (mixed) return count === 1 ? itemNoun[0] : itemNoun[1];
  return count === 1 ? 'bookmark' : 'bookmarks';
}

function NoteDialog({ allTags, initialText, onClose }: { allTags: string[]; initialText: string; onClose: (saved: boolean) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);
  return (
    <dialog ref={dialogRef} className="dialog" onClose={() => onClose(false)}>
      <h2>New note</h2>
      <NoteForm allTags={allTags} source="library" initialText={initialText} onDone={onClose} />
    </dialog>
  );
}
