# Bookmark Manager

A visual bookmark manager for Edge and other Chromium browsers. Everything is stored locally in the browser.

## Load it in Edge

1. `npm install` (first time only)
2. `npm run build`. This creates the `dist/` folder.
3. Open `edge://extensions`, turn on **Developer mode**, click **Load unpacked** and pick the `dist` folder.
4. Pin the extension to the toolbar (puzzle-piece icon → eye icon).

While working on it, `npm run dev` rebuilds `dist/` on every change. After a rebuild, click the reload arrow on the extension's card in `edge://extensions` and reopen the side panel.

To change the keyboard shortcut, go to `edge://extensions/shortcuts`.

## How it works

| Action | What happens |
|---|---|
| Click the icon, or `Alt+Shift+S` | Saves the current page and opens the side panel to add tags or a note |
| Right-click a link → *Save link to Bookmark Manager* | Saves the link without opening it. A ✓ flashes on the icon (`=` if it was already saved) |
| *Open library ↗* in the side panel | Opens the full library in a tab |
| *Refresh my memory* in the library | Shows a few old bookmarks you haven't opened in a long time |
| *Import favorites* | Copies Edge favorites in, skipping duplicates. Edge's own favorites aren't changed |
| *Add from a post* in the library | Paste a post's link or text; the sites it mentions are listed for you to tag and save |
| *Find links in this post* in the side panel | Same, read straight from the post you have open (works for logged-in-only posts) |
| *Back up* / *Restore* | Exports or merges a JSON backup |
| *Check links* in the library | Re-checks every link in the background and flags ones that seem dead |

**Back up regularly:** uninstalling the extension deletes its library.

## Previews and details

- **Saving the page you're on** takes a screenshot and reads the page's details from what you see, including logged-in pages.
- **Imported and right-clicked links** are fetched in the background, a few at a time and no more than one request per site every 1.5 seconds. The library shows progress. Anything unfinished resumes when Edge starts, and the extension retries hourly.
- **Two kinds of preview** are kept: the screenshot and the site's own preview image. Cards show the image for regular sites and the screenshot for social posts, and you can pick the other in *Edit*. Pages with neither get a colored card in the site's brand color.
- **Platform** (Substack, X, YouTube, GitHub…) is detected from the address, and from clues in the page for platforms on custom domains (Substack, Medium, Ghost, WordPress).
- **Dead links:** a link counts as dead if the site says the page doesn't exist (404/410), or if it doesn't answer in two checks at least six hours apart. Sites that block bots aren't flagged, because we can't tell.

## Links from posts

- **Pasting a post's link** reads it from each platform's public data: X (embed service), Bluesky, Mastodon, Reddit and Hacker News (their APIs), and LinkedIn's public post page. Threads, Instagram and Facebook hide posts from anyone not logged in, so for those open the post and use *Find links in this post* in the side panel.
- **Pasting a post's text** finds full links and bare ones like `figma.com/community`. Addresses the post cut short (`figma.com/commu…`) become the site's home page, marked as such and left unticked.
- **Short and redirect links** (t.co, bit.ly, lnkd.in, Instagram's and Threads' "leaving" links…) are followed to the real address, and tracking and affiliate tags (`utm_…`, `?via=`) are removed.
- **Left out:** links back to the same platform (profiles, hashtags), the post's images and videos, and "share this" buttons.
- **Review before saving:** each link shows its title and whether it's new or already saved. New links are ticked; links already in the library only change if you add tags. Each saved link remembers which post it came from (shown in *Edit*, and searchable).
- On a page that isn't a post, *Find links on this page* reads the page's main article, or the whole page if it has none. Nothing is ticked there, since menus and ads get picked up too.

## Project layout

- `src/background.ts`: icon click, shortcut and right-click saving
- `src/sidepanel/`: the side panel
- `src/library/`: the full library tab
- `src/lib/`: data model (`db.ts`), saving and duplicate detection (`bookmarks.ts`, `normalize.ts`), import, backup and resurfacing, links from posts (`posts.ts`, `linkfinder.ts`)
- `src/styles/base.css`: design tokens. All colors, spacing and type sizes live here for the design pass

`npm test` runs the unit tests for duplicate detection, saving, page details and finding links in posts.
