import { NextResponse, NextRequest } from 'next/server';
import { getTeamForUser, getUser } from '@/lib/db/queries';
import { db } from '@/lib/db/drizzle';
import { ActivityType, evolutionInstances } from '@/lib/db/schema'; 
import { eq, and } from 'drizzle-orm';
import { logActivity } from '@/lib/db/activity';

export async function DELETE(request: NextRequest) {
  try {
    const user = await getUser();
    const team = await getTeamForUser();
    if (!team || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const instanceName = request.nextUrl.searchParams.get('instanceName');
    if (!instanceName) {
      return NextResponse.json({ error: 'Instance name is required' }, { status: 400 });
    }

    const dbInstance = await db.query.evolutionInstances.findFirst({
      where: and(
        eq(evolutionInstances.teamId, team.id),
        eq(evolutionInstances.instanceName, instanceName)
      ),
      columns: { id: true, integration: true }
    });

    if (!dbInstance) {
      return NextResponse.json({ error: 'Instance not found or unauthorized' }, { status: 404 });
    }

    // Direct DB delete — no Evolution API calls needed
    console.log(`Deleting instance ${dbInstance.id} (${instanceName}) from database.`);
    await db.delete(evolutionInstances).where(eq(evolutionInstances.id, dbInstance.id));
    await logActivity(team.id, user.id, ActivityType.DELETE_INSTANCE);

    return NextResponse.json({ message: 'Instance deleted successfully.' });

  } catch (error: any) {
    console.error('Error in /api/instance/delete:', error.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}