import { getPublishedPlans, getTeamForUser } from '@/lib/db/queries';
import { PricingClient } from './pricing-client';
import { db } from '@/lib/db/drizzle';
import { messages, chats } from '@/lib/db/schema';
import { eq, and, gte, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

async function getMessagesSentThisMonth(teamId: number): Promise<number> {
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

  return result?.count ?? 0;
}

export default async function PricingPage() {
  const [plans, team] = await Promise.all([
    getPublishedPlans(),
    getTeamForUser(),
  ]);

  let messagesSentThisMonth = 0;
  if (team) {
    messagesSentThisMonth = await getMessagesSentThisMonth(team.id);
  }

  const teamData = team ? {
    planId: team.planId,
    subscriptionStatus: team.subscriptionStatus,
    messagesSentThisMonth,
    plan: team.plan ? { name: team.plan.name, amount: team.plan.amount } : null,
    subscriptionEndsAt: (team as any).subscriptionEndsAt ?? null,
  } : undefined;

  return <PricingClient allPlans={plans} currentTeam={teamData} />;
}