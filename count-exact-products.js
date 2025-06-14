const XLSX = require('xlsx');
const fs = require('fs');

const filePath = '/Users/denisdomashenko/Downloads/AIbuyer/widi wiguna.xlsx';
const fileBuffer = fs.readFileSync(filePath);
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('=== ТОЧНЫЙ ПОДСЧЕТ ТОВАРОВ ===\n');

let realProducts = 0;
let startFound = false;

for (let i = 0; i < jsonData.length; i++) {
  const row = jsonData[i];
  
  // Начинаем считать после заголовка 'NO, Item, /Unit, Price'
  if (row && row[0] === 'NO' && row[1] && row[1].includes('Item')) {
    startFound = true;
    console.log('Найден заголовок на строке:', i, row);
    continue;
  }
  
  if (startFound && row && row.length >= 4) {
    // Проверяем, что это строка с товаром (номер, название, единица, цена)
    if (typeof row[0] === 'number' && row[1] && row[2] && row[3] !== null) {
      realProducts++;
      if (realProducts <= 5) {
        console.log(`Товар ${realProducts}: ${row[1]} - ${row[3]} ${row[2]}`);
      }
      if (realProducts > 225 && realProducts <= 230) {
        console.log(`Товар ${realProducts}: ${row[1]} - ${row[3]} ${row[2]}`);
      }
    }
  }
}

console.log(`\nИТОГО: Реальных товаров в файле = ${realProducts}`);
console.log(`Gemini извлек (видимых): 157`);
console.log(`Процент извлечения: ${Math.round((157 / realProducts) * 100)}%`);

console.log('\n=== ПРИЧИНЫ НЕПОЛНОГО ИЗВЛЕЧЕНИЯ ===');
console.log('1. Ограничение токенов в ответе Gemini (maxOutputTokens: 32768)');
console.log('2. Обрезка длинного JSON ответа');
console.log('3. Большой размер файла - нужен компактный формат');
console.log('4. Возможно нужно активировать compact mode для >150 товаров');

console.log('\n=== РЕКОМЕНДАЦИИ ===');
console.log('1. Использовать компактный формат [{"n":"name","p":price,...}]');
console.log('2. Увеличить maxOutputTokens или разбить на части');
console.log('3. Активировать compact mode в промпте для больших файлов');
console.log('4. Обработка по частям (batch processing)');