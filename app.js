import {
  ESSENTIALS_COLORS,
  ESSENTIALS_PRODUCTS,
  createEssentialsVariants,
  isEssentialsListing,
  normalizeAvitoListing,
} from "./avito-normalizer.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config.js";

const STORAGE_KEY = "ontheway-mvp-v1";
const WORKSPACE_ID = "ontheway";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const money = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const shortDate = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const monthName = new Intl.DateTimeFormat("ru-RU", { month: "short" });

const statusLabels = {
  available: "В продаже",
  reserved: "Бронь",
  draft: "Подготовка",
  archived: "Архив",
};

const viewMeta = {
  dashboard: ["Сегодня", "Финансовый обзор"],
  inventory: ["Каталог OnTheWay", "Вещи"],
  sales: ["Финансовый журнал", "Продажи"],
  expenses: ["Операционные затраты", "Расходы"],
};

function isoDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function monthOffset(offset, day = 12) {
  const date = new Date();
  date.setMonth(date.getMonth() + offset, day);
  return isoDate(date);
}

function daysAgo(count) {
  const date = new Date();
  date.setDate(date.getDate() - count);
  return isoDate(date);
}

function createSeed() {
  const items = [
    ["OTW-0001", "Stone Island", "Nylon Metal Jacket", "Куртки", "L", 18000, 42000, "available", 74],
    ["OTW-0002", "Prada", "Linea Rossa Vest", "Жилеты", "M", 22000, 49000, "available", 32],
    ["OTW-0003", "CP Company", "Chrome-R Overshirt", "Рубашки", "XL", 14500, 33000, "available", 19],
    ["OTW-0004", "Burberry", "Vintage Nova Check", "Рубашки", "L", 9500, 24500, "sold", 108],
    ["OTW-0005", "Moncler", "Maya Down Jacket", "Куртки", "2", 41000, 78000, "sold", 46],
    ["OTW-0006", "Maison Margiela", "Replica Sneakers", "Обувь", "43", 21000, 39000, "reserved", 8],
    ["OTW-0007", "Arc'teryx", "Beta LT Jacket", "Куртки", "M", 27000, 52000, "draft", 2],
    ["OTW-0008", "Rick Owens", "DRKSHDW Cargo", "Брюки", "50", 26000, 56000, "sold", 152],
  ].map(([sku, brand, name, category, size, purchasePrice, listPrice, status, age], index) => ({
    id: `item-${index + 1}`,
    sku,
    brand,
    name,
    category,
    size,
    purchasePrice,
    listPrice,
    status,
    measurements: "",
    image: "",
    avitoUrl: "",
    notes: "",
    createdAt: daysAgo(age),
  }));

  const makeSale = (id, itemId, soldAt, salePrice, commission, promotion, shipping, channel = "Авито") => {
    const item = items.find((entry) => entry.id === itemId);
    const costs = commission + promotion + shipping;
    return {
      id,
      itemId,
      soldAt,
      channel,
      salePrice,
      purchaseCost: item.purchasePrice,
      commission,
      promotion,
      shipping,
      otherCost: 0,
      profit: salePrice - item.purchasePrice - costs,
      avitoOrderId: "",
    };
  };

  return {
    items,
    sales: [
      makeSale("sale-1", "item-4", monthOffset(0, 5), 23500, 1175, 450, 250),
      makeSale("sale-2", "item-5", monthOffset(0, 11), 76000, 3800, 900, 350),
      makeSale("sale-3", "item-8", monthOffset(-1, 22), 53500, 2675, 600, 300),
      { ...makeSale("sale-4", "item-4", monthOffset(-3, 16), 21000, 1050, 400, 250), id: "sale-history-1", itemId: "history-1", itemLabel: "Burberry Trench Coat", purchaseCost: 9000 },
      { ...makeSale("sale-5", "item-5", monthOffset(-5, 9), 68000, 3400, 800, 300), id: "sale-history-2", itemId: "history-2", itemLabel: "Moncler Grenoble", purchaseCost: 35000 },
    ],
    expenses: [
      { id: "expense-1", date: monthOffset(0, 2), category: "Упаковка", amount: 1650, note: "Пакеты и коробки", itemId: "" },
      { id: "expense-2", date: monthOffset(0, 8), category: "Сервисы", amount: 990, note: "Рабочие сервисы", itemId: "" },
      { id: "expense-3", date: monthOffset(-1, 3), category: "Продвижение Авито", amount: 2200, note: "Общее продвижение профиля", itemId: "" },
    ],
  };
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || createSeed();
  } catch {
    return createSeed();
  }
}

function normalizeState(nextState) {
  const normalized = nextState && typeof nextState === "object" ? nextState : createSeed();
  normalized.items = (normalized.items || []).map((item) => {
    const status = item.status === "sold" ? "archived" : item.status;
    const defaultQuantity = ["available", "reserved"].includes(status) ? 1 : 0;
    return {
      ...item,
      status,
      quantity: Math.max(0, Number(item.quantity ?? defaultQuantity)),
      archiveReason: item.status === "sold" ? "sold" : item.archiveReason || "",
    };
  });
  normalized.sales ||= [];
  normalized.expenses ||= [];
  normalized.deletedCatalogKeys ||= [];
  normalized.migrations ||= {};
  return normalized;
}

const DEMO_ITEM_IDS = new Set(Array.from({ length: 8 }, (_, index) => `item-${index + 1}`));
const DEMO_SALE_IDS = new Set(["sale-1", "sale-2", "sale-3", "sale-history-1", "sale-history-2"]);
const DEMO_EXPENSE_IDS = new Set(["expense-1", "expense-2", "expense-3"]);

function migrateWorkspaceState(nextState) {
  const itemCount = nextState.items.length;
  const saleCount = nextState.sales.length;
  const expenseCount = nextState.expenses.length;
  nextState.items = nextState.items.filter((item) => !DEMO_ITEM_IDS.has(item.id));
  nextState.sales = nextState.sales.filter(
    (sale) => !DEMO_SALE_IDS.has(sale.id) && !DEMO_ITEM_IDS.has(sale.itemId),
  );
  nextState.expenses = nextState.expenses.filter((expense) => !DEMO_EXPENSE_IDS.has(expense.id));
  let changed = nextState.items.length !== itemCount
    || nextState.sales.length !== saleCount
    || nextState.expenses.length !== expenseCount;
  if (!nextState.migrations.avitoMinimumStockV1) {
    nextState.items.forEach((item) => {
      const importedFromAvito = Boolean(item.avitoItemId || item.sourceListingIds?.length);
      if (!importedFromAvito || item.status === "archived") return;
      if (itemQuantity(item) < 1) item.quantity = 1;
      if (item.status === "draft") item.status = "available";
    });
    nextState.migrations.avitoMinimumStockV1 = true;
    changed = true;
  }
  if (!nextState.migrations.yandexGalleryPilotV1) {
    const pilotItem = nextState.items.find((item) => item.sku === "OTW-0267");
    if (pilotItem) {
      pilotItem.photoFolderUrl = "https://disk.yandex.ru/d/KsDa-M15Olz6Rw";
      nextState.migrations.yandexGalleryPilotV1 = true;
      changed = true;
    }
  }
  return changed;
}

