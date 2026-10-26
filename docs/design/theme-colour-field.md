# Theme: Colour field

A theme layer on top of `docs/design/library-interactions.md` (the Default theme spec). **Build the Default theme first.** This document only lists what the Colour field theme changes; everything not mentioned here behaves as the Default spec says. The structure matches `theme-contact-sheet.md`.

- **Idea in one line:**
  - The room is lit by what you kept. Every item glows with its own colour, and the colours of the things you use tint the whole page.
  - Things you don't open **lose their colour, then their glow**, until they're grey glass.
  - Bringing something back makes its colour **bloom** out from the centre.
  - You can **search by colour**.
- **Design source:** canvas page "M · Colour field, expanded" (Colour chart, Components, States) and the "Colour field" artboard on page "H · Themes". Source copies are in `docs/design/reference/field-*.dc.html`.
- **Default appearance:** dark. Light ("daylight") is fully supported.
- **How the theme is applied:** `data-theme="field"` on `<html>`, as for the Contact sheet (theme setting and ThemeContext from `theme-contact-sheet.md` section 10).

---

## 1. What changes, at a glance

| Area | Default | Colour field |
|---|---|---|
| Page | Cream paper | A dark room lit by blurred fields of colour taken from the library |
| Cards | Media on the page | Frosted glass cards, each glowing its own colour |
| Kind of item | Card style | Coloured outline pills: link blue, quote coral, picture gold, note green |
| Ageing | Yellowing, dust, tilt | Colour drains, glow shrinks to nothing, the pill turns grey and dashed |
| Bringing back | Dust off, shine | "Bring back": colour blooms from the centre, the glow swells |
| Look ahead | Month name, ticks | A light meter: a bar of the library's colours draining across 24 months |
| New feature | (none) | **Search by colour** |
| Tags | Ink with colour squares | Coloured outline pills; a picked tag fills with its colour and glows |
| Index | Paper columns | Columns on a glass panel; tag dots glow when used, grey when not |

---

## 2. Tokens

Overrides under `:root[data-theme="field"]`.

### 2.1 Colour

| Token | Dark (default) | Light ("daylight") | Notes |
|---|---|---|---|
| `--bg` | `#0E1116` | `#FAF8F5` | |
| `--glass` | `linear-gradient(rgba(255,255,255,0.04), rgba(255,255,255,0.04)), rgba(14,17,22,0.75)` | `rgba(255,255,255,0.80)` | Card and panel fill. More solid than the mock-ups (7% white / 60% white) so text passes 4.5:1 over the brightest field; see 8.1 |
| `--glass-edge` | `rgba(255,255,255,0.16)` | `rgba(255,255,255,0.95)` | 1px card border |
| `--glass-blur` | `blur(22px) saturate(1.5)` | same | `backdrop-filter` (see 8.3 for performance) |
| `--lift` | `0 20px 40px -24px rgba(0,0,0,0.6)` | `0 18px 36px -22px rgba(30,30,40,0.35)` | Card shadow |
| `--text` | `#EEF0F4` | `#1A1C20` | 16.58:1 / 16.09:1 on `--bg` |
| `--text-muted` | `#B3B9C5` | `#555A63` | 9.6:1 / 6.54:1 |
| `--aged-text` | `#9EA4AE` | `#666A72` | 7.54:1 / 5.12:1 on `--bg`; at least 4.89:1 on glass over any field (8.1) |
| `--border` | `rgba(255,255,255,0.14)` | `rgba(26,28,32,0.12)` | |
| `--solid-bg` / `--solid-text` | `#EEF0F4` / `#0E1116` | `#1A1C20` / `#FAF8F5` | Primary button: a light pill in the dark room |
| `--kind-link` | `#8AB8F7` | `#2A63B8` | Outline pills and text; all ≥ 5.1:1 |
| `--kind-quote` | `#F4A184` | `#B04A2A` | |
| `--kind-picture` | `#EBCB66` | `#86640C` | |
| `--kind-note` | `#8ED2A8` | `#2C7449` | |
| `--halo-strength` | `0.42` | `0.30` | Glow opacity behind a fresh card |
| `--field-strength` | `0.50` | `0.32` | Opacity of the room's colour fields |

The eight tag colours from the Default spec (4.2) are reused, with the **light text variants in dark mode** and the dark ones in daylight.

### 2.2 Type and shape

