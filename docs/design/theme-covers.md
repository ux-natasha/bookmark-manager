# Theme: Covers

A theme layer on top of `docs/design/library-interactions.md` (the Default theme spec). **Build the Default theme first.** This document only lists what the Covers theme changes; everything not mentioned here behaves as the Default spec says. The structure matches `theme-contact-sheet.md`.

- **Idea in one line:**
  - The library is a magazine rack. Every link is set as an **editorial cover built from its own details**: a newsletter becomes a masthead, a video a film strip, a repo a terminal, a recipe a menu card.
  - Things you don't open **sun-fade from the top, gather brown spots and lean on the shelf**.
  - Taking one down to read puts it **back in print**.
  - The tag index is the **index at the back of a book**.
- **Design source:** canvas page "N · Covers, expanded" (Shelf-wear chart, Components, States) and the "Covers" artboard on page "H · Themes". Source copies are in `docs/design/reference/covers-*.dc.html`.
- **How the theme is applied:** `data-theme="covers"` on `<html>`, with the theme setting and ThemeContext from `theme-contact-sheet.md` section 10.

---

## 1. What changes, at a glance

| Area | Default | Covers |
|---|---|---|
| Layout | Masonry of media cards | Rows of 3:4 covers standing on shelves |
| Link previews | Screenshot or site image | A typeset cover by default; "Links show" switches to the site's image or a screenshot |
| Ageing | Yellowing, dust, tilt | Sun-fade from the top, foxing (brown spots), sepia, a lean against the neighbour |
| Bringing back | Dust off, shine | "Take down": the cover straightens and gets a red "BACK IN PRINT" band |
| New items | Drop in | "Fresh off the press": slides up onto the shelf |
| Look ahead | Month, ticks | A shelf of monthly issues (spines), the chosen one pulled out with a ribbon |
| Kinds | Pills | Binder tabs |
| Tag strip | Ink and highlighter | A running header, "INDEX work · design …"; picks get a red ribbon |
| Tag index | Paper columns | A printed back-of-book index page, Bodoni letters, folio |
| Tidy up | Archive | "Leave out of the next edition" (an erratum slip) |

---

## 2. Tokens

Overrides under `:root[data-theme="covers"]`.

### 2.1 Colour

| Token | Light | Dark ("reading room at night") | Notes |
|---|---|---|---|
| `--bg` | `#ECE9E2` | `#0D121A` | The wall behind the rack |
| `--paper` | `#FBF8F1` | `#161D28` | Index page, panels, menus |
| `--text` | `#1F1D1A` | `#E7ECF3` | 13.87:1 / 15.82:1 |
| `--text-muted` | `#58534A` | `#AEB8C6` | 6.3:1 / 9.36:1 |
| `--aged-text` | `#6B5C42` | `#B6A784` | 5.35:1 / 7.91:1 |
| `--border` | `rgba(31,29,26,0.16)` | `rgba(231,236,243,0.16)` | |
| `--border-strong` | `rgba(31,29,26,0.28)` | `rgba(231,236,243,0.30)` | Buttons, inputs |
| `--solid-bg` / `--solid-text` | `#1F1D1A` / `#ECE9E2` | `#E7ECF3` / `#0D121A` | |
| `--danger` | `#8a2f1c` | `#F2A08F` | Dead-link text |
| `--ribbon` | `#A3302A` | `#D9604F` | Bookmark ribbons and the "Back in print" band; band text `#FBF8F1` (6.57:1) |
| `--shelf` | `linear-gradient(180deg, #d8cfbd, #c6bba5)` | `linear-gradient(180deg, #2a3342, #1c2330)` | 12px ledge with `0 10px 14px -8px` shadow |
| `--erratum` | `#F3E9CF` | `#2B2719` | Erratum slips (tidy bar, toast); text `#3E3424` (10.09:1), label `#5A4C33` (6.9:1) |

**Cover colours come from the item, not the theme** (section 4). Covers keep their own colours in dark mode; only the room, shelves and type around them change.

### 2.2 Type