let state = normalizeState(loadState());
migrateWorkspaceState(state);
let currentView = "dashboard";
let currentUser = null;
let remoteReady = false;
let saveTimer = null;
let syncInFlight = false;
let syncRequested = false;
let realtimeChannel = null;

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!remoteReady || !currentUser) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(flushRemoteState, 250);
}

function setSyncStatus(label, isError = false) {
  const indicator = document.querySelector("#sync-indicator");
  if (!indicator) return;
  indicator.querySelector("span").textContent = label;
  indicator.classList.toggle("error", isError);
}

async function flushRemoteState() {
  if (!remoteReady || !currentUser) return;
  if (syncInFlight) {
    syncRequested = true;
    return;
  }
  syncInFlight = true;
  do {
    syncRequested = false;
    setSyncStatus("Сохраняем…");
    const snapshot = JSON.parse(JSON.stringify(state));
    const { error } = await supabase.from("workspace_state").upsert({
      id: WORKSPACE_ID,
      state: snapshot,
      updated_by: currentUser.id,
      updated_at: new Date().toISOString(),
    });
    if (error) {
      console.error(error);
      setSyncStatus("Ошибка синхронизации", true);
      showToast("Не удалось сохранить в общую базу. Локальная копия сохранена.");
      break;
    }
    setSyncStatus("Все изменения сохранены");
  } while (syncRequested);
  syncInFlight = false;
}

async function loadRemoteState() {
  setSyncStatus("Загружаем общую базу…");
  const { data, error } = await supabase
    .from("workspace_state")
    .select("state, updated_at")
    .eq("id", WORKSPACE_ID)
    .maybeSingle();
  if (error) throw error;
  if (data?.state) {
    state = normalizeState(data.state);
    const migratedWorkspace = migrateWorkspaceState(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (migratedWorkspace) syncRequested = true;
  } else {
    const isLocalSetup = ["127.0.0.1", "localhost"].includes(window.location.hostname);
    if (!isLocalSetup) {
      const setupError = new Error("WORKSPACE_NOT_INITIALIZED");
      setupError.code = "WORKSPACE_NOT_INITIALIZED";
      throw setupError;
    }
    const { error: createError } = await supabase.from("workspace_state").insert({
      id: WORKSPACE_ID,
      state,
      updated_by: currentUser.id,
    });
    if (createError) throw createError;
  }
  remoteReady = true;
  if (syncRequested) await flushRemoteState();
  else setSyncStatus("Все изменения сохранены");
}

function subscribeToRemoteChanges() {
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  realtimeChannel = supabase
    .channel("ontheway-workspace")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "workspace_state", filter: `id=eq.${WORKSPACE_ID}` },
      (payload) => {
        if (!payload.new?.state || payload.new.updated_by === currentUser?.id) return;
        state = normalizeState(payload.new.state);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        renderAll();
        setSyncStatus("Получены изменения команды");
        showToast("Каталог обновлён другим сотрудником");
      },
    )
    .subscribe();
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getItem(itemId) {
  return state.items.find((item) => item.id === itemId);
}

function itemQuantity(item) {
  return Math.max(0, Number(item?.quantity || 0));
}

function saleLabel(sale) {
  const item = getItem(sale.itemId);
  return item ? `${item.brand} ${item.name}` : sale.itemLabel || "Архивная вещь";
}

function isCurrentMonth(dateString) {
  const value = new Date(`${dateString}T12:00:00`);
  const now = new Date();
  return value.getMonth() === now.getMonth() && value.getFullYear() === now.getFullYear();
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2400);
}

function changeView(view) {
  currentView = view;
  document.querySelectorAll(".view").forEach((node) => node.classList.toggle("active", node.id === `view-${view}`));
  document.querySelectorAll(".nav-item").forEach((node) => node.classList.toggle("active", node.dataset.view === view));
  const [eyebrow, title] = viewMeta[view];
  document.querySelector("#page-eyebrow").textContent = eyebrow;
  document.querySelector("#page-title").textContent = title;
  document.querySelector(".sidebar").classList.remove("open");
  window.location.hash = view;
}

function metricCard(label, value, detail = "") {
  return `<article class="metric-card"><span>${label}</span><strong>${value}</strong>${detail ? `<small>${detail}</small>` : ""}</article>`;
}

function renderDashboard() {
  const monthlySales = state.sales.filter((sale) => isCurrentMonth(sale.soldAt));
  const monthlyExpenses = state.expenses.filter((expense) => isCurrentMonth(expense.date));
  const revenue = monthlySales.reduce((sum, sale) => sum + sale.salePrice, 0);
  const contribution = monthlySales.reduce((sum, sale) => sum + sale.profit, 0);
  const operatingExpenses = monthlyExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  const net = contribution - operatingExpenses;
  const available = state.items.filter((item) => item.status === "available" && itemQuantity(item) > 0);
  const availableUnits = available.reduce((sum, item) => sum + itemQuantity(item), 0);
  const inventoryCost = available.reduce((sum, item) => sum + item.purchasePrice * itemQuantity(item), 0);
  const potentialRevenue = available.reduce((sum, item) => sum + item.listPrice * itemQuantity(item), 0);

  document.querySelector("#hero-profit").textContent = money.format(contribution);
  document.querySelector("#hero-revenue").textContent = money.format(revenue);
  document.querySelector("#hero-sales-count").textContent = monthlySales.length;
  document.querySelector("#hero-average").textContent = money.format(monthlySales.length ? revenue / monthlySales.length : 0);
  document.querySelector("#metric-grid").innerHTML = [
    metricCard("Чистый результат", money.format(net), `Общие расходы: ${money.format(operatingExpenses)}`),
    metricCard("Вещей в продаже", availableUnits, `В закупке: ${money.format(inventoryCost)}`),
    metricCard("Потенциальная выручка", money.format(potentialRevenue), "По текущим ценам"),
    metricCard("Маржинальность", `${revenue ? Math.round((contribution / revenue) * 100) : 0}%`, "После прямых затрат"),
  ].join("");

  renderChart();
  renderRecentSales();
}

function renderChart() {
  const buckets = [];
  const now = new Date();
  for (let offset = -5; offset <= 0; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const value = state.sales
      .filter((sale) => {
        const sold = new Date(`${sale.soldAt}T12:00:00`);
        return sold.getFullYear() === date.getFullYear() && sold.getMonth() === date.getMonth();
      })
      .reduce((sum, sale) => sum + sale.salePrice, 0);
    buckets.push({ label: monthName.format(date).replace(".", ""), value });
  }
  const max = Math.max(...buckets.map((bucket) => bucket.value), 1);
  document.querySelector("#revenue-chart").innerHTML = buckets
    .map((bucket) => `<div class="chart-column"><div class="chart-bar" data-value="${money.format(bucket.value)}" style="height:${Math.max(3, (bucket.value / max) * 88)}%"></div><span>${bucket.label}</span></div>`)
    .join("");
}

