import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef } from 'react';
import { restoreBookmark, trashDaysLeft, trashedBookmarks } from '../lib/bookmarks';
import { kindOf } from '../lib/db';
import { formatDate } from '../lib/hooks';

// Deleted things are kept for 30 days. This is where they can be brought back.
export function TrashDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const trashed = useLiveQuery(trashedBookmarks, []);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose}>
      <h2>Recently deleted</h2>
      <p className="small muted">Deleted things are kept for 30 days, then removed for good.</p>

      {trashed === undefined ? null : trashed.length === 0 ? (
        <p>Nothing has been deleted.</p>
      ) : (
        <ul className="duplicate-list small">
          {trashed.map((b) => {
            const left = trashDaysLeft(b.deletedAt!);
            return (
              <li key={b.id}>
                <span className="truncate">
                  {kindOf(b) !== 'link' && <span className="muted">{kindOf(b)} · </span>}
                  {b.title}
                </span>
                <span className="muted">
                  {' '}
                  — deleted {formatDate(b.deletedAt!)}, {left} {left === 1 ? 'day' : 'days'} left{' '}
                </span>
                <button type="button" className="link small" onClick={() => restoreBookmark(b.id)}>
                  Restore
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="dialog-actions">
        <span className="spacer" />
        <button type="button" className="primary" onClick={onClose}>
          Done
        </button>
      </div>
    </dialog>
  );
}
