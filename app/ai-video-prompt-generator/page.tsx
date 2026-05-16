import PSEOPage from "../components/PSEOPage";
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Video Prompt Generator — Better Prompts, Better Videos',
  description: 'Generate powerful AI video prompts instantly. Stop guessing what to type — our AI prompt expander turns simple ideas into detailed cinematic prompts that produce stunning results.',
  keywords: ['AI video prompt generator', 'video prompt generator', 'AI prompt expander', 'Kling prompt generator', 'Sora prompt ideas', 'AI video prompts', 'text to video prompts'],
  alternates: { canonical: 'https://klipflowai.com/ai-video-prompt-generator' },
  openGraph: {
    title: 'AI Video Prompt Generator — Better Prompts, Better Videos | KlipflowAI',
    description: 'Turn simple ideas into detailed cinematic AI video prompts instantly.',
    url: 'https://klipflowai.com/ai-video-prompt-generator',
  },
}

export default function AIVideoPromptGenerator() {
  return (
    <PSEOPage
      badge="✨ AI Video Prompt Generator"
      title="Generate Cinematic AI Video Prompts Instantly"
      subtitle="Turn simple ideas into professional film-grade prompts for Sora, Veo 3, and Kling."
      description="The quality of your AI video depends entirely on the quality of your prompt. KlipflowAI's Director Engine transforms any simple idea into a detailed cinematic prompt — including camera angles, lighting setups, motion styles, lens specifications, and visual atmospheres. Get professional results without knowing anything about filmmaking or prompt engineering."
      keywords={["ai video prompt generator", "video prompt generator", "sora prompt generator", "veo 3 prompts", "kling prompts", "cinematic prompt generator", "ai prompt for video", "text to video prompts"]}
      howItWorks={[
        { step: "1", icon: "💭", title: "Type Your Idea", desc: "Enter any simple description like 'luxury car on mountain road at sunset'." },
        { step: "2", icon: "✨", title: "AI Expands It", desc: "Our Director Engine adds optics, lighting, movement, atmosphere, and film grade details automatically." },
        { step: "3", icon: "🎬", title: "Generate Your Video", desc: "Use the expanded prompt directly in KlipflowAI to generate a professional cinematic video." }
      ]}
      features={[
        { icon: "🎥", title: "Camera & Optics", desc: "Automatically adds lens specs, aperture, focal length, and camera movement for cinematic results." },
        { icon: "💡", title: "Lighting Design", desc: "Volumetric lighting, golden hour, studio setups, and atmospheric effects added automatically." },
        { icon: "🎭", title: "Motion & Movement", desc: "Orbital tracking, slow motion, drone shots, and cinematic panning added to every prompt." },
        { icon: "🎨", title: "Visual Style", desc: "Film grain, color grading, depth of field, and artistic style applied automatically." },
        { icon: "🔄", title: "Multiple Variations", desc: "Generate multiple prompt variations from one idea to explore different creative directions." },
        { icon: "📋", title: "Copy & Use Anywhere", desc: "Copy your expanded prompt and use it in any AI video tool — Sora, Veo 3, Kling, Runway." }
      ]}
      faqs={[
        { q: "What is an AI video prompt generator?", a: "An AI video prompt generator transforms simple ideas into detailed, optimized prompts that produce better results in AI video generation tools like Sora, Veo 3, and Kling." },
        { q: "Why do I need a prompt generator?", a: "AI video models are extremely sensitive to prompt quality. A vague prompt produces mediocre results. A detailed cinematic prompt produces professional results. Our Director Engine bridges that gap automatically." },
        { q: "Does it work with Sora, Veo 3, and Kling?", a: "Yes. Our prompts are optimized specifically for all major AI video models. You can copy the prompt and use it directly in any tool." },
        { q: "Can I try the prompt generator free?", a: "Yes. The prompt expansion demo on our homepage is completely free — no signup required. Sign up for 25 free tokens to generate actual videos." },
        { q: "What makes a good AI video prompt?", a: "A good AI video prompt includes: subject description, camera movement, lighting setup, lens specifications, visual style, atmosphere, and mood. Our Director Engine adds all of these automatically." }
      ]}
      ctaTitle="Try the Prompt Generator Free"
      ctaDesc="No signup required for the demo. 25 free tokens to generate real videos."
    />
  );
}