import PSEOPage from "../components/PSEOPage";

export const metadata = {
  title: "AI Video Generator — Create Professional Videos in Minutes | KlipflowAI",
  description: "Generate professional AI videos from text or images. Powered by Kling, Veo 3, and Sora. Text to video, image to video, avatar videos and more. Start free."
};

export default function AIVideoGenerator() {
  return (
    <PSEOPage
      badge="🎬 AI Video Generator"
      title="Generate Professional AI Videos in Minutes"
      subtitle="Text to video, image to video, avatar videos — powered by Kling, Veo 3, and Sora."
      description="KlipflowAI is the most powerful AI video generator available. Generate cinematic videos from text descriptions, animate still images, create avatar videos with AI actors, produce UGC testimonials, and add professional voiceovers — all in one platform. Powered by the world's best AI video models including Kling 2.6, Google Veo 3, and OpenAI Sora."
      keywords={["ai video generator", "text to video ai", "ai video maker", "generate video with ai", "best ai video generator", "free ai video generator", "ai video creator online", "ai video generator from text"]}
      howItWorks={[
        { step: "1", icon: "✍️", title: "Describe Your Video", desc: "Type a simple description. Our AI Director expands it into a professional cinematic prompt automatically." },
        { step: "2", icon: "⚙️", title: "Choose Your Model", desc: "Select Kling for speed, Veo 3 for cinematic quality, or Sora for creative outputs." },
        { step: "3", icon: "⬇️", title: "Download & Use", desc: "Your video is ready in 1-3 minutes. Download in HD, watermark-free on any paid plan." }
      ]}
      features={[
        { icon: "📝", title: "Text to Video", desc: "Generate videos from any text description. Our prompt engine adds cinematic details automatically." },
        { icon: "🖼️", title: "Image to Video", desc: "Upload any image and animate it into a stunning video with controlled motion." },
        { icon: "🧑‍🎤", title: "Avatar Videos", desc: "Generate videos with AI human avatars. Create your actor or upload your own." },
        { icon: "🎙️", title: "AI Voiceover", desc: "Add natural AI voiceover to any video. Multiple languages, accents, and styles." },
        { icon: "📐", title: "Any Aspect Ratio", desc: "Generate in 9:16 for shorts, 16:9 for YouTube, 1:1 for feed. Auto-adapted per platform." },
        { icon: "⚡", title: "Fast Generation", desc: "Videos ready in 1-3 minutes. Priority processing available on Pro and Agency plans." }
      ]}
      faqs={[
        { q: "What is an AI video generator?", a: "An AI video generator creates professional videos from text descriptions or images using artificial intelligence. No cameras, no editing software, no technical skills required." },
        { q: "Which AI models power KlipflowAI?", a: "KlipflowAI uses Kling 2.6, Google Veo 3, and OpenAI Sora — the three most advanced AI video models available in 2026." },
        { q: "How long does it take to generate a video?", a: "Standard videos generate in 1-3 minutes. Pro and Agency plan users get priority processing, typically under 60 seconds." },
        { q: "What video formats can I generate?", a: "Text to video, image to video, avatar videos, UGC testimonial videos, and voiceover videos. Any format you need for social media or advertising." },
        { q: "Is there a free AI video generator option?", a: "Yes. Sign up free and get 25 tokens — enough to generate 2 complete videos. Free trial videos include a watermark which is removed on any paid plan." }
      ]}
      ctaTitle="Generate Your First AI Video Free"
      ctaDesc="25 free tokens. No credit card. Results in minutes."
    />
  );
}