| Token | Value |
|---|---|
| `--font-display` | Bodoni Moda (400, 400 italic, 600), fallback Didot, serif. Mastheads, index letters, the Look ahead month, the wordmark. Self-host the woff2 (OFL) |
| `--font-serif` | Newsreader, as Default (titles, quotes, index entries) |
| `--font-sans` / `--font-mono` | Geist / Geist Mono, as Default |

| Role | Spec |
|---|---|
| Masthead wordmark | Bodoni 600 54px, letter-spacing 0.02em, all caps "BOOKMARKS", between a 3px double rule above and a 1px rule below |
| Dateline | mono 10px, letter-spacing 0.1em: "VOL. 1 · OCTOBER 2026" left, counts right, with a 1px rule below |
| Headline | Newsreader 400, `clamp(50px, 6vw, 76px)`: "Everything you *kept.*" |
| Cover title under the cover | Newsreader 17px 500 |
| Index letter | Bodoni italic 58px 400 |
| Index entry | Newsreader 17px, comma, then the count in old-style numerals (`font-variant-numeric: oldstyle-nums`) |
| Look ahead month | Bodoni 52px, year italic muted |

### 2.3 Shape

- Covers: 3:4 aspect, 3px radius.
- Panels: 3px; buttons and inputs: 3px; the "Links show" segmented control: 4px.
- Buttons: 44px tall, 1px `--border-strong`, Geist 13px. Solid button: `--solid-bg`.

---

## 3. Layout: the rack

Its own component, `Rack.tsx`, replacing Masonry.

- **Columns:** `n = max(1, floor((width + 28) / (210 + 28)))`, capped at 6. Items are chunked into rows of `n` **in sort order**, so reading and keyboard order run row by row.
- **Row:** a flex row, `gap: 28px`, `align-items: flex-end`, so covers stand on the shelf. Then a **shelf** (12px `--shelf`, extended 10px past the row on both sides) and 40px before the next row.
- **Item:** the cover (3:4); for links, then the title under it (Newsreader 17px 500); then the meta row (6.1).
- **Pagination:** as Default; new rows append below.

---

## 4. Covers: built from an item's own details

A pure function `coverFor(bookmark): CoverSpec` in `src/lib/covers.ts` picks a template and fills it. Covers are drawn in HTML and CSS, not as images, so they stay crisp, selectable and translatable. Each template has 18px padding unless stated, and a 6px spine shadow on the left edge for article, post, repo and guide covers.

### 4.1 Choosing a template

| Template | Chosen when | Content |
|---|---|---|
| **Article** | Default for links, and newsletters (Substack, Ghost, Medium, Beehiiv by platform) | **Masthead:** `siteName` in Bodoni 600 caps, ~29px, centred, max 2 lines. **Kicker** between two rules, mono 9.5px: "A NEWSLETTER" for newsletter platforms, else the hostname. **Title** at the bottom in Newsreader 26px, max 4 lines. **Dek:** the first sentence of `description`, Newsreader italic 13px, max 2 lines |
| **Video** | Video platforms | Dark `#1E2129` cover, 30px vertical padding, **sprocket strips** top and bottom (16px). Kicker: "YOUTUBE", plus "· PART n OF m" if the title says so. Title Geist 600 25px. At the bottom, a progress bar and "5:10 watched · 18:42" when known; otherwise only the duration if known |
| **Post** | Social platforms (X, Bluesky, Threads, Mastodon, LinkedIn, Reddit) | Pale `#EEF0F2`. Handle and "1 / 6" (thread position, if known) in mono. The post's first sentence large (Newsreader 29px), the rest in Geist 13px. Footer: "POST ON X" (and "· THREAD KEPT" when the whole thread was saved) |
| **Repo** | GitHub, GitLab, Codeberg | Terminal dark `#14171C`. "$ git clone" muted, the repo name in mono 34px white, `description` in Geist 13px. A language bar only if language data exists, else nothing. The repo path in mono at the bottom |
| **Recipe** | The page has schema.org `Recipe` data (read during enrichment), or the platform is a known recipe site | Menu card: cream `#F6EEDF` with a 1px `#A3302A` inner frame inset 10px. Hostname in spaced mono caps, title in Bodoni italic 28px centred, a diamond rule, and "6 HOURS · SERVES 6" from the recipe data when present |
| **Dead** | `isDeadLink` | Grey `#d9cfbb`, grayscale, 70% opacity. Hostname, title, and a rotated "OUT OF PRINT" stamp (2px border, mono 11px 500) |
| **Quote** | Quotes | A **broadside**: paper `#FBF8F1`, a 34×3px rule in the source's colour, the quote in Newsreader 24–26px, "from host" in italic muted. Centred vertically |
| **Picture** | Pictures | A **plate**: the picture fills the cover above a 40px caption strip on paper. Caption: the title in italic left, "PLATE n" in mono right, where n is the picture's number among pictures in save order |
| **Note** | Notes | A lined card: `#FFFDF6` with ruled lines every 28px from 54px down (`rgba(47,74,107,0.22)`). "YOUR NOTE" and the date in mono at the top, the text in Newsreader italic 20px on the lines |

