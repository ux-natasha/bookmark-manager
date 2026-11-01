---
name: Folia
description: A visual library for the things you save, where what you forgot fades into view.
colors:
  ground: "#f5f1e8"
  surface: "#fffdf8"
  ink: "#1f1d1a"
  ink-muted: "#5f5a4f"
  border: "#1f1d1a1f"
  border-strong: "#1f1d1a42"
  hover: "#1f1d1a0f"
  accent-slate: "#2f4a6b"
  solid: "#1f1d1a"
  solid-text: "#f5f1e8"
  danger-rust: "#8a2f1c"
  note-paper: "#fffdf8"
  aged-paper: "#eadbb8"
  aged-ink: "#6b5c42"
  age-done: "#a07b3a"
  night-ground: "#0d121a"
  night-surface: "#161d28"
  night-ink: "#e7ecf3"
  night-ink-muted: "#aeb8c6"
  night-accent: "#ede48a"
  tag-terracotta: "#c47a52"
  tag-blue: "#4d6fa3"
  tag-rose: "#c4688a"
  tag-teal: "#5f98a8"
  tag-ochre: "#b4893f"
  tag-moss: "#6f8a3e"
  tag-stone: "#8a857a"
  tag-periwinkle: "#7b93c4"
typography:
  display:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "clamp(50px, 6.4vw, 84px)"
    fontWeight: 400
    lineHeight: 0.93
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "44px"
    fontWeight: 400
    lineHeight: 1
  title:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "19px"
    fontWeight: 500
    lineHeight: 1.22
  quote:
    fontFamily: "Newsreader, Georgia, serif"
    fontSize: "25px"
    fontWeight: 400
    lineHeight: 1.24
  body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  control:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
  label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
    letterSpacing: "0.1em"
rounded:
  sm: "6px"
  media: "10px"
  note: "12px"
  bar: "12px"
  panel: "18px"
  pill: "999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "24px"
  "6": "32px"
  card-gap: "10px"
  section: "26px"
  grid-x: "28px"
  grid-y: "34px"
components:
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "4px 12px"
  button-ghost-hover:
    backgroundColor: "{colors.hover}"
  button-primary:
    backgroundColor: "{colors.solid}"
    textColor: "{colors.solid-text}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "4px 12px"
  pill-kind:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.pill}"
    height: "38px"
  pill-kind-selected:
    backgroundColor: "{colors.solid}"
    textColor: "{colors.solid-text}"
  input-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "8px"
  card-note:
    backgroundColor: "{colors.note-paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.note}"
    padding: "18px 18px 16px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
  toast:
    backgroundColor: "{colors.solid}"
    textColor: "{colors.solid-text}"
    rounded: "{rounded.pill}"
    padding: "10px 18px"
---

# Design System: Folia

## 1. Overview

**Creative North Star: "The Studio Shelf"**

The library is a shelf in someone's own studio: pictures pinned at their natural shape, quotes set like type, notes on slips of paper, all of it slowly yellowing where nobody has touched it. The page is warm paper and dark ink, set in a book serif. The furniture is quiet so the things on it can be loud. Pictures carry the colour, and the chrome stays neutral.

Time is the one design element that belongs to this product alone. Everything saved carries a single age value, and that value drives sepia on images, dust specks, paper turning from `note-paper` to `aged-paper`, ink fading to `aged-ink`, and a slight tilt. Ageing is what the product says: it shows you what you forgot. Treat it as content, never as ornament, and always say it in words too, so the age text on the card means the same as the patina.

The system rejects productivity SaaS: dashboards, counts as the hero, streaks, nudges, upsell banners, card grids with icon, heading and text. It is not a database UI either. No tables, no folder trees, no row striping. The library ships as four themes over one token set: Default (paper and ink), Contact sheet (a cool proof sheet with square corners and Cormorant Garamond), Covers (magazine covers on a shelf, set in Bodoni Moda) and Colour field (a dark room of coloured light, with frosted panels). The tokens below are the Default theme in light mode. Each theme overrides the same custom properties on `:root[data-theme=…]` and never adds its own components.

