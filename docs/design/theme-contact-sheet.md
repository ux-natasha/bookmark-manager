# Theme: Contact sheet

A theme layer on top of `docs/design/library-interactions.md` (the Default theme spec). **Build the Default theme first.** This document only lists what the Contact sheet theme changes; everything not mentioned here behaves exactly as the Default spec says.

- **Idea in one line:** the library is a photographer's contact sheet. Every saved thing is a frame on a hairline grid with a catalogue code. Things you don't open **bleach like a print left in the sun**, new things **develop in**, and bringing something back is a **reprint**, circled in grease pencil.
- **Design source:** canvas page "L · Contact sheet, expanded" (Exposure chart, Components, States) and the "Contact sheet" artboard on page "H · Themes". Source copies are in `docs/design/reference/contact-*.dc.html`. They're prototypes: read them for values, don't copy the code.
- **How the theme is applied:** `data-theme="contact"` on `<html>`, next to `data-appearance` (light or dark). Most of the theme is CSS custom properties. A few components render a different structure, chosen from a `theme` value in React context (section 4).

---

## 1. What changes, at a glance

| Area | Default | Contact sheet |
|---|---|---|
| Layout of items | Masonry columns of floating cards | One hairline grid; each item is a cell ("frame") |
| Item identity | Kind shown by card style | Catalogue code in the cell corner: `LNK·014`, `QTE·003` |
| Ageing | Yellowing paper, dust, tilt | Sun-bleaching: colour drains, contrast drops, image lifts to white from the top right, paper warms |
| Bringing back | "Dust off", shine | "Reprint", the frame is circled in grease pencil and develops back in |
| New items | Drop in | Develop: from blank to full image in 1.4s |
| Look ahead | Month name, ticks | A strip of film, one frame per month |
| Tag index | Letter groups in columns | Each letter is a cell on a hairline grid |
| Selection | Highlighter band | Grease-pencil circle |
| Controls | Rounded pills, sans | Square corners, mono uppercase |
| Display type | Newsreader | Cormorant Garamond |

---

## 2. Tokens

Overrides under `:root[data-theme="contact"]` (and `[data-appearance="dark"]` within it). Token names are the Default spec's, so components don't change.

### 2.1 Colour

| Token | Light | Dark ("darkroom") | Notes |
|---|---|---|---|
| `--bg` | `#F2F4F3` | `#101617` | Cool photo-paper grey |
| `--surface` | `#F7F8F8` | `#151C1D` | Panels, a reprinted cell |
| `--text` | `#1E2A2E` | `#DCE5E3` | 13.33:1 / 14.24:1 |
| `--text-muted` | `#566468` | `#97A6A5` | 5.56:1 / 7.23:1; still 4.86:1 on fully bleached paper |
| `--border` | `rgba(30,42,46,0.20)` | `rgba(220,229,227,0.18)` | The sheet's hairlines |
| `--border-strong` | `rgba(30,42,46,0.32)` | `rgba(220,229,227,0.32)` | Inputs, segmented controls |
| `--hover` | `#E9EDEC` | `#172021` | Cell hover fill |
| `--accent` | `#A13A22` | `#F09A82` | Red is the only colour left on a faded frame: "Faded" and "No answer" labels |
| `--solid-bg` / `--solid-text` | `#1E2A2E` / `#F2F4F3` | `#DCE5E3` / `#101617` | Primary buttons, pressed segments, toasts |
| `--danger` | `#A13A22` | `#F09A82` | Same as accent in this theme |
| `--aged-paper` | `#ECE2CC` | `#221E16` | Cell fill when fully bleached |
| `--aged-text` | `#665840` | `#AC9F86` | 5.47:1 / 6.45:1 on aged paper |
| `--pencil` | `#E2574A` | `#F09A82` | Grease pencil marks. Non-text indicator, 3.34:1 / 8.4:1 |
| `--tidy-bar` | `#ECE2CC` | `#221E16` | With a 1px border in `rgba(102,88,64,0.35)`; bar text `#4F4430` (7.41:1) |
| `--film` | `#1E2A2E` | `#05090A` | Look ahead film strip |

