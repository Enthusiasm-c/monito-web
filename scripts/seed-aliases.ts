import { bulkCreateAliases } from '../app/services/database/aliasService';

import { prisma } from '../lib/prisma';

async function seedAliases() {
  console.log('Starting alias seeding...');
  
  try {
    // Find common products to create aliases for
    const products = await prisma.product.findMany({
      where: {
        name: {
          in: [
            'Carrot', 'Potato', 'Tomato', 'Onion', 'Spinach', 
            'Mushroom', 'Cabbage', 'Lettuce', 'Cucumber', 'Eggplant',
            'Apple', 'Orange', 'Banana', 'Chicken', 'Beef', 'Rice'
          ]
        }
      },
      select: {
        id: true,
        name: true
      }
    });
    
    console.log(`Found ${products.length} products to create aliases for`);
    
    const aliases: Array<{ productId: string; alias: string; language: string }> = [];
    
    // Create aliases based on product names
    products.forEach(product => {
      const name = product.name.toLowerCase();
      
      switch (name) {
        case 'carrot':
          aliases.push(
            { productId: product.id, alias: 'wortel', language: 'id' },
            { productId: product.id, alias: 'wortels', language: 'id' },
            { productId: product.id, alias: 'zanahoria', language: 'es' }
          );
          break;
          
        case 'potato':
          aliases.push(
            { productId: product.id, alias: 'kentang', language: 'id' },
            { productId: product.id, alias: 'papa', language: 'es' },
            { productId: product.id, alias: 'patata', language: 'es' }
          );
          break;
          
        case 'tomato':
          aliases.push(
            { productId: product.id, alias: 'tomat', language: 'id' }
          );
          break;
          
        case 'onion':
          aliases.push(
            { productId: product.id, alias: 'bawang', language: 'id' },
            { productId: product.id, alias: 'cebolla', language: 'es' }
          );
          break;
          
        case 'spinach':
          aliases.push(
            { productId: product.id, alias: 'bayam', language: 'id' },
            { productId: product.id, alias: 'espinaca', language: 'es' }
          );
          break;
          
        case 'mushroom':
          aliases.push(
            { productId: product.id, alias: 'jamur', language: 'id' },
            { productId: product.id, alias: 'champiñón', language: 'es' },
            { productId: product.id, alias: 'champiñones', language: 'es' },
            { productId: product.id, alias: 'hongo', language: 'es' },
            { productId: product.id, alias: 'hongos', language: 'es' }
          );
          break;
          
        case 'cabbage':
          aliases.push(
            { productId: product.id, alias: 'kubis', language: 'id' },
            { productId: product.id, alias: 'kol', language: 'id' },
            { productId: product.id, alias: 'repollo', language: 'es' }
          );
          break;
          
        case 'lettuce':
          aliases.push(
            { productId: product.id, alias: 'selada', language: 'id' },
            { productId: product.id, alias: 'lechuga', language: 'es' }
          );
          break;
          
        case 'cucumber':
          aliases.push(
            { productId: product.id, alias: 'timun', language: 'id' },
            { productId: product.id, alias: 'pepino', language: 'es' }
          );
          break;
          
        case 'eggplant':
          aliases.push(
            { productId: product.id, alias: 'terong', language: 'id' },
            { productId: product.id, alias: 'berenjena', language: 'es' }
          );
          break;
          
        case 'apple':
          aliases.push(
            { productId: product.id, alias: 'apel', language: 'id' },
            { productId: product.id, alias: 'manzana', language: 'es' }
          );
          break;
          
        case 'orange':
          aliases.push(
            { productId: product.id, alias: 'jeruk', language: 'id' },
            { productId: product.id, alias: 'naranja', language: 'es' }
          );
          break;
          
        case 'banana':
          aliases.push(
            { productId: product.id, alias: 'pisang', language: 'id' },
            { productId: product.id, alias: 'plátano', language: 'es' }
          );
          break;
          
        case 'chicken':
          aliases.push(
            { productId: product.id, alias: 'ayam', language: 'id' },
            { productId: product.id, alias: 'pollo', language: 'es' }
          );
          break;
          
        case 'beef':
          aliases.push(
            { productId: product.id, alias: 'daging', language: 'id' },
            { productId: product.id, alias: 'sapi', language: 'id' },
            { productId: product.id, alias: 'carne', language: 'es' }
          );
          break;
          
        case 'rice':
          aliases.push(
            { productId: product.id, alias: 'beras', language: 'id' },
            { productId: product.id, alias: 'arroz', language: 'es' }
          );
          break;
      }
    });
    
    if (aliases.length > 0) {
      const count = await bulkCreateAliases(aliases);
      console.log(`Successfully created ${count} aliases`);
    } else {
      console.log('No aliases to create');
    }
    
  } catch (error) {
    console.error('Error seeding aliases:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed script
seedAliases();