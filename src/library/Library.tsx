import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { NoteForm } from '../components/NoteForm';
import { ToastView } from '../components/ToastView';
import { exportBackup, restoreBackup } from '../lib/backup';
import { deleteBookmark, restoreBookmark } from '../lib/bookmarks';
import { db, isDeadLink, kindOf, type Bookmark, type ItemKind } from '../lib/db';
import { useBookmarks, useEnrichProgress, useTagCounts, useToast } from '../lib/hooks';
import { saveSequence } from '../lib/codes';
import { plateNumbers } from '../lib/covers';
import { LINKS_SHOW, LinksShowContext, useLinksShowSetting, type LinksShow } from '../lib/linksShow';
import { sendToBackground } from '../lib/messages';
import { platformById } from '../lib/platform';
import { pickForgotten } from '../lib/resurface';
import { archiveTags, assignColorSlots, buildTagIndex, hasTag, markTagsUsed, tagName, tagStats, unarchiveTags } from '../lib/tags';
import { THEMES, ThemeContext, useThemeSetting, type Theme } from '../lib/theme';
import { useTidyThreshold } from '../lib/tidyThreshold';
import { AppearanceToggle, useAppearance } from './AppearanceToggle';
import { BookmarkCard } from './BookmarkCard';
import { copyFor } from './copy';
import { EditDialog } from './EditDialog';
import { ImportDialog } from './ImportDialog';
import { JotNote } from './JotNote';
import { MoreMenu } from './MoreMenu';
import { PostDialog } from './PostDialog';
import { Rack, RackLoading } from './Rack';
import { Sheet } from './Sheet';
import { lookupFor, slotStyle, TagLookContext, useTagLook } from './tagLook';
import { TagIndex } from './TagIndex';
import { TagStrip } from './TagStrip';

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
  const { linksShow, setLinksShow } = useLinksShowSetting();
  return (
    <ThemeContext.Provider value={theme}>
      <LinksShowContext.Provider value={linksShow}>
        <LibraryPage theme={theme} setTheme={setTheme} linksShow={linksShow} setLinksShow={setLinksShow} />
      </LinksShowContext.Provider>
    </ThemeContext.Provider>
  );
}

interface PageProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  linksShow: LinksShow;
  setLinksShow: (value: LinksShow) => void;
}

