import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../../services/DatabaseService';
import { asyncHandler } from '../../../../utils/errors';

// GET /api/admin/dictionaries - Get all dictionary entries
export const GET = asyncHandler(async (request: NextRequest) => {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'language' or 'unit'
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    if (type === 'language') {
      const where = search ? {
        OR: [
          { sourceWord: { contains: search, mode: 'insensitive' } },
          { targetWord: { contains: search, mode: 'insensitive' } }
        ]
      } : {};

      const [entries, total] = await Promise.all([
        databaseService.getLanguageDictionaryEntries({
          where,
          orderBy: { sourceWord: 'asc' },
          take: limit,
          skip: offset
        }),
        databaseService.getLanguageDictionaryCount({ where })
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
          { sourceUnit: { contains: search, mode: 'insensitive' } },
          { targetUnit: { contains: search, mode: 'insensitive' } }
        ]
      } : {};

      const [entries, total] = await Promise.all([
        databaseService.getUnitDictionaryEntries({
          where,
          orderBy: { sourceUnit: 'asc' },
          take: limit,
          skip: offset
        }),
        databaseService.getUnitDictionaryCount({ where })
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
        databaseService.getLanguageDictionaryCount(),
        databaseService.getUnitDictionaryCount()
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

  });

// POST /api/admin/dictionaries - Create new dictionary entry
export const POST = asyncHandler(async (request: NextRequest) => {
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

      const entry = await databaseService.createLanguageDictionaryEntry({
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

      const entry = await databaseService.createUnitDictionaryEntry({
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

  });