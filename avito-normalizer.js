export const ESSENTIALS_PRODUCTS = [
  { key: "hoodie", name: "Худи", category: "Худи", sizes: ["XS", "S", "M", "L", "XL"] },
  { key: "pants", name: "Штаны", category: "Штаны", sizes: ["S", "M", "L", "XL"] },
  { key: "tshirt", name: "Футболка", category: "Футболки", sizes: ["XS", "S", "M", "L", "XL"] },
  { key: "shorts", name: "Шорты", category: "Шорты", sizes: ["S", "M", "L", "XL"] },
];

export const ESSENTIALS_COLORS = [
  { key: "light-oatmeal", name: "Light Oatmeal", russian: "молочный" },
  { key: "dark-oatmeal", name: "Dark Oatmeal", russian: "тёмно-серый" },
  { key: "stretch-lim", name: "Stretch Lim", russian: "чёрный" },
];

const TYPE_PATTERNS = {
  hoodie: /(?:худи|кофт\w*|hoodie)/i,
  pants: /(?:штан\w*|брюк\w*|pants|джоггер\w*)/i,
  tshirt: /(?:футболк\w*|t[\s-]?shirt|\btee\b)/i,
  shorts: /(?:шорт\w*|shorts)/i,
};

export function normalizeAvitoListing(source = {}) {
  return {
    id: String(source.avito_item_id || source.avitoItemId || ""),
    title: String(source.title || "Без названия").trim(),
    description: String(source.description || "").trim(),
    price: Number(source.price || 0),
    image: String(source.image || ""),
    url: String(source.url || ""),
    capturedAt: String(source.captured_at || source.capturedAt || ""),
  };
}

export function isEssentialsListing(source = {}) {
  const text = `${source.title || ""} ${source.description || ""}`;
  return /essentials/i.test(text) || /fear\s+of\s+god/i.test(text);
}

export function getEssentialsTypes(source = {}) {
  const title = String(source.title || "");
  const fromTitle = Object.entries(TYPE_PATTERNS)
    .filter(([, pattern]) => pattern.test(title))
    .map(([type]) => type);
  if (fromTitle.length) return fromTitle;

  const description = String(source.description || "");
  if (/низ\p{L}*/iu.test(description) && /верх\p{L}*/iu.test(description)) {
    return ["hoodie", "pants"];
  }
  const descriptionLead = description.split(/\n|\.(?:\s|$)/)[0] || "";
  return Object.entries(TYPE_PATTERNS)
    .filter(([, pattern]) => pattern.test(descriptionLead))
    .map(([type]) => type);
}

function mode(values) {
  const counts = new Map();
  values.filter((value) => value > 0).forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] || 0;
}

export function essentialsCatalogSummary(listings = []) {
  return ESSENTIALS_PRODUCTS.map((product) => {
    const related = listings.filter((listing) => getEssentialsTypes(listing).includes(product.key));
    const standalone = related.filter((listing) => getEssentialsTypes(listing).length === 1);
    const prices = (standalone.length ? standalone : related).map((listing) => listing.price);
    return {
      ...product,
      listings: related,
      listPrice: mode(prices),
      image: related.find((listing) => listing.image)?.image || "",
      avitoUrl: related.find((listing) => listing.url)?.url || "",
    };
  });
}

export function createEssentialsVariants(listings, makeId, nextSku) {
  const variants = [];
  for (const product of essentialsCatalogSummary(listings)) {
    const sourceListingIds = [...new Set(product.listings.map((listing) => listing.id).filter(Boolean))];
    for (const color of ESSENTIALS_COLORS) {
      for (const size of product.sizes) {
        variants.push({
          id: makeId(),
          sku: nextSku(),
          catalogKey: `essentials:${product.key}:${color.key}:${size.toLowerCase()}`,
          name: `${product.name} · ${color.name}`,
          brand: "Fear Of God Essentials",
          category: product.category,
          productType: product.key,
          color: color.name,
          colorLabel: `${color.name} (${color.russian})`,
          size,
          purchasePrice: 0,
          listPrice: product.listPrice,
          status: "available",
          quantity: 1,
          measurements: "",
          image: product.image,
          avitoUrl: product.avitoUrl,
          sourceListingIds,
          notes: `Нормализовано из ${sourceListingIds.length} объявлений Авито. Закупочную цену и фактический остаток нужно подтвердить.`,
        });
      }
    }
  }
  return variants;
}
