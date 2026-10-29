# What Sets Folia Apart

Oct 28, 2026 · @Nat · revised Oct 29, 2026

Folia's edge is that it shows you what you've forgotten, in a library that feels like a place rather than a list. Being free and needing no separate app help people say yes, but they don't set it apart.

Folia is the working name (it's on the landing page). The manifest and README still say Bookmark Manager.

## What Folia does today

All of this is in the repo now, version 0.2.0.

- **Saving:** a toolbar click or Alt+Shift+S saves the page with a screenshot of what you actually saw, logged-in pages included. Right-click saves a link, picture, quote or video without leaving the page, and GIF and video links keep a moving preview. Notes of your own, with tags. A side panel shows what you're saving and lets you tag it there.
- **Previews:** a screenshot or the site's own image, and a card in the site's brand colour when there's neither. The Covers theme typesets a cover from the page's own details.
- **Finding:** search across titles, tags, notes and quote text; filter by kind or site; search by colour; an A–Z tag index. The Contact sheet theme adds catalogue codes like `LNK·014`.
- **Links from posts:** paste a post from X, Bluesky, Mastodon, Reddit, Hacker News or LinkedIn, or read one you have open (which also covers Threads and posts behind a login). You get every site it mentions, with short links followed and tracking tags removed, and you tick which to keep.
- **Ageing:** things you don't open age visibly, reaching full age at 24 months. Look ahead shows the library up to 24 months on, and Refresh my memory resurfaces what you've neglected.
- **Four themes, light and dark,** each with its own layout and its own way of ageing: Default, Contact sheet, Covers and Colour field.
- **Housekeeping:** dead-link checks, duplicate detection that ignores tracking tags, tidying up unused tags, a trash that keeps deleted things for 30 days, and JSON back up and restore.
- **Import:** reads the browser's own bookmarks (Edge favourites or Chrome bookmarks) without changing them. Imported things start fresh and age from the day they arrive.
- **Privacy:** stored in the browser, with no account, no server, no analytics and an MIT licence.

## What the popular ones do

Most visual bookmark managers keep your library in their cloud. The few that don't ask you to run your own server.

| Product | Model | Where your data lives | How it's visual |
| --- | --- | --- | --- |
| [Raindrop.io](https://raindrop.io/pro) | Free forever with unlimited bookmarks (100 MB of uploads a month); Pro about $3/mo or $28/yr | Their cloud | Thumbnail cards. Full-text search, permanent copies, broken-link and duplicate finders and the AI assistant are Pro |
| [mymind](https://access.mymind.com/pricing) | Paid only: The Bookmarker $4.99/mo (no AI), Student $7.99, Mastermind $12.99 | Their cloud | Visual cards and AI tagging. Colour and object search are part of its AI image search; Serendipity resurfaces old cards (which plans include it isn't confirmed) |
| [Cosmos](https://www.cosmos.so/support) | Free plan with the core features; Premium $8/mo or $6/mo yearly | Their cloud | Visual pinboard with AI tags. Public and social: others can follow your clusters |
| [Are.na](https://help.are.na/docs/getting-started/premium-features) | Free up to 200 connections; Premium paid | Their cloud | Channels of blocks. Social, research-minded |
| [Karakeep](https://www.linuxlinks.com/karakeep-self-hostable-bookmark-everything-app), [Linkwarden](https://linkwarden.app/pricing) | Free and open source, self-hosted; Linkwarden cloud $3 per user per month, up to 30,000 links | Your own server | Previews, full-page archives, AI tags (Karakeep) |
| [Eagle](https://www.hackdesign.org/toolkit/eagle/) | $29.95 one-time | Your computer | Desktop app for images and design assets, not web pages |
| [Anybox](https://alternativeto.net/software/anybox/about) | Freemium, Mac and iOS only | Their cloud, synced | Link cards with Open Graph previews |
| [Toby, Papaly, Dropmark](https://blog.send.win/chrome-extension-for-bookmark-management-2026/) | Freemium extensions | Their cloud | Speed-dial boards and tab sessions |

Pocket shut down on 8 July 2025, and saved data was deleted after the export window closed on 8 October 2025 ([TechRadar](https://www.techradar.com/computing/websites-apps/pocket-shuts-down-today-heres-how-to-get-your-data-before-the-app-closes-plus-the-3-best-alternatives)). That left a lot of people looking for a new home for their saved links, but Folia can't import a Pocket or Raindrop export yet (see Gaps).

## What sets Folia apart

Four things are unique to Folia, four more beat most competitors, and two are true but won't win anyone over on their own.

### Nobody else does this

1. **Neglect is visible.** Things you don't open yellow, bleach or fade, and Look ahead shows the library in two years. Others resurface items (mymind's Serendipity, Cosmos's AI); none of the products above show time passing on the item itself.
2. **Themes are whole worlds, not colour schemes.** Each changes the layout and how things age, and has its own word for bringing them back. Competitors stop at dark mode.
3. **Typeset covers.** A newsletter becomes a masthead, a repo a terminal, built from the page's details. Everyone else shows the Open Graph image or a screenshot.
4. **Every link in a post.** Others save the post. Folia pulls out every site it mentions, cleans the links and lets you tick which to keep, even from posts behind a login.

### Better than most

5. **Colour search, free and on your computer.** In mymind it's part of a paid AI image search; here it needs no AI, no cloud and no subscription.
6. **Private with zero setup.** mymind says it's private but keeps your data on its servers. Karakeep and Linkwarden keep it yours, but you need a server and Docker. Folia has no account and nothing to host.
7. **Captures what you actually saw.** The screenshot is taken in your own browser, so logged-in pages, paywalls and private posts look right. Tools that fetch pages from their own servers can't see behind your login.
8. **Housekeeping others charge for.** Raindrop puts its broken-link and duplicate finders behind Pro. Folia includes both, plus a 30-day trash.

### True, but not a reason to switch on its own

9. **It's free.** Raindrop's free plan is already unlimited, and Cosmos has a free plan too, so free alone won't win anyone over. It works as part of "free, open source, and nobody holds your data".
10. **No separate app.** Most competitors also have a browser extension. The real point is narrower: no separate service or account at all, because the library is a tab in your own browser.

## Gaps people will compare Folia on

- No sync between computers and no phone app (a phone app is planned).
- Chromium browsers only (Chrome or Edge 116 and later); no Firefox or Safari.
- Not in the Chrome Web Store or Edge Add-ons yet, and installing currently needs `npm run build` and loading the unpacked folder.
- No import from Pocket, Raindrop, mymind or Netscape HTML bookmark files, only from the browser's own bookmarks. This matters most for people leaving Pocket.
- No saved full-text copy of pages (Raindrop Pro, Karakeep and Linkwarden archive them), so search doesn't reach the body of an article.
- Uninstalling deletes the library unless you've backed it up, and there is no automatic backup.
- No sharing or public boards, which Cosmos and Are.na are built around. That's a deliberate choice for a private room, but it will come up.

## My take

Free and no separate app support the decision to try Folia, but they aren't why anyone would choose it. Raindrop is about organising, mymind is about AI that remembers for you, and Cosmos is about a public pinboard.

Folia's own lane is that **it shows you what you've forgotten**, in a library that feels like a place rather than a list. That rests on four things: ageing, rooms, covers and colour. "Private, free, nothing to set up" then makes it an easy yes.

Two things would widen the door most: importing a Pocket or Raindrop export, so the people Pocket left behind can move in with their library, and getting into the Chrome Web Store and Edge Add-ons, so installing doesn't need a build step.

The extension is still called "Bookmark Manager" in its manifest. The store notes (`store/listing.md`) already say that name is generic and hard to find in search, so if Folia is the name, change `name` in `public/manifest.json`, the toolbar and context-menu text, and the README together.

## Sources

- [Raindrop Pro](https://raindrop.io/pro)
- [Raindrop pricing breakdown (ContextBolt, which sells a competing tool)](https://contextbolt.com/blog/raindrop-pricing/)
- [mymind pricing](https://access.mymind.com/pricing)
- [mymind's Bookmarker plan (AlternativeTo)](https://alternativeto.net/news/2025/10/mymind-introduces-more-affordable-plan-for-unlimited-visual-bookmarks)
- [mymind on the App Store](https://apps.apple.com/app/id1520332347)
- [Cosmos support and Premium](https://www.cosmos.so/support)
- [Cosmos (AlternativeTo)](https://alternativeto.net/software/cosmos--visual-pinboard/about)
- [Pocket shutdown (TechRadar)](https://www.techradar.com/computing/websites-apps/pocket-shuts-down-today-heres-how-to-get-your-data-before-the-app-closes-plus-the-3-best-alternatives)
- [Karakeep (LinuxLinks)](https://www.linuxlinks.com/karakeep-self-hostable-bookmark-everything-app)
- [Linkwarden pricing](https://linkwarden.app/pricing)
- [Are.na premium features](https://help.are.na/docs/getting-started/premium-features)
- [Eagle (Hack Design)](https://www.hackdesign.org/toolkit/eagle/)
- [Anybox (AlternativeTo)](https://alternativeto.net/software/anybox/about)
- [Chrome bookmark extensions roundup (Send.win)](https://blog.send.win/chrome-extension-for-bookmark-management-2026/)
- [Repo (ux-natasha/bookmark-manager)](https://github.com/ux-natasha/bookmark-manager)
