import type { ReactNode } from 'react';
import { Favicon } from '../components/Favicon';
import { markOpened } from '../lib/bookmarks';
import { isDeadLink, kindOf, type Bookmark } from '../lib/db';
import { formatDate } from '../lib/hooks';
import { hostnameOf } from '../lib/normalize';
import { platformById } from '../lib/platform';
import { fallbackColor, usePreviewUrl } from '../lib/previews';

interface Props {
  bookmark: Bookmark;
  onEdit: (bookmark: Bookmark) => void;
  onTagClick: (tag: string) => void;
  // Saved this session from the library, so it plays the arrive animation.
  arriving?: boolean;
}

export function BookmarkCard({ bookmark, onEdit, onTagClick, arriving }: Props) {
  const kind = kindOf(bookmark);
  const dead = isDeadLink(bookmark);

  return (
    <article className={`card card-kind-${kind} ${dead ? 'is-dead' : ''} ${arriving ? 'is-arriving' : ''}`}>
      <CardLink bookmark={bookmark} onEdit={onEdit}>
        {kind === 'link' && <LinkContent bookmark={bookmark} />}
        {kind === 'image' && <ImageContent bookmark={bookmark} />}
        {kind === 'quote' && <QuoteContent bookmark={bookmark} />}
        {kind === 'note' && <NoteContent bookmark={bookmark} />}
      </CardLink>
      <footer className="card-footer">
        <div className="card-tags">
          {bookmark.tags.map((tag) => (
            <button key={tag} className="tag" onClick={() => onTagClick(tag)}>
              {tag}
            </button>
          ))}
        </div>
        <div className="card-meta small muted">
          <span title={`Saved ${new Date(bookmark.createdAt).toLocaleString()}`}>{formatDate(bookmark.createdAt)}</span>
          <button className="link small" onClick={() => onEdit(bookmark)}>
            Edit
          </button>
        </div>
      </footer>
    </article>
  );
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
      <button type="button" className={className} aria-label={ariaLabel} onClick={() => onEdit(bookmark)}>
        {children}
      </button>
    );
  }
  const open = () => markOpened(bookmark.id);
  return (
    <a
      className={className}
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

function LinkContent({ bookmark }: { bookmark: Bookmark }) {
  const previewUrl = usePreviewUrl(bookmark);
  const platform = platformById(bookmark.platform);
  const source = platform?.label ?? bookmark.siteName ?? hostnameOf(bookmark.url);
  const dead = isDeadLink(bookmark);

  return (
    <>
      <div className="card-preview">
        {previewUrl ? (
          <img className="card-preview-image" src={previewUrl} alt="" loading="lazy" />
        ) : (
          // Designed fallback for pages with no image: site color, icon and name.
          <div className="card-fallback" style={{ background: fallbackColor(bookmark) }}>
            <Favicon className="card-fallback-icon" url={bookmark.url} size={64} />
            <span className="card-fallback-name">{source}</span>
          </div>
        )}
        {platform && <span className="card-platform">{platform.label}</span>}
        {dead && (
          <span className="card-dead" title={bookmark.linkStatus === 'gone' ? 'The site says this page no longer exists' : "The site hasn't answered in two checks"}>
            Link may be dead
          </span>
        )}
      </div>
      <div className="card-body">
        <h3 className="card-title">{bookmark.title}</h3>
        <p className="small muted truncate card-host">
          <Favicon url={bookmark.url} />
          {bookmark.siteName && bookmark.siteName !== platform?.label ? `${bookmark.siteName} · ` : ''}
          {hostnameOf(bookmark.url)}
        </p>
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
  return (
    <>
      <div className="card-picture">
        {pictureUrl ? (
          <img src={pictureUrl} alt={bookmark.title} loading="lazy" />
        ) : (
          <span className="small muted">Picture couldn't be downloaded</span>
        )}
        <span className="card-platform">Picture</span>
      </div>
      <div className="card-body">
        <h3 className="card-title">{bookmark.title}</h3>
        <SourceLine bookmark={bookmark} />
        {bookmark.note && <p className="card-note small">{bookmark.note}</p>}
      </div>
    </>
  );
}

function QuoteContent({ bookmark }: { bookmark: Bookmark }) {
  return (
    <div className="card-body">
      <blockquote className="card-quote">{bookmark.text}</blockquote>
      <p className="small card-quote-title truncate">{bookmark.title}</p>
      <SourceLine bookmark={bookmark} />
      {bookmark.note && <p className="card-note small">{bookmark.note}</p>}
    </div>
  );
}

function NoteContent({ bookmark }: { bookmark: Bookmark }) {
  // Untitled notes are titled by their first line, so it isn't repeated underneath.
  const [firstLine, ...rest] = (bookmark.text ?? '').split('\n');
  const body = firstLine.trim() === bookmark.title ? rest.join('\n').trim() : bookmark.text;
  return (
    <div className="card-body">
      <h3 className="card-title">{bookmark.title}</h3>
      {body && <p className="card-note-text small">{body}</p>}
    </div>
  );
}

function SourceLine({ bookmark }: { bookmark: Bookmark }) {
  if (!bookmark.url) return null;
  return (
    <p className="small muted truncate card-host">
      <Favicon url={bookmark.url} />
      from {platformById(bookmark.platform)?.label ?? hostnameOf(bookmark.url)}
    </p>
  );
}
