export function validateLatexText(input: string): boolean {
  const content = input.trim();
  if (!content) {
    return false;
  }

  const inlineOpen = (content.match(/\$/g) ?? []).length;
  const blockOpen = (content.match(/\$\$/g) ?? []).length;

  // Rough safety check to catch obvious unmatched delimiters.
  if (blockOpen % 2 !== 0) {
    return false;
  }

  if (inlineOpen % 2 !== 0) {
    return false;
  }

  return true;
}
