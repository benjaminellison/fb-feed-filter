console.log("[ClickbaitFilter] content script loaded");

const RULES = [
  {
    name: "shock-words",
    pattern: /\b(shocking|unbelievable|insane|crazy|jaw[- ]dropping)\b/i,
  },
  {
    name: "clickbait-phrases",
    pattern: /\b(you won.?t believe|i can.?t believe|this changed everything|what happens next|will blow your mind|gone wrong|gone sexual|nobody is talking about)\b/i,
  },
  {
    name: "must-watch",
    pattern: /\b(must watch|must see|do not miss|stop scrolling)\b/i,
  },
  {
    name: "all-caps-title",
    test: (t) => {
      const letters = t.replace(/[^a-zA-Z]/g, "");
      if (letters.length < 15) return false;
      const upper = letters.replace(/[^A-Z]/g, "").length;
      return upper / letters.length > 0.7;
    },
  },
  {
    name: "excessive-emoji",
    test: (t) => (t.match(/\p{Extended_Pictographic}/gu) || []).length >= 3,
  },
];

const VIDEO_SELECTORS = [
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-grid-video-renderer",
  "ytd-compact-video-renderer",
].join(",");

const TITLE_SELECTORS = "#video-title, a#video-title-link, yt-formatted-string#video-title";

function matchRule(title) {
  for (const rule of RULES) {
    if (rule.pattern && rule.pattern.test(title)) return rule.name;
    if (rule.test && rule.test(title)) return rule.name;
  }
  return null;
}

function getTitle(el) {
  const h3 = el.querySelector("h3[title]");
  if (h3) {
    const t = h3.getAttribute("title");
    if (t && t.trim()) return t.trim();
  }
  const direct = el.querySelector(TITLE_SELECTORS);
  if (direct) {
    const text = (direct.textContent || direct.getAttribute("title") || "").trim();
    if (text) return text;
  }
  const titleLink = el.querySelector('a[class*="LockupMetadataViewModelTitle"]');
  if (titleLink) {
    const inner = titleLink.querySelector(".ytAttributedStringHost, span[role='text']");
    const text = ((inner && inner.textContent) || titleLink.textContent || "").trim();
    if (text) return text;
  }
  return "";
}

function applyOverlay(el, ruleName) {
  if (el.querySelector(":scope > .cbf-overlay")) return;
  el.classList.add("cbf-filtered");
  if (getComputedStyle(el).position === "static") {
    el.style.position = "relative";
  }
  const overlay = document.createElement("div");
  overlay.className = "cbf-overlay";
  const label = document.createElement("div");
  label.className = "cbf-label";
  const main = document.createElement("div");
  main.textContent = "Filtered";
  const sub = document.createElement("span");
  sub.textContent = ruleName;
  label.appendChild(main);
  label.appendChild(sub);
  overlay.appendChild(label);
  overlay.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    el.classList.toggle("cbf-revealed");
  });
  el.appendChild(overlay);
}

function processVideo(el) {
  if (el.querySelector(":scope > .cbf-overlay")) return;
  const title = getTitle(el);
  if (!title) return;
  const matched = matchRule(title);
  if (matched) {
    el.dataset.cbfRule = matched;
    applyOverlay(el, matched);
  }
}

function scan() {
  document.querySelectorAll(VIDEO_SELECTORS).forEach(processVideo);
}

let scheduled = false;
function scheduleScan() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    scan();
  });
}

const observer = new MutationObserver(scheduleScan);
observer.observe(document.body, {
  childList: true,
  subtree: true,
  characterData: true,
});

scan();

document.addEventListener("keydown", (e) => {
  if (e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "h" || e.key === "H")) {
    const target = e.target;
    const tag = target && target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || (target && target.isContentEditable)) return;
    const nowRevealing = document.documentElement.classList.toggle("cbf-reveal-all");
    if (!nowRevealing) {
      document.querySelectorAll(".cbf-filtered.cbf-revealed").forEach((el) => {
        el.classList.remove("cbf-revealed");
      });
    }
    e.preventDefault();
  }
});
