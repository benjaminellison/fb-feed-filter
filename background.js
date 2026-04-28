const MENU_ID = "cbf-add-to-training";

function registerMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Add to clickbait training queue",
      contexts: ["all"],
      documentUrlPatterns: ["*://*.youtube.com/*"],
    });
  });
}

chrome.runtime.onInstalled.addListener(registerMenu);
chrome.runtime.onStartup.addListener(registerMenu);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  if (!tab || tab.id === undefined) return;
  chrome.tabs.sendMessage(tab.id, { type: "cbf-capture-training" }).catch(() => {});
});
