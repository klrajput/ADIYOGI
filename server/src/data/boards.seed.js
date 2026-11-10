'use strict';

/**
 * Seed data for the nine AdiYogi boards (ARCHITECTURE §5, §10).
 *
 * Content is adapted from the legacy prototype's board catalogue; every invented statistic
 * from the prototype (fake thread/post/active counts) has been deliberately dropped — the
 * real counters start at zero and are maintained by the services.
 *
 * `slug` is the idempotent upsert key used by services/seedService.js. Admins may edit a
 * board's presentation after seeding; seeding never touches admin-managed counters
 * (`threadCount`, `replyCount`, `lastActivityAt`) or `isActive`.
 */
const boards = [
  {
    slug: 'support',
    name: 'General Support',
    icon: '🤝',
    description:
      'A welcoming space for general mental health conversations, peer support, and everyday wellbeing. Share how you are doing and support others on their journey.',
    supportLevel: 'general',
    guidelines: [
      'Be welcoming and supportive to everyone here.',
      'Share your own experiences and offer peer support.',
      'Respect every mental health journey, including those different from yours.',
      'Direct anyone in serious crisis to the Crisis Support board and to professional help.',
    ],
    tags: ['support', 'general', 'wellbeing', 'peer'],
    order: 1,
  },
  {
    slug: 'anxiety',
    name: 'Anxiety & Panic',
    icon: '😰',
    description:
      'Support for anxiety, panic attacks, social anxiety, and the coping strategies that help people get through the day. You are not alone in this.',
    supportLevel: 'peer',
    guidelines: [
      'Share your anxiety experiences without judgment.',
      'Offer practical coping techniques that have worked for you.',
      'Be patient and supportive with others who are struggling with anxiety.',
      'Share experiences only and avoid giving medical advice.',
    ],
    tags: ['anxiety', 'panic', 'social-anxiety', 'coping'],
    order: 2,
  },
  {
    slug: 'depression',
    name: 'Depression Support',
    icon: '😔',
    description:
      'A space for depression support, understanding, and recovery conversations. Sharing how you feel can make low days feel less isolating.',
    supportLevel: 'peer',
    guidelines: [
      'Share your depression journey openly and honestly.',
      'Support others without trying to fix or diagnose them.',
      'Share what helps you cope with low moods.',
      'Remember that recovery looks different for everyone.',
    ],
    tags: ['depression', 'mood', 'recovery', 'support'],
    order: 3,
  },
  {
    slug: 'trauma',
    name: 'Trauma & PTSD',
    icon: '💔',
    description:
      'Support for trauma survivors and people living with PTSD. A gentle space for healing conversations, coping tools, and connection.',
    supportLevel: 'peer',
    guidelines: [
      'Use content warnings for potentially triggering content.',
      'Share healing and coping strategies that have helped you.',
      'Be extra gentle and supportive in responses.',
      'Respect others boundaries and their own pace of healing.',
    ],
    tags: ['trauma', 'ptsd', 'healing', 'recovery'],
    order: 4,
  },
  {
    slug: 'addiction',
    name: 'Addiction & Recovery',
    icon: '🔄',
    description:
      'Support for addiction recovery, sobriety, and the challenges of substance use. Progress and setbacks are both welcome here.',
    supportLevel: 'peer',
    guidelines: [
      'Share your recovery journey and milestones.',
      'Support others in their recovery process without judgment.',
      'Avoid glorifying or encouraging substance use.',
      'Celebrate sobriety milestones, big and small.',
    ],
    tags: ['addiction', 'recovery', 'sobriety', 'substance-abuse'],
    order: 5,
  },
  {
    slug: 'relationships',
    name: 'Relationships & Social',
    icon: '💕',
    description:
      'Support for relationship difficulties, family stress, and social challenges. Talk through what is happening and hear how others have coped.',
    supportLevel: 'general',
    guidelines: [
      'Share relationship challenges respectfully and without identifying details.',
      'Offer constructive support rather than judgment.',
      'Respect all types of relationships and families.',
      'Focus on healthy communication strategies.',
    ],
    tags: ['relationships', 'family', 'social', 'communication'],
    order: 6,
  },
  {
    slug: 'success',
    name: 'Success Stories',
    icon: '✨',
    description:
      'Share victories, milestones, and positive progress in mental health. Small steps count, and your story may give someone else hope.',
    supportLevel: 'peer',
    guidelines: [
      'Celebrate mental health victories, big and small.',
      'Share what helped you make progress.',
      'Inspire others with your recovery story.',
      'Remember that progress is not always linear.',
    ],
    tags: ['success', 'victories', 'progress', 'inspiration'],
    order: 7,
  },
  {
    slug: 'crisis',
    name: 'Crisis Support',
    icon: '🚨',
    description:
      'Immediate peer support for people going through a mental health crisis. This board supplements professional and emergency help, and never replaces it.',
    supportLevel: 'crisis',
    guidelines: [
      'If you are in immediate danger or thinking about harming yourself, contact your local emergency services now.',
      'Reach out to a crisis helpline: the Resources page lists verified phone, text and chat lines by country.',
      'This board offers peer support only and cannot provide crisis intervention or medical care.',
      'Encourage others to contact a professional or emergency service, and never promise to monitor someone.',
    ],
    tags: ['crisis', 'emergency', 'immediate-help', 'support'],
    order: 8,
  },
  {
    slug: 'resources',
    name: 'Resources & Tools',
    icon: '📚',
    description:
      'Share mental health resources, apps, books, and practical tools that have helped you. Recommendations from lived experience are welcome.',
    supportLevel: 'general',
    guidelines: [
      'Share helpful mental health resources you have used.',
      'Include a brief description of why the resource helped.',
      'Prefer free and accessible resources where possible.',
      'Do not promote paid services, products, or referral links.',
    ],
    tags: ['resources', 'tools', 'apps', 'books'],
    order: 9,
  },
];

module.exports = boards;
module.exports.boards = boards;
