import { PrismaClient } from '@prisma/client'
import { addPriceHistoryMiddleware, addBulkOperationLogging } from '@/app/lib/prisma-middleware'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const createPrismaClient = () => {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
  
  // Add middleware for automatic price history tracking
  addPriceHistoryMiddleware(client)
  
  // Add middleware for operation logging
  addBulkOperationLogging(client)
  
  return client
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma