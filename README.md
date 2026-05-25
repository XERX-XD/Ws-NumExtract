# WhatsApp Chat Number Extractor — Chrome Extension

Extract all phone numbers from your WhatsApp Web chats and export them to TXT, CSV, or JSON.

---

## 📦 Installation (Load Unpacked)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **"Load unpacked"**
4. Select the `whatsapp-extractor` folder
5. The extension icon appears in your toolbar ✅

---

## 🚀 How to Use

1. Open **[web.whatsapp.com](https://web.whatsapp.com)** and log in
2. Wait for your chats to fully load
3. Click the **WA Extractor** extension icon
4. Choose extraction mode:
   - **⚡ Quick** — Scans currently visible chats instantly
   - **🔍 Deep Scroll** — Automatically scrolls through ALL chats (recommended for full extraction)
5. Click **EXTRACT NUMBERS**
6. Preview found numbers in the popup
7. Save as **.TXT**, **.CSV**, or **.JSON**

---

## 📁 Output Formats

| Format | Contents |
|--------|----------|
| `.txt` | One number per line |
| `.csv` | `phone_number` column, importable to Excel/Sheets |
| `.json` | Array with metadata (timestamp, count, numbers) |

---

## ⚙️ How It Works

- `content.js` — Injected into WhatsApp Web. Reads chat JIDs (e.g. `919876543210@c.us`) from the DOM and also scans text nodes for phone patterns.
- `popup.js` / `popup.html` — Extension UI, sends messages to content script.
- `background.js` — Handles file downloads via the Chrome Downloads API.

---

## 🔒 Permissions Used

| Permission | Reason |
|-----------|--------|
| `activeTab` | Read the current WhatsApp Web tab |
| `scripting` | Inject content script if needed |
| `downloads` | Save extracted numbers to a file |
| `host_permissions: web.whatsapp.com` | Restrict to WhatsApp Web only |

---

## ⚠️ Notes

- Only works on **web.whatsapp.com** (not the desktop app)
- Only **individual chat numbers** are extracted; group chats are excluded
- Numbers shown are from chats you've had — not your full contact book
- The extension does not send any data anywhere; everything stays local

---

## 🛠 Troubleshooting

| Problem | Fix |
|---------|-----|
| "No numbers found" | Switch to **Deep Scroll** mode |
| "Content script not responding" | Refresh WhatsApp Web, then try again |
| Extension doesn't appear | Make sure Developer Mode is on in `chrome://extensions` |
