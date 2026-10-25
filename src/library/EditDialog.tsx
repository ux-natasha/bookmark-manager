import { useEffect, useRef, useState } from 'react';
import { TagInput } from '../components/TagInput';
import { setPreviewPreference, updateBookmark } from '../lib/bookmarks';
import { isDeadLink, type Bookmark, type PreviewKind } from '../lib/db';
import { formatDate } from '../lib/hooks';
import { sendToBackground } from '../lib/messages';
import { platformById } from '../lib/platform';
import { pickPreview, usePreviews, usePreviewUrlOfKind } from '../lib/previews';

interface Props {
  bookmark: Bookmark;
  allTags: string[];
  onClose: () => void;
  onDelete: (bookmark: Bookmark) => void;
}

const PREVIEW_LABELS: Record<PreviewKind, string> = {
  screenshot: 'Screenshot',
  image: "Site's image",
};

export function EditDialog({ bookmark, allTags, onClose, onDelete }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(bookmark.title);
  const [tags, setTags] = useState(bookmark.tags);
  const [note, setNote] = useState(bookmark.note);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const save = async () => {
    await updateBookmark(bookmark.id, { title: title.trim() || bookmark.url, tags, note });
    onClose();
  };

  const refreshDetails = async () => {
    setRefreshing(true);
    await sendToBackground({ type: 'enrich-one', bookmarkId: bookmark.id });
    setRefreshing(false);
  };

  const platform = platformById(bookmark.platform);
  const details = [
    platform?.label ?? bookmark.siteName,
    bookmark.author && `by ${bookmark.author}`,
    bookmark.publishedAt && `published ${formatDate(bookmark.publishedAt)}`,
  ].filter(Boolean);

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose}>
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <h2>Edit bookmark</h2>
        <p className="small muted truncate">
          <a href={bookmark.url} target="_blank" rel="noreferrer">
            {bookmark.url}
          </a>
        </p>

        {isDeadLink(bookmark) && (
          <p className="dead-notice small">
            {bookmark.linkStatus === 'gone'
              ? 'This link may be dead: the site says the page no longer exists.'
              : "This link may be dead: the site hasn't answered in the last two checks."}
          </p>
        )}

        <PreviewPicker bookmark={bookmark} />

        {(details.length > 0 || bookmark.description) && (
          <div className="page-details small">
            {details.length > 0 && <p className="muted">{details.join(' · ')}</p>}
            {bookmark.description && <p>{bookmark.description}</p>}
          </div>
        )}

        <label className="field">
          <span className="small muted">Title</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>

        <div className="field">
          <span className="small muted">Tags</span>
          <TagInput tags={tags} allTags={allTags} onChange={setTags} />
        </div>

        <label className="field">
          <span className="small muted">Note</span>
          <textarea
            value={note}
            placeholder="Why did you save this? (optional)"
            onChange={(e) => setNote(e.target.value)}
          />
        </label>

        <p className="small muted">
          Saved {formatDate(bookmark.createdAt)}
          {bookmark.importedFolder?.length ? ` · from favorites folder “${bookmark.importedFolder.join(' / ')}”` : ''}
          {' · '}
          {bookmark.openCount === 0
            ? 'never opened from here'
            : `opened ${bookmark.openCount}× · last ${formatDate(bookmark.lastOpenedAt!)}`}
          {bookmark.lastCheckedAt ? ` · link checked ${formatDate(bookmark.lastCheckedAt)}` : ''}
        </p>

        <div className="dialog-actions">
          <button type="button" className="danger" onClick={() => onDelete(bookmark)}>
            Delete
          </button>
          <button type="button" onClick={refreshDetails} disabled={refreshing}>
            {refreshing ? 'Refreshing…' : 'Refresh details'}
          </button>
          <span className="spacer" />
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary">
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}

// Shows the available previews side by side when there's a choice, and lets you pick one.
function PreviewPicker({ bookmark }: { bookmark: Bookmark }) {
  const previews = usePreviews(bookmark.id);
  const screenshotUrl = usePreviewUrlOfKind(previews, 'screenshot');
  const imageUrl = usePreviewUrlOfKind(previews, 'image');
  if (!previews?.length) return null;

  const shown = pickPreview(bookmark, previews)?.kind;
  const options = (['screenshot', 'image'] as const)
    .map((kind) => ({ kind, url: kind === 'screenshot' ? screenshotUrl : imageUrl }))
    .filter((o): o is { kind: PreviewKind; url: string } => !!o.url);

  return (
    <fieldset className="preview-picker">
      <legend className="small muted">{options.length > 1 ? 'Preview: pick which one the card shows' : 'Preview'}</legend>
      {options.map(({ kind, url }) => (
        <label key={kind} className={`preview-option ${shown === kind ? 'is-selected' : ''}`}>
          <input
            type="radio"
            name="preview"
            checked={shown === kind}
            disabled={options.length < 2}
            onChange={() => setPreviewPreference(bookmark.id, kind)}
          />
          <img src={url} alt="" />
          <span className="small">{PREVIEW_LABELS[kind]}</span>
        </label>
      ))}
    </fieldset>
  );
}
