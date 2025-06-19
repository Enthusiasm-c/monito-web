import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

// PUT /api/admin/dictionaries/[id] - Update dictionary entry
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { type, ...data } = body;
    const { id } = params;

    if (type === 'language') {
      const { sourceWord, targetWord, language, category } = data;

      const entry = await prisma.languageDictionary.update({
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

      const entry = await prisma.unitDictionary.update({
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

  } catch (error: any) {
    console.error('Dictionary update error:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Dictionary entry not found' },
        { status: 404 }
      );
    }
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Entry already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update dictionary entry' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/dictionaries/[id] - Delete dictionary entry
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const { id } = params;

    if (type === 'language') {
      await prisma.languageDictionary.delete({
        where: { id }
      });

      return NextResponse.json({
        success: true,
        message: 'Language dictionary entry deleted successfully'
      });

    } else if (type === 'unit') {
      await prisma.unitDictionary.delete({
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

  } catch (error: any) {
    console.error('Dictionary deletion error:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Dictionary entry not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete dictionary entry' },
      { status: 500 }
    );
  }
}

// GET /api/admin/dictionaries/[id] - Get specific dictionary entry
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const { id } = params;

    if (type === 'language') {
      const entry = await prisma.languageDictionary.findUnique({
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
      const entry = await prisma.unitDictionary.findUnique({
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

  } catch (error) {
    console.error('Dictionary fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dictionary entry' },
      { status: 500 }
    );
  }
}