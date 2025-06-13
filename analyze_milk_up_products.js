const data = require('./milk_up_ai_vision_complete.json');
const products = data.products;

// Count unique products by name
const uniqueNames = new Set();
const productsByName = {};

products.forEach(p => {
  uniqueNames.add(p.name);
  if (!productsByName[p.name]) {
    productsByName[p.name] = [];
  }
  productsByName[p.name].push(p);
});

console.log('Total products extracted:', products.length);
console.log('Unique product names:', uniqueNames.size);
console.log('\nProducts appearing multiple times:');

Object.entries(productsByName)
  .filter(([name, items]) => items.length > 1)
  .forEach(([name, items]) => {
    console.log(`\n${name}: ${items.length} variations`);
    items.forEach(item => {
      console.log(`  - ${item.price} ${item.unit}, size: ${item.size}, type: ${item.price_type}, page: ${item.source_page}`);
    });
  });