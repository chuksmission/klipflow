import { Playfair_Display } from "next/font/google";

// Cinematic serif italic for the homepage headline (hero + closing CTA).
// Playfair covers Latin, Latin Extended and Cyrillic; Arabic and Hindi fall
// back to the Noto sans faces from the root layout.
export const displaySerif = Playfair_Display({
  subsets: ["latin", "latin-ext", "cyrillic"],
  style: ["italic"],
  weight: ["600", "700"],
  display: "swap",
});
