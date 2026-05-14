console.log("[FBFeedFilter] content script loaded");

const POST_SELECTOR = "div[role='article']";
const HIDE_POST_SELECTOR = '[aria-label^="Hide post by "]';

let activeRules = [];
let threshold = DEFAULT_THRESHOLD;

function compileRule(rule) {
  if (rule.enabled === false) return null;
  const weight = typeof rule.weight === "number" ? rule.weight : 1.0;
  switch (rule.type) {
    case "regex": {
      try {
        if (rule.perMatch) {
          const flags = (rule.flags || "").includes("g") ? rule.flags : (rule.flags || "") + "g";
          const re = new RegExp(rule.pattern, flags);
          return {
            name: rule.name,
            score: (t) => {
              if (!t) return 0;
              const matches = t.match(re);
              return matches ? matches.length * weight : 0;
            },
          };
        } else {
          const re = new RegExp(rule.pattern, rule.flags || "");
          return {
            name: rule.name,
            score: (t) => (t && re.test(t) ? weight : 0),
          };
        }
      } catch (e) {
        console.warn("[FBFeedFilter] invalid regex in rule", rule.name, e.message);
        return null;
      }
    }
    case "caps_ratio": {
      const ratioThreshold = rule.threshold ?? 0.7;
      const minLetters = rule.minLetters ?? 15;
      return {
        name: rule.name,
        score: (t) => {
          if (!t) return 0;
          const letters = t.replace(/[^a-zA-Z]/g, "");
          if (letters.length < minLetters) return 0;
          const upper = letters.replace(/[^A-Z]/g, "").length;
          return upper / letters.length > ratioThreshold ? weight : 0;
        },
      };
    }
    case "emoji_count": {
      const minCount = rule.threshold ?? 3;
      return {
        name: rule.name,
        score: (t) => {
          if (!t) return 0;
          const count = (t.match(/\p{Extended_Pictographic}/gu) || []).length;
          return count >= minCount ? weight : 0;
        },
      };
    }
    case "selector": {
      const selector = rule.selector;
      if (!selector || typeof selector !== "string") {
        console.warn("[FBFeedFilter] selector rule needs a 'selector' string:", rule.name);
        return null;
      }
      try {
        document.createDocumentFragment().querySelector(selector);
      } catch (e) {
        console.warn("[FBFeedFilter] invalid selector in rule", rule.name, e.message);
        return null;
      }
      return {
        name: rule.name,
        score: (_t, el) => (el && el.querySelector(selector) ? weight : 0),
      };
    }
    case "text_selector": {
      const selector = rule.selector;
      const expected = rule.text;
      if (!selector || typeof selector !== "string") {
        console.warn("[FBFeedFilter] text_selector rule needs a 'selector' string:", rule.name);
        return null;
      }
      if (typeof expected !== "string" || !expected) {
        console.warn("[FBFeedFilter] text_selector rule needs a 'text' string:", rule.name);
        return null;
      }
      try {
        document.createDocumentFragment().querySelector(selector);
      } catch (e) {
        console.warn("[FBFeedFilter] invalid selector in rule", rule.name, e.message);
        return null;
      }
      const caseSensitive = rule.caseSensitive === true;
      const matchType = rule.matchType === "contains" || rule.matchType === "startsWith"
        ? rule.matchType
        : "exact";
      const target = caseSensitive ? expected.trim() : expected.trim().toLowerCase();
      return {
        name: rule.name,
        score: (_t, el) => {
          if (!el) return 0;
          const matches = el.querySelectorAll(selector);
          for (const m of matches) {
            const txt = (m.textContent || "").trim();
            const cmp = caseSensitive ? txt : txt.toLowerCase();
            if (matchType === "contains") {
              if (cmp.includes(target)) return weight;
            } else if (matchType === "startsWith") {
              if (cmp.startsWith(target)) return weight;
            } else {
              if (cmp === target) return weight;
            }
          }
          return 0;
        },
      };
    }
    default:
      console.warn("[FBFeedFilter] unknown rule type:", rule.type);
      return null;
  }
}

function compileAll(rawRules) {
  return (rawRules || []).map(compileRule).filter(Boolean);
}

