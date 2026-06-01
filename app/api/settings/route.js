import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'registered_center_enabled' }
    });
    
    const isEnabled = setting?.value === 'true';
    const mappingsCount = await prisma.centerMapping.count();
    
    // Fetch a small list of mappings to show in settings page as review
    const sampleMappings = await prisma.centerMapping.findMany({
      take: 10,
      orderBy: { registrationNumber: 'asc' }
    });

    return NextResponse.json({
      enabled: isEnabled,
      totalCount: mappingsCount,
      sample: sampleMappings
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await prisma.centerMapping.deleteMany();
    return NextResponse.json({ success: true, message: 'All center mappings deleted successfully.' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
