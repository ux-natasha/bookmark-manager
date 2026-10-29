# Bookmark Manager: Privacy Policy

_Last updated: 26 October 2026_

Bookmark Manager is a browser extension that keeps a visual library of the pages, links, pictures, quotes and notes you choose to save.

## The short version

Your library stays on your computer. The developer does not receive, collect, sell or share your data. There are no accounts, no analytics and no tracking.

## What the extension stores, and where

When you save something, the extension stores in your browser's local storage (IndexedDB and `chrome.storage`) on your device:

- the page address (URL), title, description and preview image;
- a screenshot of the page, if you saved the page you were viewing;
- the readable text of saved pages, so you can search them and read them if they disappear;
- pictures and quotes you saved, and notes you wrote;
- your tags and your interface preferences.

This data never leaves your device through the extension, except as described below. Uninstalling the extension deletes it. You can export a backup (a JSON file saved where you choose) and restore it later.

## Network requests the extension makes

The extension makes requests only to carry out features you use:

- **To the sites you saved, imported or pasted.** To read a link's title, description and preview image, to check whether it still works, to follow short links to their real address, and to download a picture you chose to keep, the extension requests that page or file directly from its own site. Like any browser visit, that site can see your IP address and that a request was made. Requests are limited to one per site every 1.5 seconds.
- **To read public posts when you paste a post's link.** Depending on the platform: X's public embed service (`publish.twitter.com`), Bluesky, Mastodon, Reddit and Hacker News public APIs, and LinkedIn's public post page. The post's address is sent to that service so it can return the post's text.
- **To the browser's favicon service**, locally within your browser, to show site icons.

The extension does not send your library, your tags, your notes or your browsing history to the developer or to any other server.

## Permissions

The extension asks for broad access to websites (`<all_urls>`) because you can save a link from any site. It uses that access only for the actions above, and only for pages you saved, imported or pasted, or the page you are viewing when you click Save. It does not read pages in the background as you browse. The `bookmarks` permission is used only when you press "Import favorites", and is read-only.

## Sharing

I do not sell your data, share it with third parties, or use it for advertising, creditworthiness or any purpose unrelated to the extension's single purpose of keeping your bookmark library.

## Children

The extension is not directed at children and collects no personal information from anyone.

## Changes

If this policy changes, the new version will be posted at this address with a new date.

## Contact

Questions: k.natasha140@gmail.com
