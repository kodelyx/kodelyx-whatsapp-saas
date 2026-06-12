import { NextResponse } from 'next/server';
import { getTeamForUser } from '@/lib/db/queries'; 
import { db } from '@/lib/db/drizzle'; 
import { evolutionInstances } from '@/lib/db/schema'; 
import { eq } from 'drizzle-orm';

type InstanceDetailItem = {
    dbId: number;
    instanceName: string;
    internalName?: string;
    evolutionInstanceId: string | null;
    number: string | null;
    integration: string | null;
    owner: string | null;
    profileName: string | null;
    profilePictureUrl: string | null;
    status: string;
    token: string | null;
    metaPhoneNumberId?: string | null;
    metaWabaId?: string | null;
};

export async function GET(request: Request) {
  try {
    const team = await getTeamForUser();
    if (!team) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dbInstances = await db.query.evolutionInstances.findMany({
      where: eq(evolutionInstances.teamId, team.id),
      orderBy: (instances, { asc }) => [asc(instances.instanceName)],
    });

    if (dbInstances.length === 0) {
      return NextResponse.json([]);
    }

    const apiVersion = process.env.API_VERSION || 'v25.0';

    const results = await Promise.all(dbInstances.map(async (dbInstance) => {
        let status = 'unknown';
        let profileName: string | null = null;
        let phoneNumber: string | null = dbInstance.instanceNumber || null;

        // Verify with Meta Graph API
        const token = dbInstance.metaToken || dbInstance.accessToken;
        const phoneId = dbInstance.metaPhoneNumberId;
        
        if (token && phoneId) {
          try {
            const metaResponse = await fetch(
              `https://graph.facebook.com/${apiVersion}/${phoneId}?fields=verified_name,display_phone_number,quality_rating`,
              { headers: { 'Authorization': `Bearer ${token}` }, signal: AbortSignal.timeout(10000) }
            );
            if (metaResponse.ok) {
              const metaData = await metaResponse.json();
              status = 'open';
              profileName = metaData.verified_name || null;
              phoneNumber = metaData.display_phone_number || phoneNumber;
            } else if (metaResponse.status === 401 || metaResponse.status === 403) {
              status = 'close';
            }
          } catch {
            status = 'error';
          }
        }

        return {
          dbId: dbInstance.id,
          instanceName: dbInstance.displayName || dbInstance.instanceName,
          internalName: dbInstance.instanceName,
          evolutionInstanceId: dbInstance.evolutionInstanceId,
          status,
          token: dbInstance.accessToken,
          owner: null,
          profileName: profileName,
          number: phoneNumber,
          integration: 'WHATSAPP-BUSINESS',
          profilePictureUrl: null,
          metaPhoneNumberId: dbInstance.metaPhoneNumberId,
          metaWabaId: dbInstance.metaWabaId || dbInstance.metaBusinessId,
        } as InstanceDetailItem;
    }));

    return NextResponse.json(results);

  } catch (error: any) {
    console.error('Error fetching instance details:', error.message);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}