# Publishing checklist

## Blockers in the code (fix before uploading)

1. ~~No icons~~ Done: placeholder icons in `public/icons/` (regenerate with `node store/make-icons.mjs`, or replace with a real logo; keep the same filenames).
2. ~~Edge-only wording~~ Done.
3. **Check `chrome://` and Web Store pages.** Screenshots and script injection are blocked there; the message in (2) covers it, but test it in Chrome.
4. **Test in real Chrome** (116 or newer, per `minimum_chrome_version`): load `dist/` via `chrome://extensions` → Developer mode → Load unpacked, and walk through every feature. `sidePanel`, `_favicon` and `captureVisibleTab` can behave slightly differently from Edge.
5. **Version.** Bump `version` in `public/manifest.json` and `package.json` together for every upload (the store rejects a repeated version).

## One-time account setup

- Register at the Chrome Web Store Developer Dashboard with a Google account (a one-time registration fee, currently US$5, which you pay yourself).
- Turn on 2-step verification on that account; it is required to publish.
- Verify your contact email in the dashboard.

## Making the package

```bash
npm run build
```

Zip the **contents** of `dist/` (so `manifest.json` is at the zip's root, not inside a folder). Don't include `node_modules`, sources or `.map` files.

## Privacy policy hosting

The store needs a public URL. Easiest options: a GitHub Pages page or a public GitHub gist/repo file rendering `store/privacy-policy.md`, or a Google Doc published to the web. Paste that URL in the Privacy tab.

## Dashboard steps

1. Upload the zip.
2. Store listing tab: paste copy from `listing.md`, upload icon, screenshots, small promo tile.
3. Privacy tab: single purpose, each permission justification, remote-code answer, data-usage boxes, certifications, privacy policy URL.
4. Distribution tab: visibility, regions.
5. Submit for review.

## Expect a slower review

`<all_urls>` together with `scripting` and `tabs` is a broad combination, so extensions asking for it are commonly given a longer review and sometimes follow-up questions. Make the justifications specific (they are in `listing.md`) and make sure every one matches what the code really does. Review time varies and is not something I can predict.

## After approval

- Updates go through review again.
- Keep the policy URL live permanently.
- Remind users to back up: uninstalling deletes the library.
