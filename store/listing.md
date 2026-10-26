# Chrome Web Store listing: copy to paste in

## Store listing tab

**Name** (matches manifest): Bookmark Manager
(Consider something more distinctive; "Bookmark Manager" is generic and crowded in search. Whatever you choose, change `name` in `public/manifest.json` to match.)

**Summary** (max 132 characters, comes from manifest `description`):
> A visual bookmark manager that makes you want to look at your bookmarks.

**Category:** Productivity
**Language:** English

**Detailed description:**

```
Bookmark Manager turns your saved links into a library you actually want to open. Every page gets a cover: a screenshot, the site's own preview image, or a colour card in the site's brand colour. Everything is stored on your computer.

SAVE FROM ANYWHERE
• Click the toolbar icon or press Alt+Shift+S to save the page you're on, then add tags or a note in the side panel.
• Right-click a link to save it without opening it.
• Right-click a picture to keep a copy, linked to the page it came from.
• Select text, right-click, and save it as a quote.
• Write notes of your own, with tags.

A LIBRARY THAT'S PLEASANT TO BROWSE
• A card layout with covers, three visual themes, and light and dark appearance.
• Search across titles, tags, notes and quotes. Search by colour.
• Filter by kind: pages, pictures, quotes, notes.

KEEP IT HEALTHY
• Refresh my memory: resurfaces a few old bookmarks you haven't opened in a long time.
• Check links: flags pages that appear to be dead (404/410, or unreachable in two checks at least six hours apart).
• Duplicate detection ignores tracking tags (utm_ and similar) and www/http differences.
• Import your existing browser bookmarks (read-only; your browser's own bookmarks are not changed).
• Back up and restore your whole library as a JSON file.

LINKS FROM POSTS
Paste a post's link or text (X, Bluesky, Mastodon, Reddit, Hacker News, LinkedIn) and see every site it mentions, ready to tag and save. Use "Find links in this post" in the side panel to read a post you have open, including logged-in-only posts.

PRIVATE BY DESIGN
Your library lives in your browser's local storage. There is no account, no sync server and no analytics. See the privacy policy for the few network requests the extension makes and why.

Note: uninstalling the extension deletes its library, so use Back up regularly.
```

**Screenshots:** 1280×800 (or 640×400), 24-bit PNG or JPEG, up to 5, at least 1. See `screenshots.md`.
**Small promo tile:** 440×280 (required).
**Marquee promo tile:** 1400×560 (optional).
**Icon:** 128×128 PNG (required; see "Blockers" in `checklist.md`).

---

## Privacy tab

**Single purpose** (one sentence; the review team checks every feature against this):
> Save web pages, links, pictures, quotes and notes into a visual, searchable bookmark library stored locally in the browser.

**Permission justifications** (one box per permission):

| Permission | Justification |
|---|---|
| `sidePanel` | Shows the panel where the user adds tags or a note right after saving a page, and the "Find links in this post" tool. |
| `storage` | Remembers small UI preferences (theme, last save, background-check progress). |
| `unlimitedStorage` | The library (including screenshots and saved pictures) is stored in IndexedDB and can exceed the default quota. |
| `bookmarks` | Used only when the user clicks "Import favorites": reads the browser's bookmarks, read-only, to copy them into the library. Nothing in the browser's own bookmarks is changed. |
| `contextMenus` | Adds "Save link / picture / quote to Bookmark Manager" to the right-click menu. |
| `tabs` | Reads the active tab's URL and title to save it, takes a screenshot of the visible tab on save (`captureVisibleTab`), and focuses an already-open library tab instead of opening a duplicate. |
| `favicon` | Shows each site's icon on its card using the browser's own favicon cache. |
| `alarms` | Schedules an hourly retry of background preview fetching and link checks that didn't finish. |
| `scripting` | When the user saves the page they are on, or a quote or picture from it, reads the page's title, description, preview image and the selected text or picture from that page. Also used by "Find links in this post" on the page the user has open. Runs only in response to a user action. |
| Host permission `<all_urls>` | Users save links from any site, so the extension must read the title, description and preview image of any page they save, check whether saved links still work, and download pictures they choose to keep. Requests are made only for URLs the user saved, imported or pasted, rate-limited to one request per site every 1.5 seconds. |

**Remote code:** No. All code is bundled in the package; fonts are bundled locally. (Answer "No, I am not using remote code".)

**Data usage disclosure** (check boxes). The extension handles the following, all kept on the user's device and not transmitted to the developer:
- ☑ **Web history** (the URLs of pages the user saves)
- ☑ **Website content** (page titles, descriptions, screenshots, saved text and pictures)
- ☑ **Personally identifiable information / user activity**: tick only if you judge notes the user writes count; notes are stored locally. When unsure, disclose rather than omit.
- ☐ Health, financial, authentication, location, communications: none

**Certifications** (tick all three; they are true for this extension as written):
- ☑ I do not sell or transfer user data to third parties outside the approved use cases.
- ☑ I do not use or transfer user data for purposes unrelated to the item's single purpose.
- ☑ I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** host `privacy-policy.md` somewhere public (see `checklist.md`) and paste the URL.

---

## Distribution tab

- Visibility: Public (or Unlisted while you test with friends)
- Regions: all
- Pricing: free