- **Fonts:** as Default: Newsreader for display and reading, Geist for UI, Geist Mono only for small counts. No new fonts.
- **Hero:** centred, Newsreader 400, `clamp(56px, 7.4vw, 104px)`, line-height 0.92, letter-spacing -0.03em, "Find it by how it *looked.*"
- **Radii:**

  | Element | Radius |
  |---|---|
  | Cards | 18–20px |
  | Panels | 22px |
  | Images inside cards | 12–13px |
  | Picture cards (bare image) | 20px |
  | Pills and buttons | 999px |

- **Kind pills:** 22px tall on cards, 36px as controls, 1px border in the kind colour, text in the kind colour, Geist 500.

---

## 3. New data: an item's colour

Search by colour, the halos and the room's light all need one colour per item.

- **New field:** `Bookmark.color?: string` (hex), computed during enrichment and when a picture is saved.
- **How to compute it:**
  1. Draw the preview, or the picture, onto a 16×16 canvas.
  2. Drop pixels that are near-white, near-black or almost grey (saturation < 0.12, unless every pixel is like that).
  3. Bucket the rest by hue into 12 bins, weighted by saturation × count, and take the mean colour of the heaviest bin.
  4. If no pixel survives, use the most common colour.

  Put this in `src/lib/color.ts`, as a pure function over `ImageData`, with tests.
- **Fallbacks, in order:** `color`, then `themeColor`, then today's `fallbackColor(bookmark)`.
  - **Quotes** take their source page's colour, from the saved link to the same page if it exists.
  - **Notes** take their first coloured tag's colour, else a neutral `#7b93c4`.
- **Colour buckets** for search: 8 named buckets, each a hue range plus a saturation floor:

  | Bucket | Range |
  |---|---|
  | Red | 345–15° |
  | Coral | 15–35° |
  | Gold | 35–65° |
  | Green | 65–170° |
  | Teal | 170–200° |
  | Blue | 200–250° |
  | Indigo/violet | 250–300° |
  | Pink | 300–345° |

  Add **Grey** (saturation < 0.15) and **Charcoal** (lightness < 0.18). Only buckets with at least one item are offered.
- **Backups** carry `color`. Restores of old backups recompute it on the next enrichment pass.

---

## 4. Copy changes

