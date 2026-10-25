import { useEffect, useMemo, useState } from 'react';
import { saveBookmark, updateBookmark } from '../lib/bookmarks';
import { formatDate } from '../lib/hooks';
import { sendToBackground } from '../lib/messages';
import { hostnameOf, normalizeUrl } from '../lib/normalize';
import type { FoundLink } from '../lib/linkfinder';
import { inspectLink, type Candidate, type PostLinks } from '../lib/posts';
import { Favicon } from './Favicon';
import { TagInput } from './TagInput';

const CONCURRENCY = 4;

interface Props {
  found: PostLinks;
  allTags: string[];
  // Offer to save the post itself too (not needed in the side panel, where it's already saved).
  offerSavePost?: boolean;
  onClose: () => void;
}

interface Outcome {
  added: number;
  tagged: number;
}

// Checks every link found in a post in the background: follows short links, looks for duplicates,
// and fetches titles. Results fill in as they arrive.
function useCandidates(found: PostLinks): Candidate[] {
  const [candidates, setCandidates] = useState<Candidate[]>(() => found.links.map(checking));

  useEffect(() => {
    let cancelled = false;
    let next = 0;
    setCandidates(found.links.map(checking));
    const worker = async () => {
      while (!cancelled && next < found.links.length) {
        const index = next++;
        const candidate = await inspectLink(found.links[index], found.post?.url);
        if (!cancelled) setCandidates((list) => list.map((c, i) => (i === index ? candidate : c)));
      }
    };
    for (let i = 0; i < CONCURRENCY; i++) worker();
    return () => {
      cancelled = true;
    };
  }, [found]);

  return candidates;
}

const checking = (link: FoundLink): Candidate => ({ foundUrl: link.url, url: link.url, status: 'checking', truncated: link.truncated });

function pathOf(url: string): string {
  try {
    const { hostname, pathname, search } = new URL(url);
    return hostname.replace(/^www\./, '') + (pathname === '/' ? '' : pathname) + search;
  } catch {
    return url;
  }
}

