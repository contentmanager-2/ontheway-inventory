const STORAGE_ITEMS = "onthewayAvitoItems";
const STORAGE_ENABLED = "onthewayCaptureEnabled";

let scanTimer;

function text(node) {
  return node?.textContent?.replace(/\s+/g, " ").trim() || "";
}

function absoluteUrl(value = "") {
  try {
    const url = new URL(value, window.location.origin);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

function extractCard(card) {
  const titleNode = card.querySelector('[data-marker="item-title"]');
  const priceNode = card.querySelector('[itemprop="price"]');
  const descriptionNode = card.querySelector(':scope > meta[itemprop="description"]');
  const imageNode = card.querySelector("img");
  const avitoItemId = card.dataset.itemId;
  if (!avitoItemId || !titleNode) return null;
  return {
    avito_item_id: avitoItemId,
    title: text(titleNode),
    price: Number(priceNode?.getAttribute("content") || text(priceNode).replace(/\D/g, "") || 0),
    description: descriptionNode?.getAttribute("content")?.trim() || "",
    image: imageNode?.currentSrc || imageNode?.src || "",
    url: absoluteUrl(titleNode.getAttribute("href")),
    captured_at: new Date().toISOString(),
  };
}

async function scanVisibleCards() {
  const { [STORAGE_ENABLED]: enabled } = await chrome.storage.local.get(STORAGE_ENABLED);
  if (!enabled) return { enabled: false, count: 0, added: 0 };
  const cards = [...document.querySelectorAll("[data-item-id]")];
  const found = cards.map(extractCard).filter(Boolean);
  const { [STORAGE_ITEMS]: stored = [] } = await chrome.storage.local.get(STORAGE_ITEMS);
  const byId = new Map(stored.map((item) => [String(item.avito_item_id), item]));
  const before = byId.size;
  found.forEach((item) => byId.set(String(item.avito_item_id), item));
  const items = [...byId.values()];
  await chrome.storage.local.set({ [STORAGE_ITEMS]: items });
  return { enabled: true, count: items.length, added: items.length - before };
}

function scheduleScan() {
  window.clearTimeout(scanTimer);
  scanTimer = window.setTimeout(scanVisibleCards, 500);
}

const observer = new MutationObserver(scheduleScan);
observer.observe(document.documentElement, { childList: true, subtree: true });

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "scan") {
    scanVisibleCards().then(sendResponse);
    return true;
  }
  if (message?.type === "start") {
    chrome.storage.local.set({ [STORAGE_ENABLED]: true }).then(() => scanVisibleCards()).then(sendResponse);
    return true;
  }
  if (message?.type === "stop") {
    chrome.storage.local.set({ [STORAGE_ENABLED]: false }).then(() => sendResponse({ enabled: false }));
    return true;
  }
  return false;
});

scheduleScan();