### 4.2 Colour and contrast

- **Cover background:** article, guide and other link templates use the item's colour. That's `color` if the Colour field theme has computed one, else `themeColor`, else `fallbackColor`. Video, post, repo, recipe and dead use their fixed colours.
- **Text colour** on coloured covers is `#F1EDE3` or `#15171A`, whichever contrasts more with the background, and must reach 4.5:1 for small text. If neither does (mid-tone backgrounds), darken the background by steps of 6% lightness until white text passes.

### 4.3 "Links show" (cover, site's image, screenshot)

- A segmented control in the hero: "A cover", "The site's image", "A screenshot".
- Saved as `linksShow` in `chrome.storage.local`. Default: "A cover".
- **Image and screenshot modes** fill the 3:4 cover with that preview (`object-fit: cover`, top-aligned for screenshots). The platform chip sits top-left, as Default. If the chosen preview doesn't exist, the item falls back to its typeset cover.
- An item's `previewPreference` (chosen in Edit) wins over the global setting. Add "Cover" as a third choice in the Edit dialog's preview picker.

---

## 5. Copy changes

| Default | Covers |
|---|---|
| Dust off | Take down |
| Refresh my memory | Take three down |
| "5 things have gone yellow" | "5 of 18 covers are sun-faded"; looking ahead: "By then 9 of 18 covers will be sun-faded" |
| Look ahead lead "Your library now," | "The issue on the shelf now," / "Your shelf as it'll look in" |
| "MAY BE DEAD" | "OUT OF PRINT" stamp on the cover; meta "stopped answering Oct 9" |
| "dusted off just now" | "back in print"; "back from 14 mo." |
| Open the index · 78 | Turn to the index · 78 |
| Tidy up tags not used in | Leave out of the next edition: tags unused for |
| Archive 31 | Leave out 31 |
| "Archived 31 tags. Bring them back" | "31 tags out of print. Bring them back" |
| Toasts | Erratum slips: "ERRATUM · 3 covers taken down · Undo" |
| Empty: "Nothing saved yet" | "The shelf is empty" |
| No results | "Nothing on the shelf matches that, yet." with the active filters in mono above |

---

## 6. Structural changes

### 6.1 Cover item and meta row

- **Meta row:** mono 10.5px, 30px minimum height. The age text (Default rules plus section 5), then **Take down** (when faded and Look ahead is at 0) and **Edit** (on hover or focus), as small bordered buttons (30px, Geist 12px, 3px radius).
- **Tags on covers:** a "filed under …" line in Newsreader italic 14px under the title, as Default. For pictures, quotes and notes, which have no title line, it goes under the cover.

### 6.2 Header, masthead and hero

- **Top row** (right-aligned): More, appearance, Add from a post.
- **Masthead block** (2.2) under it: the wordmark between rules, then the dateline. Dateline counts are the whole library; the volume number is the years since the first save, plus one.
- **Hero row:** headline left; "LINKS SHOW" label and the segmented control right.
- Then search and Jot a note, as Default with 3px radii.

### 6.3 Look ahead as a shelf of spines

Its own component, `LookAheadShelf.tsx`. Behaviour, keys and limits are the Default spec's 6.3.

