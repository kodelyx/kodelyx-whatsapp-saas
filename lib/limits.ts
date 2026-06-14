import { db } from '@/lib/db/drizzle';
import { plans, teams, messages, chats, campaigns } from '@/lib/db/schema';
import { eq, and, gte, sql, count } from 'drizzle-orm';
import { 
  getTeamMemberCount, 
  getContactCount, 
  getInstanceCount 
} from '@/lib/db/queries';

export type LimitResource = 'users' | 'contacts' | 'instances';
export type FeatureFlag = 'isAiEnabled' | 'isFlowBuilderEnabled' | 'isCampaignsEnabled' | 'isTemplatesEnabled' | 'isVoiceCallsEnabled' | 'isMessagingEnabled';

// Free tier: 1000 msgs/month, all features ON, limited scale.
const FREE_TIER = {
  maxUsers: 1,
  maxContacts: 1000,
  maxInstances: 1,
  isMessagingEnabled: true,
  maxMonthlyMessages: 1000,
  isAiEnabled: true,
  isFlowBuilderEnabled: true,
  isCampaignsEnabled: true,
  isTemplatesEnabled: true,
  isVoiceCallsEnabled: false,
};

export async function enforceLimit(teamId: number, resource: LimitResource) {
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    with: {
      plan: true,
    },
  });

  if (!team) {
    throw new Error("Team not found.");
  }

  const plan = team.plan ?? FREE_TIER;
  let currentUsage = 0;
  let limit = 0;
  let resourceName = '';

  switch (resource) {
    case 'users':
      currentUsage = await getTeamMemberCount(teamId);
      limit = plan.maxUsers;
      resourceName = 'Users';
      break;
    case 'contacts':
      currentUsage = await getContactCount(teamId);
      limit = plan.maxContacts;
      resourceName = 'Contacts';
      break;
    case 'instances':
      currentUsage = await getInstanceCount(teamId);
      limit = plan.maxInstances;
      resourceName = 'WhatsApp connections';
      break;
  }

  if (limit > 0 && currentUsage >= limit) {
    throw new Error(`${resourceName} limit reached (${currentUsage}/${limit}). Please upgrade your plan.`);
  }
}

export async function checkFeature(teamId: number, feature: FeatureFlag) {
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    with: {
      plan: true,
    },
  });

  // No plan = free tier — features disabled.
  if (!team || !team.plan) return FREE_TIER[feature] ?? false;

  return team.plan[feature] === true;
}

export async function enforceFeature(teamId: number, feature: FeatureFlag) {
  const hasAccess = await checkFeature(teamId, feature);
  if (!hasAccess) {
    throw new Error("Your current plan does not allow access to this feature. Please upgrade your plan.");
  }
}

/**
 * Enforce messaging gate: checks if the team's plan allows sending messages
 * and if they haven't exceeded their monthly message quota.
 */
export async function enforceMessaging(teamId: number) {
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    with: {
      plan: true,
    },
  });

  if (!team) {
    throw new Error("Team not found.");
  }

  const plan = team.plan;

  // No plan = use free tier defaults
  const activePlan = plan ?? FREE_TIER;

  // Check if messaging is enabled on this plan
  if (!activePlan.isMessagingEnabled) {
    throw new Error("Messaging is not available on your current plan. Please upgrade to start sending messages.");
  }

  // Check monthly quota (0 = unlimited)
  if (activePlan.maxMonthlyMessages > 0) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [result] = await db
      .select({ count: count() })
      .from(messages)
      .innerJoin(chats, eq(messages.chatId, chats.id))
      .where(
        and(
          eq(chats.teamId, teamId),
          eq(messages.fromMe, true),
          eq(messages.isInternal, false),
          gte(messages.timestamp, startOfMonth)
        )
      );

    const sentThisMonth = result?.count ?? 0;

    if (sentThisMonth >= activePlan.maxMonthlyMessages) {
      throw new Error(
        `Monthly message limit reached (${sentThisMonth.toLocaleString()}/${activePlan.maxMonthlyMessages.toLocaleString()}). Please upgrade your plan for more messages.`
      );
    }
  }
}

export type MessageAllowance = {
  unlimited: boolean;
  limit: number;
  used: number;
  remaining: number;
};

/**
 * How many messages this team can still send this calendar month under its plan.
 *
 * Usage is the sum of two non-overlapping sources so campaigns are counted too:
 *  - directCount: rows in `messages` (fromMe, not internal) this month. This
 *    already includes 1-to-1 sends AND campaigns sent with createContacts=true
 *    (those write a message row).
 *  - silentCampaignCount: campaigns with createContacts=false write NO message
 *    row, so they would otherwise be invisible to the quota. We add their
 *    sentCount for campaigns created this month.
 * createContacts=true campaigns are only counted via directCount, so there is
 * no double counting.
 */
export async function getMessageAllowance(teamId: number): Promise<MessageAllowance> {
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    with: { plan: true },
  });

  const activePlan = team?.plan ?? FREE_TIER;

  // Messaging disabled entirely → nothing allowed.
  if (!activePlan.isMessagingEnabled) {
    return { unlimited: false, limit: 0, used: 0, remaining: 0 };
  }

  // 0 (or negative) monthly limit means unlimited.
  if (!activePlan.maxMonthlyMessages || activePlan.maxMonthlyMessages <= 0) {
    return { unlimited: true, limit: 0, used: 0, remaining: Number.MAX_SAFE_INTEGER };
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [direct] = await db
    .select({ count: count() })
    .from(messages)
    .innerJoin(chats, eq(messages.chatId, chats.id))
    .where(and(
      eq(chats.teamId, teamId),
      eq(messages.fromMe, true),
      eq(messages.isInternal, false),
      gte(messages.timestamp, startOfMonth),
    ));

  const [silent] = await db
    .select({ total: sql<number>`coalesce(sum(${campaigns.sentCount}), 0)` })
    .from(campaigns)
    .where(and(
      eq(campaigns.teamId, teamId),
      eq(campaigns.createContacts, false),
      gte(campaigns.createdAt, startOfMonth),
    ));

  const used = (direct?.count ?? 0) + Number(silent?.total ?? 0);
  const limit = activePlan.maxMonthlyMessages;

  return {
    unlimited: false,
    limit,
    used,
    remaining: Math.max(0, limit - used),
  };
}