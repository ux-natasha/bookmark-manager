import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { TagInput } from '../components/TagInput';
import { ToastView } from '../components/ToastView';
import { Favicon } from '../components/Favicon';
import { deleteBookmark, findByUrl, markOpened, updateBookmark } from '../lib/bookmarks';
import type { Bookmark } from '../lib/db';
import { formatDate, useBookmarks, useTagCounts, useToast } from '../lib/hooks';
import { getLastSave, onLastSave, openLibrary, sendToBackground, type LastSave } from '../lib/messages';
import { hostnameOf, isSaveableUrl } from '../lib/normalize';
import { platformById } from '../lib/platform';
import { usePreviewUrl } from '../lib/previews';

interface ActiveTab {
  url?: string;
  title?: string;
  windowId?: number;
}

const RECENT_COUNT = 5;
// How long the "Saved just now" banner counts as fresh.
const JUST_SAVED_MS = 60_000;

function useActiveTab(): ActiveTab {
  const [tab, setTab] = useState<ActiveTab>({});

  useEffect(() => {
    let windowId: number | undefined;
    const refresh = async () => {
      const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
      windowId = active?.windowId;
      setTab({ url: active?.url, title: active?.title, windowId: active?.windowId });
    };
    refresh();

    const onActivated = (info: chrome.tabs.TabActiveInfo) => {
      if (info.windowId === windowId) refresh();
    };
    const onUpdated = (_id: number, change: chrome.tabs.TabChangeInfo, t: chrome.tabs.Tab) => {
      if (t.active && t.windowId === windowId && (change.url || change.title)) refresh();
    };
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  return tab;
}

function useLastSave(): LastSave | undefined {
  const [save, setSave] = useState<LastSave>();
  useEffect(() => {
    getLastSave().then(setSave);
    return onLastSave(setSave);
  }, []);
  return save;
}

export function SidePanel() {
  const tab = useActiveTab();
  const lastSave = useLastSave();
  const bookmarks = useBookmarks();
  const tagCounts = useTagCounts(bookmarks);
  const { toast, showToast, hideToast } = useToast();

  const canSave = isSaveableUrl(tab.url);
  // lastSave is a dependency so the panel re-checks right after the background script saves.
  const current = useLiveQuery(
    async () => (canSave && tab.url ? ((await findByUrl(tab.url)) ?? null) : null),
    [tab.url, canSave, lastSave?.at],
  );

  // The background script does the saving, so it can also take a screenshot and read the page's details.
  const saveCurrent = () => {
    if (canSave && tab.windowId !== undefined) sendToBackground({ type: 'save-active-tab', windowId: tab.windowId });
  };

  const retakeScreenshot = async (bookmark: Bookmark) => {
    if (tab.windowId === undefined) return;
    const result = (await sendToBackground({ type: 'retake-screenshot', bookmarkId: bookmark.id, windowId: tab.windowId })) as { ok: boolean };
    showToast({ message: result.ok ? 'Screenshot updated' : "Couldn't take a screenshot of this page" });
  };

  const undoSave = async (bookmark: Bookmark) => {
    await deleteBookmark(bookmark.id);
    showToast({ message: 'Removed from your library' });
  };

  return (
    <div className="panel">
      <header className="panel-header">
        <h1>Bookmarks</h1>
        <button onClick={openLibrary} title="Open the full library in a tab">
          Open library ↗
        </button>
      </header>

      <section className="panel-current">
        {!canSave ? (
          <p className="muted">This page can't be saved. Only web pages (http/https) can.</p>
        ) : current === undefined ? null : current === null ? (
          <UnsavedPage tab={tab} onSave={saveCurrent} />
        ) : (
          <SavedPage
            key={current.id}
            bookmark={current}
            lastSave={lastSave}
            allTags={tagCounts.map((t) => t.tag)}
            onUndo={() => undoSave(current)}
            onRetakeScreenshot={() => retakeScreenshot(current)}
          />
        )}
      </section>

      <section className="panel-recent">
        <h2>Recently saved</h2>
        {bookmarks && bookmarks.length === 0 && <p className="muted small">Nothing saved yet.</p>}
        <ul>
          {bookmarks?.slice(0, RECENT_COUNT).map((b) => (
            <li key={b.id}>
              <a
                href={b.url}
                target="_blank"
                rel="noreferrer"
                onClick={() => markOpened(b.id)}
                className="recent-item"
              >
                <Favicon url={b.url} />
                <span className="truncate">{b.title}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <ToastView toast={toast} onDone={hideToast} />
    </div>
  );
}

function UnsavedPage({ tab, onSave }: { tab: ActiveTab; onSave: () => void }) {
  return (
    <div className="page-card">
      <PageHeading url={tab.url!} title={tab.title || tab.url!} />
      <button className="primary full" onClick={onSave}>
        Save this page
      </button>
    </div>
  );
}

interface SavedPageProps {
  bookmark: Bookmark;
  lastSave?: LastSave;
  allTags: string[];
  onUndo: () => void;
  onRetakeScreenshot: () => void;
}

function SavedPage({ bookmark, lastSave, allTags, onUndo, onRetakeScreenshot }: SavedPageProps) {
  const previewUrl = usePreviewUrl(bookmark);
  const platform = platformById(bookmark.platform);
  const [title, setTitle] = useState(bookmark.title);
  const [note, setNote] = useState(bookmark.note);

  const isLastSave = lastSave?.bookmarkId === bookmark.id && Date.now() - lastSave.at < JUST_SAVED_MS;
  const justCreated = isLastSave && lastSave.created;

  return (
    <div className="page-card">
      <p className={`save-status ${justCreated ? 'is-new' : ''}`}>
        {justCreated ? (
          <>
            ✓ Saved{' '}
            <button className="link" onClick={onUndo}>
              Undo
            </button>
          </>
        ) : (
          <>Already in your library · saved {formatDate(bookmark.createdAt)}</>
        )}
      </p>

      {previewUrl && (
        <div className="panel-preview">
          <img src={previewUrl} alt="" />
          {platform && <span className="card-platform">{platform.label}</span>}
        </div>
      )}

      <PageHeading url={bookmark.url} title={bookmark.title} />

      {bookmark.description && <p className="small muted panel-description">{bookmark.description}</p>}

      <label className="field">
        <span className="small muted">Title</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title.trim() && title !== bookmark.title && updateBookmark(bookmark.id, { title: title.trim() })}
        />
      </label>

      <div className="field">
        <span className="small muted">Tags</span>
        <TagInput tags={bookmark.tags} allTags={allTags} onChange={(tags) => updateBookmark(bookmark.id, { tags })} />
      </div>

      <label className="field">
        <span className="small muted">Note</span>
        <textarea
          value={note}
          placeholder="Why did you save this? (optional)"
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== bookmark.note && updateBookmark(bookmark.id, { note })}
        />
      </label>

      <div className="panel-actions">
        <button className="link small" onClick={onRetakeScreenshot}>
          Retake screenshot
        </button>
        {!justCreated && (
          <button className="link small danger" onClick={onUndo}>
            Remove from library
          </button>
        )}
      </div>
    </div>
  );
}

function PageHeading({ url, title }: { url: string; title: string }) {
  return (
    <div className="page-heading">
      <Favicon url={url} />
      <div className="page-heading-text">
        <strong className="truncate">{title}</strong>
        <span className="small muted truncate">{hostnameOf(url)}</span>
      </div>
    </div>
  );
}
