import { useId, useMemo, useState, type KeyboardEvent } from 'react';
import { cleanTags } from '../lib/bookmarks';

interface Props {
  tags: string[];
  // Every tag used anywhere in the library, offered as suggestions while typing.
  allTags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

const MAX_SUGGESTIONS = 6;

export function TagInput({ tags, allTags, onChange, placeholder = 'Add tags…' }: Props) {
  const [draft, setDraft] = useState('');
  const [highlight, setHighlight] = useState(0);
  const listId = useId();

  const suggestions = useMemo(() => {
    const query = draft.trim().toLowerCase();
    if (!query) return [];
    return allTags.filter((t) => t.includes(query) && !tags.includes(t)).slice(0, MAX_SUGGESTIONS);
  }, [draft, allTags, tags]);

  const add = (raw: string) => {
    const next = cleanTags([...tags, ...raw.split(',')]);
    if (next.length !== tags.length) onChange(next);
    setDraft('');
    setHighlight(0);
  };

  const remove = (tag: string) => onChange(tags.filter((t) => t !== tag));

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && suggestions.length) {
      e.preventDefault();
      setHighlight((h) => (h + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp' && suggestions.length) {
      e.preventDefault();
      setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      if (!draft.trim()) return;
      e.preventDefault();
      add(suggestions[highlight] ?? draft);
    } else if (e.key === 'Backspace' && !draft && tags.length) {
      remove(tags[tags.length - 1]);
    } else if (e.key === 'Escape') {
      setDraft('');
    }
  };

  return (
    <div className="tag-input">
      {tags.map((tag) => (
        <span key={tag} className="tag">
          {tag}
          <button type="button" aria-label={`Remove tag ${tag}`} onClick={() => remove(tag)}>
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        placeholder={tags.length ? '' : placeholder}
        onChange={(e) => {
          setDraft(e.target.value);
          setHighlight(0);
        }}
        onKeyDown={onKeyDown}
        onBlur={() => draft.trim() && add(draft)}
        role="combobox"
        aria-expanded={suggestions.length > 0}
        aria-controls={listId}
        aria-label="Tags"
      />
      {suggestions.length > 0 && (
        <ul className="tag-suggestions" id={listId} role="listbox">
          {suggestions.map((s, i) => (
            <li
              key={s}
              role="option"
              aria-selected={i === highlight}
              // mousedown, not click, so it fires before the input's blur adds the half-typed draft.
              onMouseDown={(e) => {
                e.preventDefault();
                add(s);
              }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
