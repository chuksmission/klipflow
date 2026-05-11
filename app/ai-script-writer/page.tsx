import PSEOPage from "../components/PSEOPage";

export const metadata = {
  title: "AI Script Writer — Generate Video Scripts Instantly | KlipflowAI",
  description: "Generate viral video scripts with AI. Trending hooks, full scripts, and CTAs written automatically for your niche. Perfect for faceless channels and video ads."
};

export default function AIScriptWriter() {
  return (
    <PSEOPage
      badge="✍️ AI Script Writer"
      title="Generate Viral Video Scripts with AI — Instantly"
      subtitle="Trending hooks, full scripts, and CTAs written automatically for your niche."
      description="Writing compelling video scripts is the hardest part of content creation. KlipflowAI's AI Script Writer generates complete video scripts based on trending topics in your niche — including attention-grabbing hooks, engaging body content, and strong calls to action. Updated daily with what's going viral right now across TikTok, Instagram, and YouTube."
      keywords={["ai script writer", "ai video script generator", "script writing ai", "video script generator", "tiktok script generator", "youtube script generator", "ai content writer for video", "viral script generator"]}
      howItWorks={[
        { step: "1", icon: "🎯", title: "Choose Your Niche", desc: "Select your content niche or describe your topic. AI identifies trending angles automatically." },
        { step: "2", icon: "✍️", title: "AI Writes Your Script", desc: "Full script generated with viral hook, engaging body, and strong CTA. Ready in seconds." },
        { step: "3", icon: "🎬", title: "Generate the Video", desc: "Use your script directly in KlipflowAI to generate a complete AI video with voiceover." }
      ]}
      features={[
        { icon: "🪝", title: "Viral Hooks", desc: "Opening lines designed to stop the scroll. Based on proven hook formulas that drive views." },
        { icon: "📈", title: "Trend-Based Scripts", desc: "Scripts written around trending topics updated daily. Always relevant, always timely." },
        { icon: "🎙️", title: "Voiceover Ready", desc: "Scripts formatted for natural voiceover delivery. Punctuation and pacing optimized for AI voice." },
        { icon: "🛍️", title: "Ad Scripts", desc: "Dedicated ad script mode for e-commerce. Problem, agitation, solution format that converts." },
        { icon: "🔄", title: "Multiple Variations", desc: "Generate 3 script variations per topic to test different angles and hooks." },
        { icon: "📱", title: "Platform Optimized", desc: "Scripts optimized for TikTok, Instagram Reels, YouTube Shorts length and format requirements." }
      ]}
      faqs={[
        { q: "What is an AI script writer?", a: "An AI script writer generates complete video scripts using artificial intelligence. It analyzes trending content in your niche and writes hooks, body content, and CTAs that are proven to perform." },
        { q: "Can it write scripts for any niche?", a: "Yes. KlipflowAI's script writer works for any niche including finance, motivation, scary stories, luxury, fitness, e-commerce, tech, and more." },
        { q: "Are the scripts unique?", a: "Yes. Every script generated is unique. We never produce the same script twice, protecting you from duplicate content issues." },
        { q: "Can I edit the scripts?", a: "Absolutely. Generated scripts are fully editable. Use them as-is or as a starting point for your own creative direction." },
        { q: "Does it write ad scripts too?", a: "Yes. KlipflowAI has a dedicated ad script mode that writes scripts optimized for Facebook and Instagram advertising with proven conversion frameworks." }
      ]}
      ctaTitle="Generate Your First Script Free"
      ctaDesc="25 free tokens on signup. Scripts ready in seconds."
    />
  );
}