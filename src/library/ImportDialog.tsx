import { useEffect, useRef, useState } from 'react';
import { BROWSER_SAVES } from '../lib/browserKind';
import { readImportFile } from '../lib/importFile';
import { planImport, readFavorites, runImport, type ImportPlan } from '../lib/importer';
import { sendToBackground } from '../lib/messages';

type Phase =
  | { name: 'reading' }
  | { name: 'review'; plan: ImportPlan }
  | { name: 'importing'; done: number; total: number }
  | { name: 'finished'; added: number }
  | { name: 'error'; message: string };

// Without a file, imports the browser's own bookmarks. With one, an export from Pocket, Raindrop or a bookmarks file.
export function ImportDialog({ file, onClose }: { file?: File; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [phase, setPhase] = useState<Phase>({ name: 'reading' });
  const [foldersAsTags, setFoldersAsTags] = useState(true);
  const [label, setLabel] = useState<string>();

  useEffect(() => {
    dialogRef.current?.showModal();
    const read = file
      ? readImportFile(file).then(({ label, items }) => {
          setLabel(label);
          return items;
        })
      : readFavorites();
    read
      .then(planImport)
      .then((plan) => setPhase({ name: 'review', plan }))
      .catch((err: Error) =>
        setPhase({ name: 'error', message: file ? `Couldn't read ${file.name}: ${err.message}` : `Couldn't read your ${BROWSER_SAVES}: ${err.message}` }),
      );
  }, [file]);

  const start = async (plan: ImportPlan) => {
    setPhase({ name: 'importing', done: 0, total: plan.toImport.length });
    try {
      const added = await runImport(plan, { foldersAsTags }, (done, total) =>
        setPhase({ name: 'importing', done, total }),
      );
      setPhase({ name: 'finished', added });
    } catch (err) {
      // Without this the dialog stays on "importing", where it can't be closed.
      setPhase({ name: 'error', message: `The import stopped: ${(err as Error).message}. Anything imported before then was kept.` });
    }
    sendToBackground({ type: 'enrich-pending' });
  };

  return (
    <dialog
      ref={dialogRef}
      className="dialog"
      onClose={onClose}
      // Don't let Esc close the dialog halfway through an import.
      onCancel={(e) => phase.name === 'importing' && e.preventDefault()}
    >
      <h2>{file ? `Import from ${label ?? 'a file'}` : `Import ${BROWSER_SAVES}`}</h2>
      <p className="small muted">
        {file
          ? 'Copies the links in this file into your library, with their tags and notes.'
          : "Copies your browser's bookmarks into this library. Your browser's own bookmarks aren't changed."}
      </p>

      {phase.name === 'reading' && <p>{file ? `Reading ${file.name}…` : `Reading your ${BROWSER_SAVES}…`}</p>}

      {phase.name === 'error' && <p className="error">{phase.message}</p>}

      {phase.name === 'review' && (
        <Review plan={phase.plan} fromFile={!!file} foldersAsTags={foldersAsTags} setFoldersAsTags={setFoldersAsTags} />
      )}

      {phase.name === 'importing' && (
        <div className="field">
          <progress value={phase.done} max={phase.total} />
          <span className="small muted">
            {phase.done} of {phase.total}
          </span>
        </div>
      )}

      {phase.name === 'finished' && (
        <p>
          Done. Added {phase.added} bookmarks to your library. Previews, details and dead-link checks are now
          being fetched in the background; you can keep using the library meanwhile.
        </p>
      )}

      <div className="dialog-actions">
        <span className="spacer" />
        {phase.name === 'review' ? (
          <>
            <button onClick={onClose}>Cancel</button>
            <button className="primary" disabled={phase.plan.toImport.length === 0} onClick={() => start(phase.plan)}>
              Import {phase.plan.toImport.length}
            </button>
          </>
        ) : (
          <button className={phase.name === 'finished' ? 'primary' : ''} disabled={phase.name === 'importing'} onClick={onClose}>
            {phase.name === 'finished' ? 'Done' : 'Close'}
          </button>
        )}
      </div>
    </dialog>
  );
}

interface ReviewProps {
  plan: ImportPlan;
  fromFile: boolean;
  foldersAsTags: boolean;
  setFoldersAsTags: (value: boolean) => void;
}

function Review({ plan, fromFile, foldersAsTags, setFoldersAsTags }: ReviewProps) {
  const extraCopies = plan.duplicateGroups.reduce((sum, g) => sum + g.length - 1, 0);
  // Pocket has no folders, so the option would do nothing.
  const hasFolders = [...plan.toImport, ...plan.alreadySaved].some((item) => item.folder.length > 0);

  return (
    <div className="import-review">
      <ul className="import-stats">
        <li>
          <strong>{plan.total}</strong> {fromFile ? 'links' : BROWSER_SAVES} found
        </li>
        <li>
          <strong>{plan.toImport.length}</strong> new to import
        </li>
        {plan.alreadySaved.length > 0 && (
          <li>
            <strong>{plan.alreadySaved.length}</strong> already in your library
          </li>
        )}
        {extraCopies > 0 && (
          <li>
            <strong>{extraCopies}</strong> duplicate copies (each page is imported once)
          </li>
        )}
        {plan.skipped.length > 0 && (
          <li>
            <strong>{plan.skipped.length}</strong> skipped (not web pages, e.g. bookmarklets)
          </li>
        )}
      </ul>

      {plan.duplicateGroups.length > 0 && (
        <details>
          <summary>See the duplicates in {fromFile ? 'the file' : `your ${BROWSER_SAVES}`}</summary>
          <ul className="duplicate-list small">
            {plan.duplicateGroups.map((group) => (
              <li key={group[0].normalizedUrl}>
                <span className="truncate">{group[0].title || group[0].url}</span>
                <span className="muted">
                  {' '}
                  — saved {group.length}× in{' '}
                  {group.map((item) => item.location).join(', ')}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {hasFolders && (
        <label className="checkbox">
          <input type="checkbox" checked={foldersAsTags} onChange={(e) => setFoldersAsTags(e.target.checked)} />
          Turn folder names into tags
        </label>
      )}
    </div>
  );
}
