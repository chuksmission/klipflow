export default function Billing() {
  const topUpPacks = [
    { price: "$5", tokens: "50 tokens", popular: false },
    { price: "$9", tokens: "100 tokens", popular: false },
    { price: "$19", tokens: "250 tokens", popular: true },
    { price: "$39", tokens: "600 tokens", popular: false },
    { price: "$69", tokens: "1,200 tokens", popular: false },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold mb-1">Billing & Credits</h1>
        <p className="text-gray-400 text-sm">Manage your plan and top up your tokens</p>
      </div>

      {/* CURRENT PLAN */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">Current Plan</div>
            <div className="text-xl font-bold">Free Trial</div>
          </div>
          <div className="bg-purple-900/40 border border-purple-500/30 text-purple-300 text-xs font-bold px-3 py-1 rounded-full">
            Trial
          </div>
        </div>
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-400">Token Balance</span>
            <span className="font-bold">25 / 25</span>
          </div>
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full" style={{ width: '100%' }} />
          </div>
        </div>
        <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-xl transition">
          Upgrade Plan — Coming Soon
        </button>
      </div>

      {/* TOP UP PACKS */}
      <div>
        <h2 className="text-lg font-bold mb-2">Top Up Tokens</h2>
        <p className="text-gray-400 text-sm mb-4">Tokens never expire · Auto top-up available · Instant delivery</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {topUpPacks.map((pack, i) => (
            <div key={i} className={`relative border rounded-2xl p-5 text-center cursor-pointer transition ${pack.popular ? 'border-purple-500 bg-purple-900/20' : 'border-white/10 bg-white/5 hover:border-purple-500/50'}`}>
              {pack.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs font-bold px-3 py-0.5 rounded-full">
                  Popular
                </div>
              )}
              <div className="text-2xl font-extrabold mb-1">{pack.price}</div>
              <div className="text-gray-400 text-xs mb-3">{pack.tokens}</div>
              <button className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-2 rounded-full transition">
                Buy — Soon
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* INVOICE HISTORY */}
      <div>
        <h2 className="text-lg font-bold mb-4">Invoice History</h2>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <p className="text-gray-500 text-sm">No invoices yet. Your billing history will appear here.</p>
        </div>
      </div>
    </div>
  );
}