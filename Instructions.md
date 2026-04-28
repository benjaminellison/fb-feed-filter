Good morning! I'm considering vibe-coding a chrome extension for my personal use with Claude Code, and wanted to do a bit of brainstorming.

The entire purpose of the extension would be to hide click-bait videos from my youtube.  I envision it having a rule system that would scan the titles (and maybe descriptions) and if it met any of the established click-bait rules, it would just get hidden on my screen (like, set to not display, or maybe better yet - to show a semi-translucent black box over the top of it so it's obvious to me which ones are click-bait but I can still check them out if I want).  

And I could click the extension (or an option in a drop down from it or something) and then click on a video to train it.  It would then take the information available (title, author, and description if available) and using my Claude subscription (API? tokens? not sure how) pass that along to the LLM to determine the best way to write a rule that would filter out that type of click-bait. 

And I'd want hot-keys or shortcut keys that would toggle unhide/rehide for everything.







You’re on a solid track. This is actually a very buildable project—and more importantly, it’s the kind of tool that can meaningfully shape your attention instead of just consuming it.



Let me push on a few parts so you don’t overcomplicate it early.



\---



\## 1. Core idea (keep this tight at first)



What you described has two layers:



\*\*Layer 1 (must-have):\*\*



\* Scan YouTube DOM for video elements

\* Extract:



&#x20; \* title

&#x20; \* channel name

\* Apply rules

\* Either:



&#x20; \* hide element (`display: none`)

&#x20; \* or overlay it (better UX, your instinct is right)



\*\*Layer 2 (nice but optional early):\*\*



\* LLM-assisted rule generation

\* Training mode (click → classify → generate rule)



If you try to build both at once, you’ll stall. Start with Layer 1 + \*\*manual rule entry\*\*.



\---



\## 2. Rule system (this is the real backbone)



Don’t overthink “AI” yet—clickbait is extremely pattern-heavy.



Start with a simple rule schema like:



```json

{

&#x20; "type": "title\_contains",

&#x20; "value": \["shocking", "you won't believe", "this changed everything"],

&#x20; "caseInsensitive": true

}

```



Then expand to:



\* `title\_regex`

\* `channel\_equals`

\* `channel\_contains`

\* `title\_length\_over` (clickbait often long or ALL CAPS)

\* `has\_caps\_ratio > X`

\* `contains\_emoji`



You’ll be surprised how far this gets you without any AI.



\---



\## 3. DOM targeting (YouTube specifics)



You’ll mostly be dealing with:



\* `ytd-rich-item-renderer` (homepage)

\* `ytd-video-renderer` (search results)

\* `ytd-grid-video-renderer` (channel pages)



Inside those:



\* Title: `#video-title`

\* Channel: `#channel-name`



Use a \*\*MutationObserver\*\*—YouTube is dynamic and will keep loading content.



\---



\## 4. Overlay vs hide (you were right)



Don’t hide outright. That removes awareness and makes the system brittle.



Better approach:



\* Wrap video card in a container

\* Add overlay div:



&#x20; \* semi-transparent black

&#x20; \* label: “Filtered (rule: X)”

\* Click → temporarily reveal



This gives you:



\* feedback loop

\* trust in your system



\---



\## 5. Training mode (where Claude comes in)



Now the interesting part.



Your idea:



> click a video → send metadata → generate rule



That’s viable, but here’s the smarter way to structure it:



\### Input to LLM:



```json

{

&#x20; "title": "...",

&#x20; "channel": "...",

&#x20; "description": "...",

&#x20; "userIntent": "I consider this clickbait. Generate a filtering rule."

}

```



\### Output (STRICT FORMAT):



```json

{

&#x20; "rule\_type": "title\_regex",

&#x20; "pattern": "(you won’t believe|shocking|this changed everything)"

}

```



You must \*\*constrain output\*\*, or it’ll drift.



\---



\## 6. Claude API reality check



You mentioned using your Claude subscription.



Here’s the catch:



\* The consumer Claude app ≠ direct API access

\* You’ll likely need:



&#x20; \* an API key via Anthropic

&#x20; \* or route through something like a lightweight proxy



Also:



\* You \*\*don’t want to call the LLM frequently\*\*

\* Only call it during:



&#x20; \* training mode

&#x20; \* maybe periodic refinement



Otherwise you’ll burn tokens fast.



\---



\## 7. Hotkeys (keep them simple)



Start with:



\* `Alt + H` → toggle filter on/off

\* `Alt + Shift + H` → reveal all temporarily



Chrome extensions support this cleanly via `commands` in `manifest.json`.



\---



\## 8. Storage



Use:



\* `chrome.storage.local`



Store:



\* rules

\* toggled state



Keep rules editable as raw JSON at first. UI can come later.



\---



\## 9. Where this can go (if you don’t derail it)



Once the base works, \*then\* add intelligence:



\* Rule scoring (how often triggered)

\* Auto-suggest rules from patterns

\* “Aggressiveness” slider

\* Per-channel tolerance



But don’t build that yet.



\---



\## 10. The real risk



This kind of project dies in one of two ways:



1\. \*\*Over-engineering AI too early\*\*

2\. \*\*Spending too much time on UI before core filtering works\*\*



Your MVP should be ugly but effective:



\* JSON rules

\* basic overlay

\* hotkey toggle



If it works, you’ll use it. If you use it, you’ll improve it.



\---



\## If you want next step



I can give you:



\* a minimal Chrome extension file structure

\* a working content script with MutationObserver + rule engine

\* a stubbed “training mode” hook for Claude



That would get you from idea → running prototype in a couple hours instead of a couple weeks.



