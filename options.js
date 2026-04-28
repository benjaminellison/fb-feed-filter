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
  if (!confirm("Reset all rules to defaults? Your custom rules will be lost.")) return;
  chrome.storage.local.set({ rules: DEFAULT_RULES }, () => {
    render(DEFAULT_RULES);
    setStatus("Reset to defaults.", "success");
  });
});

load();