function renderRecentSales() {
  const sales = [...state.sales].sort((a, b) => b.soldAt.localeCompare(a.soldAt)).slice(0, 5);
  document.querySelector("#recent-sales").innerHTML = sales.length
    ? sales.map((sale) => `<tr><td><div class="table-item"><div><strong>${escapeHtml(saleLabel(sale))}</strong><small>${getItem(sale.itemId)?.sku || "Архив"}</small></div></div></td><td>${shortDate.format(new Date(`${sale.soldAt}T12:00:00`))}</td><td>${escapeHtml(sale.channel)}</td><td>${money.format(sale.salePrice)}</td><td class="${sale.profit >= 0 ? "positive" : "negative"}">${money.format(sale.profit)}</td></tr>`).join("")
    : `<tr><td colspan="5">Продаж пока нет</td></tr>`;
}

function renderInventory() {
  const query = document.querySelector("#inventory-search").value.trim().toLowerCase();
  const status = document.querySelector("#inventory-status").value;
  const matchesFilters = (item) => {
    const haystack = `${item.sku} ${item.brand} ${item.name} ${item.category} ${item.color || ""}`.toLowerCase();
    return haystack.includes(query) && (status === "all" || item.status === status);
  };
  const essentials = state.items.filter((item) => item.catalogKey?.startsWith("essentials:"));
  const regular = state.items.filter((item) => !item.catalogKey?.startsWith("essentials:") && matchesFilters(item));
  const familyMatchesQuery = !query || essentials.some((item) => `${item.brand} ${item.name} ${item.category} ${item.color}`.toLowerCase().includes(query));
  const familyMatchesStatus = status === "all" || essentials.some((item) => item.status === status);
  const counts = Object.keys(statusLabels).map((key) => {
    const entries = state.items.filter((item) => item.status === key);
    const units = entries.reduce((sum, item) => sum + itemQuantity(item), 0);
    return `<span class="summary-chip">${statusLabels[key]}: <strong>${units}</strong> шт. · ${entries.length} поз.</span>`;
  });
  document.querySelector("#inventory-summary").innerHTML = counts.join("");

  const familyHtml = essentials.length && familyMatchesQuery && familyMatchesStatus ? (() => {
    const visibleVariants = status === "all" ? essentials : essentials.filter((item) => item.status === status);
    const stock = visibleVariants.reduce((sum, item) => sum + itemQuantity(item), 0);
    const activeVariants = visibleVariants.filter((item) => itemQuantity(item) > 0).length;
    const sourceCount = new Set(essentials.flatMap((item) => item.sourceListingIds || [])).size;
    return `<article class="product-card family-card" data-essentials-card><div class="product-content"><div class="family-heading"><span class="product-brand">Fear Of God Essentials</span><h3>Весь ассортимент Essentials</h3></div><div class="family-stats"><div class="family-stat"><span>Остаток</span><strong>${stock} шт.</strong></div><div class="family-stat"><span>Вариантов</span><strong>${activeVariants} / ${essentials.length}</strong></div><div class="family-stat"><span>Объявлений</span><strong>${sourceCount}</strong></div></div><button type="button" class="button button-primary family-open">Открыть ассортимент →</button></div></article>`;
  })() : "";

  const renderRegularCard = (item) => {
    const visual = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.brand)} ${escapeHtml(item.name)}" loading="lazy" />`
      : `<div class="placeholder">${escapeHtml(item.brand.slice(0, 2).toUpperCase())}</div>`;
    const sources = item.sourceListingIds?.length
      ? `<span class="source-count">${item.sourceListingIds.length} объявл. Авито</span>`
      : "";
    const gallery = item.photoFolderUrl ? `<span class="source-count photo-source">Фото на Яндекс Диске</span>` : "";
    return `<article class="product-card" data-edit-item="${item.id}"><div class="product-image">${visual}<span class="status-badge">${statusLabels[item.status] || item.status}</span></div><div class="product-content"><span class="product-brand">${escapeHtml(item.brand)}</span><h3>${escapeHtml(item.name)}</h3><span class="product-meta">${item.sku} · ${escapeHtml(item.color || "Без цвета")} · ${escapeHtml(item.size || "Без размера")}</span>${sources}${gallery}<div class="product-price"><div><small>Цена · <span class="stock-count">${itemQuantity(item)} шт.</span></small><strong>${money.format(item.listPrice)}</strong></div>${item.status === "available" && itemQuantity(item) > 0 ? `<button class="sell-button" data-sell="${item.id}" title="Продать">→</button>` : ""}</div></div></article>`;
  };
  const brandGroups = Map.groupBy
    ? Map.groupBy(regular, (item) => item.brand || "Без бренда")
    : regular.reduce((groups, item) => groups.set(item.brand || "Без бренда", [...(groups.get(item.brand || "Без бренда") || []), item]), new Map());
  const regularHtml = [...brandGroups.entries()]
    .sort(([brandA], [brandB]) => brandA.localeCompare(brandB, "ru"))
    .map(([brand, items]) => `<details class="brand-folder" ${query ? "open" : ""}><summary><span>${escapeHtml(brand)}</span><small>${items.length} карточек · ${items.reduce((sum, item) => sum + itemQuantity(item), 0)} шт.</small></summary><div class="brand-product-grid">${items.map(renderRegularCard).join("")}</div></details>`)
    .join("");
  const essentialsFolder = familyHtml
    ? `<details class="brand-folder essentials-folder" open><summary><span>Fear Of God Essentials</span><small>1 карточка · ${essentials.reduce((sum, item) => sum + itemQuantity(item), 0)} шт.</small></summary><div class="brand-product-grid">${familyHtml}</div></details>`
    : "";
  document.querySelector("#product-grid").innerHTML = essentialsFolder + regularHtml;
  document.querySelector("#inventory-empty").classList.toggle("hidden", Boolean(familyHtml) || regular.length > 0);
}

function renderSales() {
  const sales = [...state.sales].sort((a, b) => b.soldAt.localeCompare(a.soldAt));
  document.querySelector("#sales-table").innerHTML = sales.length
    ? sales.map((sale) => {
      const direct = sale.commission + sale.promotion + sale.shipping + sale.otherCost;
      return `<tr><td><strong>${escapeHtml(saleLabel(sale))}</strong><br><small>${getItem(sale.itemId)?.sku || "Архив"}</small></td><td>${shortDate.format(new Date(`${sale.soldAt}T12:00:00`))}</td><td>${escapeHtml(sale.channel)}</td><td>${money.format(sale.salePrice)}</td><td>${money.format(sale.purchaseCost)}</td><td>${money.format(direct)}</td><td class="${sale.profit >= 0 ? "positive" : "negative"}">${money.format(sale.profit)}</td></tr>`;
    }).join("")
    : `<tr><td colspan="7">Продаж пока нет</td></tr>`;
}

