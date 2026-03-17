export function normalizeLegalText(body: string): string[] {
  const normalizedBlocks = body
    .replace(/^\uFEFF/, '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) =>
      block
        .split('\\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.replace(/^#{1,6}\\s*/, '').replace(/^- /, '? '))
        .join('\\n'),
    );
  if (
    normalizedBlocks[0]?.startsWith('Terms of Service') ||
    normalizedBlocks[0]?.startsWith('Privacy Policy') ||
    normalizedBlocks[0]?.startsWith('Official Rules')
  ) {
    normalizedBlocks.shift();
  }
  if (normalizedBlocks[0]?.startsWith('This is a template for informational purposes.')) {
    normalizedBlocks.shift();
  }
  return normalizedBlocks;
}
