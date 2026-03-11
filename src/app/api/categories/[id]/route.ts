import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireTeacherPayload } from '@/lib/route-auth';

const requireAdmin = async (request: NextRequest) => {
  const payload = await requireTeacherPayload(request);
  if (!payload || payload.role !== 'admin') {
    return null;
  }

  return payload;
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : name;

    if (!name) {
      return NextResponse.json({ error: 'Category name is required.' }, { status: 400 });
    }

    const category = await prisma.category.update({
      where: { id },
      data: {
        name,
        displayName,
      },
    });

    return NextResponse.json({ category });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Category already exists.' }, { status: 409 });
    }

    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const payload = await requireAdmin(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const { id } = await params;

    await prisma.category.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Category not found.' }, { status: 404 });
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error.' },
      { status: 500 }
    );
  }
}