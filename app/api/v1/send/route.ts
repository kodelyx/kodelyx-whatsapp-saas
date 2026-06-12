import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/drizzle";
import { evolutionInstances, chats, messages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getAuthenticatedTeam } from "@/lib/auth/api";
import { z } from "zod";
import { sendTextViaProvider, sendMediaViaProvider, sendAudioViaProvider } from "@/lib/whatsapp/send-helpers";

const sendSchema = z.object({
  instanceName: z.string().min(1),
  number: z.string().min(1),
  type: z.enum(["text", "image", "video", "document", "audio"]),
  message: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  fileName: z.string().optional(),
  mimetype: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const team = await getAuthenticatedTeam(req);
    if (!team) {
      return NextResponse.json({ error: "Unauthorized. Invalid or missing API Token." }, { status: 401 });
    }

    const body = await req.json();
    const validation = sendSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ error: "Invalid payload", details: validation.error.format() }, { status: 400 });
    }

    const { instanceName, number, type, message, mediaUrl, fileName, mimetype } = validation.data;

    const instance = await db.query.evolutionInstances.findFirst({
      where: and(eq(evolutionInstances.teamId, team.id), eq(evolutionInstances.instanceName, instanceName)),
    });

    if (!instance) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    const formattedNumber = number.replace(/\D/g, "");
    const remoteJid = `${formattedNumber}@s.whatsapp.net`;

    const instanceConfig = {
      id: instance.id,
      instanceName: instance.instanceName,
      accessToken: instance.accessToken || '',
      integration: instance.integration || 'WHATSAPP-BUSINESS',
      metaToken: instance.metaToken,
      metaPhoneNumberId: instance.metaPhoneNumberId,
    };

    let result;

    if (type === "text") {
      if (!message) return NextResponse.json({ error: "Message is required for type 'text'" }, { status: 400 });
      result = await sendTextViaProvider({
        instance: instanceConfig, recipientJid: remoteJid, text: message,
        teamId: team.id, instanceId: instance.id,
      });
    } else if (type === "audio") {
      if (!mediaUrl) return NextResponse.json({ error: "mediaUrl is required for type 'audio'" }, { status: 400 });
      // Fetch the audio and convert to base64
      const audioRes = await fetch(mediaUrl);
      const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
      result = await sendAudioViaProvider({
        instance: instanceConfig, recipientJid: remoteJid,
        teamId: team.id, instanceId: instance.id,
        audioBase64: audioBuffer.toString('base64'),
      });
    } else {
      if (!mediaUrl) return NextResponse.json({ error: "mediaUrl is required for media types" }, { status: 400 });
      const mediaRes = await fetch(mediaUrl);
      const mediaBuffer = Buffer.from(await mediaRes.arrayBuffer());
      result = await sendMediaViaProvider({
        instance: instanceConfig, recipientJid: remoteJid,
        teamId: team.id, instanceId: instance.id,
        mediaBase64: mediaBuffer.toString('base64'),
        mimetype: mimetype || 'application/octet-stream',
        mediaType: type as 'image' | 'video' | 'document',
        fileName: fileName || 'file',
        caption: message,
      });
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to send" }, { status: 500 });
    }

    return NextResponse.json({ success: true, messageId: result.messageId });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error", details: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}