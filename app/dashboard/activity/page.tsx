export default function Activity() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold mb-1">Activity Log</h1>
        <p className="text-gray-400 text-sm">Full history of all your generations and actions</p>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
        <div className="text-5xl mb-4">⚡</div>
        <h3 className="font-bold text-lg mb-2">No activity yet</h3>
        <p className="text-gray-400 text-sm">Every generation, post, and action will be logged here</p>
      </div>
    </div>
  );
}