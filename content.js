console.log("[ClickbaitFilter] content script loaded");

const VIDEO_SELECTORS = [
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-grid-video-renderer",
  "ytd-compact-video-renderer",
].join(",");

const TITLE_SELECTORS = "#video-title, a#video-title-link, yt-formatted-string#video-title";

let activeRules = [];

function compileRule(rule) {
  if (rule.enabled === false) return null;
  switch (rule.type) {
    case "regex": {
      try {
        const re = new RegExp(rule.pattern, rule.flags || "");
        return { name: rule.name, test: (t) => re.test(t) };
      } catch (e) {
        console.warn("[ClickbaitFilter] invalid regex in rule", rule.name, e.message);
        return null;
      }
    }
    case "caps_ratio": {
      const threshold = rule.threshold ?? 0.7;
      const minLetters = rule.minLetters ?? 15;
      return {
        name: rule.name,
        test: (t) => {
          const letters = t.replace(/[^a-zA-Z]/g, "");
          if (letters.length < minLetters) return false;
          const upper = letters.replace(/[^A-Z]/g, "").length;
          return upper / letters.length > threshold;
        },
      };
    }
    case "emoji_count": {
      const threshold = rule.threshold ?? 3;
      return {
        name: rule.name,
        test: (t) => (t.match(/\p{Extended_Pictographic}/gu) || []).length >= threshold,
      };
    }
    default:
      console.warn("[ClickbaitFilter] unknown rule type:", rule.type);
      return null;
  }
}

function compileAll(rawRules) {
  return (rawRules || []).map(compileRule).filter(Boolean);
}

function matchRule(title) {
  for (const rule of activeRules) {
    if (rule.test(title)) return rule.name;
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

function clearOverlays() {
  document.querySelectorAll(".cbf-filtered").forEach((el) => {
    el.classList.remove("cbf-filtered", "cbf-revealed");
    delete el.dataset.cbfRule;
    const ov = el.querySelector(":scope > .cbf-overlay");
    if (ov) ov.remove();
  });
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

chrome.storage.local.get({ rules: DEFAULT_RULES }, (data) => {
  activeRules = compileAll(data.rules);
  scan();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.rules) return;
  activeRules = compileAll(changes.rules.newValue || DEFAULT_RULES);
  clearOverlays();
  scan();
});

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
