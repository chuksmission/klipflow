import MarketingShell from "../components/MarketingShell";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy — KlipflowAI",
  description: "KlipflowAI refund and cancellation policy for subscriptions and token purchases.",
};

export default function RefundPolicy() {
  return (
    <MarketingShell>
      <div className="mx-auto max-w-3xl px-4 py-16 md:px-8 md:py-20">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl mb-2">Refund Policy</h1>
        <p className="text-ink-subtle text-sm mb-12">Last updated: May 22, 2026</p>

        <div className="space-y-10 text-ink-muted text-[15px] leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">1. Overview</h2>
            <p>At KlipflowAI, we want you to be completely satisfied with your purchase. This Refund Policy outlines the conditions under which refunds are granted for subscriptions and token purchases made on our platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">2. Subscription Refunds</h2>
            <p className="mb-3">We offer a <strong className="text-ink">7-day refund window</strong> for new subscription purchases. If you are not satisfied with your subscription within the first 7 days of your initial purchase, you may request a full refund.</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Refund requests must be submitted within 7 days of the subscription start date.</li>
              <li>Refunds are only available for first-time subscriptions. Renewal charges are non-refundable.</li>
              <li>If you have consumed more than 50% of your monthly token allocation, a partial refund may be issued at our discretion.</li>
              <li>Downgrading your plan does not qualify for a refund of the difference.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">3. Token Top-Up Refunds</h2>
            <p className="mb-3">Token top-up purchases (one-time credit purchases) are <strong className="text-ink">non-refundable</strong> once the tokens have been added to your account, except in the following circumstances:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Duplicate charges caused by a technical error on our platform.</li>
              <li>Tokens were not delivered to your account due to a system failure.</li>
              <li>Unauthorized charges resulting from account compromise (subject to investigation).</li>
            </ul>
            <p className="mt-3">If you believe you qualify for a token refund under these circumstances, please contact us within 14 days of the charge.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">4. Non-Refundable Items</h2>
            <p className="mb-3">The following are not eligible for refunds:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Tokens that have already been used for video or image generation.</li>
              <li>Subscription renewals after the initial 7-day window.</li>
              <li>Accounts that have violated our Terms of Service.</li>
              <li>Purchases made during promotional or discounted periods, unless otherwise stated.</li>
              <li>Partial months of subscription use.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">5. Cancellations</h2>
            <p className="mb-3">You may cancel your subscription at any time from your billing dashboard. Upon cancellation:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your subscription will remain active until the end of the current billing period.</li>
              <li>You will not be charged for the next billing cycle.</li>
              <li>Any unused tokens will remain in your account until the subscription expires.</li>
              <li>Cancellation does not automatically trigger a refund.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">6. How to Request a Refund</h2>
            <p className="mb-3">To request a refund, please contact our support team with the following information:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your registered email address</li>
              <li>Date of purchase</li>
              <li>Order or transaction ID</li>
              <li>Reason for the refund request</li>
            </ul>
            <p className="mt-3">Contact us at: <a href="mailto:support@klipflowai.com" className="text-accent-text underline underline-offset-2 hover:text-ink transition">support@klipflowai.com</a></p>
            <p className="mt-2">We aim to respond to all refund requests within <strong className="text-ink">3-5 business days</strong>.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">7. Refund Processing</h2>
            <p>Approved refunds will be processed back to the original payment method within <strong className="text-ink">5-10 business days</strong>, depending on your bank or card issuer. KlipflowAI is not responsible for delays caused by financial institutions.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">8. Disputes & Chargebacks</h2>
            <p>We encourage you to contact us before initiating a chargeback with your bank or payment provider. Chargebacks initiated without prior contact may result in account suspension. We are committed to resolving all genuine disputes fairly and promptly.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">9. Changes to This Policy</h2>
            <p>We reserve the right to modify this Refund Policy at any time. Changes will be posted on this page with an updated date. Continued use of our services after changes constitutes acceptance of the new policy.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-ink mb-3">10. Contact Us</h2>
            <p>If you have any questions about this Refund Policy, please contact us:</p>
            <div className="mt-3 space-y-1">
              <p><strong className="text-ink">KlipflowAI</strong> — Klipflow Solutions LTD</p>
              <p>Email: <a href="mailto:support@klipflowai.com" className="text-accent-text underline underline-offset-2 hover:text-ink transition">support@klipflowai.com</a></p>
              <p>Website: <a href="https://klipflowai.com" className="text-accent-text underline underline-offset-2 hover:text-ink transition">klipflowai.com</a></p>
            </div>
          </section>

        </div>

        <div className="mt-16 pt-8 border-t border-line flex gap-6 text-sm text-ink-subtle">
          <a href="/terms-of-service" className="hover:text-ink transition">Terms of Service</a>
          <a href="/privacy-policy" className="hover:text-ink transition">Privacy Policy</a>
          <a href="/refund-policy" className="hover:text-ink transition text-purple-400">Refund Policy</a>
        </div>
      </div>
    </MarketingShell>
  );
}
