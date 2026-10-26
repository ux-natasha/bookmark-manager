import { useEffect, useRef, useState } from 'react';
import { saveBookmark } from '../lib/bookmarks';
import type { BookmarkSource } from '../lib/db';
import { TagInput } from './TagInput';

interface Props {
  allTags: string[];
  source: BookmarkSource;
  // Text carried over from somewhere shorter, such as the library's Jot a note field.
  initialText?: string;
  onDone: (saved: boolean) => void;
  // Kept up to date with whether there's anything typed, so the dialog around this form can ask before Esc discards it.
  dirtyRef?: { current: boolean };
}

export const DISCARD_MESSAGE = 'Discard what you wrote?';

// Writing a new note. The title is optional: without one, the note's first line is used.
export function NoteForm({ allTags, source, initialText = '', onDone, dirtyRef }: Props) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState(initialText);
  const [tags, setTags] = useState<string[]>([]);
  const dirty = !!title.trim() || text !== initialText || tags.length > 0;
  if (dirtyRef) dirtyRef.current = dirty;
  const cancel = () => {
    if (dirty && !window.confirm(DISCARD_MESSAGE)) return;
    onDone(false);
  };
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Focus goes to the note itself, after a dialog opening around this form has moved focus to the first field.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const field = textRef.current;
      field?.focus();
      field?.setSelectionRange(field.value.length, field.value.length);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const save = async () => {
    if (!text.trim() && !title.trim()) return;
    await saveBookmark({ kind: 'note', url: '', title, text, tags, source });
    onDone(true);
  };

  return (
    <form
      className="note-form"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label className="field">
        <span className="small muted">Title</span>
        <input type="text" value={title} placeholder="Optional" onChange={(e) => setTitle(e.target.value)} />
      </label>

      <label className="field">
        <span className="small muted">Note</span>
        <textarea
          className="text-field"
          ref={textRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          // Ctrl+Enter saves, since Enter is a new line here.
          onKeyDown={(e) => e.key === 'Enter' && (e.ctrlKey || e.metaKey) && save()}
        />
      </label>

      <div className="field">
        <span className="small muted">Tags</span>
        <TagInput tags={tags} allTags={allTags} onChange={setTags} />
      </div>

      <div className="dialog-actions">
        <span className="spacer" />
        <button type="button" onClick={cancel}>
          Cancel
        </button>
        <button type="submit" className="primary" disabled={!text.trim() && !title.trim()}>
          Save note
        </button>
      </div>
    </form>
  );
}
