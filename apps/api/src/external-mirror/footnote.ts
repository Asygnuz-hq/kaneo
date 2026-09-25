// Each side appends "Reflejado desde Kaneo ..." to a description it mirrors.
// When that description is edited and sent back, the other side's footnote
// must come off first, or the notes would stack up on every round trip.
const MIRROR_FOOTNOTE = /(?:\n*Reflejado desde Kaneo[^\n]*)+\s*$/;

export function stripMirrorFootnote(text: string): string {
  return text.replace(MIRROR_FOOTNOTE, "").trimEnd();
}
