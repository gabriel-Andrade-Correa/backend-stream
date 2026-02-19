function scoreTitle(title, favoriteGenre) {
  const genreBoostMap = {
    Action: [28, 12, 878],
    Comedy: [35],
    Drama: [18],
    Horror: [27],
    Animation: [16],
    SciFi: [878]
  };

  const boosts = genreBoostMap[favoriteGenre] || [28, 18];
  const hasGenreBoost = (title.genreIds || []).some((id) => boosts.includes(id));
  const score = title.popularity + (hasGenreBoost ? 150 : 0) + (title.voteAverage || 0) * 10;
  return { ...title, recommendationScore: score };
}

function getRecommendations(titles, favoriteGenre, selectedPlatforms) {
  return titles
    .filter((title) => {
      if (!selectedPlatforms?.length) return true;
      return title.availableOn?.some((name) => selectedPlatforms.includes(name));
    })
    .map((title) => scoreTitle(title, favoriteGenre))
    .sort((a, b) => b.recommendationScore - a.recommendationScore)
    .slice(0, 10);
}

module.exports = { getRecommendations };
