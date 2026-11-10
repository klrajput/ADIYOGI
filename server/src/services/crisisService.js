'use strict';

/**
 * Crisis assessment + resources service (docs/ARCHITECTURE.md §7, §8, §12.4).
 *
 * The risk engine is LAYERED, not a naive keyword table:
 *
 *  1. text normalisation (unicode punctuation, contractions, obfuscated repeats);
 *  2. weighted phrase patterns grouped into three risk tiers
 *     (`high` = intent / plan / means / self-harm, `elevated` = hopelessness,
 *     entrapment, burden, prolonged despair, `low` = distress / help-seeking);
 *  3. per-match context: negation scoping, third-person subject detection,
 *     quoted/reported speech (song lyrics, other people), intensity modifiers,
 *     ALL-CAPS, and repeated signals;
 *  4. optional AI classifier (`ai/risk.js`) that can only RAISE the level;
 *  5. deterministic thresholds — the reported `score` is an intensity signal,
 *     while the severity tier is determined by the highest-risk matched rule,
 *     so a single ambiguous word ("die", "kill") can never produce `high`.
 *
 * `high` therefore requires an explicit high-tier pattern or the AI classifier.
 * Every returned reason is a stable code (see `RISK_PATTERNS`).
 *
 * Privacy: this module never logs or persists user text. Crisis events store
 * metadata only ({level, source, triggerCodes, country, resourcesShown}).
 */
const logger = require('../config/logger');
const crisisResources = require('../data/crisisResources');
const { classifyRisk } = require('./ai/risk');
const CrisisEvent = require('../models/CrisisEvent');

const LEVELS = Object.freeze(['none', 'low', 'elevated', 'high']);
const LEVEL_RANK = Object.freeze({ none: 0, low: 1, elevated: 2, high: 3 });
const RANK_LEVEL = Object.freeze(['none', 'low', 'elevated', 'high']);

/** Score bands reported in `score` (0-100). Informational, not the tier driver. */
const THRESHOLDS = Object.freeze({ low: 12, elevated: 40, high: 70 });

/** Minimum AI confidence before the classifier is allowed to raise the level. */
const AI_RAISE_MIN_CONFIDENCE = 0.4;

/** Score floor applied when the AI classifier raises the severity. */
const AI_LEVEL_SCORE = Object.freeze({ none: 0, low: 15, elevated: 45, high: 85 });

/** Characters around a match that are inspected for negation/intensity context. */
const NEGATION_WINDOW_CHARS = 48;
const INTENSITY_WINDOW_CHARS = 30;
const REPORTED_WINDOW_CHARS = 60;

const EVENT_SOURCES = Object.freeze(['manual', 'chat', 'content', 'assessment']);

/* ------------------------------------------------------------------------- */
/* Reviewable lexicon                                                        */
/* ------------------------------------------------------------------------- */

/**
 * Weighted, reviewable risk lexicon.
 *
 * Rule fields:
 *  - code: stable reason code returned by assess()
 *  - level: tier this rule floors at
 *  - weight: intensity points (0-100 scale, summed and capped)
 *  - patterns: regular expressions over the normalised lowercase text
 *  - negationSensitive: default true; set false when the phrase itself contains a
 *    negator that signals risk ("no reason to live", "do not want to live")
 *  - subjectSensitive: true when the phrase can describe a third party; third-person
 *    matches are surfaced as a moderate concern (`third_person`) instead of own risk
 *  - weak: true for ambiguous single-word patterns; their tier only counts once the
 *    score reaches THRESHOLDS.low, so one ambiguous word can never floor the level
 *  - description: human-readable purpose, mirrored into docs
 */
