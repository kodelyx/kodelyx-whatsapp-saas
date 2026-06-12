import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { evolutionInstances } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { getTeamForUser } from '@/lib/db/queries';

export async function POST(request: Request) {
    try {
        const team = await getTeamForUser();
        if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const instanceIdStr = formData.get('instanceId') as string;

        if (!file || !instanceIdStr) {
            return NextResponse.json({ error: 'File and Instance ID are required' }, { status: 400 });
        }

        const instance = await db.query.evolutionInstances.findFirst({
            where: and(
                eq(evolutionInstances.id, parseInt(instanceIdStr)),
                eq(evolutionInstances.teamId, team.id)
            )
        });

        if (!instance || !instance.metaToken) {
            return NextResponse.json({ error: 'Instance not configured correctly with Meta Token' }, { status: 400 });
        }

        let appId = instance.metaAppId;

        // Fetch App ID dynamically if missing from DB
        if (!appId) {
            const appRes = await fetch(`https://graph.facebook.com/v25.0/app?access_token=${instance.metaToken}`);
            if (appRes.ok) {
                const appData = await appRes.json();
                appId = appData.id;
            }
        }

        if (!appId) {
             return NextResponse.json({ error: 'Could not determine Meta App ID from Token' }, { status: 400 });
        }

        // 1. Create Upload Session
        const sessionRes = await fetch(`https://graph.facebook.com/v25.0/${appId}/uploads?file_length=${file.size}&file_type=${file.type}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${instance.metaToken}`
            }
        });

        if (!sessionRes.ok) {
            const err = await sessionRes.json();
            console.error('[Meta Upload Session Error]', err);
            return NextResponse.json({ error: 'Failed to create Meta upload session' }, { status: 500 });
        }

        const sessionData = await sessionRes.json();
        const sessionId = sessionData.id;

        // 2. Upload File to Session
        const fileBuffer = await file.arrayBuffer();
        
        const uploadRes = await fetch(`https://graph.facebook.com/v25.0/${sessionId}`, {
            method: 'POST',
            headers: {
                'Authorization': `OAuth ${instance.metaToken}`,
                'file_offset': '0'
            },
            body: fileBuffer
        });

        if (!uploadRes.ok) {
            const err = await uploadRes.json();
            console.error('[Meta File Upload Error]', err);
            return NextResponse.json({ error: 'Failed to upload file to Meta' }, { status: 500 });
        }

        const uploadData = await uploadRes.json();

        return NextResponse.json({ success: true, handle: uploadData.h });
    } catch (error: any) {
        console.error('[Template Media Upload]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
