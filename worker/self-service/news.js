import { parseRSSItems } from './rss.js';

export async function fetchGoogleNewsWorker(query) {
  const encoded = encodeURIComponent(query);
  const url = `https://news.google.com/rss/search?q=${encoded}+when:3d&hl=ko&gl=KR&ceid=KR:ko`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; B2BLeadBot/1.0)' }
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRSSItems(xml).slice(0, 5).map(item => ({ ...item, query }));
  } catch {
    return [];
  }
}

export async function fetchAllNewsWorker(queries) {
  const results = await Promise.allSettled(
    queries.map(q => fetchGoogleNewsWorker(q))
  );
  const allArticles = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value);
  return removeDuplicatesWorker(allArticles);
}

export function removeDuplicatesWorker(articles) {
  const seen = new Set();
  return articles.filter(a => {
    const key = a.title.replace(/\s+/g, '').toLowerCase().slice(0, 40);
    if (seen.has(key)) return false;
    for (const existing of seen) {
      const set1 = new Set(key);
      const set2 = new Set(existing);
      const intersection = [...set1].filter(c => set2.has(c)).length;
      const union = new Set([...set1, ...set2]).size;
      if (union > 0 && intersection / union > 0.8) return false;
    }
    seen.add(key);
    return true;
  });
}
