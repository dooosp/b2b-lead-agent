function extractGoogleNewsSource(title) {
  const match = title?.match(/ - ([^-]+)$/);
  return match ? match[1].trim() : 'Unknown';
}

function normalizeGoogleNewsItem(item, query) {
  return {
    title: item.title || '',
    link: item.link || '',
    source: item.source?._ || item.creator || extractGoogleNewsSource(item.title),
    pubDate: item.pubDate || '',
    content: item.contentSnippet || '',
    bodySource: item.contentSnippet ? 'feed-snippet' : 'missing',
    query
  };
}

function normalizeRssItem(item, { source, query }) {
  return {
    title: item.title || '',
    link: item.link || '',
    source,
    pubDate: item.pubDate || '',
    content: item.contentSnippet || '',
    bodySource: item.contentSnippet ? 'feed-snippet' : 'missing',
    query
  };
}

module.exports = {
  extractGoogleNewsSource,
  normalizeGoogleNewsItem,
  normalizeRssItem,
};
