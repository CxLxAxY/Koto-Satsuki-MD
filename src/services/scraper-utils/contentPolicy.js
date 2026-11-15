const adultContentPattern = /18\+|\b(?:adult|mature|erotic|ecchi|hentai|smut|nsfw)\b/iu;

const isAgeAppropriateContent = (value) => {
  if (!value || typeof value !== 'object') return true;
  if (value.adult === true || value.nsfw === true || value.isAdult === true) return false;
  return ![
    value.title,
    value.name,
    value.type,
    value.rating,
    value.ageRating,
    value.contentRating,
    value.genre,
    value.genres,
    value.tags,
  ].some((field) => {
    const text = Array.isArray(field)
      ? field.filter((item) => typeof item === 'string').join(' ')
      : typeof field === 'string'
        ? field
        : '';
    return adultContentPattern.test(text);
  });
};

export { isAgeAppropriateContent };
