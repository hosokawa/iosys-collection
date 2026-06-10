const IOSYS_HOME_URL = "https://iosys.co.jp/";
const IOSYS_URL_PATTERNS = ["https://iosys.co.jp/*", "https://*.iosys.co.jp/*"];

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
    documentUrlPatterns: IOSYS_URL_PATTERNS,
  });

  for (const item of MENU_ITEMS) {
    chrome.contextMenus.create({
      id: item.id,
      parentId: "iosys-root",
      title: item.title,
      contexts: ["all"],
      documentUrlPatterns: IOSYS_URL_PATTERNS,
    });
  }
}

function getMenuTitle(menuItemId) {
  return MENU_ITEMS.find((item) => item.id === menuItemId)?.title ?? "";
}

function extractSearchKey(title) {
  const match = title.match(/\(([^()]+)\)/);
  return match ? match[1].trim() : title.trim();
}

function waitForTabComplete(tabId) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Timed out waiting for IOSYS home page to load."));
    }, 15000);

    const listener = (updatedTabId, changeInfo, tab) => {
      if (updatedTabId !== tabId || changeInfo.status !== "complete") {
        return;
      }

      clearTimeout(timeoutId);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(tab);
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function searchIosysFromMenu(title, tabId) {
  const searchKey = extractSearchKey(title);
  if (!tabId) {
    throw new Error("Could not find the source tab.");
  }

  const tab = await new Promise((resolve, reject) => {
    chrome.tabs.update(tabId, { url: IOSYS_HOME_URL, active: true }, (updatedTab) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(updatedTab);
    });
  });

  await waitForTabComplete(tab.id);

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [searchKey],
    func: (key) => {
      const normalize = (value) => (value || "").replace(/\s+/g, " ").trim();
      const isVisible = (element) => Boolean(element && (element.offsetWidth || element.offsetHeight || element.getClientRects().length));
      const setNativeValue = (element, value) => {
        const inputProto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const descriptor = Object.getOwnPropertyDescriptor(inputProto, "value");

        if (descriptor?.set) {
          descriptor.set.call(element, value);
          return;
        }

        element.value = value;
      };

      const textNodes = Array.from(document.querySelectorAll("*"));
      const labelNode = textNodes.find((element) => normalize(element.textContent).includes("フリーワード検索"));
      const container = labelNode?.closest("form, section, div, header") || document;

      const inputs = Array.from(container.querySelectorAll("input, textarea")).filter((element) => {
        const type = (element.getAttribute("type") || element.type || "").toLowerCase();
        return isVisible(element) && !element.disabled && (type === "" || type === "text" || type === "search" || element.tagName === "TEXTAREA");
      });

      const searchField = inputs[0] || Array.from(document.querySelectorAll("input, textarea")).find((element) => {
        const type = (element.getAttribute("type") || element.type || "").toLowerCase();
        return isVisible(element) && !element.disabled && (type === "" || type === "text" || type === "search" || element.tagName === "TEXTAREA");
      });

      if (!searchField) {
        throw new Error("Could not find the free-word search field on IOSYS.");
      }

      searchField.focus();
      setNativeValue(searchField, key);
      searchField.dispatchEvent(new Event("input", { bubbles: true }));
      searchField.dispatchEvent(new Event("change", { bubbles: true }));

      const buttons = Array.from(container.querySelectorAll("button, input[type='submit'], input[type='button'], a")).filter(isVisible);
      const searchButton = buttons.find((element) => {
        const label = normalize(element.textContent || element.value);
        return label === "検索" || label.includes("検索");
      }) || Array.from(document.querySelectorAll("button, input[type='submit'], input[type='button'], a")).find((element) => {
        const label = normalize(element.textContent || element.value);
        return label === "検索" || label.includes("検索");
      });

      if (!searchButton) {
        throw new Error("Could not find the search button on IOSYS.");
      }

      searchButton.click();
    },
  });
}

chrome.runtime.onInstalled.addListener(() => {
  void rebuildContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  void rebuildContextMenu();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case "pixel-8":
    case "pixel-9":
    case "pixel-10":
      void searchIosysFromMenu(getMenuTitle(info.menuItemId), tab?.id);
      break;
    default:
      break;
  }
});
