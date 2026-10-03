// Lightweight, offline language guess for prompts. Returns a language code from
// the output-language list, or null when unsure (callers may then ask the AI).

const STOPWORDS: Record<string, string[]> = {
  en: ["the", "and", "with", "of", "a", "in", "on", "is", "to", "for", "her", "his", "their", "at", "from", "while", "into", "this", "that", "are", "it", "an", "by", "as", "who"],
  fr: ["le", "la", "les", "et", "avec", "des", "une", "un", "dans", "sur", "est", "du", "pour", "qui", "sa", "son", "au", "aux", "en", "pendant", "ce", "cette", "pas", "très"],
  es: ["el", "la", "los", "las", "y", "con", "una", "un", "en", "del", "que", "por", "para", "su", "sus", "es", "mientras", "al", "lo", "muy", "este", "esta"],
  pt: ["o", "os", "as", "e", "com", "uma", "um", "em", "do", "da", "dos", "das", "que", "por", "para", "seu", "sua", "é", "no", "na", "nos", "muito", "enquanto"],
  de: ["der", "die", "das", "und", "mit", "ein", "eine", "im", "in", "auf", "ist", "von", "zu", "den", "dem", "sich", "nicht", "während", "einen", "seine", "ihre"],
  it: ["il", "lo", "gli", "le", "e", "con", "una", "un", "nel", "nella", "sul", "è", "di", "che", "per", "del", "della", "mentre", "suo", "sua", "molto"],
  nl: ["de", "het", "een", "en", "met", "van", "op", "in", "is", "die", "dat", "zijn", "haar", "voor", "terwijl", "niet", "naar"],
  pl: ["i", "w", "z", "na", "się", "jest", "do", "nie", "że", "jak", "ze", "od", "po", "przez", "jego", "jej", "który", "która"],
  tr: ["ve", "bir", "ile", "bu", "için", "olan", "çok", "gibi", "da", "de", "onun", "ama", "sonra", "kadın", "adam"],
  sw: ["na", "ya", "wa", "kwa", "katika", "ni", "la", "za", "mtu", "huku", "akiwa", "yake", "hii", "kama"],
  yo: ["ati", "ni", "si", "ti", "kan", "won", "lati", "fun", "pelu", "nigba", "obinrin", "okunrin"],
  ha: ["da", "a", "na", "ta", "ya", "wani", "wata", "cikin", "kuma", "suna", "yana", "tana", "mace", "namiji"],
  af: ["die", "en", "met", "van", "op", "is", "nie", "het", "'n", "wat", "vir", "terwyl", "haar", "sy"],
};

const MARKS: [RegExp, string][] = [
  [/[ñ¿¡]/, "es"], [/[ãõ]/, "pt"], [/ç/, "pt"], [/[ßäöü]/, "de"], [/[èêëœ]/, "fr"],
  [/[ıışğ]/, "tr"], [/[łąężźśćń]/, "pl"], [/[ẹọṣ]/, "yo"], [/[ƙɗɓ]/, "ha"], [/[ò]/, "it"],
];

export function detectLanguage(text: string): string | null {
  const clean = text.replace(/https?:\/\/\S+/g, " ").replace(/[0-9]/g, " ");
  const letters = clean.replace(/[^\p{L}]/gu, "");
  if (letters.length < 12) return null;
  const share = (re: RegExp) => (clean.match(re)?.length ?? 0) / letters.length;

  // Non-Latin scripts are unambiguous enough on their own
  if (share(/[؀-ۿ]/g) > 0.3) return "ar";
  if (share(/[ऀ-ॿ]/g) > 0.3) return "hi";
  if (share(/[가-힯]/g) > 0.3) return "ko";
  if (share(/[぀-ヿ]/g) > 0.1) return "ja";
  if (share(/[一-鿿]/g) > 0.3) return "zh";
  if (share(/[Ѐ-ӿ]/g) > 0.3) {
    if (/[ыэё]/i.test(clean)) return "ru";
    if (/ъ/i.test(clean)) return "bg";
    return null;
  }

  // Latin: score common function words plus telltale letters
  const words = clean.toLowerCase().split(/[^\p{L}']+/u).filter(Boolean);
  if (words.length < 4) return null;
  const scores = Object.entries(STOPWORDS).map(([code, list]) => {
    const set = new Set(list);
    let score = words.filter((w) => set.has(w)).length;
    for (const [re, c] of MARKS) if (c === code && re.test(clean.toLowerCase())) score += 2;
    return { code, score: score / Math.sqrt(words.length) };
  }).sort((a, b) => b.score - a.score);
  const [best, second] = scores;
  if (best.score < 0.6 || best.score < second.score * 1.5) return null;
  return best.code;
}
