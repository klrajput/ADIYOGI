/**
 * Sanskrit wisdom used across AdiYogi.
 *
 * Only authentic Bhagavad Gita references are shipped here; the Sanskrit pāda is the
 * traditional text and the English is a faithful paraphrase (not a scholarly
 * translation). Wisdom is offered for reflection — it is never presented as a
 * substitute for professional mental-health care.
 */
export const SHLOKAS = [
  {
    id: 'fearlessness',
    sanskrit: 'अभयं सत्त्वसंशुद्धिः ज्ञानयोगव्यवस्थितिः।',
    transliteration: 'abhayaṃ sattva-saṃśuddhiḥ jñāna-yoga-vyavasthitiḥ',
    meaning:
      'Fearlessness, clarity of heart, and steadiness in the yoga of knowledge — these are the marks of a mind that has found its ground.',
    source: 'Bhagavad Gita 16.1',
    topic: 'Anxiety & fear',
    topicSlug: 'anxiety',
    reflection:
      'Fear narrows attention. Naming what you feel, then breathing slowly, widens it again. Courage is not the absence of fear — it is steadiness beside it.',
  },
  {
    id: 'self-uplift',
    sanskrit: 'उद्धरेदात्मनात्मानं नात्मानमवसादयेत्।',
    transliteration: 'uddhared ātmanātmānaṃ nātmānam avasādayet',
    meaning:
      'Lift yourself by your own self; never let yourself sink. The self alone is the friend of the self, and the self alone is its enemy.',
    source: 'Bhagavad Gita 6.5',
    topic: 'Low mood & hopelessness',
    topicSlug: 'depression',
    reflection:
      'On heavy days, the smallest act of care — water, sunlight, one message to someone safe — is the self lifting the self. Small is not nothing.',
  },
  {
    id: 'action-not-fruit',
    sanskrit: 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।',
    transliteration: 'karmaṇy evādhikāras te mā phaleṣu kadācana',
    meaning:
      'You have a right to your actions, never to the fruits of them. Do the work that is yours to do, and release your grip on the outcome.',
    source: 'Bhagavad Gita 2.47',
    topic: 'Stress & overthinking',
    topicSlug: 'stress',
    reflection:
      'Anxiety often lives in the gap between effort and outcome. Return to the next small action you can actually take, and let the result rest.',
  },
  {
    id: 'anger-to-clarity',
    sanskrit: 'क्रोधाद्भवति सम्मोहः सम्मोहात्स्मृतिविभ्रमः।',
    transliteration: 'krodhād bhavati sammohaḥ sammohāt smṛti-vibhramaḥ',
    meaning:
      'From anger comes delusion; from delusion, confusion of memory; from confusion of memory, the loss of reason.',
    source: 'Bhagavad Gita 2.63',
    topic: 'Anger',
    topicSlug: 'anger',
    reflection:
      'Anger is information, not instruction. Cool the body first — water, space, slower breath — then decide. Clarity returns when the heat settles.',
  },
  {
    id: 'clarity-through-knowing',
    sanskrit: 'न हि ज्ञानेन सदृशं पवित्रमिह विद्यते।',
    transliteration: 'na hi jñānena sadṛśaṃ pavitram iha vidyate',
    meaning:
      'In this world there is nothing as purifying as knowledge — knowing yourself clearly, without flinching and without exaggeration.',
    source: 'Bhagavad Gita 4.38',
    topic: 'Self-confidence',
    topicSlug: 'low-confidence',
    reflection:
      'Confidence grows from accurate self-knowledge, not from comparison. Notice what you actually did today, and let that be evidence.',
  },
];

export const SHLOKA_BY_ID = Object.fromEntries(SHLOKAS.map((shloka) => [shloka.id, shloka]));
export const SHLOKA_BY_TOPIC = Object.fromEntries(SHLOKAS.map((shloka) => [shloka.topicSlug, shloka]));

/** Deterministic "daily" shloka so server and client renders agree and it changes once a day. */
export function shlokaOfTheDay(date = new Date()) {
  const dayIndex = Math.floor(date.getTime() / 86_400_000);
  return SHLOKAS[dayIndex % SHLOKAS.length];
}
