console.log("[ClickbaitFilter] content script loaded");

const VIDEO_SELECTORS = [
  "ytd-rich-item-renderer",
  "ytd-video-renderer",
  "ytd-grid-video-renderer",
  "ytd-compact-video-renderer",
].join(",");

const TITLE_SELECTORS = "#video-title, a#video-title-link, yt-formatted-string#video-title";

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
              const matches = t.match(re);
              return matches ? matches.length * weight : 0;
            },
          };
        } else {
          const re = new RegExp(rule.pattern, rule.flags || "");
          return {
            name: rule.name,
            score: (t) => (re.test(t) ? weight : 0),
          };
        }
      } catch (e) {
        console.warn("[ClickbaitFilter] invalid regex in rule", rule.name, e.message);
        return null;
      }
    }
    case "caps_ratio": {
      const ratioThreshold = rule.threshold ?? 0.7;
      const minLetters = rule.minLetters ?? 15;
      return {
        name: rule.name,
        score: (t) => {
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
          const count = (t.match(/\p{Extended_Pictographic}/gu) || []).length;
          return count >= minCount ? weight : 0;
        },
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

function scoreTitle(title) {
  let total = 0;
  const breakdown = [];
  for (const rule of activeRules) {
    const s = rule.score(title);
    if (s > 0) {
      total += s;
      breakdown.push({ name: rule.name, score: s });
    }
  }
  return { total, breakdown };
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

function processVideo(el) {
  const title = getTitle(el);
  if (!title) return;
  if (el.dataset.cbfTitle === title) return;
  el.dataset.cbfTitle = title;

  const existing = el.querySelector(":scope > .cbf-overlay");
  const { total, breakdown } = scoreTitle(title);
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

function scan() {
  document.querySelectorAll(VIDEO_SELECTORS).forEach(processVideo);
}

function clearOverlays() {
  document.querySelectorAll(".cbf-filtered").forEach((el) => {
    el.classList.remove("cbf-filtered", "cbf-revealed");
    delete el.dataset.cbfScore;
    delete el.dataset.cbfRules;
    const ov = el.querySelector(":scope > .cbf-overlay");
    if (ov) ov.remove();
  });
  document.querySelectorAll("[data-cbf-title]").forEach((el) => {
    delete el.dataset.cbfTitle;
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
    const card = e.target.closest && e.target.closest(VIDEO_SELECTORS);
    lastRightClickTarget = card || null;
  },
  true
);

function extractMetadata(el) {
  const title = getTitle(el);
  const watchLink = el.querySelector('a[href*="/watch?v="]');
  const href = watchLink ? watchLink.getAttribute("href") || "" : "";
  let url = "";
  let videoId = "";
  if (href) {
    try {
      const u = new URL(href, location.origin);
      videoId = u.searchParams.get("v") || "";
      url = u.toString();
    } catch (_) {}
  }
  let channel = "";
  const channelLink = el.querySelector(
    'a[href^="/@"], a[href^="/channel/"], a[href^="/user/"]'
  );
  if (channelLink) channel = (channelLink.textContent || "").trim();
  if (!channel) {
    const avatarBtn = el.querySelector('[aria-label^="Go to channel "]');
    if (avatarBtn) {
      const m = (avatarBtn.getAttribute("aria-label") || "").match(
        /^Go to channel (.+)$/
      );
      if (m) channel = m[1].trim();
    }
  }
  return {
    title,
    channel,
    url,
    videoId,
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
    showToast("Right-click on a video card first.");
    return;
  }
  const meta = extractMetadata(lastRightClickTarget);
  if (!meta.title) {
    showToast("Couldn't read video title from this card.");
    return;
  }
  chrome.storage.local.get({ trainingQueue: [] }, (data) => {
    const queue = Array.isArray(data.trainingQueue) ? data.trainingQueue : [];
    if (meta.videoId && queue.some((q) => q.videoId === meta.videoId)) {
      showToast(`Already queued: ${meta.title.slice(0, 60)}`);
      return;
    }
    queue.push(meta);
    chrome.storage.local.set({ trainingQueue: queue }, () => {
      showToast(`Added (#${queue.length}): ${meta.title.slice(0, 60)}`);
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
