const MENU_URL_PATTERNS = ["https://iosys.co.jp/*", "https://*.iosys.co.jp/*"];

const MENU_ITEMS = [
  { id: "pixel-8", title: "Pixel 8(GZPFO)" },
  { id: "pixel-9", title: "Pixel 9(G1B60)" },
  { id: "pixel-10", title: "Pixel 10(GL066)" },
];

async function rebuildContextMenu() {
  await new Promise((resolve) => chrome.contextMenus.removeAll(resolve));

  chrome.contextMenus.create({
    id: "iosys-root",
    title: "IOSYS",
    contexts: ["all"],
    documentUrlPatterns: MENU_URL_PATTERNS,
  });

  for (const item of MENU_ITEMS) {
    chrome.contextMenus.create({
      id: item.id,
      parentId: "iosys-root",
      title: item.title,
      contexts: ["all"],
      documentUrlPatterns: MENU_URL_PATTERNS,
    });
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void rebuildContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  void rebuildContextMenu();
});

chrome.contextMenus.onClicked.addListener((info) => {
  // Menu actions will be wired up in the next step.
  switch (info.menuItemId) {
    case "pixel-8":
    case "pixel-9":
    case "pixel-10":
      console.log(`Clicked ${info.menuItemId}`);
      break;
    default:
      break;
  }
});
