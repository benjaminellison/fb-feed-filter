# Facebook Feed Filter

A Chrome extension (Manifest V3) that hides sponsored posts and suggested-page posts on Facebook behind a translucent overlay so you can decide whether to engage with them anyway. Uses a **weighted-rule scoring system**: every rule a post matches contributes points, and the post is hidden when the total reaches a configurable threshold.

![Filter overlay](icons/icon128.png)

## Why

Facebook's feed is increasingly stuffed with sponsored content and "you might like" page suggestions from accounts you've never followed. The point of this extension isn't to make them invisible — it's to make them *obvious*, so they cost a click instead of slipping past your attention.

## How it works

For each post (`div[role="article"]`) the extension finds in the feed, it runs every enabled rule. Each rule that matches contributes its `weight` to a running score. If the total ≥ threshold, the post gets a translucent black overlay showing the score and which rules contributed.

Default rules:

- **sponsored** — matches if the post contains any link to `l.facebook.com/l.php` (Facebook's external-redirect domain, used by ads).
- **follow-suggestion** — matches if the post header contains a `<div role="button">` whose text is `Follow` (i.e. a page you don't currently follow).

Both rules fire at weight `1.0` with a threshold of `1.0`, so either signal alone is enough to hide the post.

Click the overlay to reveal that one post. Press **Alt+H** to reveal everything; press it again to re-hide. Hover the overlay for the full score breakdown.

## Install

Chrome doesn't have this extension in its Web Store, so you have to load it manually. It's only a few steps:

1. **Download the code as a ZIP.**
   - At the top of this page, click the green **Code** button.
   - In the menu that drops down, click **Download ZIP**. Your browser will save a file called `fb-feed-filter-main.zip` (probably to your Downloads folder).

2. **Unzip it.**
   - Find the ZIP in your Downloads folder.
   - Right-click it and choose **Extract All...** (Windows) or double-click it (Mac).
   - You'll get a folder called `fb-feed-filter-main`. Move it somewhere you won't accidentally delete — your Documents folder is fine. **Remember where you put it.**

3. **Open Chrome's extensions page.**
   - In Chrome, type `chrome://extensions` into the address bar and press Enter.

4. **Turn on Developer mode.**
   - Look in the top-right corner of that page for a switch labeled **Developer mode**. Click it on.

5. **Load the extension.**
   - Three buttons will appear near the top-left: **Load unpacked**, **Pack extension**, **Update**.
   - Click **Load unpacked**.
   - A file-picker window opens. Navigate to the `fb-feed-filter-main` folder you unzipped in step 2 and select it (don't go inside it — just highlight the folder and click **Select Folder**).

6. **Done.** Open or refresh [facebook.com](https://www.facebook.com) — sponsored posts and follow suggestions should start getting overlays.

### If you need to update the extension later

If you download a new version of the ZIP, replace the old folder with the new one (keep the same location and name to make this easier), then go to `chrome://extensions` and click the circular reload arrow (↻) on the **Facebook Feed Filter** card. Refresh any open Facebook tabs.

## Configuring rules

Open the extension's options page (`chrome://extensions` → **Details** → **Extension options**). You can:

- Edit the **threshold** (default 1.0)
- Edit the **rules array** as JSON. Add, remove, disable (`"enabled": false`), or re-weight any rule.
- Click **Reset to defaults** to restore the canonical rule set.

Changes apply instantly to any open Facebook tab — overlays clear and re-evaluate live.

### Rule schema

Each rule has a `name`, a `type`, a `weight`, and type-specific fields. Five types are supported:

- `regex` — match a regex against the post's message text.
  - `pattern` (string), `flags` (string, e.g. `"i"`), `weight` (number).
  - Optional `perMatch: true` multiplies weight by match count.
- `caps_ratio` — message text is mostly uppercase.
  - `threshold` (0–1), `minLetters`, `weight`.
- `emoji_count` — message text has many emoji.
  - `threshold` (min count), `weight`.
- `selector` — any descendant of the post matches a CSS selector.
  - `selector` (string), `weight`.
- `text_selector` — element matching `selector` has trimmed text equal to `text` (case-insensitive by default).
  - `selector` (string), `text` (string), optional `caseSensitive` (bool), `weight`.

Remember to double-escape backslashes in JSON: `\\b`, `\\?`.

## Training queue

Right-click any post on Facebook → **Add post to training queue**. The extension captures the profile name, message snippet, and permalink (if available) into local storage. View, export, or clear the queue from the options page.

For now this is just a collector — no LLM is invoked. The queue exists so that a future milestone (Claude/OpenRouter rule generation) has training examples to work from.

## Project layout

```
manifest.json       MV3 manifest
defaults.js         default rules + default threshold (shared)
content.js          rule engine, scanner, overlay, hotkey, training capture
background.js       service worker (context menu registration + dispatch)
options.html        rules editor + threshold + queue viewer
options.js          options-page logic
styles.css          overlay + toast styles
icons/              16/32/48/128 PNGs referenced by manifest
dev_use_once/       one-shot dev artifacts (icon source sheet + splitter)
```

## Keyboard

- **Alt + H** — toggle reveal-all (skips when an input/textarea is focused)

## Notes on detection

- Facebook obfuscates the visible word "Sponsored" by mixing decoy text with canvas-rendered glyphs, so plain-text matching won't find it. We detect sponsored posts by their outbound link domain (`l.facebook.com/l.php`) instead, which is a stable structural signal.
- Pages you don't follow display a visible "Follow" button in the post header. That button is matched by a simple text-of-selector rule.
- Facebook's feed recycles DOM aggressively as you scroll. The scanner uses a `MutationObserver` and a cache key (profile name + first 120 chars of message) to avoid re-processing the same logical post.

## Status

Pivoted from a YouTube clickbait filter. Reuses the same scoring engine, training queue, and options page; replaces the rule set, content-script selectors, and URL patterns.

## License

No license declared yet. Treat as "personal use" until that changes.
