// popup.js
let currentMode = "quick";
let extractedNumbers = [];
let progressInterval = null;

const style = document.createElement("style");
style.textContent = "@keyframes spin { to { transform: rotate(360deg); } }";
document.head.appendChild(style);

// ── Mode buttons ──────────────────────────────────────────────────────────────
document.getElementById("modeQuick").addEventListener("click", () => setMode("quick"));
document.getElementById("modeDeep").addEventListener("click",  () => setMode("deep"));

function setMode(mode) {
  currentMode = mode;
  document.getElementById("modeQuick").classList.toggle("active", mode === "quick");
  document.getElementById("modeDeep").classList.toggle("active",  mode === "deep");
}

document.getElementById("extractBtn").addEventListener("click", startExtraction);
document.getElementById("saveTxt").addEventListener("click",  () => saveFile("txt"));
document.getElementById("saveCsv").addEventListener("click",  () => saveFile("csv"));
document.getElementById("saveJson").addEventListener("click", () => saveFile("json"));

// ── UI ────────────────────────────────────────────────────────────────────────
function showError(msg) {
  const b = document.getElementById("errorBox");
  b.textContent = msg; b.classList.add("show");
}
function hideError() { document.getElementById("errorBox").classList.remove("show"); }

function setLoading(on) {
  const btn = document.getElementById("extractBtn");
  btn.disabled = on;
  btn.innerHTML = on
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> EXTRACTING…`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg> EXTRACT NUMBERS`;
}

function showProgress(on) {
  document.getElementById("progressArea").classList.toggle("show", on);
}
function updateProgressCount(n) {
  document.getElementById("progressCount").textContent = n;
}

function showResults(numbers) {
  extractedNumbers = numbers;
  document.getElementById("totalCount").textContent = numbers.length;
  const list = document.getElementById("resultsList");
  list.innerHTML = numbers.slice(0, 500).map((n) =>
    `<div class="num">${n.replace(/&/g,"&amp;")}</div>`
  ).join("");
  if (numbers.length > 500)
    list.innerHTML += `<div style="color:var(--text-muted);font-size:10px;margin-top:4px;">…and ${numbers.length - 500} more (all saved to file)</div>`;
  document.getElementById("resultsArea").classList.add("show");
}

// ── Tab helpers ───────────────────────────────────────────────────────────────
function getActiveTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const t = tabs && tabs[0];
      resolve(t && t.url && t.url.startsWith("https://web.whatsapp.com") ? t.id : null);
    });
  });
}

function pingTab(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { action: "PING" }, (r) => {
      resolve(!chrome.runtime.lastError && r && r.ok === true);
    });
  });
}

// ── Extraction ────────────────────────────────────────────────────────────────
async function startExtraction() {
  hideError();
  document.getElementById("resultsArea").classList.remove("show");
  showProgress(false);
  setLoading(true);

  const tabId = await getActiveTab();
  if (!tabId) {
    showError("⚠️ Open web.whatsapp.com in the active tab first.");
    setLoading(false); return;
  }

  // Inject / re-inject content script
  let alive = await pingTab(tabId);
  if (!alive) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
      await new Promise((r) => setTimeout(r, 800));
      alive = await pingTab(tabId);
    } catch (e) {
      showError("Injection failed: " + e.message + ". Refresh WhatsApp Web.");
      setLoading(false); return;
    }
  }
  if (!alive) {
    showError("Script not responding. Refresh WhatsApp Web and try again.");
    setLoading(false); return;
  }

  // Show live counter for deep mode
  if (currentMode === "deep") {
    showProgress(true);
    progressInterval = setInterval(() => {
      chrome.storage.local.get("extractProgress", (d) => {
        updateProgressCount(d.extractProgress || 0);
      });
    }, 250);
  }

  chrome.tabs.sendMessage(tabId, { action: "EXTRACT", mode: currentMode }, (resp) => {
    clearInterval(progressInterval);
    progressInterval = null;
    setLoading(false);
    showProgress(false);
    chrome.storage.local.remove("extractProgress");

    if (chrome.runtime.lastError) {
      showError("Error: " + chrome.runtime.lastError.message); return;
    }
    if (!resp) {
      showError("No response. Make sure WhatsApp Web is fully loaded."); return;
    }
    const numbers = resp.numbers || [];
    if (!numbers.length) {
      showError("No numbers found. Use Deep Scroll mode and make sure chats are visible."); return;
    }
    showResults(numbers);
  });
}

// ── Save ──────────────────────────────────────────────────────────────────────
function saveFile(format) {
  if (!extractedNumbers.length) return;
  const ts = new Date().toISOString().replace(/[:.]/g,"-").slice(0,19);
  let content, mimeType, filename;
  if (format === "txt") {
    content = extractedNumbers.join("\n");
    mimeType = "text/plain"; filename = `whatsapp_numbers_${ts}.txt`;
  } else if (format === "csv") {
    content = "phone_number\n" + extractedNumbers.join("\n");
    mimeType = "text/csv"; filename = `whatsapp_numbers_${ts}.csv`;
  } else {
    content = JSON.stringify({ extracted_at: new Date().toISOString(), count: extractedNumbers.length, numbers: extractedNumbers }, null, 2);
    mimeType = "application/json"; filename = `whatsapp_numbers_${ts}.json`;
  }
  const btnId = { txt:"saveTxt", csv:"saveCsv", json:"saveJson" }[format];
  const btn = document.getElementById(btnId);
  chrome.runtime.sendMessage({ action:"DOWNLOAD", content, filename, mimeType }, () => {
    const orig = btn.innerHTML;
    btn.innerHTML = "✅ Saved!";
    setTimeout(() => { btn.innerHTML = orig; }, 1800);
  });
}

// ── Init ──────────────────────────────────────────────────────────────────────
(async function () {
  const dot = document.getElementById("statusDot");
  const tabId = await getActiveTab();
  if (!tabId) { dot.className = "status-dot error"; dot.title = "Open WhatsApp Web first"; return; }
  dot.className = "status-dot connected";
  dot.title = "WhatsApp Web detected";
})();