export function FoundLinks({ found, allTags, offerSavePost = false, onClose }: Props) {
  const candidates = useCandidates(found);
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});
  const [tags, setTags] = useState<string[]>([]);
  const [savePost, setSavePost] = useState(false);
  const [saving, setSaving] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>();

  // Short links can turn out to be repeats of each other (or links back to the post) once followed.
  const rows = useMemo(() => {
    const seen = new Set<string>();
    const result: { index: number; candidate: Candidate }[] = [];
    candidates.forEach((candidate, index) => {
      if (candidate.skip) return;
      const key = normalizeUrl(candidate.url);
      if (seen.has(key)) return;
      seen.add(key);
      result.push({ index, candidate });
    });
    return result;
  }, [candidates]);

  // New links from a post are ticked; links from a whole page (menus and all) are left for you to pick.
  const defaultChecked = (c: Candidate) =>
    !found.wholePage && c.status === 'ready' && !c.existing && !c.truncated;
  const isChecked = (index: number, c: Candidate) => overrides[index] ?? defaultChecked(c);

  const checked = rows.filter(({ index, candidate }) => isChecked(index, candidate));
  const newCount = checked.filter(({ candidate }) => !candidate.existing).length;
  const existingCount = checked.length - newCount;
  const stillChecking = candidates.some((c) => c.status === 'checking');

  const setAll = (value: boolean) =>
    setOverrides(Object.fromEntries(rows.filter(({ candidate }) => !candidate.existing).map(({ index }) => [index, value])));

  const save = async () => {
    setSaving(true);
    let added = 0;
    let tagged = 0;
    for (const { candidate } of checked) {
      if (candidate.existing) {
        if (!tags.length) continue;
        await updateBookmark(candidate.existing.id, { tags: [...candidate.existing.tags, ...tags] });
        tagged++;
      } else {
        const { created } = await saveBookmark({
          url: candidate.url,
          title: candidate.title,
          source: 'post',
          tags,
          foundInUrl: found.post?.url,
          foundInTitle: found.post?.title,
        });
        if (created) added++;
      }
    }
    if (savePost && found.post) {
      await saveBookmark({ url: found.post.url, title: found.post.title, source: 'post', tags });
    }
    // Previews and details for the new bookmarks are fetched in the background.
    sendToBackground({ type: 'enrich-pending' });
    setOutcome({ added, tagged });
    setSaving(false);
  };

  if (outcome) {
    return (
      <div className="found-links">
        <p>
          {outcome.added === 0 && outcome.tagged === 0
            ? 'Nothing new was saved.'
            : [
                outcome.added > 0 && `Saved ${outcome.added} ${outcome.added === 1 ? 'link' : 'links'}`,
                outcome.tagged > 0 && `added tags to ${outcome.tagged} you already had`,
              ]
                .filter(Boolean)
                .join(', ') + '.'}
          {outcome.added > 0 && ' Previews are being fetched in the background.'}
        </p>
        <div className="dialog-actions">
          <span className="spacer" />
          <button className="primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    );
  }

  if (found.links.length === 0) {
    return (
      <div className="found-links">
        <p className="muted">{found.hint ?? 'No links found.'}</p>
        <div className="dialog-actions">
          <span className="spacer" />
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="found-links">
      <div className="found-links-heading small muted">
        <span>
          {rows.length} {rows.length === 1 ? 'link' : 'links'} found
          {found.post?.title ? ` in “${found.post.title}”` : ''}
          {stillChecking ? ' · checking…' : ''}
        </span>
        <span className="spacer" />
        <button className="link small" onClick={() => setAll(true)}>
          Select all new
        </button>
        <button className="link small" onClick={() => setAll(false)}>
          None
        </button>
      </div>
      {found.wholePage && (
        <p className="small muted">These are from the whole page, so some may be menus or ads. Pick the ones you want.</p>
      )}

      <ul className="found-list">
        {rows.map(({ index, candidate }) => (
          <li key={index}>
            <label className={`found-item ${candidate.existing ? 'is-existing' : ''}`}>
              <input
                type="checkbox"
                checked={isChecked(index, candidate)}
                disabled={candidate.status === 'checking'}
                onChange={(e) => setOverrides((o) => ({ ...o, [index]: e.target.checked }))}
              />
              <Favicon url={candidate.url} />
              <span className="found-item-text">
                <span className="truncate">{candidate.title || hostnameOf(candidate.url)}</span>
                <span className="small muted truncate">{pathOf(candidate.url)}</span>
                {candidate.truncated && (
                  <span className="small muted">The post cut this address short, so this is the site’s home page.</span>
                )}
                <span className="found-item-status small muted">
                  {candidate.status === 'checking'
                    ? 'Checking…'
                    : candidate.existing
                      ? `Already saved · ${formatDate(candidate.existing.createdAt)}`
                      : candidate.status === 'unreachable'
                        ? "Didn't answer"
                        : 'New'}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="field">
        <span className="small muted">Tags for the links you save</span>
        <TagInput tags={tags} allTags={allTags} onChange={setTags} />
        {existingCount > 0 && (
          <span className="small muted">
            {tags.length
              ? `The ${existingCount} ticked ${existingCount === 1 ? 'link' : 'links'} you already have will get these tags too.`
              : 'Links you already have are only changed if you add tags.'}
          </span>
        )}
      </div>

      {offerSavePost && found.post && (
        <label className="checkbox">
          <input type="checkbox" checked={savePost} onChange={(e) => setSavePost(e.target.checked)} />
          Also save the post itself
        </label>
      )}

      <div className="dialog-actions">
        <span className="spacer" />
        <button onClick={onClose}>Cancel</button>
        <button className="primary" disabled={saving || (newCount === 0 && !(existingCount > 0 && tags.length) && !savePost)} onClick={save}>
          {saving ? 'Saving…' : newCount > 0 ? `Save ${newCount} ${newCount === 1 ? 'link' : 'links'}` : 'Save'}
        </button>
      </div>
    </div>
  );
}
