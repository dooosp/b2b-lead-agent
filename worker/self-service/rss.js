export function decodeXmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&apos;/g, "'");
}

export function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const m = xml.match(re);
  return m ? decodeXmlEntities(m[1].trim()) : '';
}

export function parseRSSItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title').replace(/<[^>]*>/g, '');
    const link = extractTag(block, 'link');
    const pubDate = extractTag(block, 'pubDate');
    const sourceMatch = block.match(/<source\s+url=["']([^"']+)["'][^>]*>([^<]*)<\/source>/i);
    const sourceUrl = sourceMatch ? sourceMatch[1] : '';
    const sourceName = sourceMatch ? sourceMatch[2].trim() : 'Google News';
    if (title && link) {
      items.push({ title, link, pubDate, source: sourceName, sourceUrl });
    }
  }
  return items;
}
