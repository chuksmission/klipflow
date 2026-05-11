import PSEOPage from "../components/PSEOPage";

export const metadata = {
  title: "Image to Video Generator — Animate Any Photo with AI | KlipflowAI",
  description: "Transform any image into a stunning AI video. Animate product photos, portraits, and landscapes with controlled motion. Free to try — no credit card needed."
};

export default function ImageToVideoGenerator() {
  return (
    <PSEOPage
      badge="🖼️ Image to Video Generator"
      title="Animate Any Image into a Stunning AI Video"
      subtitle="Transform product photos, portraits, and landscapes into cinematic videos in minutes."
      description="KlipflowAI's image to video generator brings your still images to life. Upload any photo — product shots, portraits, landscapes, or graphics — and our AI animates it into a smooth, cinematic video with controlled motion. Perfect for e-commerce product videos, social media content, and advertising creatives. No video editing skills required."
      keywords={["image to video generator", "animate image ai", "photo to video ai", "image to video ai free", "animate photo online", "ai image animation", "turn image into video ai", "image to video converter ai"]}
      howItWorks={[
        { step: "1", icon: "📸", title: "Upload Your Image", desc: "Upload any JPG or PNG image. Product photos, portraits, landscapes — anything works." },
        { step: "2", icon: "⚙️", title: "Set Motion Parameters", desc: "Choose motion direction, speed, and style. Zoom, pan, rotate, or complex movement." },
        { step: "3", icon: "🎬", title: "Download Your Video", desc: "Animated video ready in minutes. Perfect for ads, social media, and product showcases." }
      ]}
      features={[
        { icon: "🛍️", title: "Product Animation", desc: "Bring product photos to life for e-commerce ads. Moving products convert better than static images." },
        { icon: "🎭", title: "Portrait Animation", desc: "Animate headshots and portraits for UGC-style content without filming new footage." },
        { icon: "🏔️", title: "Landscape & Scene", desc: "Add movement to any landscape or scene photo. Parallax, zoom, and atmospheric effects." },
        { icon: "🎛️", title: "Motion Control", desc: "Control exactly how your image moves — direction, speed, intensity, and style." },
        { icon: "📱", title: "Social Formats", desc: "Export in portrait for Reels and TikTok, landscape for YouTube, square for feed." },
        { icon: "⚡", title: "Fast Processing", desc: "Image to video conversion in under 2 minutes. Batch process multiple images on Pro plans." }
      ]}
      faqs={[
        { q: "What is an image to video generator?", a: "An image to video generator uses AI to animate still images into moving video content. It analyzes the image and generates realistic motion that makes the scene come alive." },
        { q: "What types of images work best?", a: "Any image works — product photos, portraits, landscapes, illustrations, and graphics. High resolution images (1080p or higher) produce the best results." },
        { q: "Can I control how the image moves?", a: "Yes. KlipflowAI gives you control over motion direction, speed, and style. Choose from gentle zoom, parallax movement, rotation, or complex custom motion paths." },
        { q: "Is it good for product ads?", a: "Excellent. Animated product images consistently outperform static images in Facebook and Instagram ads. Our users report 30-50% higher CTR on animated product ads." },
        { q: "How much does it cost?", a: "Image to video uses 10 tokens per generation. Sign up free for 25 tokens (2 free videos). Paid plans start at $29/month." }
      ]}
      ctaTitle="Animate Your First Image Free"
      ctaDesc="25 free tokens on signup. No credit card required."
    />
  );
}