- **Panel:** `--paper`, 3px radius, no border, soft shadow, padding 24px 28px 0.
- **Top row:** the lead (Newsreader italic 18px muted) and the month (2.2) at the left; ‹ › as 44px square buttons at the right.
- **Spines:** 25 buttons (months 0–24) in a 170px-tall row, `align-items: flex-end`, gaps of 3px, sharing the width equally.
  - **Height** varies per spine (128px + (i × 37 mod 5) × 9px), so the row looks like real books.
  - **Colour** cycles the eight cover colours: `#24453B`, `#2F3B8F`, `#A3302A`, `#7d9aa8`, `#1E2129`, `#b4893f`, `#6f8a3e`, `#c4688a`. A 2px light band sits 10px from the top.
  - **Fading previews the month:** each spine gets `sepia(.55·i/24) saturate(1 − .4·i/24)`, a top bleach to 55% at i = 24, and a lean of `rotate(−1.6·i/24 deg)`.
  - **Label** in mono 8.5px, turned 90° and reading up from the bottom: "NOW", "NOV 26" …
  - **The chosen spine is pulled out** (`translateY(−22px)`, 320ms `--ease-spring`) and stands upright, with a **ribbon** (10×22px, `--ribbon`, notched end) hanging below it.
  - `aria-label` is the month and year; `aria-pressed` on the chosen spine.
- **The shelf** (`--shelf`) runs edge to edge under the spines.
- **Footer:** the status in Newsreader italic 17px muted, and "Take three down" or "Back to today".

### 6.4 Kinds as binder tabs

- Tabs (Everything, Links, Quotes, Pictures, Notes) sit along the top edge of a paper strip that holds the Source and Sort selects at the right.
- Each tab is 44px tall, Newsreader 18px, with a 4px top radius and a mono 10px count.
- **Pressed tab:** `--paper` fill, 1px `--border` on three sides, `--text`, italic. It overlaps the strip by 1px so it joins it.
- **Unpressed tabs:** transparent, `--text-muted`.

### 6.5 Running header (tag strip) and filed-under

- **Running header:** a 1px `--text` rule above and a muted rule below, like the top of a book page.
  - "INDEX" in mono 10.5px with 0.14em tracking.
  - The six most-used tags in Bodoni italic 19px, each followed by its count in Newsreader old-style numerals.
  - **Picked tag:** tag text colour, underlined (offset 5px), with a **ribbon** hanging under the word.
  - "Turn to the index · 78" is a bordered button at the right.
- **Filed-under:** as Default (Newsreader italic, small caps tag names, "clear").

### 6.6 Index as the back of a book

Its own component, `TagIndexPage.tsx`. Data and behaviour are the Default spec's 6.6 and 6.7.

- **Controls row** above the page: Find a tag (bordered, Newsreader 17px), the hint, "Leave out of the next edition: tags unused for", and a segmented control (Off · 3 months · 6 months · a year).
- **The page:** `--paper`, 3px radius, padding 40px 56px 28px.
  - **Page header:** "Index" in Bodoni italic 30px left; mono note right, "NUMBERS ARE HOW MANY THINGS CARRY EACH TAG"; 1px `--text` rule under it.
  - **Body:** 3 columns, each at least 240px, 48px gaps, with a 1px column rule.
  - **Letters:** Bodoni italic 58px.
  - **Entries** are book style: "design, 19" (name, comma, count in old-style numerals). No leaders. Sub-entries are indented 22px and smaller (15.5px). Tags used once run in after a small-caps "once:".
  - **Picked entries:** italic, with a **ribbon** in the left margin (22px out).
  - **Disuse:** entries fade to `--aged-text`, as Default. When tidy-up is on, stale entries get a dagger after the count ("2 †"). This replaces Default's shading, so it reads like a printed note.
  - **Tidy bar:** an **erratum slip** at the top of the page.
    - Fill `--erratum`, dashed 1px rules above and below.
    - "ERRATUM" in mono 10px.
    - "31 tags marked † haven't been used in a year. Leave them out of the next edition?", or the Look ahead form.
    - A solid "Leave out 31" button.
  - **Archived tags** are listed after the last letter as "Out of print:" plus a run-in of names, each clickable to bring it back, and "Bring them all back".
  - **Folio:** a footer with "BOOKMARKS · INDEX" left and "— 323 —" right in mono 10px (the number is decorative: 300 + letter count).

