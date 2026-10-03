// Shared class strings for elements that are usually written inline
// (native inputs, tables). Components in this folder build on these.

export const labelClass = "mb-1.5 block text-[13px] font-medium text-ink-muted";

const fieldBase =
  "w-full rounded-xl border border-line bg-canvas text-sm text-ink placeholder:text-ink-subtle transition-colors " +
  "hover:border-line-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 " +
  "disabled:cursor-not-allowed disabled:opacity-60";

export const inputClass = `${fieldBase} h-10 px-3.5`;
export const textareaClass = `${fieldBase} px-3.5 py-2.5 resize-none leading-relaxed`;
export const selectClass = `${fieldBase} h-10 ps-3 pe-8`;

export const cardClass = "rounded-2xl border border-line bg-surface";
export const cardPadded = `${cardClass} p-5 md:p-6`;

export const tableWrapClass = "overflow-x-auto rounded-2xl border border-line bg-surface";
export const tableClass = "w-full text-start text-sm";
export const thClass = "whitespace-nowrap border-b border-line px-4 py-3 text-xs font-medium text-ink-subtle";
export const tdClass = "border-b border-line/60 px-4 py-3 text-ink-muted";
export const trClass = "transition-colors hover:bg-white/[0.02] [&:last-child>td]:border-b-0";