function renderExpenses() {
  const monthly = state.expenses.filter((expense) => isCurrentMonth(expense.date));
  const total = monthly.reduce((sum, expense) => sum + expense.amount, 0);
  const avito = monthly.filter((expense) => expense.category.includes("Авито")).reduce((sum, expense) => sum + expense.amount, 0);
  document.querySelector("#expense-metrics").innerHTML = [
    metricCard("Расходы месяца", money.format(total)),
    metricCard("Авито", money.format(avito)),
    metricCard("Операций", monthly.length),
    metricCard("Средний расход", money.format(monthly.length ? total / monthly.length : 0)),
  ].join("");
  const expenses = [...state.expenses].sort((a, b) => b.date.localeCompare(a.date));
  document.querySelector("#expenses-table").innerHTML = expenses.length
    ? expenses.map((expense) => `<tr><td>${shortDate.format(new Date(`${expense.date}T12:00:00`))}</td><td>${escapeHtml(expense.category)}</td><td>${escapeHtml(expense.note || "—")}</td><td>${expense.itemId ? escapeHtml(getItem(expense.itemId)?.sku || "Архив") : "Общий"}</td><td class="negative">−${money.format(expense.amount)}</td></tr>`).join("")
    : `<tr><td colspan="5">Расходов пока нет</td></tr>`;
}

function renderSelects() {
  const available = state.items.filter((item) => item.status === "available" && itemQuantity(item) > 0);
  const saleOptions = available.map((item) => `<option value="${item.id}">${item.sku} · ${escapeHtml(item.brand)} ${escapeHtml(item.name)} · ${escapeHtml(item.size || "—")} · ${itemQuantity(item)} шт.</option>`).join("");
  document.querySelector("#sale-item-select").innerHTML = `<option value="">Выберите вещь</option>${saleOptions}`;
  document.querySelector("#expense-item-select").innerHTML = `<option value="">Общий расход</option>${state.items.map((item) => `<option value="${item.id}">${item.sku} · ${escapeHtml(item.brand)} ${escapeHtml(item.name)}</option>`).join("")}`;
}

function renderAll() {
  renderDashboard();
  renderInventory();
  renderSales();
  renderExpenses();
  renderSelects();
}

function openItemDialog() {
  const form = document.querySelector("#item-form");
  form.reset();
  form.elements.quantity.value = 1;
  document.querySelector("#item-dialog").showModal();
}

function openEditItemDialog(itemId) {
  const item = getItem(itemId);
  if (!item) return;
  const form = document.querySelector("#edit-item-form");
  form.reset();
  ["id", "name", "brand", "category", "status", "color", "size", "quantity", "purchasePrice", "listPrice", "measurements", "image", "photoFolderUrl", "avitoUrl", "notes"].forEach((field) => {
    form.elements[field].value = item[field] ?? "";
  });
  document.querySelector("#edit-item-title").textContent = `${item.sku} · ${item.name}`;
  document.querySelector("#edit-item-dialog").showModal();
  renderYandexGallery(item);
}

const YANDEX_PUBLIC_API = "https://cloud-api.yandex.net/v1/disk/public/resources";
let activeYandexPhotos = [];
let activeYandexPublicKey = "";

