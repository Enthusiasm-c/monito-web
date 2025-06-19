import { NextRequest, NextResponse } from 'next/server';
import { authenticateBot } from '../../middleware';

import { prisma } from '../../../../../lib/prisma';

// Search suppliers by name for Telegram bot
export async function GET(request: NextRequest) {
  // Authenticate bot
  const authError = authenticateBot(request);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');

    if (!name) {
      return NextResponse.json(
        { error: 'Supplier name is required' },
        { status: 400 }
      );
    }

    // Try exact match first
    let supplier = await prisma.supplier.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive'
        }
      }
    });

    // If no exact match, try contains search
    if (!supplier) {
      supplier = await prisma.supplier.findFirst({
        where: {
          name: {
            contains: name,
            mode: 'insensitive'
          }
        }
      });
    }

    // If still no match, try fuzzy search
    if (!supplier) {
      const suppliers = await prisma.supplier.findMany({
        where: {
          OR: [
            { name: { contains: name.split(' ')[0], mode: 'insensitive' } },
            { name: { contains: name.split(' ').pop() || '', mode: 'insensitive' } }
          ]
        },
        take: 5
      });

      if (suppliers.length === 1) {
        supplier = suppliers[0];
      } else if (suppliers.length > 1) {
        // Return multiple matches for bot to handle
        return NextResponse.json({
          supplier: null,
          suggestions: suppliers.map(s => ({
            id: s.id,
            name: s.name
          }))
        });
      }
    }

    return NextResponse.json({
      supplier: supplier ? {
        id: supplier.id,
        name: supplier.name
      } : null,
      suggestions: []
    });

  } catch (error) {
    console.error('Bot API - Error searching suppliers:', error);
    return NextResponse.json(
      { error: 'Failed to search suppliers' },
      { status: 500 }
    );
  }
}