**Key Characteristics:**
- Warm paper ground, near-black ink, one slate accent used sparingly.
- Book serif for anything you'd read (titles, quotes, notes, headlines), Geist for controls, and Geist Mono for meta and counts.
- A masonry grid of media at natural aspect ratios, with no card chrome on links, pictures or quotes.
- Patina driven by `--t` from 0 to 1, transitioned over 600ms.
- Pill-shaped ghost controls 44px tall, with one solid button per view at most.
- Light and dark on every theme, through `data-appearance` on `<html>` or the system setting.
- Motion is felt rather than watched: lifts, fades, an ease-out-expo, no bounce. Reduced motion switches all of it off.

## 2. Colors

A warm paper and ink palette held almost entirely in neutrals. The colour comes from what people saved and from eight tag inks.

### Primary
- **Slate Ink** (`accent-slate`): the hanging quote mark, focus accents and the tag-input focus ring. In dark mode it becomes **Lamplight Yellow** (`night-accent`). It covers well under 5% of any screen.

### Secondary
- **The eight tag inks** (`tag-terracotta` through `tag-periwinkle`): each mark colour has a darker text variant (`--tag-N-text`) that passes 4.5:1 on the ground in its mode. They go to the eight most-used top-level tags and nothing else. A selected tag gets a highlighter band in its mark colour at 40% alpha, running from 55% to 92% of the line height. It is a stroke, not a box, and the selected name turns ink on it so it keeps 4.5:1.

### Tertiary
- **Aged Paper** (`aged-paper`) and **Aged Ink** (`aged-ink`): the colours a thing turns when it's left alone. They are mixed in with `color-mix()` by `--t`, never applied as flat states. Aged ink on aged paper holds 4.74:1 (6.29:1 in dark).
- **Spent Gold** (`age-done`): Look ahead ticks for time already passed.
- **Rust** (`danger-rust`): dead links and destructive actions only.

### Neutral
- **Warm Paper** (`ground`): the page.
- **Fresh Sheet** (`surface`): panels, the search field, inputs, stamps and fresh notes.
- **Studio Ink** (`ink`): body text and titles. **Faded Ink** (`ink-muted`): meta, captions and counts (6.08:1 on the ground).
- **Hairline** (`border`, 12% ink) and **Pencil Line** (`border-strong`, 26% ink): media inset rings and dividers; ghost buttons, pill outlines and the dashed note field.
- **Night Room** (`night-ground`, `night-surface`, `night-ink`, `night-ink-muted`): the dark mode, a blue-black room rather than grey. It is the same palette with the lights off.

### Named Rules
**The Pictures Carry the Colour Rule.** Chrome stays neutral, so the saved images and the tag inks are the only saturated things on screen. Don't tint panels, buttons or headers with a brand hue.

**The Patina Is Data Rule.** Sepia, dust, aged paper and tilt come only from `--t`. Never use them for decoration, for empty states or for "warmth".

**The Eight Inks Rule.** Only the eight most-used tags get a colour. Every other tag is plain `ink`. Don't add a ninth slot.

## 3. Typography

**Display Font:** Newsreader, a variable optical-size serif (fallback Georgia)
**Body Font:** Geist (fallback system-ui)
**Label/Mono Font:** Geist Mono (fallback ui-monospace)

**Character:** a bookish serif with optical sizing for everything worth reading, against a plain modern sans for the controls. Mono is the catalogue card: the small dated label under each thing. All three are self-hosted woff2, because the library must work offline.

