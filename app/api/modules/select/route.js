import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request) {
  try {
    const body = await request.json();
    const { moduleId } = body;
    
    // We must await cookies() in Next 15+
    const cookieStore = await cookies();

    if (moduleId && moduleId !== 'all') {
      cookieStore.set('selectedModuleId', moduleId, { path: '/' });
      return NextResponse.json({ success: true, message: `Module ${moduleId} selected.` });
    } else {
      cookieStore.set('selectedModuleId', 'all', { path: '/' });
      return NextResponse.json({ success: true, message: 'Module selection set to all.' });
    }
  } catch (error) {
    console.error("Select Module API Error:", error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
