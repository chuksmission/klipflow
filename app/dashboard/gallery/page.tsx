export default function Gallery() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold mb-1">Gallery</h1>
        <p className="text-gray-400 text-sm">All your generated videos and images</p>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
        <div className="text-5xl mb-4">🖼️</div>
        <h3 className="font-bold text-lg mb-2">No content yet</h3>
        <p className="text-gray-400 text-sm mb-6">Generated videos and images will appear here</p>
        <a href="/dashboard/studio" className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-8 rounded-full transition inline-block text-sm">
          Generate First Video →
        </a>
      </div>
    </div>
  );
}