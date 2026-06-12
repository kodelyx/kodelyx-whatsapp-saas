import { getBranding } from '@/lib/db/queries/branding';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata = {
  title: 'Refund & Cancellation Policy',
  description: 'Read our refund and cancellation policy.',
};

export default async function RefundPage() {
  const branding = await getBranding();
  const siteName = branding?.name || 'Kodelyx';

  return (
    <main className="min-h-screen bg-background py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/">
          <Button variant="ghost" className="mb-8 pl-0 hover:bg-transparent hover:text-primary">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Button>
        </Link>

        <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">Refund & Cancellation Policy</h1>
        <p className="text-muted-foreground mb-10">Last updated: {new Date().toLocaleDateString()}</p>

        <div className="space-y-8 text-foreground/90 leading-relaxed">
          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">1. Cancellations</h2>
            <p>
              You can cancel your subscription or services at any time. If you decide to cancel, your cancellation will take effect at the end of the current paid term. 
              We do not offer prorated refunds for cancellations made during an active billing cycle.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">2. Refund Policy</h2>
            <p>
              Due to the nature of digital goods and SaaS services, all sales are final, and we generally do not offer refunds once a purchase has been made and the service/credits have been provisioned. 
              However, if you experience technical issues that prevent you from using {siteName} services and our support team is unable to resolve them within 7 business days, you may be eligible for a partial or full refund at our sole discretion.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">3. Message Credits</h2>
            <p>
              Pre-paid message credits are non-refundable. They do not expire as long as your account remains active. If your account gets terminated due to a violation of our Terms of Service, any remaining credits will be forfeited without refund.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">4. Changes to this Policy</h2>
            <p>
              {siteName} reserves the right to modify this Refund & Cancellation Policy at any time. We encourage users to frequently check this page for any changes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4 text-foreground">5. Contact Us</h2>
            <p>
              If you have any questions about our Refund & Cancellation Policy, please contact us via the contact form on our website or email our support team.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
