import { db } from '@/lib/db/drizzle';
import { sql } from 'drizzle-orm';
import type { PaymentGatewayAdapter, CheckoutOptions, CheckoutResult } from '../gateway';

export class OfflineAdapter implements PaymentGatewayAdapter {
  readonly type = 'offline' as const;

  async createCheckout(options: CheckoutOptions): Promise<CheckoutResult> {
    // One pending request per team — atomic upsert against the partial unique
    // index `uniq_pending_request_per_team`. Rapid double-clicks / retries all
    // collapse into the SAME row instead of creating duplicate admin requests.
    await db.execute(sql`
      INSERT INTO offline_payment_requests (team_id, plan_id, amount, currency, status)
      VALUES (${options.teamId}, ${options.planId}, ${options.amount}, ${options.currency}, 'pending')
      ON CONFLICT (team_id) WHERE status = 'pending'
      DO UPDATE SET
        plan_id = EXCLUDED.plan_id,
        amount = EXCLUDED.amount,
        currency = EXCLUDED.currency,
        updated_at = now()
    `);

    const params = new URLSearchParams({
      offline: 'true',
      planName: options.planName,
      amount: options.amount.toString(),
      currency: options.currency,
    });

    return {
      url: `${options.cancelUrl}?${params}`,
    };
  }

  async cancelSubscription(): Promise<void> {}

  async verifyWebhook(): Promise<any> {
    return null;
  }
}
