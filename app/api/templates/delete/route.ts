import { NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { wabaTemplates, evolutionInstances } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';

export async function DELETE(request: Request) {
    try {
        const team = await getTeamForUser();
        if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { templateId } = await request.json();

        if (!templateId) {
            return NextResponse.json({ error: 'Template ID is required' }, { status: 400 });
        }

        // Find the template
        const template = await db.query.wabaTemplates.findFirst({
            where: and(
                eq(wabaTemplates.id, templateId),
                eq(wabaTemplates.teamId, team.id)
            )
        });

        if (!template) {
            return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }

        // Find the instance to get Meta credentials
        const instance = await db.query.evolutionInstances.findFirst({
            where: and(
                eq(evolutionInstances.id, template.instanceId),
                eq(evolutionInstances.teamId, team.id)
            ),
            columns: { metaToken: true, metaBusinessId: true }
        });

        // Try to delete from Meta if credentials exist
        if (instance?.metaToken && instance?.metaBusinessId && template.name) {
            try {
                await fetch(
                    `https://graph.facebook.com/v25.0/${instance.metaBusinessId}/message_templates?name=${template.name}`,
                    {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${instance.metaToken}`
                        }
                    }
                );
            } catch (metaError) {
                console.error('[Meta Template Delete]', metaError);
                // Continue with local delete even if Meta fails
            }
        }

        // Delete from database
        await db.delete(wabaTemplates).where(
            and(
                eq(wabaTemplates.id, templateId),
                eq(wabaTemplates.teamId, team.id)
            )
        );

        return NextResponse.json({ success: true, message: 'Template deleted successfully' });
    } catch (error: any) {
        console.error('[Template Delete Error]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