const RISK_PATTERNS = Object.freeze([
  /* ------------------------------- HIGH ---------------------------------- */
  {
    code: 'suicide_intent',
    level: 'high',
    weight: 85,
    description: 'Explicit intent to end one’s life',
    patterns: [
      /\b(?:i\s+)?(?:am\s+going|going|plan|planning|intend|want|need|will|would|might|may|ready)\s+to\s+(?:kill|end|take)\s+(?:myself|my\s+own\s+life|my\s+life)\b/,
      /\b(?:i\s+)?(?:do\s+not|don't)\s+want\s+to\s+(?:live|be\s+here|be\s+alive|exist|wake\s+up)\b/,
      /\b(?:i\s+)?(?:want|need|plan|ready)\s+to\s+end\s+it(?:\s+all)?\b/,
      /\b(?:i\s+)?(?:am\s+going|going)\s+to\s+end\s+(?:my\s+life|it\s+all)\b/,
      /\b(?:i\s+)?feel\s+like\s+ending\s+(?:it|my\s+life)\b/,
      /\b(?:kill|end|take)\s+(?:myself|my\s+own\s+life|my\s+life)\b/,
      /\b(?:how|best\s+way|easiest\s+way|quickest\s+way)\s+(?:to|do\s+i|can\s+i)\s+(?:kill|end)\s+(?:myself|my\s+life)\b/,
    ],
  },
  {
    // Desire to die. Subject-sensitive: "I want to die" is high, a third-party
    // disclosure ("my friend wants to die") is surfaced as an elevated concern.
    code: 'death_wish',
    level: 'high',
    weight: 70,
    subjectSensitive: true,
    description: 'Stated desire to die (all grammatical inflections)',
    patterns: [
      /\b(?:i\s+)?(?:want|wants|wanted|wanting|wish|wishes|wished|wishing|need|needs|needed|needing)\s+to\s+die\b/,
      /\b(?:i\s+)?(?:want|wants|wanted|wanting|wish|wishes|wished|wishing)\s+to\s+(?:be\s+dead|not\s+be\s+alive|stop\s+existing)\b/,
    ],
  },
  {
    code: 'suicide_plan',
    level: 'high',
    weight: 80,
    description: 'A concrete suicide plan, note or letter',
    patterns: [
      /\b(?:i\s+)?(?:have|has|had|made|make|makes|making|got|wrote|write|writes|written|writing)\s+(?:a\s+)?(?:suicide|suicidal)\s+(?:plan|note|letter|message)\b/,
      /\b(?:plan|plans|planned|planning)\s+(?:to|on)\s+(?:kill|end)\s+(?:myself|my\s+life|himself|herself|themselves)\b/,
      /\b(?:suicide|suicidal)\s+(?:plan|note|letter|message)\b/,
    ],
  },
  {
    code: 'access_to_means',
    level: 'high',
    weight: 75,
    description: 'Preparatory behaviour, farewell note or access to a method',
    patterns: [
      /\b(?:saved\s+up|stockpiled|stockpiling|hoarded|hoarding|collected|collecting|hidden|hiding|stashed|stashing)\s+(?:some\s+|the\s+)?(?:pills|tablets|meds|medication|rope|knife|knives|gun|razors?|blades?|poison)\b/,
      /\b(?:pills|tablets|meds|medication)\s+(?:to\s+)?(?:kill\s+myself|end\s+my\s+life|overdose)\b/,
      /\b(?:i\s+)?knows?\s+(?:how|where|a\s+way)\s+to\s+(?:kill|end)\s+(?:myself|my\s+life)\b/,
      /\b(?:write|writes|wrote|written|writing|leave|leaves|left)\s+(?:a\s+)?(?:suicide|suicidal|goodbye|farewell|final)\s+(?:note|letter|message|text|voicemail|video)\b/,
      /\b(?:suicide|suicidal|goodbye|farewell)\s+(?:note|letter|voicemail|video)\b/,
    ],
  },
  {
    code: 'self_harm',
    level: 'high',
    weight: 70,
    subjectSensitive: true,
    description: 'Self-harm behaviour, intent or urge',
    patterns: [
      /\b(?:i\s+)?(?:cut|cuts|cutting|burn|burns|burned|burning|scratch|scratches|scratched|hurt|hurts|hurting)\s+(?:myself|my\s+(?:arms?|legs?|body|wrists?|thighs?))\b/,
      /\b(?:i\s+)?(?:want|wants|wanted|need|needs|urge|urges|feel\s+like)\s+(?:to\s+)?(?:cut|hurt|harm|burn|punish)\s+(?:myself|my\s+body)\b/,
      /\b(?:self[ -]?harm(?:ing|ed|s)?|self[ -]?injur(?:y|ing|ed|es))\b/,
      /\b(?:hurt|hurts|hurting|cut|cuts|cutting|harm|harms|harming)(?:ing|s)?\s+(?:himself|herself|themselves)\b/,
    ],
  },
  {
    code: 'overdose',
    level: 'high',
    weight: 80,
    description: 'Recent overdose or medication ingestion',
    patterns: [
      /\b(?:i\s+)?(?:took|swallowed|overdosed\s+on|ate)\s+(?:too\s+many\s+)?(?:pills|tablets|meds|medication)\b/,
      /\b(?:i\s+)?overdosed\b/,
    ],
  },
  {
    code: 'farewell',
    level: 'high',
    weight: 70,
    description: 'Farewell / last-message statements',
    patterns: [
      /\b(?:this\s+is|this\s+will\s+be|this\s+is\s+going\s+to\s+be)\s+my\s+(?:last|final)\s+(?:message|post|note|goodbye|words|text)\b/,
      /\bsaying\s+goodbye\s+(?:forever|for\s+good|to\s+everyone|everyone)\b/,
      /\bgoodbye\s+(?:forever|for\s+good|cruel\s+world)\b/,
      /\b(?:final|last)\s+(?:goodbye|farewell)\b/,
    ],
  },
  {
    code: 'imminent_action',
    level: 'high',
    weight: 90,
    description: 'Immediate method statement',
    patterns: [
      /\b(?:i\s+)?(?:am\s+going\s+to|going\s+to|will)\s+(?:jump|hang|shoot|drown)\s+(?:off|myself|from)\b/,
      /\b(?:i\s+)?(?:am\s+about\s+to|about\s+to|am\s+ready\s+to)\s+(?:do\s+it|end\s+it|die)\b/,
    ],
  },

  /* ----------------------------- ELEVATED -------------------------------- */
  {
    code: 'hopelessness',
    level: 'elevated',
    weight: 45,
    description: 'Hopelessness / permanence of the pain',
    patterns: [
      /\bhopeless(?:ness)?\b/,
      /\b(?:things?|it)\s+(?:will|is)\s+never\s+going\s+to\s+(?:get\s+better|change)\b/,
      /\bnever\s+going\s+to\s+get\s+better\b/,
      /\bno\s+(?:reason|point)\s+(?:to|in)\s+(?:live|living|go\s+on|going\s+on|continue|continuing)\b/,
      /\bnothing\s+to\s+live\s+for\b/,
      /\bwhat(?:'s|\s+is)\s+the\s+point\b/,
      /\b(?:feels?|feels\s+like)\s+like\s+there\s+is\s+no\s+way\s+out\b/,
    ],
  },
  {
    code: 'entrapment',
    level: 'elevated',
    weight: 45,
    description: 'Feeling trapped with no escape',
    patterns: [
      /\b(?:trapped|stuck|no\s+escape|cannot\s+escape|can\s+not\s+escape|cannot\s+get\s+out|there\s+is\s+no\s+way\s+out)\b/,
    ],
  },
  {
    code: 'perceived_burden',
    level: 'elevated',
    weight: 50,
    description: 'Believing others would be better off without them',
    patterns: [
      /\b(?:i\s+am|i'm|feel\s+like)\s+(?:a\s+)?burden\b/,
      /\bbetter\s+off\s+without\s+me\b/,
      /\b(?:everyone|everybody|they|people)\s+(?:would\s+be|will\s+be|are)\s+better\s+off\b/,
      /\b(?:everyone|everybody)\s+would\s+be\s+better\s+off\s+if\s+i\s+(?:was|were)\s+(?:dead|gone)\b/,
      /\b(?:no\s+one|nobody)\s+would\s+(?:miss|care|notice)\b/,
    ],
  },
  {
    code: 'prolonged_despair',
    level: 'elevated',
    weight: 40,
    description: 'Sustained despair / emptiness',
    patterns: [
      /\b(?:hopeless|empty|numb|worthless|suicidal|depressed)\b.{0,40}\bfor\s+(?:weeks|months|years)\b/,
      /\b(?:for\s+weeks|for\s+months|for\s+years)\b.{0,40}\b(?:hopeless|empty|numb|worthless|suicidal|depressed|sad)\b/,
      /\b(?:feel|felt|feeling)\s+(?:so\s+|very\s+|totally\s+|completely\s+)?(?:empty|numb|hollow|nothing)\b/,
    ],
  },
  {
    code: 'self_loathing',
    level: 'elevated',
    weight: 35,
    description: 'Self-loathing / worthlessness',
    patterns: [
      /\b(?:hate|disgusted\s+by|ashamed\s+of)\s+myself\b/,
      /\bworthless\b/,
      /\bgood\s+for\s+nothing\b/,
      /\b(?:i\s+am|i'm)\s+(?:a\s+)?(?:failure|useless|a\s+waste)\b/,
    ],
  },
  {
    code: 'suicidal_ideation',
    level: 'elevated',
    weight: 45,
    subjectSensitive: true,
    description: 'Suicidal thoughts without stated intent',
    patterns: [
      /\bsuicidal\b/,
      /\b(?:think(?:ing)?|thoughts?)\s+(?:about|of)\s+(?:suicide|killing\s+myself|dying|death|ending\s+it)\b/,
      /\bwish\s+i\s+(?:was|were)\s+dead\b/,
      /\b(?:do\s+not|don't)\s+want\s+to\s+be\s+alive\b/,
      /\b(?:not\s+sure|unsure|do\s+not\s+know|don't\s+know)\s+(?:if\s+)?i\s+(?:want\s+to\s+(?:live|be\s+here|be\s+alive))\b/,
    ],
  },

  /* -------------------------------- LOW ---------------------------------- */
  {
    code: 'distress',
    level: 'low',
    weight: 12,
    description: 'General distress language',
    patterns: [
      /\b(?:sad|unhappy|depressed|anxious|overwhelmed|stressed|struggling|exhausted|lonely|scared|afraid|worried|hurting|in\s+pain|crying|grief|grieving)\b/,
    ],
  },
  {
    code: 'help_seeking',
    level: 'low',
    weight: 12,
    description: 'Help-seeking / loss of direction',
    patterns: [
      /\b(?:need\s+help|want\s+help|get\s+help|talk\s+to\s+someone|do\s+not\s+know\s+what\s+to\s+do|no\s+one\s+understands|feel\s+lost|breaking\s+down|falling\s+apart|not\s+okay|not\s+ok|not\s+fine)\b/,
    ],
  },
  {
    code: 'ambiguous_risk_term',
    level: 'low',
    weight: 12,
    weak: true,
    description: 'Ambiguous suicide-related word without context (never high alone)',
    patterns: [/\b(?:suicide|suicidal|kms|unalive|unaliving)\b/],
  },
  {
    code: 'ambiguous_death_term',
    level: 'low',
    weight: 6,
    weak: true,
    description: 'Ambiguous death/kill word without context (never high alone)',
    patterns: [/\b(?:die|dies|died|death|dead|dying|kill|killed|killing)\b/],
  },
]);

/* ------------------------------------------------------------------------- */
/* Text normalisation                                                        */
/* ------------------------------------------------------------------------- */

/**
 * Normalise text for rule matching: lowercase, unicode punctuation, contraction
 * expansion (so "can't stop" becomes "cannot stop"), hyphens and obfuscated
 * repeated letters. Never mutates the caller's string.
 *
 * @param {*} input
 * @returns {string}
 */
function normalizeText(input) {
  let text = String(input == null ? '' : input);
  text = text
    .replace(/[\u2018\u2019\u02bc`\u00b4]/g, "'")
    .replace(/[\u201c\u201d\u00ab\u00bb]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .toLowerCase();

  text = text
    .replace(/([a-z])\1{2,}/g, '$1')
    .replace(/\bcan't\b/g, 'cannot')
    .replace(/\bwon't\b/g, 'will not')
    .replace(/\bshan't\b/g, 'shall not')
    .replace(/\bain't\b/g, 'is not')
    .replace(/\bi'm\b/g, 'i am')
    .replace(/\bi've\b/g, 'i have')
    .replace(/\bi'll\b/g, 'i will')
    .replace(/\bi'd\b/g, 'i would')
    .replace(/\b(do|does|did|is|are|was|were|has|have|had|would|could|should|must|need|might)n't\b/g, '$1 not')
    .replace(/\bgonna\b/g, 'going to')
    .replace(/\bwanna\b/g, 'want to')
    .replace(/\bgotta\b/g, 'got to')
    .replace(/\bdunno\b/g, 'do not know')
    .replace(/-/g, ' ')
    .replace(/([!?.,])\1+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

/**
 * @param {string} original
 * @returns {boolean} true when the message is (mostly) shouting
 */
function isShouting(original) {
  const letters = String(original).replace(/[^a-z]/gi, '');
  if (letters.length < 8) return false;
  const uppercase = String(original).replace(/[^A-Z]/g, '').length;
  return uppercase / letters.length >= 0.6;
}

const CLAUSE_BOUNDARY = /[.!?;\n]|\b(?:but|yet|however|although|though|and)\b/g;

/**
 * Find the clause containing `index`.
 * @param {string} text normalised text
 * @param {number} index
 * @returns {{start:number,end:number}}
 */
function clauseBounds(text, index) {
  const re = new RegExp(CLAUSE_BOUNDARY.source, 'g');
  let start = 0;
  let end = text.length;
  let match;
  while ((match = re.exec(text)) !== null) {
    const boundaryStart = match.index;
    const boundaryEnd = match.index + match[0].length;
    if (boundaryEnd <= index) start = boundaryEnd;
    else if (boundaryStart > index) {
      end = boundaryStart;
      break;
    }
    if (match[0].length === 0) re.lastIndex += 1;
  }
  return { start, end };
}

const NEGATION_CUE = /\b(?:not|never|no|none|nobody|nothing|nor|hardly|barely|scarcely|without|deny|denies|denied|refuse|refuses|refused|cannot)\b/g;
const NEGATION_BLOCKER = /\b(?:stop|stops|stopped|resist|control|help|helping|shake|escape|thinking|thoughts|keep|keeps|if|whether|sure|know|doubt|why|only)\b/;

/**
 * True when the matched phrase is negated within its clause
 * ("I'm not suicidal", "I would never kill myself", "I don't want to kill myself").
 * Rumination phrasing ("I can't stop thinking about suicide") is not a negation.
 *
 * @param {string} text normalised text
 * @param {{start:number}} clause
 * @param {number} index match start
 * @returns {boolean}
 */
function isNegated(text, clause, index) {
  const windowStart = Math.max(clause.start, index - NEGATION_WINDOW_CHARS);
  const window = text.slice(windowStart, index);
  if (!window) return false;

  const re = new RegExp(NEGATION_CUE.source, 'g');
  let lastCueEnd = -1;
  let match;
  while ((match = re.exec(window)) !== null) {
    lastCueEnd = match.index + match[0].length;
    if (match[0].length === 0) re.lastIndex += 1;
  }
  if (lastCueEnd === -1) return false;

  const between = window.slice(lastCueEnd);
  return !NEGATION_BLOCKER.test(between);
}

// Only media/lyric/character references are heavily downgraded. Personal report
// verbs ("he said", "she told me") are NOT media: a third-party disclosure is a
// real concern and is handled by the third-person subject path instead.
const MEDIA_MARKER = /\b(?:song|songs|lyrics?|poem|poetry|movie|film|films|show|series|character|quote|quoting|quoted|sang|sings|singing|meme|joke|tiktok|book|novel|story|game|script|article|news|documentary)\b/;

/**
 * True when the match is quoted media (song lyrics, film line, character quote,
 * meme...). Real-person reported speech is deliberately excluded so a disclosure
 * like "my partner told me she is suicidal" is not downgraded to a media quote.
 *
 * @param {string} text normalised text
 * @param {{start:number}} clause
 * @param {number} index
 * @param {number} length
 * @returns {boolean}
 */
function isQuotedOrReported(text, clause, index, length) {
  const reportedWindow = text.slice(Math.max(clause.start, index - REPORTED_WINDOW_CHARS), index);
  if (MEDIA_MARKER.test(reportedWindow)) return true;

  // A quotation is only treated as "quoted" when a media marker is in the same
  // clause; otherwise the words are the writer's own (or a real person's report).
  const clauseText = text.slice(clause.start, clause.end);
  const hasMedia = MEDIA_MARKER.test(clauseText);
  if (!hasMedia) return false;

  const before = text.slice(clause.start, index);
  const after = text.slice(index + length, clause.end);
  const quotesBefore = (before.match(/"/g) || []).length;
  const quotesAfter = (after.match(/"/g) || []).length;
  return quotesBefore % 2 === 1 && quotesAfter > 0;
}

const THIRD_PERSON_SUBJECT = /\b(?:my\s+(?:friend|friends|mom|mum|mother|dad|father|brother|sister|partner|boyfriend|girlfriend|husband|wife|son|daughter|child|kid|roommate|classmate|colleague|coworker|boss|cousin|uncle|aunt|neighbo(?:u)?r|ex|family|parents?)|he|she|they|him|her|them|his|hers|their|someone|somebody|a\s+(?:friend|person|guy|girl|man|woman)|this\s+person|that\s+person|people|everyone|everybody)\b/g;
const FIRST_PERSON_SUBJECT = /\b(?:i|me|myself|my\s+own|i\s+am|i\s+have|i\s+feel|i\s+think|i\s+want|i\s+need|we|us|ourselves)\b/g;

/**
 * @param {RegExp} re global regex (a fresh instance is created by the caller)
 * @param {string} text
 * @returns {number} index of the last match, -1 when none
 */
function lastMatchIndex(re, text) {
  let index = -1;
  let match;
  while ((match = re.exec(text)) !== null) {
    index = match.index;
    if (match[0].length === 0) re.lastIndex += 1;
  }
  return index;
}

/**
 * Decide who the clause is about. The matched span is included because some
 * patterns swallow their own subject ("i hurt myself" starts with "i").
 * @param {string} text normalised text
 * @param {{start:number}} clause
 * @param {number} index match start
 * @param {number} length match length
 * @returns {'first'|'third'|'unknown'}
 */
function detectSubject(text, clause, index, length = 0) {
  const before = text.slice(clause.start, index + length);
  if (!before.trim()) return 'unknown';
  const third = lastMatchIndex(new RegExp(THIRD_PERSON_SUBJECT.source, 'g'), before);
  const first = lastMatchIndex(new RegExp(FIRST_PERSON_SUBJECT.source, 'g'), before);
  if (third === -1 && first === -1) return 'unknown';
  if (third > first) return 'third';
  return 'first';
}

/* ------------------------------------------------------------------------- */
/* Rule engine                                                               */
/* ------------------------------------------------------------------------- */

/**
 * @param {string} original
 * @returns {{level:string, score:number, reasons:string[], showResources:boolean}}
 */
function emptyAssessment() {
  return { level: 'none', score: 0, reasons: [], showResources: false };
}

/**
 * Collect non-overlapping matches for one rule.
 * @param {string} text normalised text
 * @param {object} rule
 * @returns {Array<{index:number,length:number}>}
 */
function collectMatches(text, rule) {
  const spans = [];
  for (const pattern of rule.patterns) {
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    let match;
    while ((match = re.exec(text)) !== null) {
      if (match[0].length === 0) {
        re.lastIndex += 1;
        continue;
      }
      spans.push({ index: match.index, length: match[0].length });
    }
  }
  spans.sort((a, b) => a.index - b.index);
  const merged = [];
  for (const span of spans) {
    const previous = merged[merged.length - 1];
    if (previous && span.index <= previous.index + previous.length) continue;
    merged.push(span);
  }
  return merged;
}

/**
 * Pure, deterministic rule-based assessment (no AI). Exported indirectly through
 * `assess`; kept separate so the AI layer can only raise severity.
 *
 * @param {*} input
 * @returns {{level:string, score:number, reasons:string[], showResources:boolean}}
 */
function assessWithRules(input) {
  const original = String(input == null ? '' : input);
  if (!original.trim()) return emptyAssessment();

  const text = normalizeText(original);
  if (!text) return emptyAssessment();

  const shouting = isShouting(original);
  let score = 0;
  let topRank = 0;
  const reasons = [];
  const firedRuleLevels = [];
  let thirdPerson = false;
  let quotedOnly = false;
  let intensified = false;

  for (const rule of RISK_PATTERNS) {
    const matches = collectMatches(text, rule);
    if (matches.length === 0) continue;

    let ruleContribution = 0;
    let ruleFired = false;
    let ruleRank = 0;

    for (const match of matches) {
      const clause = clauseBounds(text, match.index);

      if (rule.negationSensitive !== false && isNegated(text, clause, match.index)) {
        continue;
      }

      let weight = rule.weight;
      let level = rule.level;

      if (isQuotedOrReported(text, clause, match.index, match.length)) {
        quotedOnly = true;
        level = 'low';
        weight *= 0.15;
      } else if (rule.subjectSensitive) {
        const subject = detectSubject(text, clause, match.index, match.length);
        if (subject === 'third') {
          thirdPerson = true;
          level = 'elevated';
          weight *= 0.35;
        } else if (subject === 'unknown') {
          level = 'low';
          weight *= 0.4;
        } else {
          weight *= 1.25;
        }
      }

      const intensityWindow = text.slice(
        Math.max(clause.start, match.index - INTENSITY_WINDOW_CHARS),
        match.index
      );
      if (/\b(?:really|so|very|extremely|totally|completely|absolutely|desperately|constantly|always|every\s+day|all\s+the\s+time|right\s+now|tonight|today|seriously|genuinely|terrified)\b/.test(intensityWindow)) {
        intensified = true;
        weight *= 1.15;
      }
      if (shouting) weight *= 1.1;

      ruleContribution += weight;
      ruleRank = Math.max(ruleRank, LEVEL_RANK[level]);
      ruleFired = true;
    }

    if (!ruleFired) continue;

    if (matches.length > 1) {
      const repeatMultiplier = Math.min(1.75, 1 + 0.25 * (matches.length - 1));
      ruleContribution *= repeatMultiplier;
    }

    score += ruleContribution;
    firedRuleLevels.push({ rank: ruleRank, weak: rule.weak === true });
    reasons.push(rule.code);
  }

  score = Math.round(Math.min(100, Math.max(0, score)));

  // Weak (ambiguous single-word) rules only floor the tier once the aggregate
  // intensity clears the low threshold — one isolated "die"/"kill" stays `none`.
  const weakFloorsAllowed = score >= THRESHOLDS.low;
  for (const fired of firedRuleLevels) {
    if (fired.weak && !weakFloorsAllowed) continue;
    topRank = Math.max(topRank, fired.rank);
  }

  if (shouting) reasons.push('raised_voice');
  if (intensified) reasons.push('intensified');
  if (thirdPerson) {
    thirdPerson = true;
    if (topRank < LEVEL_RANK.elevated) topRank = LEVEL_RANK.elevated;
    reasons.push('third_person');
  }
  if (quotedOnly) reasons.push('quoted_or_reported');

  const level = RANK_LEVEL[Math.min(topRank, LEVEL_RANK.high)];

  return { level, score, reasons, showResources: level !== 'none' };
}

/* ------------------------------------------------------------------------- */
/* Public API                                                                */
/* ------------------------------------------------------------------------- */

/**
 * Assess text for suicide/self-harm risk.
 *
 * The rule engine is authoritative; when configured, the AI classifier runs with a
 * short timeout and may only RAISE the level. A classifier failure/timeout leaves
 * the rule result untouched.
 *
 * @param {*} text user text (never logged/persisted by this function)
 * @param {{source?:string, signal?:AbortSignal}} [options]
 * @returns {Promise<{level:'none'|'low'|'elevated'|'high', score:number, reasons:string[], showResources:boolean}>}
 */
async function assess(text, options = {}) {
  const { signal } = options || {};
  const ruleResult = assessWithRules(text);
  if (ruleResult.level === 'high') return ruleResult;

  let classification = null;
  try {
    classification = await classifyRisk(text, { signal });
  } catch (_error) {
    classification = null;
  }
  if (!classification) return ruleResult;

  const aiRank = LEVEL_RANK[classification.level] || 0;
  const ruleRank = LEVEL_RANK[ruleResult.level] || 0;
  if (aiRank <= ruleRank) return ruleResult;
  if (classification.confidence < AI_RAISE_MIN_CONFIDENCE) return ruleResult;

  const level = RANK_LEVEL[aiRank];
  return {
    level,
    score: Math.max(ruleResult.score, AI_LEVEL_SCORE[level] || 0),
    reasons: [...ruleResult.reasons, 'ai_classifier'],
    showResources: true,
  };
}

/**
 * Regional helplines for the UI. Never throws; unknown/invalid countries get INTL.
 *
 * @param {{country?:string}} [options]
 * @returns {{region:string,label:string,primary:object,text:object|null,emergency:object,local:object[],international:object,lastVerified:string,disclaimer:string}}
 */
function getResources(options = {}) {
  try {
    const { country } = options || {};
    const region = crisisResources.getRegion(country);
    const intl = crisisResources.getRegion(crisisResources.DEFAULT_REGION);
    return {
      region: region.code,
      label: region.label,
      primary: region.primary,
      text: region.text || null,
      emergency: region.emergency,
      local: Array.isArray(region.local) ? region.local : [],
      international: {
        region: intl.code,
        label: intl.label,
        name: intl.primary.name,
        contact: intl.primary.contact,
        url: intl.primary.url,
        note: intl.note,
      },
      lastVerified: crisisResources.LAST_VERIFIED,
      disclaimer: crisisResources.DISCLAIMER,
    };
  } catch (error) {
    logger.error('crisis resources unavailable, serving in-memory fallback', {
      code: (error && error.code) || 'RESOURCES_ERROR',
    });
    return {
      region: crisisResources.DEFAULT_REGION,
      label: 'International',
      primary: {
        name: 'Find A Helpline',
        contact: 'https://findahelpline.com',
        type: 'web',
        available: '24/7 online directory',
        url: 'https://findahelpline.com',
      },
      text: null,
      emergency: { name: 'Local emergency services', contact: 'Your local emergency number' },
      local: [],
      international: {
        region: crisisResources.DEFAULT_REGION,
        label: 'International',
        name: 'Find A Helpline',
        contact: 'https://findahelpline.com',
        url: 'https://findahelpline.com',
        note: 'Local numbers vary by country.',
      },
      lastVerified: crisisResources.LAST_VERIFIED,
      disclaimer: crisisResources.DISCLAIMER,
    };
  }
}

/**
 * Persist a metadata-only crisis event. NEVER stores text, IPs or user agents.
 * Swallows and logs failures: crisis detection must never break content creation.
 *
 * @param {{sessionId:string, level:string, source:string, triggerCodes?:string[], country?:string, resourcesShown?:boolean}} input
 * @returns {Promise<void>}
 */
async function recordEvent(input = {}) {
  try {
    const { sessionId, level, source, triggerCodes, country, resourcesShown } = input;

    if (!sessionId) {
      logger.warn('crisis event skipped: missing session id');
      return;
    }
    if (!LEVELS.includes(level) || level === 'none') {
      logger.warn('crisis event skipped: invalid or empty level');
      return;
    }
    if (!EVENT_SOURCES.includes(source)) {
      logger.warn('crisis event skipped: invalid source');
      return;
    }

    // Model constraints: at most 20 codes, each <= 40 chars; country is a 2-letter code.
    const codes = (Array.isArray(triggerCodes) ? triggerCodes : [])
      .filter((code) => typeof code === 'string' && code.length > 0 && code.length <= 40)
      .slice(0, 20);

    const region = crisisResources.normalizeCountry(country);

    await CrisisEvent.create({
      session: sessionId,
      level,
      source,
      triggerCodes: Array.from(new Set(codes)),
      country: region === crisisResources.DEFAULT_REGION ? null : region,
      resourcesShown: Boolean(resourcesShown),
    });
  } catch (error) {
    logger.warn('crisis event could not be recorded', {
      code: (error && error.name) || 'CRISIS_EVENT_ERROR',
    });
  }
}

/**
 * Convenience: assess and record an event for anything above `none`.
 *
 * @param {{text:string, source?:string, sessionId?:string, country?:string, signal?:AbortSignal}} input
 * @returns {Promise<object>} assessment
 */
async function assessAndRecord({ text, source = 'assessment', sessionId, country, signal } = {}) {
  const assessment = await assess(text, { source, signal });
  if (assessment.level !== 'none' && sessionId) {
    await recordEvent({
      sessionId,
      level: assessment.level,
      source: EVENT_SOURCES.includes(source) ? source : 'assessment',
      triggerCodes: assessment.reasons,
      country,
      resourcesShown: assessment.showResources,
    });
  }
  return assessment;
}

module.exports = {
  LEVELS,
  THRESHOLDS,
  RISK_PATTERNS,
  normalizeText,
  assess,
  getResources,
  recordEvent,
  assessAndRecord,
};