function scoreCard(snippet, el) {
  let total = 0;
  const breakdown = [];
  for (const rule of activeRules) {
    const s = rule.score(snippet, el);
    if (s > 0) {
      total += s;
      breakdown.push({ name: rule.name, score: s });
    }
  }
  return { total, breakdown };
}

function getProfileName(el) {
  const h4Link = el.querySelector("h4 a[href], h3 a[href]");
  if (h4Link) {
    const t = (h4Link.textContent || "").trim();
    if (t) return t;
  }
  const hide = el.querySelector('[aria-label^="Hide post by "]');
  if (hide) {
    const m = (hide.getAttribute("aria-label") || "").match(/^Hide post by (.+)$/);
    if (m) return m[1].trim();
  }
  return "";
}

function getMessageSnippet(el) {
  const msg = el.querySelector('[data-ad-comet-preview="message"], [data-ad-preview="message"]');
  if (msg) {
    const t = (msg.textContent || "").trim();
    if (t) return t;
  }
  return "";
}

function getCacheKey(el) {
  const name = getProfileName(el);
  const snippet = getMessageSnippet(el).slice(0, 120);
  if (name || snippet) return name + "|" + snippet;
  return "";
}

function buildLabelContent(label, total, breakdown) {
  while (label.firstChild) label.removeChild(label.firstChild);
  const main = document.createElement("div");
  main.textContent = `Filtered · ${total.toFixed(2)}`;
  const sub = document.createElement("span");
  const count = breakdown.length;
  if (count <= 2) {
    sub.textContent = breakdown.map((b) => `${b.name} +${b.score.toFixed(2)}`).join(", ");
  } else {
    sub.textContent = `${count} rules matched`;
  }
  label.appendChild(main);
  label.appendChild(sub);
}

function buildTooltip(total, breakdown) {
  const lines = [`Score ${total.toFixed(2)} (threshold ${threshold.toFixed(2)})`];
  for (const b of breakdown) lines.push(`  ${b.name}: +${b.score.toFixed(2)}`);
  return lines.join("\n");
}

function applyOverlay(el, total, breakdown) {
  el.classList.add("cbf-filtered");
  if (getComputedStyle(el).position === "static") {
    el.style.position = "relative";
  }
  const overlay = document.createElement("div");
  overlay.className = "cbf-overlay";
  const label = document.createElement("div");
  label.className = "cbf-label";
  buildLabelContent(label, total, breakdown);
  overlay.appendChild(label);
  overlay.title = buildTooltip(total, breakdown);
  overlay.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    el.classList.toggle("cbf-revealed");
  });
  el.appendChild(overlay);
}

function updateOverlayContent(overlay, total, breakdown) {
  const label = overlay.querySelector(".cbf-label");
  if (label) buildLabelContent(label, total, breakdown);
  overlay.title = buildTooltip(total, breakdown);
}

function isTopLevelPost(el) {
  if (el.matches(POST_SELECTOR)) {
    const parent = el.parentElement;
    if (!parent) return true;
    return !parent.closest(POST_SELECTOR);
  }
  return true;
}

function processPost(el) {
  if (!isTopLevelPost(el)) return;

  const cacheKey = getCacheKey(el);
  if (!cacheKey) return;
  if (el.dataset.cbfKey === cacheKey) return;
  el.dataset.cbfKey = cacheKey;

  const snippet = getMessageSnippet(el);
  const existing = el.querySelector(":scope > .cbf-overlay");
  const { total, breakdown } = scoreCard(snippet, el);
  const shouldFilter = total >= threshold;

  if (!shouldFilter) {
    if (existing) {
      el.classList.remove("cbf-filtered", "cbf-revealed");
      delete el.dataset.cbfScore;
      delete el.dataset.cbfRules;
      existing.remove();
    }
    return;
  }

  el.dataset.cbfScore = total.toFixed(2);
  el.dataset.cbfRules = breakdown.map((b) => b.name).join(",");

  if (existing) {
    updateOverlayContent(existing, total, breakdown);
  } else {
    applyOverlay(el, total, breakdown);
  }
}

