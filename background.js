// background.js

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "DOWNLOAD") {
    const { content, filename, mimeType } = msg;
    const dataUrl =
      "data:" + mimeType + ";charset=utf-8," + encodeURIComponent(content);

    chrome.downloads.download(
      {
        url: dataUrl,
        filename: filename,
        saveAs: false,
      },
      (downloadId) => {
        sendResponse({ downloadId });
      }
    );

    return true; // async
  }
});
