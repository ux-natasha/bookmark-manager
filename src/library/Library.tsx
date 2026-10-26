import { useEffect, useMemo, useRef, useState } from 'react';
import { NoteForm } from '../components/NoteForm';
import { ToastView } from '../components/ToastView';
import { exportBackup, restoreBackup } from '../lib/backup';
import { deleteBookmark, restoreBookmark } from '../lib/bookmarks';
import { isDeadLink, kindOf, type Bookmark, type ItemKind } from '../lib/db';
import { useBookmarks, useEnrichProgress, useTagCounts, useToast } from '../lib/hooks';
import { sendToBackground } from '../lib/messages';
import { platformById } from '../lib/platform';
import { pickForgotten } from '../lib/resurface';
import { BookmarkCard } from './BookmarkCard';
import { EditDialog } from './EditDialog';
import { ImportDialog } from './ImportDialog';
import { PostDialog } from './PostDialog';

type Sort = 'newest' | 'oldest' | 'recently-opened' | 'never-opened';

const PAGE_SIZE = 120;
const RESURFACE_COUNT = 6;
const UNTAGGED = '__untagged__';
const OTHER_SITES = '__other__';

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
  const bookmarks = useBookmarks();
  const tagCounts = useTagCounts(bookmarks);
  const platformCounts = usePlatformCounts(bookmarks);
  const kindCounts = useKindCounts(bookmarks);
  const progress = useEnrichProgress();
  const { toast, showToast, hideToast } = useToast();

  const [query, setQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sort, setSort] = useState<Sort>('newest');
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  const [deadOnly, setDeadOnly] = useState(false);
  const [kindFilter, setKindFilter] = useState<ItemKind | null>(null);
  const [writingNote, setWritingNote] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [addingFromPost, setAddingFromPost] = useState(false);
  const [resurfacedIds, setResurfacedIds] = useState<string[] | null>(null);
  const restoreInput = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    if (!bookmarks) return [];
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    const result = bookmarks.filter((b) => {
      if (selectedTags.includes(UNTAGGED) && b.tags.length > 0) return false;
      if (!selectedTags.every((t) => t === UNTAGGED || b.tags.includes(t))) return false;
      if (kindFilter && kindOf(b) !== kindFilter) return false;
      if (platformFilter && (!b.url || (b.platform ?? OTHER_SITES) !== platformFilter)) return false;
      if (deadOnly && !isDeadLink(b)) return false;
      if (!words.length) return true;
      const platformLabel = platformById(b.platform)?.label ?? '';
      const haystack =
        `${b.title} ${b.url} ${b.note} ${b.text ?? ''} ${b.tags.join(' ')} ${b.description ?? ''} ${b.siteName ?? ''} ${b.author ?? ''} ${b.foundInTitle ?? ''} ${platformLabel}`.toLowerCase();
      return words.every((w) => haystack.includes(w));
    });

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
  }, [bookmarks, query, selectedTags, kindFilter, platformFilter, deadOnly, sort]);

  // Looked up from the live list so the dialog updates when details are refreshed.
  const editing = editingId ? bookmarks?.find((b) => b.id === editingId) : undefined;
  const deadCount = useMemo(() => bookmarks?.filter(isDeadLink).length ?? 0, [bookmarks]);
  const filtersActive = selectedTags.length > 0 || kindFilter !== null || platformFilter !== null || deadOnly;
  const clearFilters = () => {
    setSelectedTags([]);
    setKindFilter(null);
    setPlatformFilter(null);
    setDeadOnly(false);
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

  const cardProps = { onEdit: (b: Bookmark) => setEditingId(b.id), onTagClick: toggleTag };
  const isEmpty = bookmarks?.length === 0;

  return (
    <div className="library">
      <header className="library-header">
        <h1>Bookmarks</h1>
        <input
          type="search"
          className="library-search"
          placeholder="Search titles, links, quotes, notes, tags…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setVisible(PAGE_SIZE);
          }}
        />
        <button className="primary" onClick={refreshMemory} disabled={!bookmarks?.length}>
          Refresh my memory
        </button>
        <div className="library-menu">
          <button onClick={() => setWritingNote(true)}>New note</button>
          <button onClick={() => setAddingFromPost(true)}>Add from a post</button>
          <button onClick={() => setImporting(true)}>Import favorites</button>
          <button onClick={exportBackup} disabled={!bookmarks?.length}>
            Back up
          </button>
          <button onClick={() => restoreInput.current?.click()}>Restore</button>
          <button onClick={recheckLinks} disabled={!bookmarks?.length || progress?.running}>
            Check links
          </button>
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
        </div>
      </header>

      {progress?.running && progress.total > 0 && (
        <div className="enrich-progress small muted" role="status">
          <span>
            Fetching previews and details… {progress.done} of {progress.total}
          </span>
          <progress value={progress.done} max={progress.total} />
        </div>
      )}

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
          <div className="grid">
            {resurfaced.map((b) => (
              <BookmarkCard key={b.id} bookmark={b} {...cardProps} />
            ))}
          </div>
        </section>
      )}

      {isEmpty ? (
        <section className="empty">
          <h2>Nothing saved yet</h2>
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
        <div className="library-body">
          <aside className="tag-sidebar">
            {deadCount > 0 && (
              <button className={`tag-filter dead-filter ${deadOnly ? 'is-selected' : ''}`} onClick={() => setDeadOnly((d) => !d)}>
                <span>Links that may be dead</span>
                <span className="muted small">{deadCount}</span>
              </button>
            )}

            {kindCounts.length > 1 && (
              <>
                <h2>Show</h2>
                <ul>
                  {kindCounts.map(({ kind, count }) => (
                    <li key={kind}>
                      <button
                        className={`tag-filter ${kindFilter === kind ? 'is-selected' : ''}`}
                        onClick={() => {
                          setKindFilter((current) => (current === kind ? null : kind));
                          setVisible(PAGE_SIZE);
                        }}
                      >
                        <span>{KIND_LABELS[kind][1]}</span>
                        <span className="muted small">{count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {platformCounts.length > 1 && (
              <>
                <h2>Sources</h2>
                <ul>
                  {platformCounts.map(({ id, label, count }) => (
                    <li key={id}>
                      <button
                        className={`tag-filter ${platformFilter === id ? 'is-selected' : ''}`}
                        onClick={() => {
                          setPlatformFilter((current) => (current === id ? null : id));
                          setVisible(PAGE_SIZE);
                        }}
                      >
                        <span className="truncate">{label}</span>
                        <span className="muted small">{count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <h2>Tags</h2>
            <ul>
              <li>
                <button
                  className={`tag-filter ${selectedTags.includes(UNTAGGED) ? 'is-selected' : ''}`}
                  onClick={() => toggleTag(UNTAGGED)}
                >
                  <em>untagged</em>
                </button>
              </li>
              {tagCounts.map(({ tag, count }) => (
                <li key={tag}>
                  <button
                    className={`tag-filter ${selectedTags.includes(tag) ? 'is-selected' : ''}`}
                    onClick={() => toggleTag(tag)}
                  >
                    <span className="truncate">{tag}</span>
                    <span className="muted small">{count}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <main>
            <div className="toolbar">
              <span className="muted small">
                {filtered.length} {countNoun(filtered.length, kindFilter, kindCounts.length > 1)}
                {filtersActive && (
                  <>
                    {' · '}
                    <button className="link small" onClick={clearFilters}>
                      clear filters
                    </button>
                  </>
                )}
              </span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="recently-opened">Recently opened</option>
                <option value="never-opened">Never opened</option>
              </select>
            </div>

            <div className="grid">
              {filtered.slice(0, visible).map((b) => (
                <BookmarkCard key={b.id} bookmark={b} {...cardProps} />
              ))}
            </div>

            {filtered.length > visible && (
              <button className="show-more" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Show more ({filtered.length - visible} left)
              </button>
            )}
          </main>
        </div>
      )}

      {editing && (
        <EditDialog
          key={editing.id}
          bookmark={editing}
          allTags={tagCounts.map((t) => t.tag)}
          onClose={() => setEditingId(null)}
          onDelete={handleDelete}
        />
      )}
      {writingNote && (
        <NoteDialog
          allTags={tagCounts.map((t) => t.tag)}
          onClose={(saved) => {
            setWritingNote(false);
            if (saved) showToast({ message: 'Note saved' });
          }}
        />
      )}
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
      {addingFromPost && <PostDialog allTags={tagCounts.map((t) => t.tag)} onClose={() => setAddingFromPost(false)} />}
      <ToastView toast={toast} onDone={hideToast} />
    </div>
  );
}

function countNoun(count: number, kind: ItemKind | null, mixed: boolean): string {
  if (kind) {
    const [singular, plural] = KIND_LABELS[kind];
    return count === 1 ? singular : plural.toLowerCase();
  }
  if (mixed) return count === 1 ? 'item' : 'items';
  return count === 1 ? 'bookmark' : 'bookmarks';
}

function NoteDialog({ allTags, onClose }: { allTags: string[]; onClose: (saved: boolean) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);
  return (
    <dialog ref={dialogRef} className="dialog" onClose={() => onClose(false)}>
      <h2>New note</h2>
      <NoteForm allTags={allTags} source="library" onDone={onClose} />
    </dialog>
  );
}
