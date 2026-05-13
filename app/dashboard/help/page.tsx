export default function Help() {
  const faqs = [
    { q: "How do tokens work?", a: "1 video = 10 tokens, 1 image = 2 tokens, 1 script = 1 token. You start with 25 free tokens. Top up anytime from $5." },
    { q: "When will video generation be live?", a: "We're currently integrating with Kling, Veo 3, and Sora APIs. Video generation will be live very soon. You'll be notified by email." },
    { q: "How do I connect my social accounts?", a: "Go to Settings → Connected Social Accounts. Click Connect next to each platform. We use official APIs so your accounts are always safe." },
    { q: "Can I get a refund?", a: "Token top-ups are non-refundable once purchased. Subscription plans can be cancelled anytime with no future charges." },
    { q: "How do I upgrade my plan?", a: "Go to Billing → Upgrade Plan. Stripe payments will be live soon. You'll be notified when subscriptions open." },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold mb-1">Help & Support</h1>
        <p className="text-gray-400 text-sm">Get answers and contact our team</p>
      </div>

      {/* CONTACT */}
      <div className="grid md:grid-cols-2 gap-4">
        <a href="mailto:support@klipflowai.com" className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-purple-500/50 transition">
          <div className="text-3xl mb-3">📧</div>
          <div className="font-bold mb-1">Email Support</div>
          <div className="text-gray-400 text-sm">support@klipflowai.com</div>
        </a>
        <a href="/blog" className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-purple-500/50 transition">
          <div className="text-3xl mb-3">📚</div>
          <div className="font-bold mb-1">Documentation</div>
          <div className="text-gray-400 text-sm">Guides, tutorials and tips</div>
        </a>
      </div>

      {/* FAQ */}
      <div>
        <h2 className="text-lg font-bold mb-4">Frequently Asked Questions</h2>
        <div className="space-y-3">
          {faqs.map((item, i) => (
            <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-5">
              <h3 className="font-semibold text-sm mb-2">{item.q}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}