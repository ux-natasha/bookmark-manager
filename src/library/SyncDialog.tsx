import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { formatDate } from '../lib/hooks';
import { chooseSyncFolder, getSyncSetup, stopSync, SYNC_FOLDER_NAME, type SyncOutcome } from '../lib/sync';

interface Props {
  outcome: SyncOutcome | undefined;
  run: (ask?: boolean) => Promise<SyncOutcome>;
  onClose: () => void;
}

// Sync through a folder you already sync: picking it, seeing when it last ran, and stopping.
export function SyncDialog({ outcome, run, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // undefined while loading, null when no folder is set.
  const setup = useLiveQuery(async () => (await getSyncSetup()) ?? null, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const act = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
    } catch (err) {
      // Closing the folder picker without choosing isn't a problem.
      if (!(err instanceof DOMException && err.name === 'AbortError')) setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const choose = () => act(async () => {
    await chooseSyncFolder();
    await run(true);
  });

  return (
    <dialog ref={dialogRef} className="dialog" onClose={onClose}>
      <h2>Sync</h2>
      <p className="small">
        Keep this library the same in each browser you use, through a folder you already sync, like Dropbox, iCloud
        Drive, Google Drive or OneDrive. No account: each browser keeps its own file in a “{SYNC_FOLDER_NAME}” folder
        there and reads the others’.
      </p>
      <p className="small muted">
        Previews, pictures and the saved copies of pages aren’t synced; each browser reads its own. Syncing runs while
        the library is open.
      </p>

      {setup === undefined ? null : !setup ? (
        <p className="small">Pick the same folder in each browser to start.</p>
      ) : (
        <p className="small">
          Syncing through <strong>{setup.folder.name || 'the folder you picked'}</strong>
          {outcome?.status === 'needs-permission' ? (
            <span className="muted"> · paused until you allow the folder again</span>
          ) : outcome?.status === 'failed' ? (
            <span className="dead-notice"> · couldn’t sync: {outcome.message}</span>
          ) : setup.lastSyncedAt ? (
            <span className="muted">
              {' '}
              · last synced {formatDate(setup.lastSyncedAt)},{' '}
              {new Date(setup.lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          ) : null}
        </p>
      )}
      {error && <p className="dead-notice small">{error}</p>}

      <div className="dialog-actions">
        {setup && (
          <button type="button" className="danger" disabled={busy} onClick={() => act(stopSync)}>
            Stop syncing
          </button>
        )}
        {setup && (
          <button type="button" disabled={busy} onClick={choose}>
            Change folder
          </button>
        )}
        <span className="spacer" />
        <button type="button" onClick={onClose}>
          Done
        </button>
        {setup ? (
          <button type="button" className="primary" disabled={busy} onClick={() => act(() => run(true))}>
            {busy ? 'Syncing…' : outcome?.status === 'needs-permission' ? 'Allow and sync' : 'Sync now'}
          </button>
        ) : (
          <button type="button" className="primary" disabled={busy} onClick={choose}>
            Choose folder…
          </button>
        )}
      </div>
    </dialog>
  );
}
