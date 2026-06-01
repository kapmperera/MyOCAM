import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request) {
  try {
    const { enabled } = await request.json();
    
    const setting = await prisma.systemSetting.upsert({
      where: { key: 'registered_center_enabled' },
      update: { value: enabled ? 'true' : 'false' },
      create: { key: 'registered_center_enabled', value: enabled ? 'true' : 'false' }
    });

    return NextResponse.json({ success: true, enabled: setting.value === 'true' });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
