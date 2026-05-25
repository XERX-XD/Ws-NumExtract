// content.js — WhatsApp Web number extractor
if (!window.__waExtractorLoaded) {
  window.__waExtractorLoaded = true;

  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  function cleanPhone(raw) {
    if (!raw) return null;
    const digits = raw.replace(/[\s\-().]/g, "");
    const m = digits.match(/^\+?(\d{7,15})$/);
    if (!m) return null;
    return digits.startsWith("+") ? digits : "+" + m[1];
  }

  // Collect every phone number visible in the DOM RIGHT NOW
  function snapCurrentNumbers() {
    const found = new Set();

    // 1. span[title] — most reliable, e.g. title="+977 980-8947614"
    document.querySelectorAll("span[title]").forEach((el) => {
      const t = (el.getAttribute("title") || "").trim();
      if (/^\+?[\d][\d\s\-]{5,17}\d$/.test(t)) {
        const p = cleanPhone(t);
        if (p) found.add(p);
      }
    });

    // 2. JID in data-id, e.g. "919876543210@c.us"
    document.querySelectorAll("[data-id]").forEach((el) => {
      const m = (el.getAttribute("data-id") || "").match(/^(\d{7,15})@c\.us$/i);
      if (m) found.add("+" + m[1]);
    });

    // 3. aria-label on list items, e.g. aria-label="+977 980-8947614, ..."
    document.querySelectorAll("[aria-label]").forEach((el) => {
      const label = (el.getAttribute("aria-label") || "").split(",")[0].trim();
      if (/^\+?[\d][\d\s\-]{5,17}\d$/.test(label)) {
        const p = cleanPhone(label);
        if (p) found.add(p);
      }
    });

    return found;
  }

  // Find the scrollable chat list pane
  function findPane() {
    // WhatsApp Web renders chats inside a scrollable div inside #pane-side
    const candidates = [
      document.querySelector('[data-testid="chat-list"]'),
      document.querySelector('[aria-label="Chat list"]'),
      document.querySelector('[aria-label="Chats"]'),
      document.getElementById("pane-side"),
    ].filter(Boolean);

    // Among candidates pick the one that is actually scrollable
    for (const el of candidates) {
      if (el.scrollHeight > el.clientHeight + 50) return el;
      // Maybe the scrollable child is one level deeper
      for (const child of el.children) {
        if (child.scrollHeight > child.clientHeight + 50) return child;
      }
    }

    // Last resort: find any narrow tall scrollable div
    return Array.from(document.querySelectorAll("div"))
      .filter((el) => {
        const s = window.getComputedStyle(el);
        return (
          (s.overflowY === "scroll" || s.overflowY === "auto") &&
          el.scrollHeight > el.clientHeight + 100 &&
          el.clientWidth > 50 && el.clientWidth < 500
        );
      })
      .sort((a, b) => b.scrollHeight - a.scrollHeight)[0] || null;
  }

  // ── DEEP SCROLL: scroll step by step, snapshot at each position ───────────
  async function deepExtract(onProgress) {
    const allNumbers = new Set();

    const pane = findPane();
    if (!pane) {
      // No pane — just snapshot what's visible
      snapCurrentNumbers().forEach((n) => allNumbers.add(n));
      onProgress(allNumbers.size);
      return allNumbers;
    }

    // Scroll back to very top first
    pane.scrollTop = 0;
    await sleep(800);

    const STEP = 300;          // small steps so we don't skip rows
    const WAIT = 300;          // ms between steps — wait for React to render
    const MAX_STUCK = 6;       // stop after this many steps with no scroll change
    const MAX_STEPS = 1000;    // absolute safety cap

    let prevScrollTop = -1;
    let stuckCount = 0;
    let step = 0;
    let lastCount = 0;

    while (step < MAX_STEPS) {
      // Snapshot BEFORE scrolling
      snapCurrentNumbers().forEach((n) => allNumbers.add(n));

      if (allNumbers.size !== lastCount) {
        lastCount = allNumbers.size;
        onProgress(allNumbers.size);
      }

      const cur = pane.scrollTop;

      if (cur === prevScrollTop) {
        stuckCount++;
        if (stuckCount >= MAX_STUCK) break; // genuinely at bottom
        // Try a nudge in case the pane needs focus
        pane.dispatchEvent(new WheelEvent("wheel", { deltaY: STEP, bubbles: true }));
      } else {
        stuckCount = 0;
      }
      prevScrollTop = cur;

      pane.scrollTop += STEP;
      await sleep(WAIT);
      step++;
    }

    // Final snapshot at bottom
    snapCurrentNumbers().forEach((n) => allNumbers.add(n));
    onProgress(allNumbers.size);

    return allNumbers;
  }

  // ── Message listener ───────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.action === "PING") {
      sendResponse({ ok: true });
      return true;
    }

    if (msg.action === "EXTRACT") {
      if (msg.mode === "quick") {
        const nums = snapCurrentNumbers();
        sendResponse({ numbers: [...nums], done: true });
        return true;
      }

      // Deep mode — scroll through entire list
      deepExtract((count) => {
        try { chrome.storage.local.set({ extractProgress: count }); } catch (_) {}
      }).then((nums) => {
        sendResponse({ numbers: [...nums], done: true });
      }).catch((err) => {
        sendResponse({ numbers: [], done: true, error: String(err) });
      });
      return true; // keep message channel open
    }
  });
}
