import { NextResponse, NextRequest } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { getTeamForUser } from '@/lib/db/queries';
import { chats, evolutionInstances, type Message } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { formatMessageForFrontend } from '@/lib/db/messages';
import { sendMediaViaProvider } from '@/lib/whatsapp/send-helpers';
import { enforceMessaging } from '@/lib/limits';
import fs from 'fs/promises';
import path from 'path';
import { Buffer } from 'buffer';
import { v4 as uuidv4 } from 'uuid';

function getMediaType(mimeType: string): { type: 'image' | 'video' | 'document', subDir: string, preview: string, msgType: Message['messageType'] } {
    if (mimeType.startsWith('image/')) return { type: 'image', subDir: 'image', preview: '📷 Image', msgType: 'imageMessage' };
    if (mimeType.startsWith('video/')) return { type: 'video', subDir: 'video', preview: '📹 Video', msgType: 'videoMessage' };
    return { type: 'document', subDir: 'document', preview: '📄 Document', msgType: 'documentMessage' };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { recipientJid, fileBase64, mimeType, fileName, quotedMessageData, instanceId } = body;

    if (!recipientJid || !fileBase64 || !mimeType || !fileName) {
      return NextResponse.json({ error: 'recipientJid, fileBase64, mimeType and fileName are required' }, { status: 400 });
    }

    const team = await getTeamForUser();
    if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Enforce messaging plan gate
    await enforceMessaging(team.id);

    let activeInstance = null;
    let targetChat = null;

    if (instanceId) {
      activeInstance = await db.query.evolutionInstances.findFirst({
        where: and(eq(evolutionInstances.id, Number(instanceId)), eq(evolutionInstances.teamId, team.id))
      });
      if (activeInstance) {
        targetChat = await db.query.chats.findFirst({
          where: and(eq(chats.teamId, team.id), eq(chats.remoteJid, recipientJid), eq(chats.instanceId, activeInstance.id))
        });
      }
    }

    if (!activeInstance) {
      targetChat = await db.query.chats.findFirst({
        where: and(eq(chats.teamId, team.id), eq(chats.remoteJid, recipientJid)),
        with: { instance: true }
      });
      if (targetChat && targetChat.instance) activeInstance = targetChat.instance;
    }

    if (!activeInstance) {
      activeInstance = await db.query.evolutionInstances.findFirst({ where: eq(evolutionInstances.teamId, team.id) });
    }

    if (!activeInstance) {
      return NextResponse.json({ error: 'No connected instance found.' }, { status: 404 });
    }

    const { instanceName, id: dbInstanceId } = activeInstance;
    const accessToken = activeInstance.accessToken || '';
    const { type: mediaType, subDir, preview, msgType } = getMediaType(mimeType);

    // Save file locally
    let publicMediaUrl: string | null = null;
    try {
      const buffer = Buffer.from(fileBase64, 'base64');
      const uniqueId = uuidv4();
      const safeFileName = `${uniqueId}-${fileName.replace(/[^a-z0-9._-]/gi, '_')}`;
      const relativeDirPath = path.join('uploads', subDir);
      const absoluteDirPath = path.join(process.cwd(), 'public', relativeDirPath);
      const absoluteFilePath = path.join(absoluteDirPath, safeFileName);
      await fs.mkdir(absoluteDirPath, { recursive: true });
      await fs.writeFile(absoluteFilePath, buffer);
      publicMediaUrl = `/${relativeDirPath.split(path.sep).join('/')}/${safeFileName}`;
    } catch (fileError: any) {
      console.error(`Failed to save file locally: ${fileError.message}`);
    }

    // Send via Meta Cloud API
    const result = await sendMediaViaProvider({
      instance: {
        id: dbInstanceId, instanceName, accessToken,
        integration: activeInstance.integration || 'WHATSAPP-BUSINESS',
        metaToken: activeInstance.metaToken, metaPhoneNumberId: activeInstance.metaPhoneNumberId,
      },
      recipientJid, teamId: team.id, chatId: targetChat?.id, instanceId: dbInstanceId,
      mediaBase64: fileBase64, mimetype: mimeType, mediaType: mediaType as any,
      fileName, caption: undefined, localMediaUrl: publicMediaUrl || undefined,
      quotedMessageData: quotedMessageData || null,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to send media' }, { status: 500 });
    }

    return NextResponse.json(formatMessageForFrontend({
      id: result.messageId, chatId: result.chatId, fromMe: true,
      messageType: msgType, text: preview, timestamp: new Date(),
      status: 'sent', isInternal: false, mediaUrl: publicMediaUrl, mediaMimetype: mimeType,
    }));

  } catch (error: any) {
    console.error('Error in /api/messages/sendMedia:', error.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}