### 6.7 Buttons, menu, toast

- **More menu:** a "Contents" page (`--paper`): "Contents" in Bodoni italic 20px, then each item as a contents line (Newsreader 17px, dotted leader, mono shortcut letter where one exists).
- **Toast:** an **erratum slip**, `--erratum`, dashed rules above and below, turned −0.6°, "ERRATUM" label, Newsreader 16px message, underlined Undo. Bottom centre, as Default.

---

## 7. Ageing: sun-fade, foxing, lean

Input is `t = patina(b, now)`, as in Default 5.2.

| Part | Mapping | Implementation |
|---|---|---|
| Cover colour | Toward sepia, loses about 40% saturation | `filter: sepia(calc(var(--t)*.55)) saturate(calc(1 - var(--t)*.4)) brightness(calc(1 + var(--t)*.05))` |
| Sun | The top fades first, as if the rack faced a window | `::before` overlay `linear-gradient(180deg, rgba(255,248,230,.9), rgba(255,248,230,.25) 45%, transparent 75%)`, opacity `calc(var(--t)*.6)` |
| Foxing | Brown specks and a warm edge | `::after`: the Default dust layers (Default section 7), opacity `calc(var(--t)*.95)` |
| Lean | The cover slumps against its neighbour | `transform-origin: 0 100%; transform: rotate(calc(var(--t) * -2.4deg))` |
| Title under the cover | Fades to `--aged-text` | `color-mix()` |
| Not used | No halo | |

Transitions 600ms ease-out. Dead links use the Dead template and don't age.

---

## 8. Moments and states

| State | Look |
|---|---|
| Hover | The cover is pulled forward: `translateY(-6px) rotate(-0.6deg)`, deeper shadow (`0 30px 30px -20px rgba(0,0,0,.6)`), 260ms `--ease-out`. Title underlined; Edit appears. A leaning cover straightens while hovered |
| Keyboard focus | As hover, plus `outline: 2px solid var(--text); outline-offset: 5px` around the cover |
| Sun-faded (t ≥ 0.5, Look ahead at 0) | Section 7; "Take down" in the meta row |
| Back in print (Take down, Take three down) | The lean returns to 0 and the fading clears (600ms). Then a **red band** slides in from the left across the lower third of the cover (`--ribbon` fill, mono 10px "BACK IN PRINT" with 0.14em tracking, 30px tall; `translateX(-100%)` → 0, 400ms ease-out, 600ms delay). It stays for the session. Meta "back from 14 mo." |
| New: fresh off the press | The cover slides up onto the shelf: `translateY(46px)`, opacity 0 → none, 900ms `cubic-bezier(.2,.9,.25,1.15)` (a small overshoot) |
| Dead link | Dead template; meta in `--danger` |
| Fetching details | A **proof**: paper cover with four corner crop marks (14px, 1px `--text-muted`), "PROOF" in mono 10px and the hostname in Bodoni italic 18px. Title "Details on the way", meta "next try in 1.5 s". It's replaced by the real cover with the press animation |
| Picture couldn't be downloaded | A plate with an empty `--border` box and "PLATE MISSING" in mono |
| Empty library | An empty shelf: Bodoni italic 32px "The shelf is empty", the explainer, a solid "Import your Edge favorites", and a shelf ledge under it |
| No results | Active filters in mono, Bodoni italic 32px "Nothing on the shelf matches that, yet.", "clear filters" |
| Loading | Blank boards (`#DDD8CE`, 3:4, 3px radius) standing on shelves, at the rack's column count. No shimmer |

