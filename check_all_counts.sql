SELECT 
  (SELECT COUNT(*) FROM products) as products_count,
  (SELECT COUNT(*) FROM suppliers) as suppliers_count,
  (SELECT COUNT(*) FROM uploads) as uploads_count,
  (SELECT COUNT(*) FROM prices) as prices_count;