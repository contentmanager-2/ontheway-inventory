const STORAGE_KEY = "ontheway-mvp-v1";

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
  sold: "Продано",
  draft: "Подготовка",
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

let state = loadState();
let currentView = "dashboard";

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getItem(itemId) {
  return state.items.find((item) => item.id === itemId);
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
  const available = state.items.filter((item) => item.status === "available");
  const inventoryCost = available.reduce((sum, item) => sum + item.purchasePrice, 0);
  const potentialRevenue = available.reduce((sum, item) => sum + item.listPrice, 0);

  document.querySelector("#hero-profit").textContent = money.format(contribution);
  document.querySelector("#hero-revenue").textContent = money.format(revenue);
  document.querySelector("#hero-sales-count").textContent = monthlySales.length;
  document.querySelector("#hero-average").textContent = money.format(monthlySales.length ? revenue / monthlySales.length : 0);
  document.querySelector("#metric-grid").innerHTML = [
    metricCard("Чистый результат", money.format(net), `Общие расходы: ${money.format(operatingExpenses)}`),
    metricCard("Товаров в продаже", available.length, `В закупке: ${money.format(inventoryCost)}`),
    metricCard("Потенциальная выручка", money.format(potentialRevenue), "По текущим ценам"),
    metricCard("Маржинальность", `${revenue ? Math.round((contribution / revenue) * 100) : 0}%`, "После прямых затрат"),
  ].join("");

  renderChart();
  renderAging();
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

function renderAging() {
  const items = state.items
    .filter((item) => item.status === "available")
    .map((item) => ({ ...item, age: Math.max(0, Math.round((Date.now() - new Date(item.createdAt).getTime()) / 86400000)) }))
    .sort((a, b) => b.age - a.age)
    .slice(0, 4);
  document.querySelector("#aging-list").innerHTML = items.length
    ? items.map((item) => `<div class="aging-row"><div class="mini-thumb"></div><div><strong>${escapeHtml(item.brand)} · ${escapeHtml(item.name)}</strong><small>${item.sku} · ${money.format(item.listPrice)}</small></div><span class="aging-days">${item.age} дн.</span></div>`).join("")
    : `<p class="muted">Все товары проданы или находятся в подготовке.</p>`;
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
  const filtered = state.items.filter((item) => {
    const haystack = `${item.sku} ${item.brand} ${item.name} ${item.category}`.toLowerCase();
    return haystack.includes(query) && (status === "all" || item.status === status);
  });
  const counts = Object.keys(statusLabels).map((key) => `<span class="summary-chip">${statusLabels[key]}: <strong>${state.items.filter((item) => item.status === key).length}</strong></span>`);
  document.querySelector("#inventory-summary").innerHTML = counts.join("");
  document.querySelector("#product-grid").innerHTML = filtered.map((item) => {
    const visual = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.brand)} ${escapeHtml(item.name)}" loading="lazy" />`
      : `<div class="placeholder">${escapeHtml(item.brand.slice(0, 2).toUpperCase())}</div>`;
    return `<article class="product-card"><div class="product-image">${visual}<span class="status-badge">${statusLabels[item.status]}</span></div><div class="product-content"><span class="product-brand">${escapeHtml(item.brand)}</span><h3>${escapeHtml(item.name)}</h3><span class="product-meta">${item.sku} · ${escapeHtml(item.size || "Без размера")}</span><div class="product-price"><div><small>Цена</small><strong>${money.format(item.listPrice)}</strong></div>${item.status === "available" ? `<button class="sell-button" data-sell="${item.id}" title="Продать">→</button>` : ""}</div></div></article>`;
  }).join("");
  document.querySelector("#inventory-empty").classList.toggle("hidden", filtered.length > 0);
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
  const available = state.items.filter((item) => item.status === "available");
  const saleOptions = available.map((item) => `<option value="${item.id}">${item.sku} · ${escapeHtml(item.brand)} ${escapeHtml(item.name)}</option>`).join("");
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
  document.querySelector("#item-dialog").showModal();
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
  const maxSku = state.items.reduce((max, item) => Math.max(max, Number(item.sku.replace(/\D/g, "")) || 0), 0);
  state.items.unshift({
    id: uid("item"),
    sku: `OTW-${String(maxSku + 1).padStart(4, "0")}`,
    name: data.get("name").trim(),
    brand: data.get("brand").trim(),
    category: data.get("category").trim() || "Без категории",
    size: data.get("size").trim(),
    purchasePrice: Number(data.get("purchasePrice")),
    listPrice: Number(data.get("listPrice")),
    status: "available",
    measurements: data.get("measurements").trim(),
    image: data.get("image").trim(),
    avitoUrl: data.get("avitoUrl").trim(),
    notes: data.get("notes").trim(),
    createdAt: isoDate(),
  });
  saveState();
  renderAll();
  document.querySelector("#item-dialog").close();
  showToast("Вещь добавлена в каталог");
}

function addSale(form) {
  const data = new FormData(form);
  const item = getItem(data.get("itemId"));
  if (!item || item.status !== "available") {
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
  item.status = "sold";
  saveState();
  renderAll();
  document.querySelector("#sale-dialog").close();
  showToast(`${item.sku} отмечена как проданная`);
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

const knownBrands = [
  "Fear Of God Essentials",
  "Fear Of God",
  "Maison Margiela",
  "Stone Island",
  "CP Company",
  "Rick Owens",
  "Arc'teryx",
  "Burberry",
  "Moncler",
  "Prada",
  "MM6",
];

function detectBrand(title = "") {
  const match = knownBrands.find((brand) => title.toLowerCase().includes(brand.toLowerCase()));
  return match || "Не определён";
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
  const existingAvitoIds = new Set(state.items.map((item) => String(item.avitoItemId || "")).filter(Boolean));
  let maxSku = state.items.reduce((max, item) => Math.max(max, Number(item.sku.replace(/\D/g, "")) || 0), 0);
  let imported = 0;
  let skipped = 0;
  for (const source of incoming) {
    const avitoItemId = String(source.avito_item_id || source.avitoItemId || "");
    if (!avitoItemId || existingAvitoIds.has(avitoItemId)) {
      skipped += 1;
      continue;
    }
    maxSku += 1;
    const title = String(source.title || "Без названия").trim();
    const description = String(source.description || "").trim();
    state.items.push({
      id: uid("item"),
      sku: `OTW-${String(maxSku).padStart(4, "0")}`,
      name: title,
      brand: detectBrand(title),
      category: "Импортировано из Авито",
      size: detectSizes(`${title} ${description}`),
      purchasePrice: 0,
      listPrice: Number(source.price || 0),
      status: "draft",
      measurements: "",
      image: String(source.image || ""),
      avitoUrl: String(source.url || ""),
      avitoItemId,
      notes: description,
      createdAt: isoDate(),
    });
    existingAvitoIds.add(avitoItemId);
    imported += 1;
  }
  saveState();
  renderAll();
  changeView("inventory");
  document.querySelector("#inventory-status").value = "draft";
  renderInventory();
  showToast(`Импортировано: ${imported}${skipped ? ` · пропущено: ${skipped}` : ""}`);
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
  if (button) openSaleDialog(button.dataset.sell);
});
document.querySelector("#sale-form").addEventListener("input", updateSalePreview);
document.querySelector("#sale-form").addEventListener("change", updateSalePreview);

document.querySelector("#item-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (event.submitter?.value === "cancel") return document.querySelector("#item-dialog").close();
  addItem(event.currentTarget);
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
if (viewMeta[requestedView]) changeView(requestedView);
renderAll();
