# YT Clickbait Filter

A Chrome extension (Manifest V3) that hides clickbait videos on YouTube behind a translucent overlay so you can decide whether to watch them anyway. Filtering uses a **weighted-rule scoring system**: every rule a title matches contributes points, and the card is hidden when the total reaches a configurable threshold.

![Filter overlay](icons/icon128.png)

## Why

The YouTube algorithm rewards clickbait. The point of this extension isn't to make those videos invisible — it's to make them *obvious*, so they cost a click instead of slipping past your attention.

## How it works

For each video card on the page, the extension reads the title and runs every enabled rule against it. Each rule that matches contributes its `weight` to a running score. If the total ≥ threshold, the card gets a translucent black overlay showing the score and which rules contributed.

```
Title: "JUST one ingredient and you'll NEVER cook dinner again!!"

  only-never-again      +0.75   (only/just + never...again)
  all-caps-title        +0.50   (>70% of letters uppercase)
  exclamation-marks     +0.30   (2 × 0.15 per "!")
  ────────────────────────────
  total                  1.55   ≥ threshold (0.7) → filtered
```

Click the overlay to reveal that one card. Press **Alt+H** to reveal everything; press it again to re-hide. Hover the overlay for the full score breakdown.

## Install (developer mode)

1. Clone this repo
2. Open `chrome://extensions`
3. Toggle on **Developer mode** (top right)
4. Click **Load unpacked** → select the repo folder
5. Open YouTube — clickbait cards should start getting overlays

To pick up code changes after editing: `chrome://extensions` → reload icon (↻) on the extension card → reload any open YouTube tabs.

## Configuring rules

Open the extension's options page (`chrome://extensions` → **Details** → **Extension options**). You can:

- Edit the **threshold** (default 0.7)
- Edit the **rules array** as JSON. Add, remove, disable (`"enabled": false`), or re-weight any rule.
- Click **Reset to defaults** to restore the canonical rule set.

Changes apply instantly to any open YouTube tab — overlays clear and re-evaluate live.

### Rule schema

Each rule has a `name`, a `type`, a `weight`, and type-specific fields. Three types are supported:

- `regex` — match a regex against the title.
  - `pattern` (string), `flags` (string, e.g. `"i"`), `weight` (number).
  - Optional `perMatch: true` multiplies weight by match count (auto-appends the `g` flag). Use this for per-character scoring like `!`.
- `caps_ratio` — title is mostly uppercase letters.
  - `threshold` (0–1, ratio of uppercase letters), `minLetters` (don't fire on short titles), `weight`.
- `emoji_count` — title has many emoji.
  - `threshold` (minimum emoji count to trigger), `weight`.

Remember to double-escape backslashes in JSON: `\\b`, `\\?`.

## Training queue

Right-click any video card on YouTube → **Add to clickbait training queue**. The extension captures the title, channel, URL, and video ID into local storage. View, export, or clear the queue from the options page.

For now this is just a collector — no LLM is invoked. The queue exists so that a future *milestone 3* (Claude/OpenRouter rule generation) has training examples to work from.

## Project layout

```
manifest.json       MV3 manifest
defaults.js         default rules + default threshold (shared)
content.js          rule engine, scanner, overlay, hotkey, training capture
background.js      service worker (context menu registration + dispatch)
options.html        rules editor + threshold + queue viewer
options.js          options-page logic
styles.css          overlay + toast styles
icons/              16/32/48/128 PNGs referenced by manifest
dev_use_once/       one-shot dev artifacts (icon source sheet + splitter)
```

## Keyboard

- **Alt + H** — toggle reveal-all (skips when an input/textarea is focused)

## Status

Personal-use project, but kept clean enough that someone else could pick it up. Roadmap:

- ✅ **Milestone 1** — static rule engine + overlays + hotkey
- ✅ **Milestone 2** — editable rules in `chrome.storage.local` + options page
- ✅ **Milestone B** — right-click "Add to training queue"
- ✅ **Pivot** — weighted scoring + configurable threshold (replaces binary first-match-wins)
- ⬜ **Milestone 3** — LLM-assisted rule generation from queued items (OpenRouter)

## License

No license declared yet. Treat as "personal use" until that changes.
