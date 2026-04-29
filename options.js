const textarea = document.getElementById("rules");
const saveBtn = document.getElementById("save");
const resetBtn = document.getElementById("reset");
const status = document.getElementById("status");

function setStatus(message, kind) {
  status.textContent = message;
  status.className = "status" + (kind ? " " + kind : "");
  if (kind === "success") {
    setTimeout(() => {
      if (status.textContent === message) {
        status.textContent = "";
        status.className = "status";
      }
    }, 2500);
  }
}

function render(rules) {
  textarea.value = JSON.stringify(rules, null, 2);
  textarea.classList.remove("invalid");
}

function load() {
  chrome.storage.local.get({ rules: DEFAULT_RULES }, (data) => {
    render(data.rules);
  });
}

function validate(parsed) {
  if (!Array.isArray(parsed)) return "Rules must be a JSON array.";
  const validTypes = new Set(["regex", "caps_ratio", "emoji_count"]);
  const seenNames = new Set();
  for (let i = 0; i < parsed.length; i++) {
    const r = parsed[i];
    const ctx = `Rule ${i + 1}`;
    if (!r || typeof r !== "object") return `${ctx}: must be an object.`;
    if (!r.name || typeof r.name !== "string") return `${ctx}: missing or invalid "name".`;
    if (seenNames.has(r.name)) return `${ctx}: duplicate name "${r.name}".`;
    seenNames.add(r.name);
    if (!validTypes.has(r.type)) return `${ctx} (${r.name}): invalid "type". Must be one of regex, caps_ratio, emoji_count.`;
    if (r.weight !== undefined && (typeof r.weight !== "number" || !isFinite(r.weight))) {
      return `${ctx} (${r.name}): "weight" must be a finite number.`;
    }
    if (r.type === "regex") {
      if (typeof r.pattern !== "string") return `${ctx} (${r.name}): regex rule needs a string "pattern".`;
      try {
        new RegExp(r.pattern, r.flags || "");
      } catch (e) {
        return `${ctx} (${r.name}): invalid regex — ${e.message}`;
      }
    }
  }
  return null;
}

saveBtn.addEventListener("click", () => {
  let parsed;
  try {
    parsed = JSON.parse(textarea.value);
  } catch (e) {
    textarea.classList.add("invalid");
    setStatus("Invalid JSON: " + e.message, "error");
    return;
  }
  const err = validate(parsed);
  if (err) {
    textarea.classList.add("invalid");
    setStatus(err, "error");
    return;
  }
  textarea.classList.remove("invalid");
  chrome.storage.local.set({ rules: parsed }, () => {
    if (chrome.runtime.lastError) {
      setStatus("Save failed: " + chrome.runtime.lastError.message, "error");
    } else {
      setStatus("Saved.", "success");
    }
  });
});

resetBtn.addEventListener("click", () => {
  if (!confirm("Reset all rules and threshold to defaults? Your custom rules will be lost.")) return;
  chrome.storage.local.set({ rules: DEFAULT_RULES, threshold: DEFAULT_THRESHOLD }, () => {
    render(DEFAULT_RULES);
    thresholdInput.value = DEFAULT_THRESHOLD;
    setStatus("Reset to defaults.", "success");
  });
});

const thresholdInput = document.getElementById("threshold");
const saveThresholdBtn = document.getElementById("save-threshold");
const thresholdStatus = document.getElementById("threshold-status");

function setThresholdStatus(msg, kind) {
  thresholdStatus.textContent = msg;
  thresholdStatus.className = "status" + (kind ? " " + kind : "");
  if (kind === "success") {
    setTimeout(() => {
      if (thresholdStatus.textContent === msg) {
        thresholdStatus.textContent = "";
        thresholdStatus.className = "status";
      }
    }, 2500);
  }
}

function loadThreshold() {
  chrome.storage.local.get({ threshold: DEFAULT_THRESHOLD }, (data) => {
    thresholdInput.value =
      typeof data.threshold === "number" ? data.threshold : DEFAULT_THRESHOLD;
  });
}

saveThresholdBtn.addEventListener("click", () => {
  const v = parseFloat(thresholdInput.value);
  if (!isFinite(v) || v < 0) {
    setThresholdStatus("Threshold must be a non-negative number.", "error");
    return;
  }
  chrome.storage.local.set({ threshold: v }, () => {
    setThresholdStatus(`Saved threshold: ${v}`, "success");
  });
});

const queueList = document.getElementById("queue-list");
const queueEmpty = document.getElementById("queue-empty");
const queueCount = document.getElementById("queue-count");
const queueStatus = document.getElementById("queue-status");
const exportBtn = document.getElementById("export-queue");
const clearBtn = document.getElementById("clear-queue");

function setQueueStatus(msg, kind) {
  queueStatus.textContent = msg;
  queueStatus.className = "status" + (kind ? " " + kind : "");
  if (kind === "success") {
    setTimeout(() => {
      if (queueStatus.textContent === msg) {
        queueStatus.textContent = "";
        queueStatus.className = "status";
      }
    }, 2500);
  }
}

function renderQueue(queue) {
  queueList.innerHTML = "";
  queueCount.textContent = queue.length ? `(${queue.length})` : "";
  queueEmpty.style.display = queue.length ? "none" : "block";
  queue.forEach((item, idx) => {
    const li = document.createElement("li");
    li.className = "queue-item";
    const left = document.createElement("div");
    const titleDiv = document.createElement("div");
    titleDiv.className = "title";
    titleDiv.textContent = item.title || "(no title)";
    left.appendChild(titleDiv);
    const meta = document.createElement("div");
    meta.className = "meta";
    const channel = item.channel ? `${item.channel} · ` : "";
    const date = item.addedAt ? new Date(item.addedAt).toLocaleString() : "";
    meta.appendChild(document.createTextNode(channel));
    if (item.url) {
      const a = document.createElement("a");
      a.href = item.url;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = item.videoId || "open";
      meta.appendChild(a);
    }
    if (date) meta.appendChild(document.createTextNode(` · ${date}`));
    left.appendChild(meta);
    li.appendChild(left);
    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => removeQueueItem(idx));
    li.appendChild(removeBtn);
    queueList.appendChild(li);
  });
}

function loadQueue() {
  chrome.storage.local.get({ trainingQueue: [] }, (data) => {
    renderQueue(Array.isArray(data.trainingQueue) ? data.trainingQueue : []);
  });
}

function removeQueueItem(idx) {
  chrome.storage.local.get({ trainingQueue: [] }, (data) => {
    const queue = Array.isArray(data.trainingQueue) ? data.trainingQueue : [];
    queue.splice(idx, 1);
    chrome.storage.local.set({ trainingQueue: queue }, () => renderQueue(queue));
  });
}

exportBtn.addEventListener("click", () => {
  chrome.storage.local.get({ trainingQueue: [] }, (data) => {
    const queue = Array.isArray(data.trainingQueue) ? data.trainingQueue : [];
    const blob = new Blob([JSON.stringify(queue, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    a.download = `clickbait-training-queue-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setQueueStatus(`Exported ${queue.length} item${queue.length === 1 ? "" : "s"}.`, "success");
  });
});

clearBtn.addEventListener("click", () => {
  if (!confirm("Clear the entire training queue? This cannot be undone.")) return;
  chrome.storage.local.set({ trainingQueue: [] }, () => {
    renderQueue([]);
    setQueueStatus("Queue cleared.", "success");
  });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.trainingQueue) {
    renderQueue(changes.trainingQueue.newValue || []);
  }
});

load();
loadThreshold();
loadQueue();
