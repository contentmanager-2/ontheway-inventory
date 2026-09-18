import test from "node:test";
import assert from "node:assert/strict";

import {
  createEssentialsVariants,
  getEssentialsTypes,
  isEssentialsListing,
} from "../avito-normalizer.js";

const listings = [
  { id: "1", title: "Худи Fear Of God Essentials", description: "Также есть шорты", price: 8792, image: "hoodie.jpg", url: "https://example.test/1" },
  { id: "2", title: "Худи + штаны Fear Of God Essentials", description: "Комплект", price: 17592, image: "set.jpg", url: "https://example.test/2" },
  { id: "3", title: "Футболка Fear Of God Essentials", description: "XS / S / M / L / XL", price: 5192, image: "tee.jpg", url: "https://example.test/3" },
  { id: "4", title: "Шорты Fear Of God Essentials", description: "S / M / L / XL", price: 5192, image: "shorts.jpg", url: "https://example.test/4" },
];

test("single-product title wins over cross-sells in description", () => {
  assert.deepEqual(getEssentialsTypes(listings[0]), ["hoodie"]);
  assert.deepEqual(getEssentialsTypes(listings[1]), ["hoodie", "pants"]);
  assert.deepEqual(getEssentialsTypes({ title: "Fear OF God essentials L L", description: "Черный низ Л. Светло серый верх Л." }), ["hoodie", "pants"]);
});

test("Essentials recognition covers brand wording", () => {
  assert.equal(isEssentialsListing(listings[0]), true);
  assert.equal(isEssentialsListing({ title: "Maison Margiela" }), false);
});

test("catalog contains exactly 54 canonical color-size variants", () => {
  let id = 0;
  let sku = 0;
  const variants = createEssentialsVariants(listings, () => `item-${++id}`, () => `OTW-${++sku}`);
  assert.equal(variants.length, 54);
  assert.equal(new Set(variants.map((item) => item.catalogKey)).size, 54);
  assert.equal(variants.filter((item) => item.productType === "hoodie").length, 15);
  assert.equal(variants.filter((item) => item.productType === "pants").length, 12);
  assert.equal(variants.filter((item) => item.productType === "tshirt").length, 15);
  assert.equal(variants.filter((item) => item.productType === "shorts").length, 12);
  assert.deepEqual(new Set(variants.map((item) => item.color)), new Set(["Light Oatmeal", "Dark Oatmeal", "Stretch Lim"]));
});