Several covers taken down at once: stagger by 120ms. Reduced motion: no slides, the band appears instantly, and the lean still shows as a static angle (it's information, not motion).

---

## 9. Accessibility notes

- **Contrast:** every pair in 2.1 passes 4.5:1. Cover text is checked per cover (4.2).
- **Each cover is one link** whose accessible name is the item's title plus its kind ("Why every team needs a decision log, article"). Typeset decoration inside (kickers, sprockets, "PLATE 3", fake thread counts) is `aria-hidden`, so screen readers don't hear a jumble of cover furniture.
- **Spines** are buttons named by month. The rotated labels are `aria-hidden`.
- **The dagger** for stale tags is backed by the tidy bar text, and is explained there ("tags marked †").
- **The lean is at most 2.4°.** That's enough to notice, not enough to hurt legibility.

---

## 10. Responsive

| Width | Changes |
|---|---|
| ≥ 1100px | 5–6 covers per shelf |
| 720–1099px | 3–4 covers per shelf; masthead 44px |
| < 720px | 2 covers per shelf (each at least 150px wide; cover text scales with `container-type: inline-size` and `cqi` units so typesetting holds). The spine shelf scrolls horizontally with the chosen spine in view. Binder tabs scroll horizontally. Index page 1 column, padding 24px |

---

## 11. Build notes

After the Default phases and the theme setting from the Contact sheet spec:

1. `src/styles/themes/covers.css`: tokens, shelf, cover templates (one class per template), ageing variables, states.
2. `src/lib/covers.ts`: `coverFor(b)` (template choice and fields), `coverTextColor(bg)` and `plateNumber(b, items)`. Unit tests: template choice per platform; dead wins over everything; fallbacks when description, siteName or duration are missing; contrast darkening.
3. **Enrichment:** capture `siteName`, `description` and `author` (already read). Also capture video duration and recipe data (schema.org `Recipe`: `totalTime`, `recipeYield`) where cheap. Store them under a new optional `Bookmark.details?: { duration?: number; recipe?: { totalTime?: string; yield?: string }; language?: string[]; thread?: { index: number; count: number } }`. Templates must work when all of these are missing.
4. **New components:**
   - `src/library/Rack.tsx`
   - `src/library/Cover.tsx` (renders a `CoverSpec`)
   - `src/library/LookAheadShelf.tsx`
   - `src/library/KindTabs.tsx`
   - `src/library/TagIndexPage.tsx`
5. **Settings:** `linksShow` in `chrome.storage.local`; "Cover" added to the EditDialog preview picker.
6. **Animations:** `usePress(ids)` and `useBackInPrint(ids)`, like the other themes' hooks.
7. **Copy** strings in `src/library/copy.ts` under `covers`.

### Acceptance checklist

- [ ] Links render as typeset covers by template; the cover, site image and screenshot modes work, and per-item preferences win.
- [ ] Covers stand on shelves in rows, in sort order; keyboard order is row by row.
- [ ] Ageing matches the Shelf-wear chart at 0, 6, 12 and 24 months: top fade, foxing, sepia, lean.
- [ ] Take down and Take three down straighten the cover, clear the fade, slide in the red band, and show an erratum toast with Undo; `openCount` is unchanged.
- [ ] New covers slide up onto the shelf; fetching shows a proof.
- [ ] The spine shelf steps by buttons, arrow keys and spine clicks; the chosen spine is pulled out with a ribbon.
- [ ] The index reads as a book page: Bodoni letters, "name, count" entries in old-style numerals, daggers for stale tags, the erratum tidy bar, out-of-print archived tags, and the folio.
- [ ] Every cover's text passes 4.5:1 (auto-darkening works on mid-tone colours).
- [ ] Reduced motion removes the slides; the lean stays as a static angle.

---

## 12. Decisions made in this spec, and open questions

1. **Covers are HTML and CSS, not images.** They stay sharp and readable to screen readers and search, but they need the template code. The Default spec's preview images are still used when "Links show" is set to an image.
2. **Recipe and guide templates depend on page data.** Recipe needs schema.org data; the "travel guide" cover in the mock-ups (Lisbon) has no reliable signal, so it falls back to the Article template.
3. **Thread position ("1 / 6") and video watch progress** only show when the data exists. The extension doesn't record watch progress today, so expect "18:42" alone.
4. **The folio and "VOL. 1" are decorative.** Drop them if they read as fake data.
5. **The lean stays under reduced motion**, because it carries meaning (neglect) and isn't an animation.
