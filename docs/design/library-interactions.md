# Library: interaction spec (Default theme, from design F)

Handoff for building the redesigned library tab. It covers layout, tokens, every component and its states, the two new features (**Look ahead** and the **tag index**), how things age, the data changes they need, and a build plan mapped to files in this repo.

- **Design source:** the "H · Themes" page of the design canvas, artboard **"Default · F's media cards"**. A copy of its source is in `docs/design/reference/library-default.dc.html`. It's a prototype format (inline styles, sample data), so read it for exact values, not as code to copy.
- **Scope of this phase:** the Default theme only, light and dark. The other three themes (Contact sheet, Colour field, Covers) come later as token sets; section 4 is structured so they can slot in.
- **Ground rule:** nothing the library does today is removed. Every existing feature gets a place in the new layout (see section 2). If something here conflicts with existing behaviour that isn't mentioned, keep the existing behaviour and flag it.

---

## Contents

1. [What the library is for](#1-what-the-library-is-for)
2. [What changes from today](#2-what-changes-from-today)
3. [Layout](#3-layout)
4. [Design tokens](#4-design-tokens)
5. [Data model changes](#5-data-model-changes)
6. [Components and interactions](#6-components-and-interactions)
7. [Ageing (patina)](#7-ageing-patina)
8. [Motion](#8-motion)
9. [Keyboard and screen readers](#9-keyboard-and-screen-readers)
10. [Responsive behaviour](#10-responsive-behaviour)
11. [Edge cases](#11-edge-cases)
12. [Build plan](#12-build-plan)
13. [Acceptance checklist](#13-acceptance-checklist)
14. [Decisions made in this spec, and open questions](#14-decisions-made-in-this-spec-and-open-questions)

---

## 1. What the library is for

A visual library of everything the person kept: links, pictures, quotes and notes. The previews are the interface. Two ideas run through the design:

- **Things you don't open age.** Cards slowly yellow like paper the longer they go untouched, so forgotten things stand out and find you again. Opening or "dusting off" a card makes it fresh.
- **Tags are an index, not a cloud.** Tags are laid out like the index at the back of a book (tall letters, sub-entries, tags used once run together on one line). The index is collapsed when not in use, and it helps you tidy tags you've stopped using.

**Look ahead** ties the two together: step forward a month at a time to preview how the library (cards and tags) will look if nothing is opened.

---

## 2. What changes from today

| Today (`Library.tsx`) | New design | Notes |
|---|---|---|
| Left sidebar: dead filter, Show (kinds), Sources, Tags | Sidebar removed. Kinds become a pill row; Sources and dead links become a select; tags become the **tag strip + index** above the grid | Same filter state (`kindFilter`, `platformFilter`, `deadOnly`, `selectedTags`), new controls |
| Header buttons: New note, Add from a post, Import, Back up, Restore, Check links | **Add from a post** stays as the primary button. The rest move into a **More** menu. New note also gets an inline **Jot a note** field | No feature removed |
| "Refresh my memory" opens a "From a while ago" row | **Refresh my memory** dusts off three forgotten things and brings them to the front of the grid | Uses `pickForgotten` (section 6.4) |
| Sort select in toolbar | Sort select at the right of the filter row | Same four options |
| Cards in a uniform grid | Masonry columns; each kind has its own card | Section 6.10 |
| Tags on cards as grey chips | "filed under work and reading" sentence on cards | Clickable, same `onTagClick` |
| No ageing | Cards and tags fade with time; Look ahead previews it | Sections 6.3, 7 |
| Flat tags | Nested tags by convention (`recipes/weeknight`), archived tags, stable tag colours | Section 5 |
| System light/dark only | System by default, plus a manual toggle | Section 6.1 |

---

## 3. Layout

Single centred column, max width **1280px**, side padding `clamp(16px, 3vw, 36px)`, top 20px, bottom 64px. Sections are separated by `--gap-section` (26px).

```
┌────────────────────────────────────────────────────────────────────────────┐
│ folia                                       [More ▾] [☾] [Add from a post] │  6.1 header
│                                                                            │
│ 18 KEPT · 8 LINKS · 3 QUOTES · 4 PICTURES · 3 NOTES      ┌───────────────┐ │  6.2 hero
│ Everything you kept.                                     │ Your library  │ │
│ [🔍 Search links, quotes…        ] [✎ Jot a note… Keep]  │ now,          │ │  6.3 Look ahead
│ Fetching previews… 12 of 40 ▬▬▬▬▬▭▭▭                     │ ‹ October 2026 ›│
│                                                          │ ▮▮▮▮▮▮▮▮▮▮▮▮▮ │ │
│                                                          │ 5 things have │ │
│                                                          │ gone yellow   │ │
│                                                          │ [Refresh my…] │ │
│                                                          └───────────────┘ │
│ ────────────────────────────────────────────────────────────────────────── │
│ Most used  work²⁴ · design¹⁹ · reading¹⁷ · travel¹⁴ …   [Open the index · 78]│  6.5 tag strip
│ ────────────────────────────────────────────────────────────────────────── │
│ Showing things filed under WORK and READING  clear                         │  (when filtering)
│ ┌ open index panel (6.6), only when opened ─────────────────────────────┐  │
│ └───────────────────────────────────────────────────────────────────────┘  │
│ (Everything 18) (Links 8) (Quotes 3) (Pictures 4) (Notes 3)  [All sources ▾][Newest first ▾] │ 6.8
│                                                                            │
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐                                                 │  6.9 masonry
│ │card│ │card│ │    │ │card│                                                 │
│ └────┘ │    │ └────┘ └────┘                                                 │
│ ┌────┐ └────┘ ┌────┐ ┌────┐                                                 │
│        …                                                                    │
│                       ( Show more · 240 left )                              │
└────────────────────────────────────────────────────────────────────────────┘
```

**Hero row:** a wrapping flex row. Left block `flex: 1 1 460px` (summary, headline, search and note field). Right block is the Look ahead panel, `flex: 1 1 360px; max-width: 470px`, aligned to the bottom of the row (`align-items: flex-end`). Below 860px wide it wraps under the left block at full width.

**Grid:** 4 columns, each at least 230px, 28px column gap, 34px between cards in a column. See 6.9 for how items are distributed.

---

## 4. Design tokens

Replace the placeholder tokens in `src/styles/base.css`. Keep the existing names where they exist so current components keep working, and add the new ones. Theme switching is done with `data-appearance` on `<html>` (section 6.1); `prefers-color-scheme` applies when it's `system`.

### 4.1 Colour

| Token | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | `#f5f1e8` | `#0D121A` | Page ground |
| `--surface` | `#fffdf8` | `#161D28` | Look ahead panel, index panel, search field, inputs, stamps |
| `--text` | `#1f1d1a` | `#E7ECF3` | Body, titles |
| `--text-muted` | `#5f5a4f` | `#AEB8C6` | Meta, captions, counts (6.08:1 and 9.36:1 on `--bg`) |
| `--border` | `rgba(31,29,26,0.12)` | `rgba(231,236,243,0.12)` | Hairlines, card media inset ring |
| `--border-strong` | `rgba(31,29,26,0.26)` | `rgba(231,236,243,0.28)` | Ghost buttons, pill outlines, dashed note field |
| `--hover` | `rgba(31,29,26,0.06)` | `rgba(231,236,243,0.08)` | Hover fill on ghost controls |
| `--accent` | `#2f4a6b` | `#EDE48A` | Quote mark, focus accents |
| `--solid-bg` / `--solid-text` | `#1f1d1a` / `#f5f1e8` | `#E7ECF3` / `#0D121A` | Primary button, pressed pills and segments |
| `--danger` | `#8a2f1c` | `#F2A08F` | Dead-link stamp and text |
| `--note-paper` | `#fffdf8` | `#161D28` | Note card fill when fresh |
| `--aged-paper` | `#EADBB8` | `#2B2719` | Note fill and cell tint when fully aged |
| `--aged-text` | `#6B5C42` | `#B6A784` | Text colour when fully aged (4.74:1 on aged paper, 6.29:1 dark) |
| `--halo-strength` | `0.22` | `0.32` | Opacity of the blurred colour halo behind media |
| `--stale-tint` | `rgba(201,160,80,0.18)` | `rgba(235,212,150,0.10)` | Shading behind stale tags (6.7) |
| `--tidy-bar` | `rgba(201,160,80,0.20)` | `rgba(235,212,150,0.12)` | Tidy-up bar fill |
| `--age-done` | `#A07B3A` | `#C9A86A` | Look ahead ticks already passed (3.8:1 / 7.5:1 on surface) |

`--accent-text`, `--surface-muted` and `--success` stay for dialogs that aren't restyled yet (map `--surface-muted` to `--hover`).

### 4.2 Tag palette

Eight colours, given to the eight most-used top-level tags (assignment rules in 5.3). Every other tag is drawn in plain `--text`. Each colour has a **mark** (squares, highlights, halos) and a **text** colour per mode. All text colours pass 4.5:1 on `--bg`.

| Slot | Mark | Text, light | Text, dark |
|---|---|---|---|
| 1 terracotta | `#c47a52` | `#9A4F2B` | `#E8A985` |
| 2 blue | `#4d6fa3` | `#2F5288` | `#9DB7E3` |
| 3 rose | `#c4688a` | `#9C3E62` | `#E79BB8` |
| 4 teal | `#5f98a8` | `#2E6E7E` | `#93C6D3` |
| 5 ochre | `#b4893f` | `#80601E` | `#E0BD74` |
| 6 moss | `#6f8a3e` | `#4A6224` | `#A9C77A` |
| 7 stone | `#8a857a` | `#5C584F` | `#C2BCAF` |
| 8 periwinkle | `#7b93c4` | `#4B63A0` | `#A9BCE6` |

Expose as `--tag-1` … `--tag-8` and `--tag-1-text` … `--tag-8-text`. Highlight behind a selected tag: the mark colour at 40% alpha (`#RRGGBB66`) in a band from 55% to 92% of the line height (a highlighter stroke, not a full box). A selected strip name turns `--text` on the band: the tag colour over its own band is under 4.5:1 in light mode.

### 4.3 Type

Self-host the fonts as woff2 in `public/fonts/` (extension pages shouldn't depend on a font CDN, and the library must work offline). Use `font-display: swap`.

| Token | Family | Weights / styles |
|---|---|---|
| `--font-serif` | Newsreader (optical size axis 6–72), fallback Georgia, serif | 300 italic, 400, 400 italic, 500 |
| `--font-sans` | Geist, fallback system-ui, sans-serif | 400, 500, 600 |
| `--font-mono` | Geist Mono, fallback ui-monospace, monospace | 400, 500 |

| Role | Spec |
|---|---|
| Wordmark | "folia", lowercase, Bodoni Moda italic 30px 500 (`--font-wordmark`), in every theme |
| Headline | serif `clamp(50px, 6.4vw, 84px)`, line-height 0.93, letter-spacing -0.025em; "kept." italic |
| Summary line | mono 11px, uppercase, letter-spacing 0.1em, `--text-muted` |
| Card title | serif 19px, 500, line-height 1.22, `text-wrap: pretty`, max 3 lines |
| Quote | serif 25px (21px when the quote is over 60 characters), line-height 1.24, max 8 lines |
| Note body | serif italic 19px, line-height 1.35, max 10 lines |
| Card meta | mono 11px, `--text-muted` |
| "filed under" line | serif italic 14px `--text-muted`; tag names roman, small caps, letter-spacing 0.04em, tag text colour |
| Look ahead month | serif 44px, 400; year italic `--text-muted` |
| Index letter | serif italic 64px, weight 300, line-height 0.85, letter-spacing -0.03em |
| Index entry / sub-entry / run-in | serif 18px / 16px / 15.5px, line-height 1.25 / 1.25 / 1.75 |
| Counts in index | mono 11.5px |
| UI controls (buttons, pills, selects) | sans 13px; pill labels 500 |

### 4.4 Space, size, radius

| Token | Value | Used for |
|---|---|---|
| `--gap-section` | 26px | Between page sections |
| `--grid-gap-x` / `--grid-gap-y` | 28px / 34px | Masonry |
| `--card-gap` | 10px | Inside a card (media, title, lines) |
| `--control-h` | 44px | Buttons, round icon buttons, search field (50px), tag strip button |
| `--pill-h` | 38px | Kind pills, selects |
| `--radius-media` | 10px | Card media |
| `--radius-note` | 12px | Note cards |
| `--radius-panel` | 18px | Look ahead panel, index panel |
| `--radius-bar` | 12px | Tidy-up bar |
| `--radius-pill` | 999px | Pills, round buttons |

Minimum hit area for anything clickable is 44×44px. The two exceptions (index run-in words, the "Dust off" button at 30px tall) sit inside larger rows, and their spacing keeps neighbouring targets 8px apart or more.

### 4.5 Motion

| Token | Value |
|---|---|
| `--ease-out` | `cubic-bezier(.2,.7,.2,1)` |
| `--ease-spring` | `cubic-bezier(.3,1.3,.5,1)` |
| `--dur-fast` | 220ms |
| `--dur-age` | 600ms |

Full table in section 8. Under `prefers-reduced-motion: reduce`, all animation and transition is off; state changes happen instantly.

---

## 5. Data model changes

### 5.1 `Bookmark.dustedAt` (new, optional, not indexed)

Set to `Date.now()` when the person dusts a card off (6.4). It counts as "touched" for ageing without counting as opened, so `openCount` and the "Never opened" sort stay truthful.

### 5.2 "Last touched" and age

Put these in a new pure module `src/lib/age.ts` with unit tests.

```ts
export const MONTH = 30.44 * 24 * 60 * 60 * 1000;
export const FADED = 0.5; // patina at which a card counts as faded (12 months untouched)

// Notes are "touched" when edited; links, pictures and quotes when opened.
// updatedAt is ignored for other kinds because background enrichment bumps it.
export function lastTouched(b: Bookmark): number {
  const base = Math.max(b.createdAt, b.lastOpenedAt ?? 0, b.dustedAt ?? 0);
  return kindOf(b) === 'note' ? Math.max(base, b.updatedAt) : base;
}

export function monthsUntouched(b: Bookmark, now: number): number {
  return Math.max(0, (now - lastTouched(b)) / MONTH);
}

// 0 = fresh, 1 = fully aged (24 months). Dead links don't age; they have their own look.
export function patina(b: Bookmark, now: number): number {
  return isDeadLink(b) ? 0 : Math.min(1, monthsUntouched(b, now) / 24);
}
```

`now` is always passed in. In the library it is `addMonths(Date.now(), lookAheadMonths)` (calendar months), so Look ahead needs no other special cases.

### 5.3 Tag metadata table (Dexie version 3)

```ts
export interface TagMeta {
  tag: string;          // primary key, the full tag including any parent ("recipes/weeknight")
  colorSlot?: number;   // 1–8, top-level tags only; stable once given
  lastUsedAt?: number;  // set when the tag is added to something or picked as a filter
  archivedAt?: number;  // set by "Archive" in tidy-up; unset by "Bring back"
}

db.version(3).stores({
  bookmarks: 'id, normalizedUrl, *tags, createdAt, updatedAt, lastOpenedAt, deletedAt, platform',
  previews: '[bookmarkId+kind], bookmarkId',
  tagMeta: 'tag, archivedAt',
});
```

- **Tag last used** = the latest of `tagMeta.lastUsedAt` and `lastTouched()` of every item carrying that exact tag. Write `lastUsedAt` in `updateBookmark`/`saveBookmark` for tags that were added (not ones already present), and when the tag is picked as a filter in the library.
- **Colour slots** go to the eight most-used top-level tags, in order of count, the first time the library renders with no slot assigned. After that a tag keeps its slot even if its count changes, so colours never shuffle. A slot is freed when its tag is archived or no longer on any item, and the next most-used uncoloured tag gets it on the next render.
- **Archived tags** stay on items and still show on cards. They are left out of the index, the tag strip, the "Most used" line and `TagInput` suggestions. They're listed at the end of the open index so they can be brought back.

### 5.4 Nested tags

A convention, not a schema change: `parent/child`, any depth (`home/kitchen renovation/lighting ideas`).

- `cleanTags` also trims spaces around slashes and drops empty segments: `"Recipes / Weeknight"` → `recipes/weeknight`, `"/recipes//x/"` → `recipes/x`.
- **Filtering by a parent includes its children:** an item matches tag `t` if one of its tags equals `t` or starts with `t + '/'`. Replace the `b.tags.includes(t)` check in `Library.tsx` with that helper (`hasTag(b, t)` in `src/lib/tags.ts`).
- **Counts:** a parent's count is the number of distinct items carrying the parent or any child. A child's count is its own items only.
- A child whose parent tag isn't used on its own still shows its parent as an index entry (count = the children's items), so the hierarchy is visible.

### 5.5 Backup format version 2

`exportBackup` adds `tagMeta: TagMeta[]` and writes `version: 2`. `restoreBackup` accepts version 1 (no tagMeta) and 2. On merge: keep the earliest `archivedAt` only if both sides have one (an un-archive on either side wins), the latest `lastUsedAt`, and the local `colorSlot` when the local side has one. `dustedAt` merges like `lastOpenedAt` (max).

---

## 6. Components and interactions

Each component lists anatomy, states and behaviour. "Ghost button" means: transparent fill, 1px `--border-strong` outline, `--radius-pill`, `--hover` fill on hover, 2px focus ring.

**Focus ring everywhere:** `outline: 2px solid currentColor; outline-offset: 3px` on `:focus-visible`.

### 6.1 Header

Row: wordmark (left, `margin-right: auto`), More menu, appearance toggle, Add from a post. Wraps on narrow screens.

| Element | Behaviour |
|---|---|
| **More** (ghost button, 44px tall, label "More" + chevron) | Opens a menu (`role="menu"`) under the button, aligned right: New note, Import favorites, Check links, Back up, Restore. Disabled items follow today's rules (Back up and Check links are disabled with an empty library; Check links while a check is running). Arrow keys move, Enter activates, Esc closes and returns focus to the button. Clicking outside closes. |
| **Appearance toggle** (44px round ghost, icon only) | Cycles light ↔ dark. The first click from `system` goes to the opposite of the current system appearance. Saved in `chrome.storage.local` as `appearance: 'system' \| 'light' \| 'dark'`; the menu gets a "Match system" item when not on system. Icon: moon in light mode, sun in dark. `aria-label` "Switch to dark mode" / "Switch to light mode". Page background and text cross-fade over 380ms. |
| **Add from a post** (solid button: `--solid-bg`, `--solid-text`, 44px, sans 13px 500) | Opens the existing `PostDialog`. Hover: `filter: brightness(1.07)`. |

### 6.2 Hero: summary, headline, search, Jot a note

- **Summary line:** "18 kept · 8 links · 3 quotes · 4 pictures · 3 notes". Counts are the whole library (not filtered). Kinds with zero items are left out. Below it, when background enrichment runs, the existing progress line: mono 11px "Fetching previews and details… 12 of 40" with a 2px progress bar 200px wide (`--text` on `--border`), `role="status"`.
- **Headline:** "Everything you *kept*." Static.
- **Search field:** 50px tall pill, `--surface` fill, 1px `--border-strong`, search icon (16px, 70% opacity), placeholder "Search links, quotes, pictures, notes…" (italic, `--text-muted`). It searches exactly what it searches today, plus tag names with dashes read as spaces. Typing resets pagination (as today). `Esc` clears when there's text; with no text, Esc blurs.
- **Jot a note** (from F): a second pill beside search, `flex: 1 1 340px; max-width: 520px`, 1.5px dashed `--border-strong`, pencil icon, input in serif italic 17px, placeholder "Jot a note, it lands with everything else". **Keep** is a solid button inside the right end (38px tall), disabled while the field is empty.
  - **Enter** or **Keep** saves a note (`saveBookmark({ kind: 'note', text, source: 'library' })`), clears the field and keeps focus in it. The new card appears at the front of the grid with the "arrive" animation (section 8).
  - **Shift+Enter** opens the full New note dialog with the text carried over, for longer notes or adding tags.
  - Below 720px wide the two pills stack, search first.

### 6.3 Look ahead

A panel (`--surface`, 1px `--border`, `--radius-panel`, padding 18px 20px 12px, centred text) that previews how the library will look in the future if nothing is opened. **It never writes to the database.**

Anatomy, top to bottom:
1. **Lead** (serif italic 17px, muted): "Your library now," at month 0; "Your library as it'll look in" otherwise.
2. **Month row:** ‹ button, month and year (serif 44px, year italic muted, `min-width: 250px` so the arrows don't move as names change), › button. Buttons are 44px round ghosts with 16px chevrons.
3. **Tick strip:** 25 ticks (months 0–24), each 7px wide with a 4px radius and 4px gaps, bottom-aligned in a 22px row. The current month is 22px tall in `--text`. Ticks before it are 8px in `--age-done`. Later ticks are 8px in `--border-strong`. Each January is 14px tall, to mark the year. Decorative (`aria-hidden`).
4. **Footer row:** status text (sans 13px, muted) and one button:
   - Month 0: "Refresh my memory" (6.4).
   - Month 1–24: "Back to today" (returns to 0).

| Interaction | Result |
|---|---|
| ‹ / › | ±1 month, clamped 0–24. ‹ is disabled at 0, › at 24 (`disabled`, 35% opacity, default cursor). |
| ← / → while focus is anywhere inside the panel | Same as ‹ / ›. **Home** returns to 0. |
| Month changes | Every card's patina and every tag's fade animates to the new value over 600ms (sections 7 and 6.6). The status text updates. The month text is `aria-live="polite"`. |
| Status text | "Nothing has gone yellow yet" / "1 thing has gone yellow" / "N things have gone yellow" (faded = patina ≥ 0.5 at the previewed date). |
| While month > 0 | The library is a preview. **Dust off** buttons are hidden, because dusting writes to the database and wouldn't show in a future preview anyway. Opening a card still works and counts as opened. |
| Reload | Look ahead resets to 0 (not persisted). |

### 6.4 Refresh my memory and Dust off

**Dust off** (per card) appears in a card's meta row when its patina is ≥ 0.5 and Look ahead is at 0. It's a 30px tall ghost pill, sans 12px, "Dust off".
- On click it sets `dustedAt = now`.
- The card animates back to fresh over 600ms and plays the "shine" (section 8).
- Its age text becomes "dusted off just now" for the rest of the session.
- Focus moves to the card's main link, since the button disappears.
- A toast "Dusted off · Undo" appears; Undo restores the previous `dustedAt` (or unsets it).

**Refresh my memory** (in Look ahead, month 0):
1. Picks 3 items with `pickForgotten(faded, 3)`, where `faded` is the items with patina ≥ 0.5. If fewer than 3 are faded, it picks from all items, as `pickForgotten` does today.
2. Sets their `dustedAt = now` in one transaction.
3. Moves them to the front of the grid for this session. They're kept in a `refreshedIds` list in component state, which wins over sort order until reload or until "clear filters". Each one shows the shine and a mono label "back from 14 months" in place of its age.
4. Scrolls the grid's first row into view (smooth, or instant under reduced motion).
5. Toast: "Brought back 3 things you'd forgotten · Undo". Undo reverts all three `dustedAt` values and their positions.
- With nothing faded and fewer than 4 items in total, the button is disabled with the title "Nothing to bring back yet".
- This replaces today's "From a while ago" row (see section 14).

### 6.5 Tag strip and "filed under" line

The tag strip is the **collapsed index**: always visible, one line, between two `--border` hairlines (10px vertical padding).

- **"Most used"** (serif italic 20px), then the six most-used top-level, non-archived tags, each a text button: name in serif 18px in its tag text colour (or `--text` if uncoloured), count as a mono 10px superscript, separated by " · " in `--text-muted`.
  - Clicking toggles that tag as a filter. A selected tag gets the highlighter band (4.2).
  - Clicking doesn't open the index.
  - `aria-pressed` reflects selection.
- **Right end:** ghost button "Open the index · 78" (the count is live, non-archived tags), or "Close the index" when open. `aria-expanded`, and `aria-controls` pointing at the index panel.

**Filed under line:** shown under the strip whenever tags are selected, serif italic 19px muted: "Showing things filed under WORK and READING  clear".
- Tag names are roman small caps in their tag text colour. Each is a button that removes that tag (`aria-label` "Remove filter: work").
- Joins: "A", "A and B", "A, B and C".
- "clear" is a sans 13px underlined text button that empties `selectedTags`.
- The line is `aria-live="polite"`.
- Several tags combine with AND, as today.

### 6.6 Tag index (open)

**Opening and closing**
- It starts closed on every visit.
- It opens and closes with the strip button.
- Picking a tag inside the index applies the filter **and closes the index**. Shift-, Ctrl- or Cmd-click keeps it open so several can be picked. A one-line hint in the panel says so: "Picking a tag closes the index. Shift-click to pick several."
- **Esc** inside the panel closes it and returns focus to the strip button.
- When it closes after a pick, focus goes to the strip button and the filed-under line announces the new filter.
- It's inline (it pushes the grid down), not a popover. Clicking elsewhere doesn't close it.

**Panel:** `--surface`, 1px `--border`, `--radius-panel`, padding 24px 28px 26px, 18px gap between rows.

**Rows inside:**
1. **Controls row:**
   - "Find a tag" search field (44px pill, `--bg` fill, max 300px).
   - The hint text (sans 12px, muted).
   - At the right, "Tidy up tags not used in" (serif italic 18px) with a segmented control: Off · 3 months · 6 months · a year (6.7).
2. **Tidy-up bar** (6.7), when it applies.
3. **Letter bar:** A–Z as 30×36px links in serif 17px. Letters with no tags (after search) are shown at 30% opacity and aren't focusable. A link scrolls its letter group to the top of the viewport and moves focus to the group heading. Bottom hairline.
4. **Groups**, in CSS columns (3 columns, each at least 280px, 44px gap). Each group is a letter heading followed by entries, sub-entries and a run-in. 24px between groups. The heading uses `break-after: avoid` so it never sits alone at the foot of a column.
5. **Archived**, at the end, when any tags are archived (6.7).

**Group heading:** the letter in the index letter style (64px italic 300). This tall letter is the signature of the index and must be kept.

**Entry** (top-level tags used two or more times, or with children): a full-width button with the tag's colour square, name, dotted leader and count.
- **Square:** 7×7px, the tag's mark colour, or nothing if uncoloured. It sits on the first line's baseline.
- **Name:** serif 18px. Wraps with a hanging indent (`padding-left: 1em; text-indent: -1em`), and long words break anywhere (`overflow-wrap: anywhere`).
- **Leader:** 1.5px dotted rule in the current colour at 40% opacity. It fills the remaining width and sits on the last line.
- **Count:** mono 11.5px, on the last line. When tidy-up is on it shows time since last use instead ("now", "3 mo", "14 mo").
- Minimum height 32px; the whole row is the hit target.
- **Hover/focus:** the name is underlined (1px, offset 4px).
- **Selected:** the name gets the highlighter band and goes italic. `aria-pressed="true"`.

**Sub-entry** (child tags): indented 30px, an em-dash prefix at 55% opacity (`aria-hidden`), serif 16px, leader and count 11px. Deeper levels repeat the indent and show the rest of the path joined with " / ".

**Run-in** (tags used exactly once, with no children): one paragraph per letter, serif 15.5px, line-height 1.75, muted, with a hanging indent. It starts with a mono 10px uppercase "Once ·", then the tag names as text buttons separated by ", ". The buttons have no box; the hit area is the word plus line-height. Selected words get the highlighter band. This keeps a library of hundreds of single-use tags to a few lines per letter.

**"Find a tag" search:**
- Case-insensitive substring match on the tag, also reading dashes as spaces.
- A parent stays visible if any child matches; it shows only the matching children unless the parent itself matches.
- Groups and letters with no matches disappear from the columns and grey out in the letter bar.
- With no matches: "No tag matches that." (serif italic 22px, muted).
- **Esc** clears the search before it closes the panel.

**Fading by disuse** (applies whether or not tidy-up is on):
- `fade = min(1, monthsSinceTagLastUsed / 18)`, measured from the Look ahead date.
- Entry text colour blends from `--text` to `--aged-text` by `fade`, transitioning over 500ms.
- When `fade > 0.4` (about 7 months), the colour square turns hollow: a 1.5px border in the mark colour, transparent fill.
- **Selected tags never fade**, and neither do tags used in the last week.

### 6.7 Tidy up and archive

- **Threshold:** segmented control, Off / 3 months / 6 months / a year. Default "a year", saved in `chrome.storage.local` as `tidyThreshold` (0, 3, 6 or 12). The pressed segment uses the solid colours.
- **Stale tag:** months since last use (from the Look ahead date) ≥ the threshold. Never stale: selected tags, archived tags, and tags on items opened in the last month.
- **Stale entries** get a `--stale-tint` fill (4px radius, entry padding 3px 4px). This is in addition to fading, so stale and faded can't be confused.
- **Tidy-up bar:** shown only when the threshold isn't Off and there's at least one stale tag. Fill `--tidy-bar`, `--radius-bar`, padding 12px 16px. Contents:
  - Count sentence (serif 19px): "31 tags haven't been used in a year". While looking ahead: "By April 2027, 54 tags won't have been used in a year". Months read as "3 months", "6 months" or "a year".
  - Explainer (sans 13px, muted): "They're shaded below. Archived tags leave the index but stay on the things they're on."
  - Solid button: "Archive 31".
- **Archive:**
  - Sets `archivedAt` on every currently stale tag in one transaction.
  - Stale entries fade out (opacity, 300ms), then the columns reflow.
  - Toast: "Archived 31 tags · Undo". Undo unsets them all.
  - Archiving is allowed while looking ahead, since it acts on what's shown. That's the only write allowed in a Look ahead preview, and the toast's Undo makes it safe.
- **Archived section:** a muted serif italic 16px line at the end of the panel, above a hairline: "Archived 31 tags. Bring them back · Show". "Bring them back" unsets all. "Show" expands a run-in list of the archived names; each one, when clicked, unarchives that tag alone.
- `colorSlot` is freed on archive and reassigned (5.3).

### 6.8 Filter row: kinds, source, sort

A wrapping flex row with 6px gaps:
- **Kind pills** on the left.
- **Source select** and **Sort select** pushed right (`margin-left: auto` on the source select). On narrow screens they wrap under the pills.

**Kind pills:**
- Everything, Links, Quotes, Pictures, Notes. Kinds with no items are hidden, and the row is hidden if only one kind exists, as today.
- Each pill is 38px tall: label in sans 13px 500, then the count in mono 10px at 75% opacity.
- Counts respect search and tag filters, but not the kind filter itself.
- **Pressed:** `--solid-bg` fill and border, `--solid-text`, `aria-pressed="true"`.
- **Unpressed:** transparent, 1px `--border-strong`.
- Exactly one is pressed; Everything means `kindFilter = null`.

**Source select:** "All sources", then platforms by count (as `usePlatformCounts`), "Other websites", and, when any exist, "Links that may be dead (N)". Picking the dead option sets `deadOnly` and clears `platformFilter`, and vice versa. Styled as a 38px pill: `--surface` fill, `--border-strong`, 12px left padding, 30px right padding for the native arrow.

**Sort select:** Newest first, Oldest first, Recently opened, Never opened. The behaviour is the same as today.

**Result count and clear filters:** when any filter or search is active, a muted mono 11px line shows above the grid, "18 items · clear filters" (today's `countNoun`). "clear filters" also clears `refreshedIds` and the tag selection.

### 6.9 Grid (masonry) and pagination

- **Columns:** `n = max(1, floor((width + 28) / (230 + 28)))`, capped at 4.
- **Distribution:** items go to the shortest column, in sort order, using an estimated height (media aspect ratio × column width, plus text lines estimated from title length). This keeps the newest items across the top row, which CSS `columns` doesn't. Recompute on resize (debounced 100ms) and when the list changes.
- **DOM:** each column is a `<div role="list">` of `<article role="listitem">` cards. Keyboard order goes down each column in turn; that's acceptable, and the skip link in section 9 covers the long-page case.
- **Pagination:** keep `PAGE_SIZE = 120`. The "Show more · 240 left" ghost pill is centred under the grid. New items append to the shortest columns; nothing already on screen moves. Focus moves to the first new card.
- **Order of precedence:** `refreshedIds` first (6.4), then items in the chosen sort.

### 6.10 Cards

**Shared anatomy:** an `<article>` with no border or background of its own. The content is followed by a meta row. Each card's main element is its link or button, as today in `CardLink`: links, pictures and quotes open their page; notes open the edit dialog.

**States for every card:**

| State | Look |
|---|---|
| Default | As drawn |
| Hover / focus-within | Media lifts 4px (`translateY(-4px)`, 220ms `--ease-out`). Halo opacity rises from `--halo-strength` to 2.2×. Title underlined (1px, offset 4px). The meta row's **Edit** button fades in (opacity 0 → 1, 150ms). |
| Focus-visible on the main link | As hover, plus the focus ring around the whole card |
| Active (pressed) | Lift returns to 2px |
| Aged | Patina (section 7) |
| Just dusted / refreshed | Shine (section 8), then fresh |
| New (saved this session) | Arrive animation (section 8) |
| Dead link | See below |
| Touch devices (`hover: none`) | Edit always visible at 70% opacity; no lift |

**Meta row** (mono 11px, muted, 30px min height):
- `[age text]` takes the remaining width, with ellipsis.
- `[Dust off]` shows when it applies (6.4).
- `[Edit]` is a text button, sans 12px underlined, revealed on hover/focus. It opens `EditDialog`.

The age text follows these rules, in order:

| Condition | Text |
|---|---|
| Dead link | "stopped answering Oct 9" (from `lastCheckedAt`), in `--danger` |
| Dusted this session | "dusted off just now" |
| Brought back by Refresh my memory | "back from 14 months" |
| Untouched < 7 days | "opened this week" (notes: "written this week") |
| Untouched < 1 month | "opened this month" (notes: "written this month") |
| Never opened | "never opened, 14 mo." |
| Otherwise | "untouched 14 mo." |

The age text is prefixed by the source:
- links: hostname, e.g. "fieldnotes.substack.com · untouched 9 mo."
- pictures: "picture from slowtravel.blog · …"
- quotes: "quote · …"
- notes: "your note · …"

**"filed under" line** (cards with tags), below the title, or below the quote or note text:
- "filed under WORK and READING". At most two tags, then "and 3 more" as a text button that expands the full list in place. Nested tags show only the leaf ("weeknight").
- Each tag is a button that toggles it as a filter (today's `onTagClick`), with `aria-label` "Filter by work".
- Long tag names wrap normally; nothing is cut off.
- Hidden for untagged items.

**Link card:**
- **Media:** the preview at its natural aspect ratio, clamped between 4:5 and 2:1 (`object-fit: cover`, top-aligned for screenshots). `--radius-media`. Inset 1px `--border` ring.
- **Halo:** the image's dominant colour, or the `themeColor`/fallback colour, blurred 24px behind the media, inset 12% 6% -8%.
- **Platform chip:** top-left, 10px in. Fill `rgba(255,255,255,0.92)`, text `#15171A`, mono 11px, 4px radius, padding 3px 7px.
- **No preview** (existing fallback): the site colour fills the media at 1.91:1. The site name sits bottom-left in mono 11px at 80% opacity, with the title over it in serif 19px 500. Text is white or `#15171A`, whichever has more contrast on the colour.
- **Video platforms** (YouTube, Vimeo): a 44px circle play badge centred, `rgba(255,253,248,0.92)` fill, 15px dark triangle.
- **Title:** card title style.

**Picture card:**
- Media only: the picture at its aspect ratio (no clamp), `--radius-media`, halo, and `alt` = title.
- Title isn't repeated, because the meta line names the source.
- Download failed: `--hover` fill at 4:3 with mono 11px muted "Picture couldn't be downloaded", centred.

**Quote card:**
- No box.
- A large opening quote mark (serif 70px, `--accent`) hangs at top-left, -10px / -4px, `aria-hidden`.
- The quote text has 30px top padding.
- Below: the source page title in serif italic 15px muted, linking to the page.
- Quotes take the age ink (section 7) instead of a paper tint.

**Note card:**
- A box with `--note-paper` fill, `--radius-note`, 1px `--border` ring, padding 18px 18px 16px.
- Top line: mono 11px muted "your note · Oct 22".
- Body: note body style.
- Clicking opens edit. Ctrl/Cmd+Enter in the edit dialog saves, as today.

**Dead link card:**
- Media at `grayscale(1) opacity(0.65)`.
- Stamp: "MAY BE DEAD", top-right, 14px / 12px in, rotated 4°. Mono 10px 500 with 0.08em tracking, `--danger` text and 1.5px `--danger` border, 4px radius, `--surface` fill. `title` keeps today's explanation.
- No patina and no Dust off.
- Clicking still opens the page.

### 6.11 Feedback states

| Situation | Look and copy |
|---|---|
| Library empty | Today's empty state, restyled: serif 28px "Nothing saved yet". Explainer in sans 14px muted (today's copy). Solid button "Import your Edge favorites". Centred, max 480px, 15vh from top. Look ahead, tag strip and filter row are hidden. |
| No results | Serif italic 26px muted: "Nothing you kept matches that, yet." followed by a "clear filters" text button. |
| Loading (first `useLiveQuery` result pending) | Nothing for 200ms. After that, the header and hero render immediately, and the grid shows 8 placeholder blocks in `--hover` with the media aspect cycling 16:9, 4:5, 1:1, 3:2, no shimmer. |
| Toasts | Today's `ToastView`, restyled: `--solid-bg` fill, `--solid-text`, `--radius-pill`, sans 13px, padding 10px 18px, bottom centre. The action is a 500-weight underlined button. 5s timeout; pauses on hover or focus. |
| Errors (restore fails, save fails) | Toast with the error message, as today. |

---

## 7. Ageing (patina)

Every visual comes from one number, `t = patina(b, now)` (5.2), set as CSS custom properties on the card (`style={{ '--t': t }}`), so a Look ahead step is one re-render and the CSS transitions do the rest.

| Part | At t = 0 → t = 1 | Implementation |
|---|---|---|
| Media (link and picture) | Natural → sepia, desaturated, softer | `filter: sepia(calc(var(--t) * .78)) saturate(calc(1 - var(--t) * .55)) contrast(calc(1 - var(--t) * .14))`, `transition: filter 600ms ease-out` |
| Dust | None → visible specks and a warm vignette | `::after` overlay, `opacity: calc(var(--t) * .95)`. Two radial-gradient speck layers (23×19px and 17×29px tiles, 0.8px and 0.7px dots in `rgba(92,70,36,.42/.34)`) plus `radial-gradient(ellipse at 50% 45%, transparent 52%, rgba(130,96,40,.3))`. Exact values are in the reference file (`.dust`). |
| Note paper | `--note-paper` → `--aged-paper` | `color-mix(in srgb, var(--aged-paper) calc(var(--t) * 100%), var(--note-paper))` |
| Text in quotes and notes | `--text` → `--aged-text` | `color-mix()` the same way. The quote mark's opacity goes from 1 to 0.4. |
| Tilt | 0° → ±1.4° | `rotate(calc(var(--t) * 1.4deg * var(--side)))`, where `--side` is 1 or -1 alternating by index in its column, transition 600ms |
| Faded threshold | t ≥ 0.5 | Shows Dust off; counted in "N things have gone yellow" |

Contrast holds at full age (4.74:1 light, 6.29:1 dark), so aged text stays readable. Ageing is never the only signal: the age text always says it in words.

---

## 8. Motion

| Element | Trigger | Animation | Duration | Easing |
|---|---|---|---|---|
| Card media | Hover / focus-within | `translateY(-4px)` | 220ms | `--ease-out` |
| Card halo | Hover / focus-within | opacity × 2.2 | 260ms | ease-out |
| Patina (filter, colour, tilt, dust) | Look ahead step, dust off, open | Transition to new `--t` | 600ms | ease-out |
| Shine | Dust off, Refresh my memory | Keyframes: 0% opacity .4, scale .97 → 60% opacity 1, scale 1.015 → 100% none | 900ms | ease-out |
| Arrive (new note) | Saved via Jot a note | From opacity 0, `translateY(-10px) rotate(-1.5deg)` to rest | 650ms | `cubic-bezier(.2,.8,.2,1.1)` |
| Look ahead ticks | Month change | height | 300ms | `--ease-spring` |
| Index entry colour | Look ahead step, tidy change | color, background-color | 500ms | ease-out |
| Index archive | Archive | Stale entries opacity → 0, then reflow (no reflow animation) | 300ms | ease-out |
| Index open/close | Toggle | None. It appears and disappears; the content below moves at once | n/a | n/a |
| Edit button | Hover / focus-within | opacity 0 → 1 | 150ms | ease-out |
| Appearance | Toggle | background-color and color cross-fade | 380ms | ease-out |

Only `transform`, `opacity`, `filter` and colours are animated; never width, height or position. The tick height is the one exception, kept because it's tiny and isolated. Under `prefers-reduced-motion: reduce`: no animations or transitions, and smooth scroll becomes instant.

---

## 9. Keyboard and screen readers

**Tab order:**
1. Skip link "Skip to your library" (visually hidden until focused) → first card.
2. Header: More, appearance, Add from a post.
3. Search, Jot a note, Keep.
4. Look ahead: ‹, ›, its button.
5. Tag strip: Most used tags, then Open the index.
6. Filed-under buttons, then clear.
7. Index panel, when open: search, tidy segments, Archive, letters, entries.
8. Kind pills, source select, sort select.
9. Cards: each card's main link, then its tag buttons, Dust off and Edit.
10. Show more.

| Key | Where | Action |
|---|---|---|
| `/` | Anywhere, unless typing in a field | Focus search |
| `Esc` | Search with text | Clear it |
| `Esc` | Index panel | Clear the tag search if it has text; otherwise close the panel and focus the strip button |
| `Esc` | More menu | Close and focus More |
| `←` / `→`, `Home` | Inside Look ahead | Step month / back to today |
| `Enter` | Jot a note | Save note |
| `Shift+Enter` | Jot a note | Open the full note dialog with the text |
| Shift/Ctrl/Cmd + click or + Enter | Index entry | Pick and keep the index open |

**ARIA:**

| Element | Treatment |
|---|---|
| Look ahead panel | `role="group"`, `aria-label="Look ahead"`; month text `aria-live="polite"` |
| Index panel | `<section aria-label="Tag index">`; each group `<section aria-labelledby>` its letter heading (`<h3>`) |
| Filter toggles (tag strip, entries, run-ins, kind pills) | `aria-pressed` |
| Letter bar | `<nav aria-label="Jump to a letter">` |
| Decorative parts (leaders, squares, dust, halo, quote marks, ticks) | `aria-hidden="true"` |
| Card media | Pictures `alt` = title; link previews `alt=""`, because the title follows |
| Result count | A visually hidden `aria-live="polite"` region that announces "18 items" after filtering, debounced 500ms |

---

## 10. Responsive behaviour

| Width | Changes |
|---|---|
| ≥ 1100px | As drawn: 4 columns, hero side by side, index in 3 columns |
| 860–1099px | 3 columns. Hero side by side if it fits, else Look ahead wraps below at full width |
| 720–859px | 2–3 columns. Look ahead full width under the hero. Index 2 columns. Tidy controls wrap under the tag search |
| < 720px | 1–2 columns (230px minimum). Search and Jot a note stack. Header wraps; "Add from a post" shortens to "Add from post". Tag strip: "Most used" label hidden, tags scroll horizontally in one line, index button stays at the end. Index 1 column, letter bar scrolls horizontally. Filter row: pills scroll horizontally; selects drop to their own line |
| Touch | Edit always visible; no hover lift; every target 44px |

---

## 11. Edge cases

| Case | Handling |
|---|---|
| Thousands of items | Pagination stays at 120; masonry only lays out what's shown. Compute patina and counts in `useMemo` keyed on `[bookmarks, lookAheadMonths]` |
| Hundreds of tags | Single-use tags fold into run-ins; tidy-up archives stale ones; "Find a tag" filters. Build the index in a pure function (`buildTagIndex` in `src/lib/tags.ts`) memoised on `[tagCounts, tagMeta, query, now, threshold]` |
| Very long tag names | Wrap with a hanging indent in the index and filed-under line. Never truncated, so they can always be read in full |
| Tag that's both a parent and used alone | Entry with its own count plus sub-entries (5.4) |
| Child tag whose parent isn't used alone | Parent shown as an entry with the children's count; selecting it filters all children |
| Tag starting with a digit or symbol | Grouped under "#", sorted before A |
| Non-Latin first letter | Grouped by its first character (uppercased with `toLocaleUpperCase`); the letter bar shows A–Z, then extra groups at the end |
| Untagged items | An italic "untagged" entry at the end of the index (after Z), with a count. It maps to today's `UNTAGGED` filter. Not in the Most used line |
| No faded items | Status "Nothing has gone yellow yet"; Refresh my memory falls back to `pickForgotten` over all items |
| Library under 4 items | Look ahead works; Refresh my memory is disabled with the title "Nothing to bring back yet" |
| Item opened in another tab while the library is open | `useLiveQuery` updates it; the patina animates back to fresh |
| Look ahead at 24 months | Everything older than 0 days is fully aged; › disabled |
| Archived tag still on a card | Shown in the card's filed-under line in `--text-muted` with no colour; clicking it filters as normal |
| Dark mode | All tokens have dark values; dust specks stay brown, which reads as age on dark too |
| Item with `lastOpenedAt` before `createdAt` (imported favourites) | `lastTouched` takes the max, so it's never in the future |
| Clock moves back | `monthsUntouched` floors at 0 |

---

## 12. Build plan

Work in this order; each phase leaves the library working. Run `npm test` and `npm run typecheck` at the end of each.

**Phase 1: tokens, fonts, shell**
- `src/styles/base.css`: new tokens (section 4), `data-appearance` handling, font-faces.
- `public/fonts/`: Newsreader, Geist and Geist Mono woff2 files.
- `src/library/Library.tsx`: remove the sidebar. Add the header (More menu, appearance toggle), the hero (summary, headline, search, Jot a note) and the filter row (pills, source select, sort select). Keep all existing state.
- `src/library/library.css`: rewrite for the new layout.
- New `src/library/MoreMenu.tsx`, `src/library/AppearanceToggle.tsx`, `src/library/JotNote.tsx`.

**Phase 2: cards and masonry**
- `src/library/BookmarkCard.tsx`: new card anatomy per kind, meta row, filed-under line, Edit reveal, dead state.
- New `src/library/Masonry.tsx` (shortest-column distribution, resize handling).

**Phase 3: ageing and Look ahead**
- `src/lib/db.ts`: `dustedAt` on `Bookmark`.
- New `src/lib/age.ts` and `src/lib/age.test.ts`: `lastTouched`, `monthsUntouched`, `patina`, `addMonths`.
- `src/lib/bookmarks.ts`: `dustOff(ids)` and `undoDustOff(snapshot)`.
- New `src/library/LookAhead.tsx`.
- `Library.tsx`: `lookAheadMonths` state, `refreshedIds`, Refresh my memory rewired to 6.4.
- CSS patina variables (section 7).

**Phase 4: tag index**
- `src/lib/db.ts`: version 3 with `tagMeta`.
- New `src/lib/tags.ts` and `src/lib/tags.test.ts`: `hasTag`, `buildTagIndex`, `tagLastUsed`, `assignColorSlots`, `staleTags`, `archiveTags`, `unarchiveTags`.
- `src/lib/bookmarks.ts`: `cleanTags` slash normalisation; write `lastUsedAt` when tags are added.
- `src/lib/backup.ts`: version 2 (5.5).
- `src/components/TagInput.tsx`: leave archived tags out of suggestions.
- New `src/library/TagStrip.tsx` and `src/library/TagIndex.tsx`.

**Phase 5: polish**
- Keyboard map (section 9), the live region, reduced motion, the responsive table (section 10), the loading state.

**Tests to add:**
- `age.test.ts`: `lastTouched` per kind; notes use `updatedAt`; dead links give 0; clamping at 0 and 1; `addMonths` across a year boundary.
- `tags.test.ts`:
  - `hasTag` matches children but not prefixes (`recipe` must not match `recipes`).
  - Parent counts are distinct across children.
  - Run-in vs entry split.
  - Search keeps the parent when a child matches.
  - Staleness respects the threshold, selection and Look ahead.
  - Colour slots are stable when counts change and are freed on archive.
- `bookmarks.test.ts`: `cleanTags` slash cases; `dustOff` doesn't change `openCount`.
- `backup` round trip with `tagMeta`; version 1 files still restore.

---

## 13. Acceptance checklist

- [ ] Every action from today's header and sidebar is reachable (More menu, filter row, tag strip).
- [ ] Light, dark and system appearance all work; the choice persists.
- [ ] Look ahead steps 0–24 by button and arrow keys; cards and tags visibly age; nothing is written to the database.
- [ ] "Back to today" and Home return to month 0. Dust off is hidden while looking ahead.
- [ ] Dust off and Refresh my memory write `dustedAt`, animate, show a toast with a working Undo, and leave `openCount` unchanged.
- [ ] The tag index starts closed. Picking closes it, Shift-click keeps it open, and Esc closes it and returns focus.
- [ ] Tall italic letters head each group. Sub-entries are indented with dashes, single-use tags run in, and long names wrap without truncation.
- [ ] Filtering by a parent tag includes its children.
- [ ] Tidy-up shades stale tags, archives with Undo, and archived tags can be brought back one by one or all at once.
- [ ] Tag colours stay put when counts change.
- [ ] Masonry keeps the newest items across the first row; Show more appends without moving existing cards.
- [ ] Every text/background pair meets 4.5:1, including fully aged; every target is at least 44px or spaced as in 4.4.
- [ ] Reduced motion removes all animation.
- [ ] At 390px wide nothing scrolls sideways except the deliberately scrollable rows.
- [ ] Backups include `tagMeta` and old backups still restore.

---

## 14. Decisions made in this spec, and open questions

These weren't fully settled in the design, so the spec makes a call. The person who designed this should confirm or change them before or during Phase 2.

1. **Refresh my memory** now dusts off three forgotten things and brings them to the front of the grid. This replaces today's separate "From a while ago" row, which F showed as a strip. Alternative: keep the strip and have Refresh my memory fill it.
2. **Dust off is hidden while looking ahead**, so the preview stays read-only. Archive is the one exception, because it acts on what the preview shows and has Undo.
3. **Cards show "filed under …" instead of the coloured dots** in the meta line. The dots couldn't be clicked or read by name, and the sentence matches the index style ("Tags 4 at scale" on the canvas).
4. **F's "By tag" piles view isn't included.** The tag index replaces it. Say so if you want it as a third view.
5. **The index's "Press Enter to make it a new tag"** from the mock is dropped. A tag with no items has nothing to show in the library, so tags are still created where things are tagged (side panel, edit dialog, Jot a note's full dialog).
6. **Parent counts include their children's items.** This makes "recipes 12" mean "12 things about recipes".
7. **Masonry keeps the newest items across the top row** (JS distribution) instead of CSS columns, at the cost of keyboard order going down columns.
8. **Fonts are self-hosted.** Check the licences: Newsreader is OFL, Geist and Geist Mono are OFL.
9. **The theme switcher** (Contact sheet, Colour field, Covers) is out of scope here. Build tokens as CSS custom properties on `:root` so a later `data-theme` attribute can swap them.
10. **The side panel's tag picker** ("K6 · Side panel picker" on the canvas) is a separate piece of work; `TagInput` only gains the archived-tags filter in this phase.
