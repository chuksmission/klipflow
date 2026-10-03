// What a Studio module reports after saving a result to the gallery, so a host
// (Showcase Studio) can feature it on the homepage.
export interface SavedGeneration {
  id: number | string;
  url: string;
  outputType: "video" | "image";
  sourceImage?: string | null;
}