| Default | Colour field |
|---|---|
| Dust off | Bring back |
| Refresh my memory | Bring back three |
| "5 things have gone yellow" | "5 of 18 things have lost their colour"; looking ahead: "By then 10 of 18 things will have lost their colour" |
| "MAY BE DEAD" stamp | Grey dashed pill "may be dead" |
| "dusted off just now" | "brought back just now"; "back from 14 mo." |
| Tidy bar: "They're shaded below." | "They've gone grey below." |
| Toast "Dusted off · Undo" | "Brought back 3 things · Undo" (with a small dot glowing in the item's colour) |
| Empty: "Nothing saved yet" | "Nothing here to glow yet" |
| No results | "Nothing you kept looked like that, yet." with the active filters above it, including the colour swatch |

---

## 5. Structural changes

### 5.1 The room (page background)

- Five blurred fields of colour, absolutely positioned behind everything: circles 560–760px, `filter: blur(90–110px)`, opacity `--field-strength`, `pointer-events: none`, `aria-hidden`.
  - Positions are fixed: top-left, top-right, middle, lower-left, lower-right.
- **Their colours come from the library:** the five bucket colours with the highest score, where score = Σ (1 − patina) over the items in that bucket.
  - Things you use light the room. As the library ages, the room dims and greys on its own. With Look ahead, the room dims as you step forward.
  - Recompute when the library changes, debounced 1s.
  - Cross-fade colour changes over 1.2s.
- The page wraps them with `overflow: hidden` so they never cause horizontal scroll.

### 5.2 Header and hero

- **Header:** wordmark left; glass buttons (More, appearance) and the solid "Add from a post".
- **Hero:** centred.
  - The headline (2.2).
  - The sentence "All your [links] [quotes] [pictures] and [notes], in their own colours." The words in brackets are the kind pills at 30px tall. They're decorative; the real filters are in 5.5.
  - Search and Jot a note as glass pills under it, centred, max 960px together.
- **Look ahead** (5.3) and **Search by colour** (5.4) follow, each full width.

### 5.3 Look ahead as a light meter

Its own component, `LookAheadMeter.tsx`. Behaviour, keys and limits are the Default spec's 6.3.

- **Panel:** glass, 22px radius, centred contents.
  - The lead.
  - The month in Newsreader 52px with ‹ › glass round buttons (44px).
  - The meter.
  - The status line with its button.
- **Meter:** a 26px tall, fully rounded bar, max 860px wide, made of 25 equal segments (months 0–24).
  - Each segment is a library colour (cycle the room's bucket colours) filtered `saturate(1 − 0.92·i/24) brightness(1 − 0.1·i/24)`, so the bar visibly drains from full colour to grey.
  - Segments are real buttons (`aria-label` "April 2027", `aria-pressed`).
  - Inner border 1px `--glass-edge`.
- **Knob:** a 42px glass ring with a 2px `--text` border, centred over the current segment, with a glow in that segment's colour (`box-shadow: 0 0 28px`). It moves with `left` over 400ms `--ease-spring`. That's a layout property, but it's a single small element; use `transform: translateX` if it measures badly.
- **Scale under the bar:** mono 10px muted: NOW · 6 MO · 1 YR · 18 MO · 2 YRS.

### 5.4 Search by colour (new)

- **Glass row:** "Search by colour" (serif italic 20px), then up to 10 swatch buttons, then a live description at the right ("4 blue things", or "Pick a colour to see things that looked like it").
- **Swatch:**
  - A 44px circle in the bucket's representative colour (the mean `color` of its items), with a 2px `--bg` border and a 1px `--glass-edge` ring.
  - **Selected:** `box-shadow: 0 0 0 2px var(--text), 0 0 26px <colour>`.
  - **Hover:** lifts 3px.
  - `aria-pressed`; `aria-label` "Blue things, 4".
- **Filter:**
  - Selecting a swatch filters to items in that bucket. It combines with search, kind and tags (AND); one colour at a time.
  - Clicking the selected swatch clears it.
  - "clear filters" clears it too.
- Faded items are matched by their original colour (the colour is data, not the faded rendering).

### 5.5 Kind pills

Pills in their kind colours (Everything uses `--text`), outline at rest.

- **Pressed:** filled with the kind colour, text `--bg`, glow `0 0 22px <colour>99`.
- **Source and Sort:** glass pill buttons that open native selects.

### 5.6 Cards

Masonry as in Default (columns, distribution, pagination).

- **Every card has a halo behind it:**
  - A blur(34px) rounded rectangle inset 10% 4% 4% in the item's `color`.
  - Opacity `--halo-strength × (1 − t)`.
  - On hover: ×1.7 and `scale(1.04)`.
  - Pictures use a larger halo, inset 6% 0 −4%.
- **Link:**
  - A glass card (padding 10px 10px 14px, 20px radius) holding the preview (13px radius), the title (Newsreader 19px 500) and a row: kind pill (the link's sub-kind word: article, video, post, repo, recipe, or link), then platform.
  - **Video:** a frosted 48px play button and a duration chip on the image.
- **Picture:** no glass; the bare image (20px radius) with a "picture" pill inside at bottom-left (white outline, `rgba(20,24,32,0.5)` frosted fill). Source and tags sit in the meta line under it.
- **Quote:** glass with a faint tint of its source colour, `linear-gradient(160deg, <colour 42% alpha>, var(--glass) 70%)`. Quote in Newsreader 26px, then a row with a quote pill and "from host".
- **Note:** glass with a **dashed** border. A row with the note pill and date, then the text in Newsreader italic 21px.
- **Meta line** under every card: tag dots and the age text, as Default, plus **Bring back** or **Edit**. The dots are kept here because colour carries meaning in this theme.

### 5.7 Tag strip, filed-under and index

- **Tag strip:**
  - "Most used" (serif italic 20px), then six tags as outline pills (border = tag colour, text = tag text colour, mono count).
  - **Picked tags** fill with their colour (text `--bg`) and glow `0 0 22px <colour>`.
  - "Open the index · 78" is a glass pill.
- **Filed-under:** "Showing things filed under", then filled glowing tag pills, each with ×, then "clear".
- **Index:** on a glass panel (22px radius). Layout as Default (3 columns, tall letters Newsreader italic 300 64px, entries, sub-entries, "ONCE ·" run-ins), with these differences:
  - Each top-level coloured tag has an **8px round dot** instead of a square. When fresh it glows (`0 0 10px <colour>`). As the tag fades it mixes toward `#5A5F68`; at fade > 0.4 the glow goes off.
  - **Picked entries** get a soft fill (tag colour at 20% alpha, 10px radius) and a glow (`0 0 24px <colour 53%>`), not a highlighter.
  - **Tidy bar:** a grey glass strip with a **dashed** border, "N tags haven't been used in a year" (or the Look ahead form), the explainer, and a solid "Archive N".
  - Controls are glass: Find a tag, and a glass segmented control with a light pressed segment.

---

## 6. Ageing: losing colour and glow

Input is `t = patina(b, now)`, as in Default 5.2. Set `--t` on the card.

| Part | Mapping | Implementation |
|---|---|---|
| Image | Colour drains, then dims slightly | `filter: saturate(calc(1 - var(--t)*.92)) brightness(calc(1 - var(--t)*.08))` |
| Glow | Shrinks to nothing | Halo opacity `calc(var(--halo-strength) * (1 - var(--t)))` |
| Text | Title, quote, note drift to `--aged-text` | `color-mix()` as in Default |
| Pill | At t ≥ 0.5 the kind pill turns `--text-muted` with a **dashed** border | Also the note card's dashed border stays dashed |
| Card border | At t ≥ 0.5 the glass border becomes dashed | A second cue that doesn't rely on colour |
| Room | Fields dim as their items fade (5.1) | |
| Not used | No dust, no tilt, no sepia | |

Transitions 600ms ease-out, as Default. Dead links: image `grayscale(1)`, card at 72% opacity, no halo, dashed pill "may be dead".

---

## 7. Moments and states

| State | Look |
|---|---|
| Hover | Card lifts 3px; glass sheen goes from 4% to 8% white in dark mode (90% white in daylight); halo ×1.7, `scale(1.04)`; title underlined; Edit appears |
| Keyboard focus | As hover, plus a double ring: `0 0 0 2px var(--bg), 0 0 0 4px var(--text)` around the glass |
| Faded (t ≥ 0.5, Look ahead at 0) | Colourless image, no glow, dashed border and pill; a glass "Bring back" pill (28px tall) in the meta row |
| Brought back | **Bloom** (below); age "back from 14 mo."; toast with a dot glowing in the item's colour |
| New | Bloom |
| Dead link | Section 6 |
| Fetching | Glass card with an empty, dashed, 5%-white image area; hostname as title in muted; "details on the way". It blooms in when details arrive |
| Picture couldn't be downloaded | Same empty area with "Picture couldn't be downloaded" centred |
| Empty library | "A room with no light yet": a faint white radial glow on `--bg`, Newsreader 34px "Nothing here to glow yet", the explainer and a light solid button. No colour fields |
| No results | The active filters as a line, including the colour swatch as a glowing dot. Newsreader italic 32px "Nothing you kept looked like that, yet." and "clear filters" |
| Loading | Soft glass blanks (`rgba(255,255,255,0.06)` with a 1px edge) at the masonry's estimated sizes. **No colour until it's real**, and no fields |

### Bloom

| Part | Keyframes | Duration, easing |
|---|---|---|
| Image | `saturate(.08) brightness(.92)` → 55%: `saturate(1.25) brightness(1.04)` → none | 1300ms, `cubic-bezier(.2,.8,.2,1)` |
| Halo | opacity 0, `scale(.55)` → 55%: opacity .75, `scale(1.15)` → `--halo-strength`, none | same |

Several items: stagger by 120ms. Reduced motion: none.

---

## 8. Accessibility and performance

### 8.1 Contrast

All solid pairs in 2.1 pass 4.5:1. **Glass is translucent, so text on it has to be checked against the brightest field that can sit behind it.**

The mock-ups use 7% white glass in dark mode. Measured over a field at full strength, that glass drops to these ratios:

| Text | Ratio |
|---|---|
| Muted text | as low as 1.78:1 (pale-grey field) |
| Main text | 3.07:1 |

That's why the `--glass` tokens in 2.1 are more solid. With them, the worst cases measured over coral, gold, pale grey, mint and peach fields at 50% are:

| Mode | Worst case |
|---|---|
| Dark (75% `--bg` tint, 4% white sheen, `--aged-text` `#9EA4AE`) | 4.89:1 |
| Daylight (80% white over fields at 32%) | 4.83:1 |

The look stays glassy because of the blur and the edge highlight. Keep these values unless a lighter glass is measured to pass.

Text never sits directly on the page background over a field: the hero headline and sentence sit over the darkest part of the room, the top centre, which no field occupies.

### 8.2 Not colour alone

- Every colour cue has a second cue:
  - Kind pills have words.
  - Faded items get dashed borders and the age text.
  - Picked tags get `aria-pressed` and the filed-under row.
- Search by colour swatches carry names in their labels ("Blue things, 4"), and the live description says the name in words.

### 8.3 Transparency and performance

- **`prefers-reduced-transparency: reduce`:** glass becomes solid (`#1A1E25` dark, `#FFFFFF` daylight), blur is off and fields drop to 0.25 opacity.
- **`backdrop-filter` is expensive.**
  - Apply it only to cards inside the viewport. Use an IntersectionObserver to add a `.is-visible` class; off-screen cards get the solid fallback.
  - Never animate it.
  - If a page shows more than 60 cards, switch all card glass to the solid fallback and keep blur on the panels only.
- The fields are 5 elements with static `filter: blur`; they're cheap. Don't animate their size or position, only their colour (cross-fade).

---

## 9. Responsive

| Width | Changes |
|---|---|
| ≥ 1100px | As drawn; 4 masonry columns |
| 720–1099px | 2–3 columns; the meter stays full width; swatches wrap |
| < 720px | 1–2 columns. Hero `clamp` floor 56px. Fields scale to 60% size. Swatches scroll horizontally in one row. Meter segments stay tappable as a group (the strip is one 44px-tall touch target that maps the tap position to a month) |

---

## 10. Build notes

After the Default phases and the theme setting from the Contact sheet spec:

1. `src/styles/themes/field.css`: tokens, glass, fields, ageing variables, reduced transparency.
2. `src/lib/color.ts`:
   - `dominantColor(imageData)`
   - `bucketOf(hex)`
   - `fieldColors(items, now)`

   With tests: buckets at hue boundaries; greys and charcoal; empty image; score weighting.
3. **Enrichment** (`src/lib/enrich.ts`, `src/lib/previews.ts`): compute `color` after a preview is stored. Add a background pass for existing items, a few at a time, like today's queue.
4. `src/lib/db.ts`: `color?: string` on `Bookmark` (no index). The colour filter runs in memory like the others.
5. **New components:** `src/library/Field.tsx` (the room), `src/library/LookAheadMeter.tsx`, `src/library/ColourSearch.tsx`, `src/library/CardGlass.tsx` (or a variant of `BookmarkCard`).
6. `Library.tsx`: `colourFilter` state, included in the filter pipeline and the result count.
7. `useBloom(ids)`, like the Contact sheet's `useDevelop`.
8. **Copy** strings in `src/library/copy.ts` under `field`.

### Acceptance checklist

- [ ] Dark is the default in this theme; daylight works, and the appearance toggle persists.
- [ ] Every item gets a colour after enrichment; quotes and notes follow their fallbacks.
- [ ] The room's fields come from the most-used, freshest colours and dim as things age and as Look ahead steps forward.
- [ ] Cards fade in colour, then glow, then get dashed borders, matching the Colour chart at 0, 6, 12 and 24 months.
- [ ] Bring back and Bring back three bloom, show a toast with Undo, and leave `openCount` unchanged.
- [ ] The light meter steps by buttons, arrow keys and segment taps; it drains visibly.
- [ ] Search by colour filters correctly, combines with other filters, and announces its result in words.
- [ ] Picked tags fill and glow; index dots glow when fresh and go grey and still when stale.
- [ ] Reduced transparency and reduced motion both work; scrolling a 500-item library stays smooth (blur only on visible cards).
- [ ] All text passes 4.5:1, including on glass over the brightest field.

---

## 11. Decisions made in this spec, and open questions

1. **The glass is more solid than in the mock-ups** (8.1), so text stays readable over any field. If that looks too heavy, the alternative is to keep the light glass and cap field opacity lower (around 0.25), which dims the room.
2. **An item's colour is computed once and stored.** It's cheap and lets search by colour work offline. The alternative, computing on render, would be slow with hundreds of previews.
3. **The room's colours come from what you use**, weighted by freshness, not just by count. That makes the page itself a signal of what you're neglecting.
4. **One colour at a time** in Search by colour. Multi-select could come later if wanted.
5. **Dark is this theme's default** because glow reads best in the dark. Daylight keeps every feature.
6. **Tag dots stay on cards in this theme** (unlike Default, which uses the filed-under sentence), because colour is the organising idea here. The filed-under sentence could replace them if consistency matters more.
