import { NextRequest, NextResponse } from 'next/server';
import { 
  createAlias, 
  getProductAliases, 
  deleteAlias,
  bulkCreateAliases 
} from '../../../services/database/aliasService';

// GET /api/admin/aliases?productId=xxx
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const productId = searchParams.get('productId');
    
    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }
    
    const aliases = await getProductAliases(productId);
    
    return NextResponse.json({ aliases });
  } catch (error) {
    console.error('Error fetching aliases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch aliases' },
      { status: 500 }
    );
  }
}

// POST /api/admin/aliases
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Handle bulk creation
    if (Array.isArray(body.aliases)) {
      const count = await bulkCreateAliases(body.aliases);
      return NextResponse.json({ 
        message: `Created ${count} aliases`,
        count 
      });
    }
    
    // Handle single creation
    const { productId, alias, language } = body;
    
    if (!productId || !alias) {
      return NextResponse.json(
        { error: 'Product ID and alias are required' },
        { status: 400 }
      );
    }
    
    const newAlias = await createAlias(productId, alias, language || 'en');
    
    return NextResponse.json(newAlias);
  } catch (error: any) {
    console.error('Error creating alias:', error);
    
    // Handle unique constraint violation
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'This alias already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create alias' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/aliases/:id
export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.pathname.split('/').pop();
    
    if (!id) {
      return NextResponse.json(
        { error: 'Alias ID is required' },
        { status: 400 }
      );
    }
    
    await deleteAlias(id);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting alias:', error);
    return NextResponse.json(
      { error: 'Failed to delete alias' },
      { status: 500 }
    );
  }
}