The eight tag colours aren't used in this theme. Tags are ink only; selection is shown with grease pencil instead of colour.

### 2.2 Type

| Token | Value |
|---|---|
| `--font-serif` | Cormorant Garamond (400, 400 italic, 500, 500 italic), fallback Georgia, serif. Self-host the woff2 (OFL) next to the Default fonts |
| `--font-sans` | Geist (only for long running text, such as the empty-state explainer) |
| `--font-mono` | Geist Mono. **The UI voice of this theme**: buttons, labels, codes, counts, notes |

Cormorant sets small for its size, so every size below is larger than its Default equivalent.

| Role | Spec |
|---|---|
| Wordmark | serif 30px 500, centred in the header |
| Headline | serif 500, `clamp(56px, 6.4vw, 84px)`, line-height 0.9: "Everything you kept," then on a new line, italic, "on one sheet." |
| Cell title | serif 31px 500, line-height 1 |
| Quote | serif `clamp(36px, 3.8vw, 52px)`, line-height 1, `text-wrap: balance`, wrapped in curly quotes |
| Note text | mono 15px, line-height 1.55 |
| Cell code and corner label | mono 10px, uppercase, letter-spacing 0.08em |
| Cell meta | mono 10.5px |
| Buttons and controls | mono 11px, uppercase, letter-spacing 0.08em |
| Index letter | serif italic 84px 400, line-height 0.8 |
| Index entry | serif 20px 500 |
| Look ahead month | serif 54px 500, year italic muted |

### 2.3 Shape

