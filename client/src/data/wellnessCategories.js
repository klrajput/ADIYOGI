/**
 * Mental-wellness category experiences.
 *
 * Each category has its own visual atmosphere (never an identical card), its own
 * Sanskrit reflection and the community board it links into. Categories are a lens
 * for finding the right peer space — they are not diagnoses and the copy never
 * implies that wisdom or community replaces professional care.
 */
export const WELLNESS_CATEGORIES = [
  {
    slug: 'anxiety',
    name: 'Anxiety',
    tagline: 'Soft water, steady breath',
    description:
      'Racing thoughts, a tight chest, the body bracing for something unnamed. A space to slow the pace and share what helps.',
    atmosphere: 'water',
    glyph: 'wave',
    boardSlug: 'anxiety',
    shlokaId: 'fearlessness',
    practice: '4-4-6 breathing: in for 4, hold for 4, out for 6. Three rounds.',
  },
  {
    slug: 'depression',
    name: 'Low mood',
    tagline: 'Warm sunrise, gentle light',
    description:
      'Heaviness, flatness, the sense that effort costs more than it should. Small steps count here, and nobody rushes you.',
    atmosphere: 'sunrise',
    glyph: 'sun',
    boardSlug: 'depression',
    shlokaId: 'self-uplift',
    practice: 'One act of care today: water, sunlight, or a single message to someone safe.',
  },
  {
    slug: 'stress',
    name: 'Stress',
    tagline: 'Green nature, slow growth',
    description:
      'Too many demands, too little room to breathe. Ground yourself in the next single action rather than the whole mountain.',
    atmosphere: 'nature',
    glyph: 'leaf',
    boardSlug: 'support',
    shlokaId: 'action-not-fruit',
    practice: 'Name the next one thing. Do only that. Then decide the next.',
  },
  {
    slug: 'overthinking',
    name: 'Overthinking',
    tagline: 'Night sky, quiet distance',
    description:
      'Loops that replay, rehearsed conversations, plans for outcomes that may never come. Step back and let the mind widen.',
    atmosphere: 'night',
    glyph: 'stars',
    boardSlug: 'anxiety',
    shlokaId: 'clarity-through-knowing',
    practice: 'Write the loop down. Circle only what is actually yours to act on.',
  },
  {
    slug: 'anger',
    name: 'Anger',
    tagline: 'Cool river, returning calm',
    description:
      'Heat that arrives before thought. Anger is information — cool the body first, then decide what it is pointing at.',
    atmosphere: 'river',
    glyph: 'river',
    boardSlug: 'relationships',
    shlokaId: 'anger-to-clarity',
    practice: 'Cool water on the wrists. Ten slow exhales before any reply.',
  },
  {
    slug: 'loneliness',
    name: 'Loneliness',
    tagline: 'Warm ambient light',
    description:
      'The ache of feeling unseen. You are not the only one here at this hour — connection can start with one honest sentence.',
    atmosphere: 'warm',
    glyph: 'lamp',
    boardSlug: 'support',
    shlokaId: 'self-uplift',
    practice: 'Read one thread. Reply to one person. Nothing more is required today.',
  },
  {
    slug: 'low-confidence',
    name: 'Low confidence',
    tagline: 'Mountains at first light',
    description:
      'Comparison and self-doubt crowding out what is true. Confidence is built from evidence, and evidence starts small.',
    atmosphere: 'mountain',
    glyph: 'mountain',
    boardSlug: 'success',
    shlokaId: 'clarity-through-knowing',
    practice: 'Record one thing you actually did today. Keep the list for a week.',
  },
  {
    slug: 'sleep',
    name: 'Sleep',
    tagline: 'Moonlight, soft cosmic quiet',
    description:
      'Nights that stretch, a mind that will not switch off. Wind-down routines and shared experience help more than force.',
    atmosphere: 'moon',
    glyph: 'moon',
    boardSlug: 'resources',
    shlokaId: 'fearlessness',
    practice: 'Dim the room an hour early. Same wake time tomorrow, whatever tonight did.',
  },
];

export const CATEGORY_BY_SLUG = Object.fromEntries(WELLNESS_CATEGORIES.map((category) => [category.slug, category]));

/** Map a community board slug back to its most relevant category experience. */
export function categoryForBoard(boardSlug) {
  return (
    WELLNESS_CATEGORIES.find((category) => category.boardSlug === boardSlug) ||
    WELLNESS_CATEGORIES.find((category) => category.slug === boardSlug) ||
    null
  );
}