function LibraryPage({ theme, setTheme, linksShow, setLinksShow }: PageProps) {
  const bookmarks = useBookmarks();
  const tagCounts = useTagCounts(bookmarks);
  const platformCounts = usePlatformCounts(bookmarks);
  const kindCounts = useKindCounts(bookmarks);
  const progress = useEnrichProgress();
  const { toast, showToast, hideToast } = useToast();
  const { appearance, isDark, toggle: toggleAppearance, setAppearance } = useAppearance();
  const copy = copyFor(theme);
  const contact = theme === 'contact';
  const covers = theme === 'covers';

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
  const [indexOpen, setIndexOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState('');
  const { threshold, setThreshold } = useTidyThreshold();
  const indexButton = useRef<HTMLButtonElement>(null);
  const refocusIndexButton = useRef(false);
  const indexId = useId();

  // The tag index. Colour slots are handed out as tags come and go, and then kept.
  const tagMeta = useLiveQuery(() => db.tagMeta.toArray(), []);
  const stats = useMemo(() => tagStats(bookmarks ?? []), [bookmarks]);
  useEffect(() => {
    if (!bookmarks || !tagMeta) return;
    const changes = assignColorSlots(stats, tagMeta);
    if (changes.length) db.tagMeta.bulkPut(changes);
  }, [bookmarks, stats, tagMeta]);
  // Measured when the tags or their metadata change; fading by the hour isn't worth a timer.
  const now = useMemo(() => Date.now(), [stats, tagMeta]);
  const tagIndex = useMemo(
    () => buildTagIndex({ stats, meta: tagMeta ?? [], selected: selectedTags, query: tagQuery, now, threshold }),
    [stats, tagMeta, selectedTags, tagQuery, now, threshold],
  );
  const tagLook = useMemo(() => {
    const slots = new Map<string, number>();
    const archived = new Set<string>();
    for (const m of tagMeta ?? []) {
      if (m.colorSlot !== undefined) slots.set(m.tag, m.colorSlot);
      if (m.archivedAt) archived.add(m.tag);
    }
    return lookupFor(slots, archived);
  }, [tagMeta]);

  // Everything but the kind filter, so the kind pills can count what each kind would show.
  const matching = useMemo(() => {
    if (!bookmarks) return [];
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return bookmarks.filter((b) => {
      if (selectedTags.includes(UNTAGGED) && b.tags.length > 0) return false;
      if (!selectedTags.every((t) => t === UNTAGGED || hasTag(b, t))) return false;
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
  const plates = useMemo(() => plateNumbers(bookmarks ?? []), [bookmarks]);
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
    // Picking a tag counts as using it, so tidy-up leaves it alone.
    if (!selectedTags.includes(tag) && tag !== UNTAGGED) markTagsUsed([tag]);
    setSelectedTags((tags) => (tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]));
    setVisible(PAGE_SIZE);
  };

  const closeIndex = () => {
    setIndexOpen(false);
    setTagQuery('');
    refocusIndexButton.current = true;
  };
  // Once the panel is gone, focus goes back to the button that opened it.
  useEffect(() => {
    if (indexOpen || !refocusIndexButton.current) return;
    refocusIndexButton.current = false;
    indexButton.current?.focus();
  }, [indexOpen]);

  const pickFromIndex = (tag: string, keepOpen: boolean) => {
    toggleTag(tag);
    if (!keepOpen) closeIndex();
  };

  const archive = async (tags: string[]) => {
    const undo = await archiveTags(tags);
    showToast({ message: copy.index.archivedToast(tags.length), action: { label: 'Undo', run: undo } });
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
  // Archived tags aren't suggested when tagging.
  const allTags = tagCounts.map((t) => t.tag).filter((t) => !tagLook(t).archived);
  const untaggedCount = bookmarks?.filter((b) => b.tags.length === 0).length ?? 0;
  const fetching = progress?.running ? progress.total - progress.done : 0;
  const renderItems = (items: Bookmark[]) =>
    contact ? (
      <Sheet bookmarks={items} sequence={sequence} arrivedIds={arrivedIds} {...cardProps} />
    ) : covers ? (
      <Rack bookmarks={items} plates={plates} arrivedIds={arrivedIds} {...cardProps} />
    ) : (
      <div className="grid">
        {items.map((b) => (
          <BookmarkCard key={b.id} bookmark={b} arriving={arrivedIds.has(b.id)} {...cardProps} />
        ))}
      </div>
    );

  return (
    <TagLookContext.Provider value={tagLook}>
      <div className="library">
        <header className="library-header">
          {contact && (
            <p className="header-summary">
              {bookmarks?.length ?? 0} kept{fetching > 0 && ` · ${fetching} fetching`}
            </p>
          )}
          <p className="wordmark">Bookmarks</p>
          {covers && (
            <p className="dateline">
              <span>{volumeLine(bookmarks)}</span>
              <span>
                {bookmarks?.length ? summaryLine(bookmarks.length, kindCounts) : '0 kept'}
                {fetching > 0 && ` · ${fetching} fetching`}
              </span>
            </p>
          )}
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
            {/* The Contact sheet theme moves these into the header and the kind list; Covers, into the dateline. */}
            {theme === 'default' && !!bookmarks?.length && <p className="summary-line">{summaryLine(bookmarks.length, kindCounts)}</p>}
            {theme === 'default' && progress?.running && progress.total > 0 && (
              <div className="enrich-progress" role="status">
                <span>
                  Fetching previews and details… {progress.done} of {progress.total}
                </span>
                <progress value={progress.done} max={progress.total} />
              </div>
            )}
            <div className="headline-row">
              <h1 className="headline">
                {copy.headline[0]}
                {copy.headlineBreak && <br />}
                <em>{copy.headline[1]}</em>.
              </h1>
              {covers && <LinksShowControl value={linksShow} onChange={setLinksShow} />}
            </div>
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
        ) : !bookmarks ? (
          covers && <RackLoading />
        ) : (
          bookmarks && (
            <main className="library-main">
              {tagCounts.length > 0 && (
                <section className="tags" aria-label="Tags">
                  <TagStrip
                    mostUsed={tagIndex.mostUsed}
                    liveCount={tagIndex.liveCount}
                    open={indexOpen}
                    panelId={indexId}
                    buttonRef={indexButton}
                    onToggleTag={toggleTag}
                    onToggleOpen={() => (indexOpen ? closeIndex() : setIndexOpen(true))}
                  />
                  {selectedTags.length > 0 && (
                    <FiledUnder lead={copy.filedUnderLead} tags={selectedTags} onRemove={toggleTag} onClear={() => setSelectedTags([])} />
                  )}
                  {indexOpen && (
                    <TagIndex
                      id={indexId}
                      index={tagIndex}
                      query={tagQuery}
                      onQuery={setTagQuery}
                      threshold={threshold}
                      onThreshold={setThreshold}
                      untagged={{ count: untaggedCount, selected: selectedTags.includes(UNTAGGED), tag: UNTAGGED }}
                      onPick={pickFromIndex}
                      onArchive={archive}
                      onUnarchive={unarchiveTags}
                      onClose={closeIndex}
                    />
                  )}
                </section>
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
                  {theme !== 'default' && (
                    <p className="no-results-filters">
                      {[
                        contact && `0 ${copy.itemNoun[1]}`,
                        kindFilter && (contact ? KIND_CODES[kindFilter] : KIND_LABELS[kindFilter][1]),
                        selectedTags.length > 0 && `filed under ${selectedTags.map((t) => tagLabel(t, true)).join(', ')}`,
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
    </TagLookContext.Provider>
  );
}

// The Covers theme's "Links show": a typeset cover, the site's image or a screenshot, for every link
// that hasn't been given its own choice in Edit.
function LinksShowControl({ value, onChange }: { value: LinksShow; onChange: (value: LinksShow) => void }) {
  return (
    <div className="links-show">
      <span className="links-show-label" id="links-show-label">
        Links show
      </span>
      <div className="segmented" role="group" aria-labelledby="links-show-label">
        {LINKS_SHOW.map(({ id, label }) => (
          <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}>
            {label}
          </button>
        ))}
      </div>
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
  const look = useTagLook();
  return (
    <p className="filed-under-filter" aria-live="polite">
      <span className="filed-under-lead">{lead}</span>{' '}
      {tags.map((tag, i) => (
        <span key={tag}>
          {i > 0 && (i === tags.length - 1 ? ' and ' : ', ')}
          <button
            type="button"
            className="filed-under-tag"
            style={slotStyle(look(tag).slot)}
            aria-label={`Remove filter: ${tagLabel(tag)}`}
            onClick={() => onRemove(tag)}
          >
            {tagLabel(tag, true)}
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

function tagLabel(tag: string, leaf = false): string {
  return tag === UNTAGGED ? 'untagged' : tagName(tag, leaf);
}

// "18 kept · 8 links · 3 quotes · 4 pictures · 3 notes", over the whole library. Kinds with nothing are left out.
function summaryLine(total: number, kindCounts: { kind: ItemKind; count: number }[]): string {
  const kinds = kindCounts.map(({ kind, count }) => `${count} ${count === 1 ? KIND_LABELS[kind][0] : KIND_LABELS[kind][1].toLowerCase()}`);
  return [`${total} kept`, ...kinds].join(' · ');
}

// "VOL. 1 · OCTOBER 2026". The volume is the years since the first save, plus one.
function volumeLine(bookmarks: Bookmark[] | undefined): string {
  const now = new Date();
  const first = (bookmarks ?? []).reduce((min, b) => Math.min(min, b.createdAt), now.getTime());
  const volume = Math.floor((now.getTime() - first) / (365.25 * 24 * 3600 * 1000)) + 1;
  const month = now.toLocaleDateString('en', { month: 'long', year: 'numeric' });
  return `Vol. ${volume} · ${month}`;
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
