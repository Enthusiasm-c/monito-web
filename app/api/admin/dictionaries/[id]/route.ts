import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../../../services/DatabaseService';
import { asyncHandler } from '../../../../../utils/errors';

// PUT /api/admin/dictionaries/[id] - Update dictionary entry
export const PUT = asyncHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
    const body = await request.json();
    const { type, ...data } = body;
    const { id } = params;

    if (type === 'language') {
      const { sourceWord, targetWord, language, category } = data;

      const entry = await databaseService.updateLanguageDictionaryEntry({
        where: { id },
        data: {
          ...(sourceWord && { sourceWord: sourceWord.toLowerCase().trim() }),
          ...(targetWord && { targetWord: targetWord.toLowerCase().trim() }),
          ...(language && { language }),
          ...(category !== undefined && { category })
        }
      });

      return NextResponse.json({
        success: true,
        data: entry,
        message: 'Language dictionary entry updated successfully'
      });

    } else if (type === 'unit') {
      const { sourceUnit, targetUnit, conversionFactor, category } = data;

      const entry = await databaseService.updateUnitDictionaryEntry({
        where: { id },
        data: {
          ...(sourceUnit && { sourceUnit: sourceUnit.toLowerCase().trim() }),
          ...(targetUnit && { targetUnit: targetUnit.toLowerCase().trim() }),
          ...(conversionFactor !== undefined && { conversionFactor }),
          ...(category !== undefined && { category })
        }
      });

      return NextResponse.json({
        success: true,
        data: entry,
        message: 'Unit dictionary entry updated successfully'
      });

    } else {
      return NextResponse.json(
        { error: 'type must be "language" or "unit"' },
        { status: 400 }
      );
    }

  });

// DELETE /api/admin/dictionaries/[id] - Delete dictionary entry
export const DELETE = asyncHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const { id } = params;

    if (type === 'language') {
      await databaseService.deleteLanguageDictionaryEntry({
        where: { id }
      });

      return NextResponse.json({
        success: true,
        message: 'Language dictionary entry deleted successfully'
      });

    } else if (type === 'unit') {
      await databaseService.deleteUnitDictionaryEntry({
        where: { id }
      });

      return NextResponse.json({
        success: true,
        message: 'Unit dictionary entry deleted successfully'
      });

    } else {
      return NextResponse.json(
        { error: 'type parameter must be "language" or "unit"' },
        { status: 400 }
      );
    }

  });

// GET /api/admin/dictionaries/[id] - Get specific dictionary entry
export const GET = asyncHandler(async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const { id } = params;

    if (type === 'language') {
      const entry = await databaseService.getLanguageDictionaryEntryById({
        where: { id }
      });

      if (!entry) {
        return NextResponse.json(
          { error: 'Language dictionary entry not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: entry
      });

    } else if (type === 'unit') {
      const entry = await databaseService.getUnitDictionaryEntryById({
        where: { id }
      });

      if (!entry) {
        return NextResponse.json(
          { error: 'Unit dictionary entry not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: entry
      });

    } else {
      return NextResponse.json(
        { error: 'type parameter must be "language" or "unit"' },
        { status: 400 }
      );
    }

  });