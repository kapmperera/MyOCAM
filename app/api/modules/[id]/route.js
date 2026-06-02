import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Module ID is required' }, { status: 400 });
    }

    // Use a transaction to safely delete child records before the parent module
    await prisma.$transaction([
      prisma.markEntry.deleteMany({
        where: { moduleId: id },
      }),
      prisma.oCAMResult.deleteMany({
        where: { moduleId: id },
      }),
      prisma.module.delete({
        where: { id },
      }),
    ]);

    // If the deleted module was the currently selected one, clear the cookie
    const cookieStore = await cookies();
    const selectedId = cookieStore.get('selectedModuleId')?.value;
    
    if (selectedId === id) {
      cookieStore.delete('selectedModuleId');
    }

    return NextResponse.json({ success: true, message: 'Module and all associated records deleted.' });
  } catch (error) {
    console.error("Delete Module API Error:", error);
    return NextResponse.json({ error: 'Internal server error during deletion.' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, courseCode, academicYear } = body;

    if (!id) {
      return NextResponse.json({ error: 'Module ID is required' }, { status: 400 });
    }

    const updatedModule = await prisma.module.update({
      where: { id },
      data: {
        name,
        courseCode,
        academicYear,
      },
    });

    return NextResponse.json({ success: true, module: updatedModule });
  } catch (error) {
    console.error("Update Module API Error:", error);
    return NextResponse.json({ error: 'Internal server error during update.' }, { status: 500 });
  }
}