async function fetchYandexResource(publicKey, path = "", previewSize = "M") {
  const url = new URL(YANDEX_PUBLIC_API);
  url.searchParams.set("public_key", publicKey);
  url.searchParams.set("limit", "100");
  url.searchParams.set("preview_size", previewSize);
  url.searchParams.set("preview_crop", "false");
  if (path) url.searchParams.set("path", path);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Yandex Disk: ${response.status}`);
  return response.json();
}

async function renderYandexGallery(item) {
  const gallery = document.querySelector("#item-photo-gallery");
  activeYandexPhotos = [];
  activeYandexPublicKey = item.photoFolderUrl || "";
  if (!activeYandexPublicKey) {
    gallery.classList.add("hidden");
    gallery.innerHTML = "";
    return;
  }
  gallery.classList.remove("hidden");
  gallery.innerHTML = `<div class="gallery-heading"><div><span class="eyebrow">Детальные фото</span><h3>Загружаем с Яндекс Диска…</h3></div></div>`;
  try {
    const resource = await fetchYandexResource(activeYandexPublicKey);
    activeYandexPhotos = (resource._embedded?.items || [])
      .filter((entry) => entry.type === "file" && entry.mime_type?.startsWith("image/"))
      .sort((a, b) => a.name.localeCompare(b.name, "ru"));
    const photos = activeYandexPhotos.map((photo, index) => `<button class="gallery-thumb" type="button" data-yandex-photo="${index}" title="${escapeHtml(photo.name)}"><img src="${escapeHtml(photo.preview || "")}" alt="${escapeHtml(photo.name)}" loading="lazy" /><span>${index + 1}</span></button>`).join("");
    gallery.innerHTML = `<div class="gallery-heading"><div><span class="eyebrow">Детальные фото</span><h3>${activeYandexPhotos.length} фото</h3></div><a href="${escapeHtml(activeYandexPublicKey)}" target="_blank" rel="noopener">Открыть папку ↗</a></div>${photos ? `<div class="gallery-grid">${photos}</div>` : `<p class="muted">В папке пока нет изображений.</p>`}`;
  } catch (error) {
    console.error(error);
    gallery.innerHTML = `<div class="gallery-heading"><div><span class="eyebrow">Детальные фото</span><h3>Не удалось загрузить папку</h3></div><a href="${escapeHtml(activeYandexPublicKey)}" target="_blank" rel="noopener">Открыть на Яндекс Диске ↗</a></div><p class="muted">Проверьте, что доступ к папке открыт по ссылке.</p>`;
  }
}

async function openYandexPhoto(index) {
  const photo = activeYandexPhotos[index];
  if (!photo) return;
  const dialog = document.querySelector("#photo-viewer-dialog");
  const image = document.querySelector("#photo-viewer-image");
  const download = document.querySelector("#download-photo-original");
  image.src = photo.preview || "";
  document.querySelector("#photo-viewer-name").textContent = photo.name;
  download.href = photo.file || activeYandexPublicKey;
  dialog.showModal();
  try {
    const full = await fetchYandexResource(activeYandexPublicKey, photo.path, "XXXL");
    if (full.preview) image.src = full.preview;
    if (full.file) download.href = full.file;
  } catch (error) {
    console.error(error);
  }
}

function renderEssentialsMatrix() {
  const variants = state.items.filter((item) => item.catalogKey?.startsWith("essentials:"));
  document.querySelector("#essentials-matrix").innerHTML = ESSENTIALS_PRODUCTS.map((product) => {
    const productVariants = variants.filter((item) => item.productType === product.key);
    const stock = productVariants.reduce((sum, item) => sum + itemQuantity(item), 0);
    const colors = ESSENTIALS_COLORS.map((color) => {
      const colorVariants = productVariants.filter((item) => item.color === color.name);
      const rows = colorVariants.map((item) => `<div class="variant-row" data-variant-row="${item.id}"><span class="variant-size">${escapeHtml(item.size)}</span><input type="number" min="0" name="quantity" value="${itemQuantity(item)}" aria-label="Количество ${escapeHtml(item.name)} ${escapeHtml(item.size)}" /><input type="number" min="0" name="purchasePrice" value="${Number(item.purchasePrice || 0)}" aria-label="Закупка ${escapeHtml(item.name)} ${escapeHtml(item.size)}" /><input type="number" min="0" name="listPrice" value="${Number(item.listPrice || 0)}" aria-label="Цена ${escapeHtml(item.name)} ${escapeHtml(item.size)}" /><button class="variant-delete" type="button" data-delete-variant="${item.id}" title="Удалить вариант">×</button></div>`).join("");
      return `<section class="color-group"><h4>${escapeHtml(color.name)}</h4><small>${escapeHtml(color.russian)}</small><div class="matrix-legend"><span>Размер</span><span>Штук</span><span>Закупка</span><span>Продажа</span></div>${rows || `<p class="muted">Вариантов нет</p>`}</section>`;
    }).join("");
    return `<section class="essentials-product"><div class="essentials-product-heading"><h3>${escapeHtml(product.name)}</h3><span>${stock} шт. в остатке · ${product.sizes.join(" / ")}</span></div><div class="color-groups">${colors}</div></section>`;
  }).join("");
}

function openEssentialsDialog() {
  renderEssentialsMatrix();
  document.querySelector("#essentials-dialog").showModal();
}

function openSaleDialog(itemId = "", prefill = {}) {
  renderSelects();
  const form = document.querySelector("#sale-form");
  form.reset();
  form.elements.soldAt.value = isoDate();
  form.elements.itemId.value = itemId;
  const item = getItem(itemId);
  form.elements.salePrice.value = prefill.salePrice || item?.listPrice || "";
  form.elements.commission.value = prefill.commission || 0;
  form.elements.promotion.value = prefill.promotion || 0;
  form.elements.shipping.value = prefill.shipping || 0;
  form.elements.otherCost.value = prefill.otherCost || 0;
  updateSalePreview();
  document.querySelector("#sale-dialog").showModal();
}

function updateSalePreview() {
  const form = document.querySelector("#sale-form");
  const item = getItem(form.elements.itemId.value);
  const salePrice = Number(form.elements.salePrice.value || 0);
  const directCosts = ["commission", "promotion", "shipping", "otherCost"].reduce((sum, field) => sum + Number(form.elements[field].value || 0), 0);
  const profit = salePrice - (item?.purchasePrice || 0) - directCosts;
  document.querySelector("#sale-preview").innerHTML = item
    ? `Закупка: ${money.format(item.purchasePrice)} · прямые затраты: ${money.format(directCosts)}<br>Прибыль: <strong class="${profit >= 0 ? "positive" : "negative"}">${money.format(profit)}</strong>`
    : "Выберите вещь, чтобы увидеть расчёт.";
}

function addItem(form) {
  const data = new FormData(form);
  const quantity = Math.max(0, Number(data.get("quantity") || 0));
  const maxSku = state.items.reduce((max, item) => Math.max(max, Number(item.sku.replace(/\D/g, "")) || 0), 0);
  state.items.unshift({
    id: uid("item"),
    sku: `OTW-${String(maxSku + 1).padStart(4, "0")}`,
    name: data.get("name").trim(),
    brand: data.get("brand").trim(),
    category: data.get("category").trim() || "Без категории",
    size: data.get("size").trim(),
    color: data.get("color").trim(),
    quantity,
    purchasePrice: Number(data.get("purchasePrice")),
    listPrice: Number(data.get("listPrice")),
    status: quantity > 0 ? "available" : "draft",
    measurements: data.get("measurements").trim(),
    image: data.get("image").trim(),
    photoFolderUrl: data.get("photoFolderUrl").trim(),
    avitoUrl: data.get("avitoUrl").trim(),
    notes: data.get("notes").trim(),
    createdAt: isoDate(),
  });
  saveState();
  renderAll();
  document.querySelector("#item-dialog").close();
  showToast("Вещь добавлена в каталог");
}

function saveEditedItem(form) {
  const data = new FormData(form);
  const item = getItem(data.get("id"));
  if (!item) return;
  const quantity = Math.max(0, Number(data.get("quantity") || 0));
  item.name = data.get("name").trim();
  item.brand = data.get("brand").trim();
  item.category = data.get("category").trim() || "Без категории";
  item.color = data.get("color").trim();
  item.size = data.get("size").trim();
  item.quantity = quantity;
  item.purchasePrice = Number(data.get("purchasePrice") || 0);
  item.listPrice = Number(data.get("listPrice") || 0);
  item.measurements = data.get("measurements").trim();
  item.image = data.get("image").trim();
  item.photoFolderUrl = data.get("photoFolderUrl").trim();
  item.avitoUrl = data.get("avitoUrl").trim();
  item.notes = data.get("notes").trim();
  item.status = data.get("status");
  if (quantity === 0 && item.status === "available") item.status = "draft";
  if (quantity > 0 && item.status === "draft") item.status = "available";
  saveState();
  renderAll();
  document.querySelector("#edit-item-dialog").close();
  showToast(`${item.sku} сохранена`);
}

function archiveEditedItem() {
  const item = getItem(document.querySelector("#edit-item-form").elements.id.value);
  if (!item) return;
  item.status = "archived";
  item.quantity = 0;
  item.archiveReason = item.archiveReason || "manual";
  item.archivedAt = isoDate();
  saveState();
  renderAll();
  document.querySelector("#edit-item-dialog").close();
  showToast(`${item.sku} добавлена в архив`);
}

function deleteEditedItem() {
  const item = getItem(document.querySelector("#edit-item-form").elements.id.value);
  if (!item) return;
  if (state.sales.some((sale) => sale.itemId === item.id)) {
    showToast("У вещи есть продажи — её можно только архивировать");
    return;
  }
  if (!window.confirm(`Удалить ${item.sku} окончательно? Это действие нельзя отменить.`)) return;
  if (item.catalogKey) state.deletedCatalogKeys.push(item.catalogKey);
  state.items = state.items.filter((entry) => entry.id !== item.id);
  state.expenses = state.expenses.map((expense) => expense.itemId === item.id ? { ...expense, itemId: "" } : expense);
  saveState();
  renderAll();
  document.querySelector("#edit-item-dialog").close();
  showToast(`${item.sku} удалена окончательно`);
}

function saveEssentialsMatrix() {
  document.querySelectorAll("[data-variant-row]").forEach((row) => {
    const item = getItem(row.dataset.variantRow);
    if (!item) return;
    item.quantity = Math.max(0, Number(row.querySelector('[name="quantity"]').value || 0));
    item.purchasePrice = Number(row.querySelector('[name="purchasePrice"]').value || 0);
    item.listPrice = Number(row.querySelector('[name="listPrice"]').value || 0);
    item.status = item.quantity > 0 ? "available" : "draft";
  });
  saveState();
  renderAll();
  document.querySelector("#essentials-dialog").close();
  showToast("Остатки Essentials сохранены");
}

function deleteEssentialsVariant(itemId) {
  const item = getItem(itemId);
  if (!item) return;
  if (state.sales.some((sale) => sale.itemId === item.id)) {
    showToast("У варианта есть продажи — переведите его в архив");
    return;
  }
  if (!window.confirm(`Удалить ${item.name}, размер ${item.size} окончательно?`)) return;
  if (item.catalogKey) state.deletedCatalogKeys.push(item.catalogKey);
  state.items = state.items.filter((entry) => entry.id !== item.id);
  saveState();
  renderEssentialsMatrix();
  renderAll();
  showToast("Вариант удалён");
}

function addSale(form) {
  const data = new FormData(form);
  const item = getItem(data.get("itemId"));
  if (!item || item.status !== "available" || itemQuantity(item) < 1) {
    showToast("Выберите доступную вещь");
    return;
  }
  const salePrice = Number(data.get("salePrice"));
  const commission = Number(data.get("commission") || 0);
  const promotion = Number(data.get("promotion") || 0);
  const shipping = Number(data.get("shipping") || 0);
  const otherCost = Number(data.get("otherCost") || 0);
  state.sales.unshift({
    id: uid("sale"),
    itemId: item.id,
    soldAt: data.get("soldAt") || isoDate(),
    channel: data.get("channel") || "Авито",
    salePrice,
    purchaseCost: item.purchasePrice,
    commission,
    promotion,
    shipping,
    otherCost,
    profit: salePrice - item.purchasePrice - commission - promotion - shipping - otherCost,
    avitoOrderId: data.get("avitoOrderId").trim(),
  });
  item.quantity = Math.max(0, itemQuantity(item) - 1);
  if (item.quantity === 0) {
    item.status = "archived";
    item.archiveReason = "sold";
    item.archivedAt = isoDate();
  }
  saveState();
  renderAll();
  document.querySelector("#sale-dialog").close();
  showToast(item.quantity > 0 ? `${item.sku}: осталось ${item.quantity} шт.` : `${item.sku} продана и перенесена в архив`);
}

function addExpense(form) {
  const data = new FormData(form);
  state.expenses.unshift({
    id: uid("expense"),
    category: data.get("category"),
    amount: Number(data.get("amount")),
    date: data.get("date") || isoDate(),
    itemId: data.get("itemId"),
    note: data.get("note").trim(),
  });
  saveState();
  renderAll();
  document.querySelector("#expense-dialog").close();
  showToast("Расход сохранён");
}

const brandPatterns = [
  ["Fear Of God Essentials", /(?:fear\s+of\s+god\s+essentials|essentials\s+fear\s+of\s+god)/i],
  ["Fear Of God", /fear\s+of\s+god/i],
  ["MM6 Maison Margiela", /\bMM6\b.*(?:Maison\s+Margiela)?/i],
  ["Maison Margiela", /Maison\s+Margiela/i],
  ["C.P. Company", /C\.?\s*P\.?\s*Company/i],
  ["Stone Island", /Stone\s+Island/i],
  ["Rick Owens", /Rick\s+Owens/i],
  ["Arc'teryx", /Arc['’]?teryx/i],
  ["Louis Vuitton", /Louis\s+Vuitton/i],
  ["Loro Piana", /Loro\s+Piana/i],
  ["Ermenegildo Zegna", /Er(?:m|n)enegildo\s+Zegna/i],
  ["Comme des Garçons", /Comme\s+Des\s+Gar(?:c|s)ons/i],
  ["Carhartt WIP", /Carhartt\s+Wip/i],
  ["Polo Ralph Lauren", /Polo\s+Ralph\s+Lauren/i],
  ["Cav Empt", /Cav\s+Empt/i],
  ["New Balance", /New\s+Balance/i],
  ["The North Face", /The\s+North\s+Face/i],
  ["Golden Goose", /Golden\s+Goose/i],
  ["Gosha Rubchinskiy", /Гоша\s+Рубчинск/i],
  ["Yung Lean", /Yung\s+Lean/i],
  ["Kanye West", /Kanye\s+West/i],
  ["True Religion", /True\s+Religion/i],
  ["Paul & Shark", /Paul\s+Shark/i],
  ["GU Undercover", /GU\s+Undercover/i],
  ["BAPE", /\bBape\b/i],
  ["Balenciaga", /Balenciaga/i],
  ["Burberry", /Burberry/i],
  ["Moncler", /Moncler/i],
  ["Prada", /Prada/i],
  ["Goyard", /Goyard/i],
  ["Gucci", /Gucci/i],
  ["Canali", /Canali/i],
  ["Dickies", /Dickies/i],
  ["Vetements", /Vetem(?:en|em)ts/i],
  ["Hermès", /Herm[eèé]s/i],
  ["Supreme", /Supreme/i],
  ["Nike", /\bNike\b/i],
  ["Uniqlo", /\bUniqlo\b/i],
  ["Jordan", /\bJordan\b/i],
  ["Nemen", /Nemen/i],
  ["Yeezy", /Yeezy/i],
  ["H&M", /(?:\bH&M\b|Glenn\s+Martens)/i],
  ["Richmond", /Richmond/i],
  ["Oklou", /Oklou/i],
  ["Богема Ленинград", /Богема\s+Ленинград/i],
];

function detectBrand(title = "") {
  return brandPatterns.find(([, pattern]) => pattern.test(title))?.[0] || "Не определён";
}

function repairImportedBrands() {
  let changed = false;
  state.items.forEach((item) => {
    if (item.catalogKey) return;
    const detected = detectBrand(`${item.brand || ""} ${item.name}`);
    if (detected !== "Не определён" && item.brand !== detected) {
      item.brand = detected;
      changed = true;
    }
  });
  if (changed) saveState();
}

function detectSizes(text = "") {
  const matches = text.match(/\b(?:XXXL|XXL|XXS|XL|XS|S|M|L)\b(?:\s*[\/,]\s*\b(?:XXXL|XXL|XXS|XL|XS|S|M|L)\b)*/gi);
  return matches ? [...new Set(matches.map((value) => value.toUpperCase()))].join(", ") : "";
}

async function importAvitoFile(file) {
  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    showToast("Не удалось прочитать JSON-файл");
    return;
  }
  const incoming = Array.isArray(payload) ? payload : payload.items;
  if (!Array.isArray(incoming)) {
    showToast("В файле нет списка объявлений");
    return;
  }
  state.avitoListings ||= [];

  const oldEssentialsDrafts = state.items.filter((item) =>
    item.avitoItemId
    && item.category === "Импортировано из Авито"
    && item.status === "draft"
    && Number(item.purchasePrice || 0) === 0
    && isEssentialsListing({ title: item.name, description: item.notes }),
  );
  for (const item of oldEssentialsDrafts) {
    if (!state.avitoListings.some((listing) => listing.id === String(item.avitoItemId))) {
      state.avitoListings.push(normalizeAvitoListing({
        avitoItemId: item.avitoItemId,
        title: item.name,
        description: item.notes,
        price: item.listPrice,
        image: item.image,
        url: item.avitoUrl,
      }));
    }
  }
  const oldDraftIds = new Set(oldEssentialsDrafts.map((item) => item.id));
  state.items = state.items.filter((item) => !oldDraftIds.has(item.id));

  const existingAvitoIds = new Set([
    ...state.items.map((item) => String(item.avitoItemId || "")),
    ...state.avitoListings.map((listing) => String(listing.id || "")),
  ].filter(Boolean));
  let maxSku = state.items.reduce((max, item) => Math.max(max, Number(item.sku.replace(/\D/g, "")) || 0), 0);
  let imported = 0;
  let skipped = 0;
  for (const source of incoming) {
    const listing = normalizeAvitoListing(source);
    const avitoItemId = listing.id;
    if (!avitoItemId || existingAvitoIds.has(avitoItemId)) {
      skipped += 1;
      continue;
    }
    state.avitoListings.push(listing);
    existingAvitoIds.add(avitoItemId);
    imported += 1;
    if (isEssentialsListing(listing)) continue;

    maxSku += 1;
    const title = listing.title;
    const description = listing.description;
    state.items.push({
      id: uid("item"),
      sku: `OTW-${String(maxSku).padStart(4, "0")}`,
      name: title,
      brand: detectBrand(title),
      category: "Импортировано из Авито",
      size: detectSizes(`${title} ${description}`),
      purchasePrice: 0,
      listPrice: listing.price,
      status: "available",
      quantity: 1,
      measurements: "",
      image: listing.image,
      avitoUrl: listing.url,
      avitoItemId,
      notes: description,
      createdAt: isoDate(),
    });
  }

  const essentialsListings = state.avitoListings.filter(isEssentialsListing);
  const existingCatalogKeys = new Set(state.items.map((item) => item.catalogKey).filter(Boolean));
  const normalizedVariants = createEssentialsVariants(
    essentialsListings,
    () => uid("item"),
    () => `OTW-${String(++maxSku).padStart(4, "0")}`,
  );
  let variantsCreated = 0;
  for (const variant of normalizedVariants) {
    if (state.deletedCatalogKeys.includes(variant.catalogKey)) continue;
    const existing = state.items.find((item) => item.catalogKey === variant.catalogKey);
    if (existing) {
      existing.sourceListingIds = variant.sourceListingIds;
      if (!existing.listPrice) existing.listPrice = variant.listPrice;
      if (!existing.image) existing.image = variant.image;
      continue;
    }
    if (!existingCatalogKeys.has(variant.catalogKey)) {
      state.items.push({ ...variant, createdAt: isoDate() });
      existingCatalogKeys.add(variant.catalogKey);
      variantsCreated += 1;
    }
  }
  saveState();
  renderAll();
  changeView("inventory");
  document.querySelector("#inventory-status").value = "draft";
  renderInventory();
  showToast(`Объявлений: +${imported} · вариантов Essentials: +${variantsCreated}${skipped ? ` · уже были: ${skipped}` : ""}`);
}

function amountAfterKeyword(message, words) {
  const wordPattern = words.join("|");
  const match = message.match(new RegExp(`(?:${wordPattern})[^\\d]{0,12}([\\d\\s]+)`, "i"));
  return match ? Number(match[1].replace(/\s/g, "")) : 0;
}

function parseAiSale(message) {
  const normalized = message.toLowerCase();
  const skuMatch = normalized.match(/otw[-\s]?(\d{1,4})/i);
  let item = skuMatch ? state.items.find((entry) => Number(entry.sku.replace(/\D/g, "")) === Number(skuMatch[1])) : null;
  if (!item) {
    item = state.items
      .filter((entry) => entry.status === "available")
      .find((entry) => normalized.includes(entry.brand.toLowerCase()) || normalized.includes(entry.name.toLowerCase()));
  }
  const commission = amountAfterKeyword(message, ["комисси(?:я|ю|и)", "комиссия авито"]);
  const promotion = amountAfterKeyword(message, ["продвижени(?:е|я)", "реклама"]);
  const shipping = amountAfterKeyword(message, ["доставк(?:а|у|и)", "упаковк(?:а|у|и)"]);
  let salePrice = amountAfterKeyword(message, ["за", "цена(?: продажи)?"]);
  if (!salePrice) {
    const withoutSku = message.replace(/otw[-\s]?\d{1,4}/gi, "");
    const knownCosts = new Set([commission, promotion, shipping].filter(Boolean));
    salePrice = [...withoutSku.matchAll(/\d[\d\s]*/g)]
      .map((match) => Number(match[0].replace(/\s/g, "")))
      .find((value) => value >= 1000 && !knownCosts.has(value)) || 0;
  }
  return { item, salePrice, commission, promotion, shipping };
}

function handleAiMessage(form) {
  const message = new FormData(form).get("message").trim();
  const parsed = parseAiSale(message);
  const result = document.querySelector("#ai-result");
  if (!parsed.item) {
    result.classList.remove("hidden");
    result.innerHTML = "Не удалось однозначно найти вещь. Добавьте артикул вида <strong>OTW-0001</strong> — так финансовая операция не попадёт не в ту карточку.";
    return;
  }
  if (parsed.item.status !== "available") {
    result.classList.remove("hidden");
    result.innerHTML = `Нашёл ${parsed.item.sku}, но её текущий статус — <strong>${statusLabels[parsed.item.status]}</strong>. Проверьте карточку перед повторной продажей.`;
    return;
  }
  document.querySelector("#ai-dialog").close();
  openSaleDialog(parsed.item.id, parsed);
  showToast("Сообщение разобрано — проверьте суммы");
}

document.querySelectorAll(".nav-item").forEach((button) => button.addEventListener("click", () => changeView(button.dataset.view)));
document.querySelectorAll("[data-go]").forEach((button) => button.addEventListener("click", () => changeView(button.dataset.go)));
document.querySelector("#mobile-menu").addEventListener("click", () => document.querySelector(".sidebar").classList.toggle("open"));
document.querySelector("#open-add-item").addEventListener("click", openItemDialog);
document.querySelector("#open-manual-sale").addEventListener("click", () => openSaleDialog());
document.querySelector("#open-add-expense").addEventListener("click", () => {
  const form = document.querySelector("#expense-form");
  form.reset();
  form.elements.date.value = isoDate();
  document.querySelector("#expense-dialog").showModal();
});
function openAiDialog() {
  const form = document.querySelector("#ai-form");
  form.reset();
  document.querySelector("#ai-result").classList.add("hidden");
  document.querySelector("#ai-dialog").showModal();
}

document.querySelector("#open-ai-sale").addEventListener("click", openAiDialog);
document.querySelector("#hero-ai-sale").addEventListener("click", openAiDialog);
document.querySelector("#inventory-search").addEventListener("input", renderInventory);
document.querySelector("#inventory-status").addEventListener("change", renderInventory);
document.querySelector("#open-avito-import").addEventListener("click", () => document.querySelector("#avito-import-file").click());
document.querySelector("#avito-import-file").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (file) await importAvitoFile(file);
  event.target.value = "";
});
document.querySelector("#product-grid").addEventListener("click", (event) => {
  const button = event.target.closest("[data-sell]");
  if (button) {
    event.stopPropagation();
    openSaleDialog(button.dataset.sell);
    return;
  }
  if (event.target.closest("[data-essentials-card]")) {
    openEssentialsDialog();
    return;
  }
  const card = event.target.closest("[data-edit-item]");
  if (card) openEditItemDialog(card.dataset.editItem);
});
document.querySelector("#item-photo-gallery").addEventListener("click", (event) => {
  const photo = event.target.closest("[data-yandex-photo]");
  if (photo) openYandexPhoto(Number(photo.dataset.yandexPhoto));
});
document.querySelector("#close-photo-viewer").addEventListener("click", () => document.querySelector("#photo-viewer-dialog").close());
document.querySelector("#sale-form").addEventListener("input", updateSalePreview);
document.querySelector("#sale-form").addEventListener("change", updateSalePreview);

document.querySelector("#item-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.submitter?.value === "cancel") return document.querySelector("#item-dialog").close();
  addItem(event.currentTarget);
});
document.querySelector("#edit-item-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.submitter?.value === "cancel") return document.querySelector("#edit-item-dialog").close();
  saveEditedItem(event.currentTarget);
});
document.querySelector("#archive-item").addEventListener("click", archiveEditedItem);
document.querySelector("#delete-item").addEventListener("click", deleteEditedItem);
document.querySelector("#essentials-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.submitter?.value === "cancel") return document.querySelector("#essentials-dialog").close();
  saveEssentialsMatrix();
});
document.querySelector("#essentials-matrix").addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete-variant]");
  if (button) deleteEssentialsVariant(button.dataset.deleteVariant);
});
document.querySelector("#sale-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.submitter?.value === "cancel") return document.querySelector("#sale-dialog").close();
  addSale(event.currentTarget);
});
document.querySelector("#expense-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.submitter?.value === "cancel") return document.querySelector("#expense-dialog").close();
  addExpense(event.currentTarget);
});
document.querySelector("#ai-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.submitter?.value === "cancel") return document.querySelector("#ai-dialog").close();
  handleAiMessage(event.currentTarget);
});

const requestedView = window.location.hash.slice(1);

function showAuthMessage(message, success = false) {
  const node = document.querySelector("#auth-error");
  node.textContent = message;
  node.classList.remove("hidden");
  node.style.color = success ? "#477100" : "";
  node.style.background = success ? "#eff7cf" : "";
}

function clearAuthMessage() {
  const node = document.querySelector("#auth-error");
  node.classList.add("hidden");
  node.style.color = "";
  node.style.background = "";
}

function showAuthScreen() {
  document.querySelector("#loading-screen").classList.add("hidden");
  document.querySelector("#app-shell").classList.add("hidden");
  document.querySelector("#auth-screen").classList.remove("hidden");
}

function showLoginForm() {
  showAuthScreen();
  document.querySelector("#auth-title").textContent = "Вход в магазин";
  document.querySelector("#auth-copy").textContent = "Войдите с рабочего телефона или компьютера. Каталог и продажи будут общими для всей команды.";
  document.querySelector("#auth-form").classList.remove("hidden");
  document.querySelector("#password-form").classList.add("hidden");
}

function showPasswordForm() {
  showAuthScreen();
  document.querySelector("#auth-title").textContent = "Установить пароль";
  document.querySelector("#auth-copy").textContent = "Придумайте новый пароль для аккаунта владельца. После сохранения выполните первый вход в локальной версии.";
  document.querySelector("#auth-form").classList.add("hidden");
  document.querySelector("#password-form").classList.remove("hidden");
  document.querySelector("#password-form").reset();
  clearAuthMessage();
}

async function enterApp(session) {
  if (!session?.user) return;
  currentUser = session.user;
  document.querySelector("#signed-in-user").textContent = currentUser.email || "Пользователь";
  try {
    await loadRemoteState();
  } catch (error) {
    console.error(error);
    remoteReady = false;
    setSyncStatus("База ещё не настроена", true);
    showAuthScreen();
    showAuthMessage(
      error.code === "WORKSPACE_NOT_INITIALIZED"
        ? "Первый вход нужно выполнить в локальной версии на основном компьютере — так текущий каталог безопасно перенесётся в общую базу."
        : "Не удалось подключиться к общей базе. Проверьте настройки Supabase и повторите вход.",
    );
    if (error.code === "WORKSPACE_NOT_INITIALIZED") {
      showLoginForm();
      await supabase.auth.signOut();
      showAuthMessage("Первый вход нужно выполнить по локальному адресу на основном компьютере — так текущий каталог безопасно перенесётся в общую базу.");
    }
    return;
  }
  repairImportedBrands();
  subscribeToRemoteChanges();
  document.querySelector("#loading-screen").classList.add("hidden");
  document.querySelector("#auth-screen").classList.add("hidden");
  document.querySelector("#app-shell").classList.remove("hidden");
  if (viewMeta[requestedView]) changeView(requestedView);
  renderAll();
}

function leaveApp() {
  currentUser = null;
  remoteReady = false;
  if (realtimeChannel) {
    supabase.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }
  clearAuthMessage();
  showLoginForm();
}

document.querySelector("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearAuthMessage();
  const form = event.currentTarget;
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  submit.textContent = "Входим…";
  const { error } = await supabase.auth.signInWithPassword({
    email: form.elements.email.value.trim(),
    password: form.elements.password.value,
  });
  submit.disabled = false;
  submit.textContent = "Войти";
  if (error) showAuthMessage(error.message === "Invalid login credentials" ? "Неверный email или пароль." : error.message);
});

document.querySelector("#password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  clearAuthMessage();
  const form = event.currentTarget;
  const password = form.elements.password.value;
  if (password !== form.elements.passwordConfirm.value) {
    showAuthMessage("Пароли не совпадают.");
    return;
  }
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  submit.textContent = "Сохраняем…";
  const { error } = await supabase.auth.updateUser({ password });
  submit.disabled = false;
  submit.textContent = "Сохранить пароль";
  if (error) {
    showAuthMessage(error.message);
    return;
  }
  await supabase.auth.signOut();
  showLoginForm();
  showAuthMessage("Пароль сохранён. Теперь войдите в локальной версии на основном компьютере.", true);
});

document.querySelector("#reset-password").addEventListener("click", async () => {
  const form = document.querySelector("#auth-form");
  const email = form.elements.email.value.trim();
  if (!email) {
    showAuthMessage("Сначала укажите email.");
    form.elements.email.focus();
    return;
  }
  clearAuthMessage();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "https://contentmanager-2.github.io/ontheway-inventory/",
  });
  showAuthMessage(error ? error.message : "Письмо для установки нового пароля отправлено. Откройте последнюю ссылку из письма.", !error);
});

document.querySelector("#sign-out").addEventListener("click", () => supabase.auth.signOut());

supabase.auth.onAuthStateChange((event, session) => {
  if (event === "SIGNED_OUT") leaveApp();
  if (event === "PASSWORD_RECOVERY") showPasswordForm();
  if (event === "SIGNED_IN" && session) window.setTimeout(() => enterApp(session), 0);
});

async function bootstrap() {
  const { data } = await supabase.auth.getSession();
  if (data.session) await enterApp(data.session);
  else showLoginForm();
}

bootstrap();