| Token | Value |
|---|---|
| `--radius-*` (all) | `0`. Nothing in this theme is rounded except the grease-pencil marks |
| `--control-h` | 44px, unchanged |
| Cell padding | 18px 18px 12px |
| Sheet gap | 1px (the hairline, drawn by the grid's background showing through) |

---

## 3. Copy changes

Only the words change; the actions behind them are the Default spec's.

| Default | Contact sheet |
|---|---|
| Dust off | Reprint |
| Refresh my memory | Reprint the three most faded |
| "5 things have gone yellow" | "5 of 18 frames have faded"; looking ahead: "By then 9 of 18 frames will have faded" |
| Card corner: (none) | Faded, or Fresh: see 4.4 |
| "MAY BE DEAD" stamp | Code struck through, corner "No answer ×2" |
| "dusted off just now" | "reprinted just now"; "back from 14 mo." after Reprint the three most faded |
| "Showing things filed under WORK and READING" | "SHOWING FRAMES FILED UNDER [WORK ×] [READING ×] CLEAR" |
| Toast "Dusted off · Undo" | "REPRINTED 3 FRAMES · UNDO" (toasts are mono uppercase) |
| Empty: "Nothing saved yet" | "Nothing exposed yet" |
| No results: "Nothing you kept matches that, yet." | "No frame on the sheet matches that, yet." with the active filters above it in mono ("0 FRAMES · LNK · FILED UNDER WEDDING · “LISBON”") |
| Tidy bar: "They're shaded below." | "Their frames are bleached below." |

---

## 4. Structural changes

These components render differently when `theme === 'contact'`. Keep one component per concept with a variant prop where it stays readable; split into separate components where noted.

### 4.1 Header

A 3-column grid (`1fr auto 1fr`), 66px tall, with a bottom hairline:
- **Left:** the summary in mono 11px muted ("18 KEPT · 2 FETCHING"). The fetching count replaces the Default progress line.
- **Middle:** the wordmark.
- **Right:** More, appearance, Add from a post, as square buttons.

Below 720px it becomes a wrapping row with the wordmark first.

### 4.2 Hero

- The headline as in 2.2.
- At the right, a mono list, one row per kind ("LNK · 8 links", "QTE · 3 quotes", …), 11px, letter-spacing 0.08em. It replaces the Default summary line.
- Search and Jot a note keep their behaviour: square corners, 1px `--border-strong`, `--surface` fill. Jot a note uses mono 15px input text (notes are typed, not handwritten, in this theme).
- Look ahead (4.5) sits under the hero at full width, not beside it.

### 4.3 Kind bar (replaces the kind pills)

A row of mono uppercase segments using codes: `ALL 18 · LNK 8 · QTE 3 · PIC 4 · NTE 3`.
- Each segment is 44px tall, 14px horizontal padding, `--text-muted`, with a 2px transparent bottom border.
- **Pressed:** `--text` with a 2px `--text` bottom border.
- `LNK` covers all link sub-kinds (VID, PST and REP are link codes; see 4.4).
- **Source and Sort** are text-style selects on the right: "SOURCE · ALL ▾", "SORT · NEWEST ▾". They're native `<select>` elements styled as mono text with no border, 44px tall.

### 4.4 The sheet (replaces Masonry)

Split into its own component, `Sheet.tsx`.

**Grid:**
- `display: grid; grid-template-columns: repeat(auto-fill, minmax(min(270px, 100%), 1fr)); grid-auto-rows: minmax(300px, auto); grid-auto-flow: dense; gap: 1px;`
- Grid background `--border`, plus a 1px `--border` outline.
- Quotes span two columns (`grid-column: span 2`, dropped below 640px).
- **DOM order is row by row**, which fixes the Default masonry's column-by-column tab order. With `dense`, a few cells may fill earlier gaps. Keep the result count announcement as in the Default spec.

**Crosshair:** every cell has a 13px "+" (1px strokes, `--text-muted`) at its top-left corner, offset -7px/-7px so it sits on the hairline intersection. `z-index: 2`, `aria-hidden`.

**Cell anatomy, top to bottom:**
1. **Top row** (mono 10px uppercase, space-between):
   - **Code** on the left in `--text`. The code is `KIND·NNN`. NNN is the item's number in the order things were saved (oldest = 001). It's computed, not stored, and zero-padded to three digits; it grows past 999 without padding. The kind is LNK for links, then by platform: VID for video platforms, PST for social posts (X, Bluesky, Threads, Mastodon, LinkedIn, Reddit), REP for GitHub/GitLab repositories. QTE for quotes, PIC for pictures, NTE for notes.
   - **Corner label** on the right, in `--text-muted` unless stated:

     | Condition | Label |
     |---|---|
     | Dead link | "No answer ×2", or "Gone" for 404/410, in `--accent` |
     | Reprinted this session | "Reprinted", in `--accent` |
     | Patina ≥ 0.5 | "Faded · 14 mo.", in `--accent` |
     | Video | platform and duration, if known |
     | Other link | platform or site name |
     | Quote | hostname |
     | Picture | aspect ratio ("4 : 5") |
     | Note | "Today", "Oct 22", … |

2. **Body by kind:**
   - **Link:** media at its aspect ratio (clamped 4:5 to 2:1, as Default), no radius. No halo; this theme has no glow. For video, a 22px white play triangle at top-left 12px and a 3px progress line along the bottom edge if a watched position is known (otherwise omitted).
   - **Picture:** a decorative row of frame numbers above the image (mono 9.5px muted, `aria-hidden`): `NNN`, `▸ NNNA`, `NNN+1`, from the code number. Then the image at its aspect ratio.
   - **Quote:** the quote, centred vertically in the cell (it spans two columns).
   - **Note:** mono 15px text, filling the cell. A note saved in the last 60 seconds shows a blinking block caret after its last character (8px wide, 1.1s `steps(1)` blink), then the caret goes away.
3. **Title** (links only), cell title style. Pictures, quotes and notes have none.
4. **Meta row**, mono 10.5px, 30px minimum height:
   - Tags on the left as "FILED · WORK / READING" (max two, then "+3"). Each tag is a text button that toggles its filter.
   - The age text on the right (Default rules, with the copy changes in section 3).
   - **Reprint** (6.4) and **Edit** sit after the age, as in Default.

**Crop marks:** four 12px L-shaped corners (1px `--text`), placed 7px outside the media's corners.
- Hidden at rest (`opacity: 0`, nudged 5px inwards).
- On cell hover or focus-within they slide out to the corners and appear (200ms ease-out, opacity and transform).
- Pictures, links and videos only.

### 4.5 Look ahead as a film strip

Split into its own component, `LookAheadFilm.tsx`. The behaviour, keyboard and limits are the Default spec's 6.3.

- **Panel:** `--surface`, 1px `--border`, square, padding 22px 24px 18px. Full width under the hero.
- **Top row** (space-between, wrapping):
  - Left: the lead (serif italic 19px muted), then the month (2.2).
  - Right: ‹ and › as 44px square bordered buttons.
- **Film strip:** a `--film` band, padding 14px 12px 8px.
  - **Sprocket holes:** a 6px-tall row of light rectangles along the top and bottom edges (`repeating-linear-gradient(90deg, transparent 0 8px, var(--bg) 8px 14px, transparent 14px 20px)`), `aria-hidden`.
  - **Frames:** 25 buttons (months 0–24), 34×30px, spread evenly. Each frame's fill is a preview of bleaching at that month: a mix from `#3E6CA8` to `#D8CDB4` by month/24, with the sun overlay from 5.2 at opacity month/24 × 0.8. Clicking a frame jumps to that month. `aria-label` is the month and year ("April 2027"); `aria-pressed` on the current frame.
  - **Under each frame:** mono 8.5px at 60% opacity: "NOW" for 0, then the month count. At each January the two-digit year and "▸" ("27▸") mark the new year. The current frame's label is at full opacity.
  - **The current frame is circled in grease pencil** (section 4.7), drawn 9px outside the frame.
- **Footer row:** status (mono 11px uppercase muted, section 3) and either "Reprint the three most faded" (month 0) or "Back to today".

### 4.6 Tag strip and filed-under

- **Tag strip:** "Most used" (serif italic 22px), then the six tags in serif 21px 500 with a mono 9.5px superscript count, separated by 1px × 18px vertical hairlines. A selected tag is **circled in grease pencil** (4.7) instead of highlighted. "OPEN THE INDEX · 78" is a square bordered button.
- **Filed-under row:** under the strip, separated by a hairline. "SHOWING FRAMES FILED UNDER" (mono), then each tag as a square bordered chip: serif 19px small caps with a 9px ×. The chip removes the tag; `aria-label` is "Remove filter: work". "CLEAR" is a mono underlined text button.

### 4.7 Grease pencil

A small component, `GreasePencil.tsx`, that draws a hand-drawn loop around its parent.

- An absolutely positioned SVG with `preserveAspectRatio="none"`, `pointer-events: none`, `aria-hidden`.
- Stroke `--pencil`, 2.2px (1.4px with `vector-effect: non-scaling-stroke` for whole cells), round caps.
- The loop is an open ellipse whose end overshoots its start, as if drawn in one stroke:
  - words: `M14 8 C 34 1, 80 2, 93 12 C 101 22, 88 35, 54 37 C 22 39, 2 31, 4 20 C 6 11, 20 6, 36 5`, viewBox `0 0 100 40`.
  - cells: `M18 6 C 50 1, 88 3, 95 14 C 100 40, 98 76, 90 92 C 70 99, 26 98, 8 90 C 2 68, 1 30, 6 12 C 9 6, 20 4, 34 4`, viewBox `0 0 100 100`.
  - Look ahead frame: the path in the reference file.
- **Draw-on:** when it appears, animate `stroke-dashoffset` from the path length to 0 over 450ms ease-out (set `pathLength="1"` and dash 1). No animation under reduced motion.
- **Used for:** selected tags (strip, index, run-ins), the current Look ahead frame, and reprinted cells.
- It's never the only signal: selected controls keep `aria-pressed`, and reprinted cells keep the "Reprinted" label.

### 4.8 Tag index as a grid of cells

Split into its own component, `TagIndexGrid.tsx`. It uses the same `buildTagIndex` data and the same behaviour as Default 6.6 and 6.7.

- **Controls row** (outside the grid):
  - Find a tag: square, 1px `--border-strong`, `--surface`, serif 18px input.
  - Hint in mono 10.5px: "PICKING CLOSES THE INDEX · SHIFT-CLICK FOR SEVERAL".
  - "Tidy up tags not used in" (serif italic 19px), then a square segmented control: OFF · 3 MO · 6 MO · A YEAR. Segments are separated by 1px lines; the pressed one uses the solid colours.
- **Tidy bar:** square, `--tidy-bar` fill and border. Mono 11px uppercase count ("31 TAGS UNUSED FOR A YEAR", or "BY APRIL 2027, 54 TAGS WILL BE UNUSED FOR A YEAR"), the explainer in serif italic 17px, and a solid "ARCHIVE 31" button.
- **Grid:** the same hairline technique as the sheet, `repeat(auto-fill, minmax(270px, 1fr))`. Each letter is a cell (padding 14px 18px 16px) with a crosshair at its top-left.
  - **Cell top:** the letter (2.2) on the left, the tag count on the right in mono 10px uppercase ("6 TAGS").
  - **Entries:** serif 20px 500 with a 1px dotted leader and mono 11px count. Sub-entries are 17px, indented 24px, with an em-dash prefix. The "ONCE ·" run-in is serif 17px muted.
  - **Bleaching by disuse:** entry text goes from `--text` to `--aged-text` as in Default.
  - **Cell tint:** a cell's background tints toward `--aged-paper` in proportion to how many of its tags are stale (`mix(--bg, --aged-paper, staleShare × 0.8)`), so a letter full of unused tags reads as a faded frame. There's no per-entry shading.
  - **Selected entries** are circled in grease pencil.
- The tall letter on every cell is required. It's the shared signature with the Default index.

### 4.9 Buttons, menu, toast

- **Buttons:** square, 44px, mono 11px uppercase.
  - Bordered: 1px `--text`, hover `--hover`.
  - Solid: `--solid-bg`.
  - Disabled: 35% opacity.
  - Text buttons are mono underlined.
- **More menu:** a square panel (`--surface`, 1px `--border`) with a mono "MORE" header. Items are serif 19px, 44px tall, with a hairline between each.
- **Toast:** a `--solid-bg` bar 48px tall, square, mono 11px uppercase, with the action at the right as an underlined mono button. Bottom centre, as Default.

---

## 5. Ageing: sun-bleaching

Same input as Default: `t = patina(b, now)` (Default 5.2), 0 = fresh, 1 = 24 months untouched, faded at t ≥ 0.5. Only the visual mapping changes. Set `--t` on the cell, as in Default.

| Part | Mapping | Implementation |
|---|---|---|
| Image (link, video, picture media) | Colour drains first, then contrast, then it lifts toward white | `filter: grayscale(calc(var(--t)*.85)) sepia(calc(var(--t)*.35)) contrast(calc(1 - var(--t)*.3)) brightness(calc(1 + var(--t)*.12))` |
| Sun | Light falls from the top right, so that corner goes first | `::after` on the media: `linear-gradient(215deg, rgba(255,251,240,.95) 0%, rgba(255,251,240,.4) 38%, transparent 68%)`, opacity `calc(var(--t)*.8)` (0.55 in dark mode) |
| Paper | The cell warms | `background: color-mix(in srgb, var(--aged-paper) calc(var(--t)*90%), var(--bg))` |
| Ink | Titles, quotes and notes drift to faded brown | `color: color-mix(in srgb, var(--aged-text) calc(var(--t)*100%), var(--text))`; the code takes the same colour |
| Label | At t ≥ 0.5 the corner reads "Faded · N mo." in `--accent` | The red is the only saturated thing left on a faded frame, so faded frames are easy to spot |
| Not used | No dust, no tilt, no halo | |

All of it transitions over 600ms ease-out (`--dur-age`), so a Look ahead step bleaches the whole sheet in one smooth move. Dead links don't bleach (t = 0); they use the dead state (6.1).

---

## 6. Moments and states

### 6.1 State table

| State | Look |
|---|---|
| Rest | As 4.4 |
| Hover | Cell fill `--hover`; crop marks appear; title underlined (1px, offset 5px); Edit appears in the meta row |
| Keyboard focus (focus-visible on the cell's link) | As hover, plus a 2px `--text` inset ring around the whole cell (`box-shadow: inset 0 0 0 2px`) |
| Faded (t ≥ 0.5, Look ahead at 0) | Bleached as section 5; a square bordered "REPRINT" button (30px tall, mono 10px) appears in the meta row |
| Reprinted (Reprint, or Reprint the three most faded) | Cell fill `--surface`; the whole cell is circled in grease pencil, inset 6px; corner reads "Reprinted"; the image develops back in (6.2). The circle stays for the session |
| New (saved this session) | Develops in (6.2) |
| Dead link | Code struck through; corner "No answer ×2" or "Gone" in `--accent`; media `grayscale(1)` at 60% opacity; title in `--text-muted`; meta "stopped Oct 9" in `--accent`. No bleaching, no Reprint |
| Fetching details | An unexposed frame: media area is a 1px dashed `--text-muted` box with faint 135° hatching (`rgba(30,42,46,0.08)` lines every 10px); the title shows the hostname in muted; meta "details on the way · next try in 1.5 s" (from the enrich queue). It swaps to the real cell when details arrive, by developing in |
| Picture couldn't be downloaded | The same unexposed frame, with mono "NO NEGATIVE · picture couldn't be downloaded" centred |
| Empty library | A blank sheet: an empty hairline grid (4 columns, 75px rows) behind centred text. Serif 34px "Nothing exposed yet", the mono explainer (today's copy), solid "IMPORT YOUR EDGE FAVORITES" |
| No results | The active filters in mono, then serif italic 34px "No frame on the sheet matches that, yet." and a CLEAR FILTERS text button |
| Loading the library | A sheet of grey placeholder cells (`#E2E7E6`; dark `#1A2324`) with bars where the code, media and title go. No shimmer |

### 6.2 Develop

A new or reprinted frame "develops" like a print in the tray: from blank paper to a full image.

| Part | Keyframes | Duration, easing |
|---|---|---|
| Media | 0%: `filter: contrast(0) brightness(1.9)`, opacity .6 → 35%: `contrast(.35) brightness(1.4) sepia(.4)`, opacity 1 → 100%: none | 1400ms, `cubic-bezier(.3,.6,.3,1)` |
| Title / text | opacity 0 → .2 at 45% → 1 | 1400ms, ease-out |
| Grease pencil (reprints only) | Draws on after the image is 60% developed (delay 840ms) | 450ms, ease-out |

- Notes and quotes (no media) develop their text only.
- Under reduced motion they appear finished at once.
- When several frames develop together (Reprint the three most faded), stagger them by 120ms in sheet order.

---

## 7. Motion overrides

Everything in the Default motion table applies, except:

| Element | Default | Contact sheet |
|---|---|---|
| Card lift on hover | translateY(-4px) | None. Crop marks instead (200ms) |
| Halo | Opacity ×2.2 | None |
| Shine (dust off) | 900ms keyframes | Develop (6.2) plus grease pencil |
| Arrive (new note) | Drop and rotate | Develop (6.2) |
| Look ahead ticks | Height spring | Frame fills cross-fade (300ms); grease pencil redraws on the new frame (450ms) |
| Archive in the index | Fade entries | Same, then the letter cell's tint recalculates (600ms) |

---

## 8. Accessibility notes

- **Contrast:** all text pairs in 2.1 pass 4.5:1, including muted text on fully bleached paper (4.86:1) and aged ink (5.47:1). Grease pencil is a non-text indicator at 3.34:1.
- **Codes:** visually short and cryptic, so they're `aria-hidden`. A visually hidden kind word ("Link", "Video", "Post", "Repository", "Quote", "Picture", "Note") starts the cell's accessible name.
- **Selection** is never shown by grease pencil alone: `aria-pressed`, the filed-under row and the cell label carry it too.
- **Mono uppercase controls** use CSS `text-transform`. The source text stays sentence case, so screen readers don't spell words out letter by letter.
- **Film frames** are real buttons with month names. The decorative numbers under them are `aria-hidden`.
- **Reading order** is row-major (an improvement over Default masonry).

---

## 9. Responsive

| Width | Changes |
|---|---|
| ≥ 1100px | 4 sheet columns; index grid 4 columns |
| 720–1099px | 2–3 sheet columns; quotes still span 2 |
| < 720px | 1 column (`min(270px, 100%)`); quotes span 1. The header wraps with the wordmark first. The film strip scrolls horizontally with the current frame scrolled into view. The kind bar scrolls horizontally. Index grid 1 column |

---

## 10. Build notes

Do this after the Default phases 1–5.

1. **Theme setting:**
   - Add `theme: 'default' | 'contact'` to `chrome.storage.local`, with a ThemeContext (`src/lib/theme.ts`) that sets `data-theme` on `<html>`.
   - Add a "Theme" submenu to the More menu: Default, Contact sheet. (The later Colour field and Covers themes join here.)
2. **CSS:** `src/styles/themes/contact.css` holds all token overrides and the theme-scoped rules (`[data-theme="contact"] .…`).
3. **Fonts:** Cormorant Garamond woff2 in `public/fonts/`, loaded only when the theme is active (via `@font-face` inside the theme stylesheet, which the browser fetches only when used).
4. **New components:** `src/library/Sheet.tsx`, `src/library/LookAheadFilm.tsx`, `src/library/TagIndexGrid.tsx`, `src/components/GreasePencil.tsx`. `Library.tsx` picks Sheet/Masonry, LookAheadFilm/LookAhead and TagIndexGrid/TagIndex from the theme context. Data hooks and handlers are shared, unchanged.
5. **Pure helpers** in `src/lib/codes.ts`: `itemCode(b, sequence)` (kind code plus number) and `subKind(b)` (VID/PST/REP from platform). Add unit tests for both.
6. **Develop animation:** a `useDevelop(ids)` hook that adds a class for 1.4s to newly mounted or reprinted cells and respects reduced motion.
7. **Copy:** keep the strings for both themes in one table (`src/library/copy.ts`) keyed by theme, so the verbs in section 3 aren't scattered through components.

### Acceptance checklist

- [ ] Switching theme from the More menu changes the whole page without a reload, and the choice persists.
- [ ] Every Default interaction still works in this theme (Look ahead, Reprint, tag index, tidy-up, filters, sort, pagination, dialogs).
- [ ] Items sit on a hairline grid with crosshairs; quotes span two columns; reading order is row by row.
- [ ] Codes are correct and stable for a given library; video, post and repo codes follow the platform.
- [ ] Bleaching matches the Exposure chart at 0, 6, 12 and 24 months, in light and dark.
- [ ] Faded frames show "Faded · N mo." in red and a REPRINT button (Look ahead at 0 only).
- [ ] New and reprinted frames develop in; reprinted frames are circled in grease pencil.
- [ ] The film strip steps with the buttons, arrow keys and frame clicks, and its frames preview the bleaching.
- [ ] Tags show selection with grease pencil plus `aria-pressed`; index letter cells tint with their share of stale tags.
- [ ] All controls are square, 44px, mono uppercase; nothing is rounded except pencil marks.
- [ ] Contrast and reduced motion pass as in section 8.

---

## 11. Decisions made in this spec, and open questions

1. **Codes number items in the order they were saved** and aren't stored, so deleting an item renumbers everything after it. Alternative: store a permanent number at save time, so codes never change. That's better for "find LNK·014 again", but needs a new field and a counter.
2. **No tag colours in this theme.** The contact sheet is monochrome plus one red. If tag colours are wanted, they could appear as the small squares in the meta row.
3. **Look ahead sits full width under the hero**, not beside it as in Default, because the film strip needs the width.
4. **The grease-pencil circle on reprinted frames stays for the session** and clears on reload.
5. **Notes are mono ("typed") in this theme** and italic serif in Default. Jot a note follows the theme.
