import PSEOPage from "../components/PSEOPage";
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Text to Video Generator — AI Video from Text',
  description: 'Convert any text prompt into a cinematic AI video in seconds. Powered by Kling 3.0, Sora 2, Veo 3 and more. The fastest text to video AI available.',
  keywords: ['text to video', 'text to video AI', 'text to video generator', 'AI text to video free', 'convert text to video', 'text to video online'],
  alternates: { canonical: 'https://klipflowai.com/text-to-video-generator' },
  openGraph: {
    title: 'Text to Video Generator — AI Video from Text | KlipflowAI',
    description: 'Convert any text prompt into a cinematic AI video in seconds. Powered by Kling, Sora, Veo 3.',
    url: 'https://klipflowai.com/text-to-video-generator',
  },
}

export default function TextToVideoGenerator() {
  return (
    <PSEOPage
      badge="📝 Text to Video Generator"
      title="Generate Professional Videos from Text with AI"
      subtitle="Type any idea. Get a cinematic video in minutes. No skills required."
      description="KlipflowAI's text to video generator is the most advanced on the market. Simply describe what you want to see and our AI Director automatically expands your idea into a detailed cinematic prompt, then generates a professional video using Kling 2.6, Google Veo 3, or OpenAI Sora. From simple product descriptions to complex cinematic scenes — if you can describe it, we can generate it."
      keywords={["text to video generator", "text to video ai", "ai video from text", "generate video from text", "text to video free", "best text to video ai", "ai text to video generator online", "convert text to video ai"]}
      howItWorks={[
        { step: "1", icon: "📝", title: "Type Your Description", desc: "Describe your video in plain English. As simple or as detailed as you like." },
        { step: "2", icon: "✨", title: "AI Enhances Your Prompt", desc: "Director Engine adds cinematic details — lighting, camera movement, visual style." },
        { step: "3", icon: "🎬", title: "Video Generated", desc: "Professional AI video ready in 1-3 minutes. Download in HD quality." }
      ]}
      features={[
        { icon: "🌍", title: "Any Scene or Subject", desc: "Generate any video — product shots, nature scenes, human actors, abstract visuals, and more." },
        { icon: "🎬", title: "Cinematic Quality", desc: "Film-grade visuals with professional lighting, camera movement, and color grading." },
        { icon: "⚡", title: "Fast Generation", desc: "Videos ready in 1-3 minutes. Priority processing under 60 seconds on Pro plans." },
        { icon: "📐", title: "Multiple Formats", desc: "Generate in portrait, landscape, or square. Perfect for any social media platform." },
        { icon: "🔧", title: "AI Model Choice", desc: "Choose Kling for speed, Veo 3 for quality, or Sora for creativity." },
        { icon: "🔄", title: "Extend Your Video", desc: "Not long enough? Extend any video with additional scenes using the same style." }
      ]}
      faqs={[
        { q: "How does text to video AI work?", a: "Text to video AI converts written descriptions into video content using deep learning models trained on millions of videos. The AI understands your description and generates matching visuals frame by frame." },
        { q: "What's the best text to video AI in 2026?", a: "The top AI video models in 2026 are Kling 2.6, Google Veo 3, and OpenAI Sora. KlipflowAI gives you access to all three in one platform." },
        { q: "How detailed does my text description need to be?", a: "As simple as you like. You can write 'a cat sitting in a sunny window' or a detailed 200-word scene description. Our Director Engine fills in the cinematic details automatically." },
        { q: "What video length can I generate?", a: "Standard generations produce 5-10 second clips. You can extend videos by adding additional scenes to build longer content." },
        { q: "Is there a free text to video generator?", a: "Yes. Sign up free and get 25 tokens to generate 2 complete videos. No credit card required." }
      ]}
      ctaTitle="Try Text to Video Free Today"
      ctaDesc="25 free tokens. No credit card. Your video in minutes."
    />
  );
}