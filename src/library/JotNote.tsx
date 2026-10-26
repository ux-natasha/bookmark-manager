import { useState } from 'react';
import { saveBookmark } from '../lib/bookmarks';
import type { Bookmark } from '../lib/db';

interface Props {
  onSaved: (bookmark: Bookmark) => void;
  // Shift+Enter: carry the text over to the full New note dialog, for longer notes or adding tags.
  onExpand: (text: string) => void;
}

// A one-line note field beside search. Enter keeps the note and leaves focus here for the next one.
export function JotNote({ onSaved, onExpand }: Props) {
  const [text, setText] = useState('');

  const keep = async () => {
    if (!text.trim()) return;
    const { bookmark } = await saveBookmark({ kind: 'note', url: '', text, source: 'library' });
    setText('');
    onSaved(bookmark);
  };

  return (
    <form
      className="jot-note"
      onSubmit={(e) => {
        e.preventDefault();
        keep();
      }}
    >
      <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
      </svg>
      <input
        type="text"
        aria-label="Jot a note"
        placeholder="Jot a note, it lands with everything else"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            onExpand(text);
            setText('');
          }
        }}
      />
      <button type="submit" className="primary" disabled={!text.trim()}>
        Keep
      </button>
    </form>
  );
}
