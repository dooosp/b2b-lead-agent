/**
 * Jaccard 유사도 기반 뉴스 중복 제거
 */

function calculateSimilarity(str1, str2) {
  const set1 = new Set(str1.toLowerCase().split(/\s+/));
  const set2 = new Set(str2.toLowerCase().split(/\s+/));
  const intersection = [...set1].filter(x => set2.has(x));
  const union = new Set([...set1, ...set2]);
  return union.size === 0 ? 0 : intersection.length / union.size;
}

function removeDuplicates(articles, threshold = 0.6) {
  const unique = [];
  for (const article of articles) {
    const isDuplicate = unique.some(
      existing => calculateSimilarity(existing.title, article.title) > threshold
    );
    if (!isDuplicate) unique.push(article);
  }
  return unique;
}

module.exports = { calculateSimilarity, removeDuplicates };