function findPostContainers() {
  const containers = new Set();
  document.querySelectorAll(POST_SELECTOR).forEach((el) => containers.add(el));
  document.querySelectorAll(HIDE_POST_SELECTOR).forEach((btn) => {
    const article = btn.closest(POST_SELECTOR);
    if (article) {
      containers.add(article);
      return;
    }
    let node = btn.parentElement;
    let depth = 0;
    while (node && depth < 12) {
      if (node.querySelector('[data-ad-rendering-role="story_message"], [data-ad-rendering-role="like_button"], [data-ad-comet-preview="message"], [data-ad-preview="message"]')) {
        containers.add(node);
        return;
      }
      node = node.parentElement;
      depth++;
    }
  });
  return containers;
}

let lastScanLog = 0;
function scan() {
  const containers = findPostContainers();
  if (Date.now() - lastScanLog > 5000) {
    console.log(`[FBFeedFilter] scan: ${containers.size} post containers found, ${activeRules.length} rules active, threshold ${threshold}`);
    lastScanLog = Date.now();
  }
  containers.forEach(processPost);
}

function clearOverlays() {
  document.querySelectorAll(".cbf-filtered").forEach((el) => {
    el.classList.remove("cbf-filtered", "cbf-revealed");
    delete el.dataset.cbfScore;
    delete el.dataset.cbfRules;
    const ov = el.querySelector(":scope > .cbf-overlay");
    if (ov) ov.remove();
  });
  document.querySelectorAll("[data-cbf-key]").forEach((el) => {
    delete el.dataset.cbfKey;
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

chrome.storage.local.get(
  { rules: DEFAULT_RULES, threshold: DEFAULT_THRESHOLD },
  (data) => {
    threshold = typeof data.threshold === "number" ? data.threshold : DEFAULT_THRESHOLD;
    activeRules = compileAll(data.rules);
    scan();
  }
);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  let needsRescan = false;
  if (changes.rules) {
    activeRules = compileAll(changes.rules.newValue || DEFAULT_RULES);
    needsRescan = true;
  }
  if (changes.threshold) {
    threshold =
      typeof changes.threshold.newValue === "number"
        ? changes.threshold.newValue
        : DEFAULT_THRESHOLD;
    needsRescan = true;
  }
  if (needsRescan) {
    clearOverlays();
    scan();
  }
});

let lastRightClickTarget = null;

document.addEventListener(
  "contextmenu",
  (e) => {
    if (!e.target || !e.target.closest) {
      lastRightClickTarget = null;
      return;
    }
    let card = e.target.closest(POST_SELECTOR);
    if (!card) {
      const hideBtn = e.target.closest("*");
      let node = hideBtn;
      let depth = 0;
      while (node && depth < 20) {
        if (node.querySelector && node.querySelector(HIDE_POST_SELECTOR)) {
          card = node;
          break;
        }
        node = node.parentElement;
        depth++;
      }
    }
    lastRightClickTarget = card || null;
  },
  true
);

function extractMetadata(el) {
  const name = getProfileName(el);
  const snippet = getMessageSnippet(el);
  const permalink = el.querySelector('a[href*="/posts/"], a[href*="/photo/?fbid="], a[href*="/videos/"], a[href*="story_fbid="]');
  const url = permalink ? permalink.href : "";
  return {
    profile: name,
    snippet: snippet.slice(0, 300),
    url,
    addedAt: new Date().toISOString(),
  };
}

function showToast(message) {
  const t = document.createElement("div");
  t.className = "cbf-toast";
  t.textContent = message;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("cbf-toast-show"));
  setTimeout(() => {
    t.classList.remove("cbf-toast-show");
    setTimeout(() => t.remove(), 300);
  }, 2500);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.type !== "cbf-capture-training") return;
  if (!lastRightClickTarget || !lastRightClickTarget.isConnected) {
    showToast("Right-click on a post first.");
    return;
  }
  const meta = extractMetadata(lastRightClickTarget);
  if (!meta.profile && !meta.snippet) {
    showToast("Couldn't read post content.");
    return;
  }
  chrome.storage.local.get({ trainingQueue: [] }, (data) => {
    const queue = Array.isArray(data.trainingQueue) ? data.trainingQueue : [];
    queue.push(meta);
    chrome.storage.local.set({ trainingQueue: queue }, () => {
      const label = meta.profile || meta.snippet.slice(0, 60);
      showToast(`Added (#${queue.length}): ${label.slice(0, 60)}`);
    });
  });
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
