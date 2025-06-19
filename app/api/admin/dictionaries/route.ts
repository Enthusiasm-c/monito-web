import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

// GET /api/admin/dictionaries - Get all dictionary entries
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'language' or 'unit'
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    if (type === 'language') {
      const where = search ? {
        OR: [
          { sourceWord: { contains: search, mode: 'insensitive' as const } },
          { targetWord: { contains: search, mode: 'insensitive' as const } }
        ]
      } : {};

      const [entries, total] = await Promise.all([
        prisma.languageDictionary.findMany({
          where,
          orderBy: { sourceWord: 'asc' },
          take: limit,
          skip: offset
        }),
        prisma.languageDictionary.count({ where })
      ]);

      return NextResponse.json({
        success: true,
        data: entries,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } else if (type === 'unit') {
      const where = search ? {
        OR: [
          { sourceUnit: { contains: search, mode: 'insensitive' as const } },
          { targetUnit: { contains: search, mode: 'insensitive' as const } }
        ]
      } : {};

      const [entries, total] = await Promise.all([
        prisma.unitDictionary.findMany({
          where,
          orderBy: { sourceUnit: 'asc' },
          take: limit,
          skip: offset
        }),
        prisma.unitDictionary.count({ where })
      ]);

      return NextResponse.json({
        success: true,
        data: entries,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });

    } else {
      // Get both types with counts
      const [langCount, unitCount] = await Promise.all([
        prisma.languageDictionary.count(),
        prisma.unitDictionary.count()
      ]);

      return NextResponse.json({
        success: true,
        summary: {
          languageEntries: langCount,
          unitEntries: unitCount,
          total: langCount + unitCount
        }
      });
    }

  } catch (error) {
    console.error('Dictionary API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dictionary entries' },
      { status: 500 }
    );
  }
}

// POST /api/admin/dictionaries - Create new dictionary entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, ...data } = body;

    if (type === 'language') {
      const { sourceWord, targetWord, language, category, createdBy } = data;

      if (!sourceWord || !targetWord || !language) {
        return NextResponse.json(
          { error: 'sourceWord, targetWord, and language are required' },
          { status: 400 }
        );
      }

      const entry = await prisma.languageDictionary.create({
        data: {
          sourceWord: sourceWord.toLowerCase().trim(),
          targetWord: targetWord.toLowerCase().trim(),
          language,
          category,
          createdBy
        }
      });

      return NextResponse.json({
        success: true,
        data: entry,
        message: 'Language dictionary entry created successfully'
      });

    } else if (type === 'unit') {
      const { sourceUnit, targetUnit, conversionFactor, category, createdBy } = data;

      if (!sourceUnit || !targetUnit) {
        return NextResponse.json(
          { error: 'sourceUnit and targetUnit are required' },
          { status: 400 }
        );
      }

      const entry = await prisma.unitDictionary.create({
        data: {
          sourceUnit: sourceUnit.toLowerCase().trim(),
          targetUnit: targetUnit.toLowerCase().trim(),
          conversionFactor: conversionFactor || 1.0,
          category,
          createdBy
        }
      });

      return NextResponse.json({
        success: true,
        data: entry,
        message: 'Unit dictionary entry created successfully'
      });

    } else {
      return NextResponse.json(
        { error: 'type must be "language" or "unit"' },
        { status: 400 }
      );
    }

  } catch (error: any) {
    console.error('Dictionary creation error:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Entry already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create dictionary entry' },
      { status: 500 }
    );
  }
}