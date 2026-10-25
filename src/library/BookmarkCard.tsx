import { Favicon } from '../components/Favicon';
import { markOpened } from '../lib/bookmarks';
import { isDeadLink, type Bookmark } from '../lib/db';
import { formatDate } from '../lib/hooks';
import { hostnameOf } from '../lib/normalize';
import { platformById } from '../lib/platform';
import { fallbackColor, usePreviewUrl } from '../lib/previews';

interface Props {
  bookmark: Bookmark;
  onEdit: (bookmark: Bookmark) => void;
  onTagClick: (tag: string) => void;
}

export function BookmarkCard({ bookmark, onEdit, onTagClick }: Props) {
  const open = () => markOpened(bookmark.id);
  const previewUrl = usePreviewUrl(bookmark);
  const platform = platformById(bookmark.platform);
  const source = platform?.label ?? bookmark.siteName ?? hostnameOf(bookmark.url);
  const dead = isDeadLink(bookmark);

  return (
    <article className={`card ${dead ? 'is-dead' : ''}`}>
      <a
        className="card-link"
        href={bookmark.url}
        target="_blank"
        rel="noreferrer"
        onClick={open}
        // Middle-click opens in a background tab and should count as opening it too.
        onAuxClick={(e) => e.button === 1 && open()}
      >
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
      </a>
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
