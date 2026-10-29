import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { TagInput } from '../components/TagInput';
import { DISCARD_MESSAGE } from '../components/NoteForm';
import { retitleNote, setPreviewPreference, updateBookmark } from '../lib/bookmarks';
import { coverFor } from '../lib/covers';
import { db, isDeadLink, kindOf, type Bookmark, type ItemKind, type PreviewKind, type PreviewPreference } from '../lib/db';
import { formatDate } from '../lib/hooks';
import { sendToBackground } from '../lib/messages';
import { platformById } from '../lib/platform';
import { linkShows, useLinksShow } from '../lib/linksShow';
import { pickPreview, usePreviews, usePreviewUrl, usePreviewUrlOfKind } from '../lib/previews';
import { useTheme } from '../lib/theme';
import { Cover } from './Cover';

interface Props {
  bookmark: Bookmark;
  allTags: string[];
  onClose: () => void;
  onDelete: (bookmark: Bookmark) => void;
}

const PREVIEW_LABELS: Record<PreviewPreference, string> = {
  screenshot: 'Screenshot',
  image: "Site's image",
  cover: 'Cover',
};

const HEADINGS: Record<ItemKind, string> = {
  link: 'Edit bookmark',
  image: 'Edit picture',
  quote: 'Edit quote',
  note: 'Edit note',
};

export function EditDialog({ bookmark, allTags, onClose, onDelete }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(bookmark.title);
  const [tags, setTags] = useState(bookmark.tags);
  const [note, setNote] = useState(bookmark.note);
  const [text, setText] = useState(bookmark.text ?? '');
  const kind = kindOf(bookmark);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const hasText = kind === 'quote' || kind === 'note';
  const dirty =
    title !== bookmark.title ||
    note !== bookmark.note ||
    text !== (bookmark.text ?? '') ||
    JSON.stringify(tags) !== JSON.stringify(bookmark.tags);
  // A quote is its words; a note needs words or a title. Saving either empty would leave a blank card.
  const canSave = kind === 'quote' ? !!text.trim() : kind === 'note' ? !!text.trim() || !!title.trim() : true;

  // Esc, Cancel and the like ask first when something has been changed.
  const requestClose = () => {
    if (dirty && !window.confirm(DISCARD_MESSAGE)) return;
    onClose();
  };

  const save = async () => {
    if (!canSave) return;
    const nextTitle = title.trim() || bookmark.url || bookmark.title;
    await updateBookmark(bookmark.id, {
      // A note titled by its first line keeps following it.
      title: kind === 'note' ? retitleNote(bookmark, nextTitle, text) : nextTitle,
      tags,
      note,
      ...(hasText && { text: text.trim() }),
    });
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
    <dialog
      ref={dialogRef}
      className="dialog"
      onClose={onClose}
      onCancel={(e) => {
        if (!dirty) return;
        e.preventDefault();
        requestClose();
      }}
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <h2>{HEADINGS[kind]}</h2>
        {bookmark.url && (
          <p className="small muted truncate">
            {kind !== 'link' && 'From '}
            <a href={bookmark.url} target="_blank" rel="noreferrer">
              {bookmark.url}
            </a>
          </p>
        )}

        {isDeadLink(bookmark) && (
          <p className="dead-notice small">
            {bookmark.linkStatus === 'gone'
              ? 'This link may be dead: the site says the page no longer exists.'
              : "This link may be dead: the site hasn't answered in the last two checks."}
          </p>
        )}

        {kind === 'link' && <PreviewPicker bookmark={bookmark} />}
        {kind === 'image' && <Picture bookmark={bookmark} />}

        {(details.length > 0 || bookmark.description) && (
          <div className="page-details small">
            {details.length > 0 && <p className="muted">{details.join(' · ')}</p>}
            {bookmark.description && <p>{bookmark.description}</p>}
          </div>
        )}

        {kind === 'link' && <SavedCopy bookmark={bookmark} />}

        <label className="field">
          <span className="small muted">Title</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus={kind !== 'note'} />
        </label>

        {(kind === 'quote' || kind === 'note') && (
          <label className="field">
            <span className="small muted">{kind === 'quote' ? 'Quote' : 'Note'}</span>
            <textarea className="text-field" value={text} onChange={(e) => setText(e.target.value)} autoFocus={kind === 'note'} />
          </label>
        )}

        <div className="field">
          <span className="small muted">Tags</span>
          <TagInput tags={tags} allTags={allTags} onChange={setTags} />
        </div>

        {kind !== 'note' && (
          <label className="field">
            <span className="small muted">Note</span>
            <textarea
              value={note}
              placeholder="Why did you save this? (optional)"
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        )}

        <p className="small muted">
          Saved {formatDate(bookmark.createdAt)}
          {bookmark.importedFolder?.length ? ` · from favorites folder “${bookmark.importedFolder.join(' / ')}”` : ''}
          {bookmark.foundInUrl && (
            <>
              {' · found in '}
              <a href={bookmark.foundInUrl} target="_blank" rel="noreferrer">
                {bookmark.foundInTitle || 'a post'}
              </a>
            </>
          )}
          {kind !== 'note' && (
            <>
              {' · '}
              {bookmark.openCount === 0
                ? 'never opened from here'
                : `opened ${bookmark.openCount}× · last ${formatDate(bookmark.lastOpenedAt!)}`}
            </>
          )}
          {bookmark.lastCheckedAt ? ` · link checked ${formatDate(bookmark.lastCheckedAt)}` : ''}
        </p>

        <div className="dialog-actions">
          <button type="button" className="danger" onClick={() => onDelete(bookmark)}>
            Delete
          </button>
          {kind === 'link' && (
            <button type="button" onClick={refreshDetails} disabled={refreshing}>
              {refreshing ? 'Refreshing…' : 'Refresh details'}
            </button>
          )}
          <span className="spacer" />
          <button type="button" onClick={requestClose}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={!canSave}>
            Save
          </button>
        </div>
      </form>
    </dialog>
  );
}

