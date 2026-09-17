const STORAGE_ITEMS = "onthewayAvitoItems";
const STORAGE_ENABLED = "onthewayCaptureEnabled";

const countNode = document.querySelector("#count");
const statusNode = document.querySelector("#status");

async function refresh() {
  const result = await chrome.storage.local.get([STORAGE_ITEMS, STORAGE_ENABLED]);
  countNode.textContent = (result[STORAGE_ITEMS] || []).length;
  statusNode.textContent = result[STORAGE_ENABLED] ? "Сбор включён — прокручивайте каталог" : "Сбор выключен";
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function send(type) {
  const tab = await activeTab();
  if (!tab?.id || !tab.url?.startsWith("https://www.avito.ru/brands/ontheway")) {
    statusNode.textContent = "Откройте страницу профиля OnTheWay на Авито";
    return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { type });
  } catch {
    statusNode.textContent = "Обновите страницу Авито после установки расширения";
    return;
  }
  await refresh();
}

document.querySelector("#start").addEventListener("click", () => send("start"));
document.querySelector("#scan").addEventListener("click", () => send("scan"));
document.querySelector("#stop").addEventListener("click", () => send("stop"));
document.querySelector("#clear").addEventListener("click", async () => {
  await chrome.storage.local.set({ [STORAGE_ITEMS]: [] });
  await refresh();
});
document.querySelector("#export").addEventListener("click", async () => {
  const { [STORAGE_ITEMS]: items = [] } = await chrome.storage.local.get(STORAGE_ITEMS);
  if (!items.length) {
    statusNode.textContent = "Сначала соберите карточки";
    return;
  }
  const blob = new Blob([JSON.stringify({ version: 1, source: "avito-profile", items }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `ontheway-avito-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  statusNode.textContent = `Сохранено карточек: ${items.length}`;
});

refresh();
