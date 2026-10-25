import { useEffect, useRef, useState } from 'react';
import { FoundLinks } from '../components/FoundLinks';
import { isSingleLink, linksFromPostUrl, linksFromText, type PostLinks } from '../lib/posts';

type Phase = { name: 'input' } | { name: 'finding' } | { name: 'review'; found: PostLinks; fromLink: boolean };

export function PostDialog({ allTags, onClose }: { allTags: string[]; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [phase, setPhase] = useState<Phase>({ name: 'input' });
  const [text, setText] = useState('');

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const find = async () => {
    const input = text.trim();
    if (!input) return;
    if (isSingleLink(input)) {
      setPhase({ name: 'finding' });
      setPhase({ name: 'review', found: await linksFromPostUrl(input), fromLink: true });
    } else {
      setPhase({ name: 'review', found: linksFromText(input), fromLink: false });
    }
  };

  return (
    <dialog ref={dialogRef} className="dialog dialog-wide" onClose={onClose}>
      <h2>Add from a post</h2>

      {phase.name === 'input' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            find();
          }}
        >
          <p className="small muted">
            Paste the link to a post (X, Bluesky, Threads, Reddit, LinkedIn, Mastodon…) or the post's text, and
            the sites it mentions are picked out for you to save.
          </p>
          <label className="field">
            <span className="small muted">Post link or text</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="https://x.com/someone/status/…"
              rows={5}
              autoFocus
            />
          </label>
          <div className="dialog-actions">
            <span className="spacer" />
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={!text.trim()}>
              Find links
            </button>
          </div>
        </form>
      )}

      {phase.name === 'finding' && <p>Reading the post…</p>}

      {phase.name === 'review' && (
        <FoundLinks found={phase.found} allTags={allTags} offerSavePost={phase.fromLink} onClose={onClose} />
      )}
    </dialog>
  );
}