// The page's words as they were when it was saved, folded away until asked for.
function SavedCopy({ bookmark }: { bookmark: Bookmark }) {
  const page = useLiveQuery(() => db.pageTexts.get(bookmark.id), [bookmark.id]);
  if (!page) return null;
  const words = page.text.split(/\s+/).length;
  return (
    <details className="saved-copy small">
      <summary>
        {isDeadLink(bookmark) ? 'Read the copy kept of this page' : 'Saved copy of the page'}
        <span className="muted">
          {' · '}
          {words.toLocaleString()} words, kept {formatDate(page.savedAt)}
        </span>
      </summary>
      <div className="saved-copy-text">
        {page.text.split('\n').map((line, i) => (
          <p key={i}>{line}</p>
        ))}
      </div>
    </details>
  );
}

// Shows the available previews side by side when there's a choice, and lets you pick one.
// The Covers theme adds the typeset cover as a choice.
function PreviewPicker({ bookmark }: { bookmark: Bookmark }) {
  const covers = useTheme() === 'covers';
  const linksShow = useLinksShow();
  const previews = usePreviews(bookmark.id);
  const screenshotUrl = usePreviewUrlOfKind(previews, 'screenshot');
  const imageUrl = usePreviewUrlOfKind(previews, 'image');
  if (!previews?.length) return null;

  const images = (['screenshot', 'image'] as const)
    .map((kind) => ({ kind, url: kind === 'screenshot' ? screenshotUrl : imageUrl }))
    .filter((o): o is { kind: PreviewKind; url: string } => !!o.url);
  const options: { kind: PreviewPreference; url?: string }[] = covers ? [{ kind: 'cover' }, ...images] : images;
  const wanted = linkShows(bookmark.previewPreference, linksShow);
  // Same rule as the rack: the chosen preview if it exists, else the cover.
  const shown: PreviewPreference | undefined = covers
    ? images.some((o) => o.kind === wanted)
      ? wanted
      : 'cover'
    : pickPreview(bookmark, previews)?.kind;

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
          {url ? (
            <img src={url} alt="" />
          ) : (
            <span className="preview-cover">
              <Cover spec={coverFor(bookmark)} createdAt={bookmark.createdAt} />
            </span>
          )}
          <span className="small">{PREVIEW_LABELS[kind]}</span>
        </label>
      ))}
    </fieldset>
  );
}

function Picture({ bookmark }: { bookmark: Bookmark }) {
  const url = usePreviewUrl(bookmark);
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" title="Open the picture full size">
      <img className="edit-picture" src={url} alt="" />
    </a>
  );
}