### Hierarchy
- **Display** (400, `clamp(50px, 6.4vw, 84px)`, line-height 0.93, -0.025em): the one headline in the library hero, with its last word in italic ("Everything you *kept.*").
- **Headline** (400, 44px): the Look ahead month, with the year in italic muted ink. The index letters use serif italic 300 at 64px.
- **Title** (500, 19px, line-height 1.22, `text-wrap: pretty`, three lines at most): card titles.
- **Quote** (400, 25px, or 21px when the quote runs over 60 characters, line-height 1.24, eight lines at most): quote cards. Note bodies are serif italic 19px with a line-height of 1.35.
- **Body** (Geist 400, 14px, line-height 1.45): dialogs, explainers and settings. Keep prose to 65–75ch.
- **Control** (Geist 500, 13px): buttons, pills and selects.
- **Label** (Geist Mono 400, 11px, `ink-muted`): card meta and age text. The hero summary line is the one place it is uppercase, with 0.1em tracking.

### Named Rules
**The Read It or Click It Rule.** Serif is for things you read, sans is for things you click, mono is for things you scan. A button is never serif, and a quote is never sans.

**The One Uppercase Line Rule.** The hero summary ("18 KEPT · 8 LINKS · …") is the only uppercase tracked text in the library. Don't add eyebrows above sections.

## 4. Elevation

Flat by default. Depth comes from the things themselves: a blurred halo of each image's own colour behind the media (`--halo-strength` 0.22 light, 0.32 dark), a 1px inset hairline ring on media and notes, and tonal steps from ground to surface. Real shadows are kept for things that float above the page.

### Shadow Vocabulary
- **Popover** (`box-shadow: 0 4px 16px rgb(0 0 0 / 0.12)`): tag suggestions and dropdowns.
- **Menu** (`box-shadow: 0 10px 30px rgb(0 0 0 / 0.14)`): the More menu.
- **Toast** (`box-shadow: 0 4px 16px rgb(0 0 0 / 0.2)`): the undo toast.
- **Media ring** (`box-shadow: inset 0 0 0 1px var(--border)`): card media and note cards. It is an edge, not a lift.
- Theme-only: Covers puts a shelf shadow under each row (`0 10px 14px -8px rgba(60,40,10,.45)`), and Colour field uses `--lift` (`0 20px 40px -24px rgba(0,0,0,.6)`) under its frosted panels.

### Named Rules
**The Halo Not Shadow Rule.** A card lifts by moving 4px up while its own-colour halo brightens 2.2×. Never add a grey drop shadow to a card.

## 5. Components

The furniture is soft and quiet. It's pill-shaped, outlined and out of the way, so the saved things are what you see.

### Buttons
- **Shape:** full pill (999px), at least 44px tall. Every button is a ghost by default.
- **Ghost:** transparent with a 1px `border-strong` outline, `ink` text and Geist 13px. On hover it fills with `hover` (6% ink).
- **Primary (solid):** `solid` fill with `solid-text` and weight 500. On hover it brightens with `filter: brightness(1.07)`. Use one per view at most ("Add from a post", "Keep", "Import your Edge favorites").
- **Link:** no box, underlined with a 3px offset; on hover the underline thickens to 2px. It is used for Edit, "clear filters", "and 3 more" and toast actions.
- **Danger:** a ghost with `danger-rust` text. Never a red fill.
- **Disabled:** 35% opacity, default cursor.
- **Focus:** a 2px `currentColor` outline offset 3px on everything (1px on text fields).

### Chips
- **Kind pills** (Everything, Links, Quotes, Pictures, Notes): 38px ghost pills with Geist 500 labels. When selected or pressed they invert to `solid` and `solid-text`.
- **Platform chip:** sits over the media, top-left and 10px in. It has a `rgba(255,255,255,0.92)` fill, `#15171A` text, mono 11px and a 4px radius.
- **Dead-link stamp:** "MAY BE DEAD" in mono 10px 500 with 0.08em tracking, in `danger-rust` with a 1.5px border on `surface`, a 4px radius and a 4° rotation. It is the one rotated label in the system.

