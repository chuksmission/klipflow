export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen bg-black text-white px-8 py-16">
      <div className="max-w-3xl mx-auto">

        <a href="/" className="text-purple-400 hover:text-white text-sm transition mb-8 inline-block">← Back to KlipflowAI</a>

        <h1 className="text-4xl font-extrabold mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm mb-12">Last updated: May 2026</p>

        <div className="space-y-10 text-gray-400 text-sm leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Introduction</h2>
            <p>Welcome to KlipflowAI ("we", "our", "us"). We are committed to protecting your personal data and your right to privacy. This Privacy Policy explains how we collect, use, and share information about you when you use our platform at klipflowai.com.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Information We Collect</h2>
            <p className="mb-3">We collect the following types of information:</p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong className="text-white">Account Information:</strong> Email address, name, and password when you register.</li>
              <li><strong className="text-white">Usage Data:</strong> How you interact with our platform, features used, videos generated, and content posted.</li>
              <li><strong className="text-white">Device Information:</strong> Browser type, operating system, screen resolution, and timezone for security purposes.</li>
              <li><strong className="text-white">Payment Information:</strong> Processed securely by Stripe. We do not store card details.</li>
              <li><strong className="text-white">Uploaded Content:</strong> Images, photos, or actor likenesses you upload for video generation.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>To provide, operate, and improve our services</li>
              <li>To process payments and manage subscriptions</li>
              <li>To prevent fraud and abuse of free trial tokens</li>
              <li>To send transactional emails (verification, receipts, alerts)</li>
              <li>To analyze usage patterns and improve platform performance</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Cookies</h2>
            <p>We use cookies to improve your experience, remember your preferences, and analyze site traffic. You can accept or reject non-essential cookies via our cookie banner. Essential cookies required for the platform to function cannot be disabled.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Third-Party Services</h2>
            <p className="mb-3">We use the following third-party services which may process your data:</p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong className="text-white">Supabase:</strong> Database and authentication</li>
              <li><strong className="text-white">Stripe:</strong> Payment processing</li>
              <li><strong className="text-white">Ayrshare:</strong> Social media distribution</li>
              <li><strong className="text-white">OpenAI / Google / Kling:</strong> AI video and image generation</li>
              <li><strong className="text-white">ElevenLabs:</strong> AI voice generation</li>
              <li><strong className="text-white">Vercel:</strong> Hosting and infrastructure</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Data Retention</h2>
            <p>We retain your personal data for as long as your account is active. If you delete your account, we will delete your personal data within 30 days, except where we are required to retain it for legal or financial compliance purposes.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Your Rights (GDPR)</h2>
            <p className="mb-3">If you are located in the European Union or United Kingdom, you have the following rights:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Right to access your personal data</li>
              <li>Right to rectify inaccurate data</li>
              <li>Right to erasure ("right to be forgotten")</li>
              <li>Right to data portability</li>
              <li>Right to object to processing</li>
              <li>Right to withdraw consent at any time</li>
            </ul>
            <p className="mt-3">To exercise any of these rights, contact us at: <a href="mailto:privacy@klipflowai.com" className="text-purple-400 hover:text-white">privacy@klipflowai.com</a></p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Data Security</h2>
            <p>We implement industry-standard security measures including encryption in transit (HTTPS), row-level security on our database, and regular security audits. However, no system is 100% secure and we cannot guarantee absolute security.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">9. Children's Privacy</h2>
            <p>KlipflowAI is not intended for users under the age of 18. We do not knowingly collect personal data from minors. If you believe a minor has provided us with personal data, please contact us immediately.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">10. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes by email or via a notice on our platform. Your continued use of KlipflowAI after changes constitutes acceptance of the updated policy.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-3">11. Contact Us</h2>
            <p>For any privacy-related questions or requests, contact us at:</p>
            <div className="mt-3 bg-white/5 border border-white/10 rounded-xl p-4">
              <p className="text-white font-semibold">KlipflowAI</p>
              <p>Email: <a href="mailto:privacy@klipflowai.com" className="text-purple-400 hover:text-white">privacy@klipflowai.com</a></p>
              <p>Website: <a href="https://klipflowai.com" className="text-purple-400 hover:text-white">klipflowai.com</a></p>
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}