'use server';

import { db } from '@/lib/db/drizzle';
import { branding } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { uploadFile } from '@/lib/storage/upload';

export async function updateBranding(formData: FormData) {
  const name = formData.get('name') as string;
  const logo = formData.get('logo') as File;
  const favicon = formData.get('favicon') as File;

  try {
    let logoUrl = '';
    if (logo && logo.size > 0) {
      logoUrl = await uploadFile(logo, 'branding');
    }

    let faviconUrl = '';
    if (favicon && favicon.size > 0) {
      faviconUrl = await uploadFile(favicon, 'branding');
    }

    const currentBranding = await db.query.branding.findFirst();

    if (currentBranding) {
      await db
        .update(branding)
        .set({
          name,
          logoUrl: logoUrl || currentBranding.logoUrl,
          faviconUrl: faviconUrl || currentBranding.faviconUrl,
          updatedAt: new Date(),
        })
        .where(eq(branding.id, currentBranding.id));
    } else {
      await db.insert(branding).values({
        name,
        logoUrl,
        faviconUrl,
      });
    }

    revalidatePath('/(admin)/admin/branding');
    revalidatePath('/');

    return {
      success: true,
    };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message: 'Failed to update branding.',
    };
  }
}