### Cards
- **No chrome on links, pictures or quotes.** An `<article>` has no background or border of its own: the media is the card. Media keeps its natural aspect ratio (links are clamped between 4:5 and 2:1, pictures aren't clamped), with `rounded.media` (10px) and the hairline ring.
- **Quote card:** no box. A 70px serif quote mark in the accent hangs at the top-left, the text is set in the quote style, and the source title follows in serif italic 15px muted ink.
- **Note card:** the only boxed card. It has a `note-paper` fill, `rounded.note` (12px), a hairline ring and 18px padding, with a mono "your note · Oct 22" line above serif italic text.
- **Meta row:** mono 11px muted with a 30px minimum height. The source and age text are joined by " · ", for example "fieldnotes.substack.com · untouched 9 mo.".
- **Hover and focus:** the media lifts 4px over 220ms (`--ease-out`), the halo brightens, the title is underlined, and Edit fades in over 150ms. On touch screens, Edit stays at 70% opacity and nothing lifts.
- **Grid:** masonry with columns at least 230px wide, 28px between columns and 34px down a column, up to four columns, in a centred column 1280px wide at most.

### Inputs / Fields
- **Style:** `surface` fill, a 1px `border-strong` stroke, `rounded.sm` (6px) and 8px padding. The library search field is a 50px pill.
- **Focus:** a 2px outline offset 1px. The tag input draws its ring on the container in the accent.
- **Placeholder:** same contrast rule as body text (4.5:1).

### Navigation
- **Header:** the wordmark in serif 26px on the left. On the right are ghost pills (More ▾, the appearance toggle) and a single solid button. There are no tabs or sidebar: the library is one room.
- **Tag strip:** "Most used" followed by tag names in their inks, with mono counts in superscript and a hairline above and below. "Open the index · 78" opens the tag index panel (`rounded.panel`, 18px).

### Look ahead (signature)
A `surface` panel with `rounded.panel` (18px). It has a serif month heading with ‹ › steppers, a row of ticks (passed ticks in `age-done`), and a plain sentence such as "5 things have gone yellow". Stepping the month re-renders `--t` across the grid, so the whole library ages or un-ages in place over 600ms.

### Motion (folded in)
Use `--ease-out` (`cubic-bezier(0.2, 0.7, 0.2, 1)`) for state changes and `--ease-out-expo` (`cubic-bezier(0.16, 1, 0.3, 1)`) for arrivals. `--dur-fast` is 220ms and `--dur-age` is 600ms. Animate only transform, opacity, filter and colour. There is no overshoot or spring anywhere. Under `prefers-reduced-motion: reduce`, every animation and transition is off and state changes happen instantly.

## 6. Do's and Don'ts

### Do:
- **Do** take every colour, radius and length from the custom properties in `src/styles/base.css`, so the Contact sheet, Covers and Colour field themes can swap them.
- **Do** let saved media keep its natural aspect ratio. Clamp it (4:5 to 2:1 for links) rather than crop it to a uniform tile.
- **Do** drive every sign of age from `--t`, and always say the same thing in words in the meta row ("untouched 14 mo.").
- **Do** keep text at 4.5:1 or better in every theme, both appearances and every age, including `aged-ink` on `aged-paper` and muted ink on Colour field glass.
- **Do** make every clickable thing at least 44×44px, or at least 8px from its neighbours where a row forces it smaller.
- **Do** write controls in Geist and anything worth reading in Newsreader (or the theme's display serif).

### Don't:
- **Don't** make it look like productivity SaaS: no dashboards, no streaks, no nudges, no upsell banners, and no big number with a small label as a hero.
- **Don't** turn the library into a database: no tables, folder trees, zebra rows or column headers.
- **Don't** put the same box around every card. Only notes get a box.
- **Don't** use `border-left` or `border-right` over 1px as a coloured stripe. Quotes are marked by the hanging quote mark.
- **Don't** add drop shadows to cards, or blurred glass outside the Colour field theme.
- **Don't** use sepia, dust, tilt or aged paper as decoration on anything fresh, on empty states or on marketing frames that aren't showing ageing.
- **Don't** use gradient text, bounce or elastic easing, or animate width, height or position.
- **Don't** add uppercase tracked eyebrows above sections. The hero summary line is the only one.
- **Don't** give a tag a colour outside the eight inks, or tint the chrome with a brand hue.
