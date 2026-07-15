export function buildDiscussionContent(title: string, body: string): string {
  return `${title.trim()}\n\n${body.trim()}`;
}

export function parseDiscussionContent(content: string): { title: string; body: string } {
  const separator = content.indexOf('\n\n');
  if (separator === -1) {
    return { title: content.slice(0, 80), body: content };
  }
  return {
    title: content.slice(0, separator),
    body: content.slice(separator + 2),
  };
}