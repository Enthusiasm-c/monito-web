import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search') || '';
    
    const skip = (page - 1) * limit;
    
    const where = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
        { phone: { contains: search, mode: 'insensitive' as const } }
      ]
    } : {};

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        include: {
          prices: {
            where: { validTo: null },
            include: { product: true }
          },
          uploads: true,
          _count: {
            select: {
              prices: { where: { validTo: null } },
              uploads: true
            }
          }
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.supplier.count({ where })
    ]);

    return NextResponse.json({
      suppliers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch suppliers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, phone, address, website, contactPerson, notes } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const supplier = await prisma.supplier.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        address: address || null,
        website: website || null,
        contactPerson: contactPerson || null,
        notes: notes || null
      }
    });

    return NextResponse.json(supplier);

  } catch (error) {
    console.error('Error creating supplier:', error);
    return NextResponse.json(
      { error: 'Failed to create supplier' },
      { status: 500 }
    );
  }
}