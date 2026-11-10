/**
 * Educational wellness library.
 *
 * Content rules for this file:
 *  - general education only: never a diagnosis, treatment plan or dosage;
 *  - every article tells the reader how to get human help;
 *  - outbound links point only at official organisation pages (WHO, NIMH, NHS,
 *    findahelpline.com, 988lifeline.org);
 *  - no placeholders, no lorem ipsum, no fabricated statistics.
 *
 * The UI in `pages/ResourcesPage.jsx` renders this data as an editorial library;
 * it never renders HTML from this file (plain strings only).
 */

export const WELLNESS_CATEGORIES = [
  {
    id: 'anxiety',
    label: 'Understanding anxiety',
    description: 'What anxiety is, how it shows up in the body, and what tends to help.',
  },
  {
    id: 'mood',
    label: 'Low mood & depression',
    description: 'Low mood is common and treatable. What to notice and how to start.',
  },
  {
    id: 'sleep',
    label: 'Sleep',
    description: 'Small, practical changes that support rest without chasing a perfect night.',
  },
  {
    id: 'grounding',
    label: 'Grounding & breathing',
    description: 'Short exercises for moments when thoughts and feelings feel overwhelming.',
  },
  {
    id: 'support',
    label: 'Supporting a friend',
    description: 'How to show up for someone without trying to fix them.',
  },
  {
    id: 'professional',
    label: 'When to seek professional help',
    description: 'Honest guidance on when self-help is not enough and where help comes from.',
  },
  {
    id: 'digital',
    label: 'Digital wellbeing',
    description: 'Being online in a way that supports your mood instead of draining it.',
  },
  {
    id: 'myths',
    label: 'Myths vs facts',
    description: 'Common assumptions about mental health, checked against what we know.',
  },
];

export const WELLNESS_RESOURCES = [
  {
    id: 'anxiety-what-it-is',
    categoryId: 'anxiety',
    title: 'What anxiety actually is',
    summary:
      'Anxiety is a normal alarm system that misfires. Understanding the mechanics takes some of the fear out of it.',
    readMinutes: 4,
    sections: [
      {
        heading: 'A normal system, turned up too loud',
        paragraphs: [
          'Anxiety is your body preparing for a threat. When the alarm goes off, your heart speeds up, breathing shallow and muscles tense so you are ready to react. That response is useful when there is real danger. The trouble is that it also fires when the danger is a thought — an email you have not answered, a conversation you are dreading, a worry about the future.',
          'Because the physical response is real, anxiety can feel like proof that something is wrong. It is not evidence of a serious illness by itself. Many people experience anxiety regularly, and it usually becomes more manageable when it is understood and addressed rather than avoided.',
        ],
      },
      {
        heading: 'How it shows up',
        paragraphs: [
          'Anxiety rarely looks like one thing. It can be racing thoughts, irritability, a tight chest, an upset stomach, difficulty concentrating, or a strong urge to check, plan or escape. Some people notice they cannot sit still; others describe feeling frozen.',
          'A common pattern is avoidance: cancelling, delaying, or needing reassurance before you can act. Avoidance brings short-term relief, which teaches your brain that the feared situation really was dangerous, so the anxiety tends to grow over time. This is why gentle, repeated exposure — usually with support — is a core part of most evidence-based treatments.',
        ],
      },
      {
        heading: 'What helps in the moment',
        paragraphs: [
          'A slower exhale is one of the quickest ways to signal safety to your body: breathe in for about four seconds, hold for four, then out for six. Grounding exercises (naming what you can see, touch, hear, smell and taste) pull attention out of the future and into the room.',
          'Writing the worry down, then asking what is inside and outside your control, can also reduce the loop. So can moving your body for a few minutes, or calling someone rather than rehearsing the conversation in your head.',
        ],
      },
      {
        heading: 'When to get more support',
        paragraphs: [
          'If anxiety is limiting your work, study, relationships or sleep for more than a couple of weeks, or you are relying on alcohol or avoidance to cope, talk to a professional. Anxiety is one of the most treatable mental-health concerns; talking therapies such as CBT are well evidenced. If you ever feel unsafe, contact local crisis services immediately.',
        ],
      },
    ],
    takeaways: [
      'The alarm system is real, but discomfort is not proof of danger.',
      'Avoidance gives quick relief and grows the fear — practice small steps instead.',
      'Exhaling slowly and grounding are fast, free first aids.',
      'Persistent anxiety is treatable; ask a professional for help.',
    ],
    links: [
      {
        label: 'Anxiety disorders — NIMH',
        href: 'https://www.nimh.nih.gov/health/topics/anxiety-disorders',
      },
      {
        label: 'Mental health — World Health Organization',
        href: 'https://www.who.int/health-topics/mental-health',
      },
    ],
  },
  {
    id: 'mood-what-it-is',
    categoryId: 'mood',
    title: 'Low mood and depression: what is the difference?',
    summary:
      'Everyone has low days. Depression is different in duration, intensity and how much it changes daily life — and it is treatable.',
    readMinutes: 4,
    sections: [
      {
        heading: 'A normal human experience',
        paragraphs: [
          'Mood moves. Sadness after a loss, disappointment after a setback, and flatness after a hard week are all normal. Low mood usually has a reason, comes in waves, and lifts as circumstances change or time passes.',
          'Depression is not simply a bad mood. It is a cluster of symptoms that lasts most of the day, most days, for weeks or longer. It can include losing interest in things you used to enjoy, changes in appetite or sleep, low energy, difficulty concentrating, feeling worthless or guilty, and thinking about death. It can be diagnosed by a qualified professional; this page cannot do that.',
        ],
      },
      {
        heading: 'What it can feel like',
        paragraphs: [
          'People describe depression as heaviness, as watching life through glass, or as a flatness where feelings should be. Everyday tasks can feel enormous. It is common to withdraw from friends, to assume you are a burden, and to feel convinced things will not change.',
          'That conviction is a symptom, not a fact. Depression distorts judgement about the future, and that is one reason telling someone else is so important — it gives you a second perspective on your own thinking.',
        ],
      },
      {
        heading: 'What tends to help',
        paragraphs: [
          'Depression usually responds best to a combination of support, therapy and — for some people — medication prescribed by a clinician. Behavioural approaches focus on re-engaging with activities that matter to you, even before motivation returns; motion often comes before motivation, not after it.',
          'Small steps count: getting outside, moving your body, keeping regular meals and sleep times, and staying in contact with at least one person you trust. These are not a cure. They are scaffolding, and they are easier to build with help.',
        ],
      },
      {
        heading: 'When to get more support',
        paragraphs: [
          'If low mood lasts more than two weeks, affects your ability to work or study, or comes with thoughts of harming yourself, please speak to a doctor or mental-health professional. If you are thinking about suicide, contact a crisis line now — trained people are available and you do not have to explain yourself perfectly.',
        ],
      },
    ],
    takeaways: [
      'Low mood is normal; depression is a persistent pattern that deserves care.',
      'Hopelessness is a symptom that narrows your thinking, not a prediction.',
      'Action often comes before motivation — start very small.',
      'Therapy and, for some, medication help. Ask a professional.',
    ],
    links: [
      {
        label: 'Depression — NIMH',
        href: 'https://www.nimh.nih.gov/health/topics/depression',
      },
      {
        label: 'Depression — NHS',
        href: 'https://www.nhs.uk/mental-health/conditions/depression-in-adults/',
      },
    ],
  },
  {
    id: 'sleep-basics',
    categoryId: 'sleep',
    title: 'Sleep when your mind will not switch off',
    summary:
      'Chasing a perfect eight hours can make sleep harder. Consistency and a gentler wind-down routine usually help more.',
    readMinutes: 3,
    sections: [
      {
        heading: 'Why sleep and mood are linked',
        paragraphs: [
          'Sleep and mental health affect each other in both directions. A poor night can make emotions feel bigger and concentration harder; anxiety and low mood can make falling asleep more difficult. Breaking that loop is easier with routine than with willpower.',
          'Most adults do best with seven to nine hours, but needs vary. The goal is not a perfect sleep score. It is a reasonably regular rhythm that leaves you functional.',
        ],
      },
      {
        heading: 'What the evidence supports',
        paragraphs: [
          'Wake at roughly the same time each day, including at weekends — a stable wake time anchors the body clock more strongly than a fixed bedtime. Get natural light soon after waking, ideally outdoors. Keep the bed for sleep rather than scrolling, and give yourself 30 to 60 minutes to wind down before lights out.',
          'Caffeine can stay active in the body for hours; if sleep is difficult, try cutting it out from early afternoon. Alcohol can make you fall asleep quickly but fragments sleep later in the night. Vigorous exercise is helpful overall, though some people find it too stimulating close to bedtime.',
        ],
      },
      {
        heading: 'If you cannot sleep',
        paragraphs: [
          'Lying in bed awake and frustrated teaches your brain that bed is a place for stress. If you are still awake after roughly 20 minutes, get up, do something quiet and low-light, and return when sleepy. Keep the clock out of sight where possible — time-checking feeds anxiety.',
          'If sleep problems last more than a few weeks, affect your daytime functioning, or come with loud snoring and daytime sleepiness, mention it to a doctor. Sleep difficulties are treatable, and cognitive behavioural therapy for insomnia is well evidenced.',
        ],
      },
    ],
    takeaways: [
      'Stable wake time is more useful than chasing a perfect bedtime.',
      'Wind down before bed and reduce late caffeine and alcohol.',
      'If awake, get up rather than lying there frustrated.',
      'Ongoing sleep problems deserve professional support.',
    ],
    links: [
      {
        label: 'How to get to sleep — NHS',
        href: 'https://www.nhs.uk/live-well/sleep-and-tiredness/how-to-get-to-sleep/',
      },
      {
        label: 'Insomnia — NHS',
        href: 'https://www.nhs.uk/conditions/insomnia/',
      },
    ],
  },
  {
    id: 'grounding-breathing',
    categoryId: 'grounding',
    title: 'Five-minute grounding and breathing toolkit',
    summary:
      'Grounding does not solve the problem. It lowers the volume enough that you can choose your next step instead of reacting.',
    readMinutes: 3,
    sections: [
      {
        heading: 'Why it works',
        paragraphs: [
          'When you are overwhelmed, attention narrows to the threat. Grounding deliberately moves attention to neutral, concrete sensory information — what you can see, hear and touch right now. This interrupts the loop of distressing thoughts and gives your nervous system something ordinary to process.',
          'Breathing works on the same system. A longer exhale tends to activate the calming branch of the nervous system. You do not need to breathe perfectly. Slowing down slightly and letting the out-breath be longer than the in-breath is enough to begin.',
        ],
      },
      {
        heading: 'The 5-4-3-2-1 exercise',
        paragraphs: [
          'Say out loud or in your head: five things you can see, four things you can touch, three things you can hear, two things you can smell, and one thing you can taste. Move slowly and actually describe them — "grey mug with a chip on the rim" rather than "a mug". Specificity is what pulls attention into the present.',
          'The 4-4-6 breathing pattern — in for four, hold for four, out for six — is an accessible starting point. Four rounds is usually enough. Stop if you feel dizzy or uncomfortable and return to your normal breathing.',
        ],
      },
      {
        heading: 'The cold-water technique',
        paragraphs: [
          'Cooling the face with cold water, a cold pack, or holding something cold briefly can trigger the dive reflex, which slows the heart rate and can interrupt intense distress. It is a short, physical reset, not a treatment. Do not use it while driving or standing in water, and avoid it if you have a heart condition — ask a clinician instead.',
          'Walking outside, pressing your feet into the floor, or humming can also help. The best technique is the one you remember and are willing to use when things are hard.',
        ],
      },
      {
        heading: 'When grounding is not enough',
        paragraphs: [
          'Grounding is for moments. If distress is frequent, intense or tied to trauma, professional support is the right next step. If you feel you might act on thoughts of harming yourself, contact a crisis line or emergency services immediately.',
        ],
      },
    ],
    takeaways: [
      'Grounding interrupts the loop by redirecting attention to the present.',
      '5-4-3-2-1 works better when you describe things specifically.',
      'Longer exhales help; stop if you feel dizzy.',
      'Cold water is a brief reset — not for use when driving or with heart conditions.',
    ],
    links: [
      {
        label: 'Self-help for anxiety — NHS',
        href: 'https://www.nhs.uk/mental-health/self-help/tips-and-support/',
      },
      {
        label: 'Find a helpline in your country',
        href: 'https://findahelpline.com',
      },
    ],
  },
  {
    id: 'supporting-a-friend',
    categoryId: 'support',
    title: 'How to support a friend who is struggling',
    summary:
      'You are not their therapist. Being steady, specific and honest is more helpful than having the right words.',
    readMinutes: 4,
    sections: [
      {
        heading: 'Start with presence, not solutions',
        paragraphs: [
          'When someone we care about is struggling, the instinct is to fix it. Most people first need to feel heard. That means asking an open question — "how have things been lately?" — and then listening without steering the conversation toward advice.',
          'Resist the urge to compare their experience to yours or to reassure too quickly. "That sounds exhausting" is often more useful than "it will get better". You can be honest that you do not have the answers and still stay in the conversation.',
        ],
      },
      {
        heading: 'Ask directly about suicide',
        paragraphs: [
          'A common fear is that asking about suicide will plant the idea. Evidence does not support that. Asking directly — "are you thinking about suicide?" — can be a relief for someone who has not been able to say it. If the answer is yes, stay calm, take it seriously, and help them reach a crisis line or emergency service. Do not promise to keep it secret if their safety is at risk.',
          'If someone is in immediate danger, call emergency services. If you can, stay with them or make sure another trusted person is with them until help arrives.',
        ],
      },
      {
        heading: 'Practical support that helps',
        paragraphs: [
          'Offer specific help rather than "let me know if you need anything": a lift to an appointment, a meal, a walk, or a message at the same time each week. Keep your promises, including the small ones. Consistency is a form of care.',
          'Look after yourself too. Supporting someone can be tiring and frightening. Set limits you can actually keep, and talk to someone you trust about what you are carrying. You are allowed to need support while giving it.',
        ],
      },
      {
        heading: 'Know when to hand over',
        paragraphs: [
          'You are not responsible for keeping another person alive, and you are not qualified to treat them. If their needs are beyond what you can hold, encourage professional help and, where appropriate, support them in making the first call. If you are worried about immediate risk, contact emergency services or a crisis line rather than waiting.',
        ],
      },
    ],
    takeaways: [
      'Listen first; advice can come later, or not at all.',
      'Ask directly about suicide — it does not plant the idea.',
      'Offer specific, reliable help instead of vague availability.',
      'Hand over to professionals when risk is present.',
    ],
    links: [
      {
        label: 'Supporting someone with mental health — NHS',
        href: 'https://www.nhs.uk/mental-health/social-care-and-your-rights/',
      },
      {
        label: 'Find a helpline in your country',
        href: 'https://findahelpline.com',
      },
    ],
  },
  {
    id: 'when-to-seek-help',
    categoryId: 'professional',
    title: 'When self-help is not enough',
    summary:
      'Self-help is a starting point, not a substitute for assessment. Here is an honest guide to involving a professional.',
    readMinutes: 4,
    sections: [
      {
        heading: 'Signs it is time to ask for more',
        paragraphs: [
          'Talk to a doctor or mental-health professional if symptoms last more than two weeks, are getting worse, or are affecting sleep, appetite, work, study or relationships. Also seek help if you are using alcohol or other substances to cope, if you have stopped doing things that matter to you, or if people close to you are worried.',
          'Some situations need help quickly: thoughts of hurting yourself or someone else, hearing or seeing things others do not, feeling unable to care for yourself, or feeling that life is not worth living. In those cases contact crisis services or emergency services right away — do not wait for a scheduled appointment.',
        ],
      },
      {
        heading: 'Who you can talk to',
        paragraphs: [
          'A general practitioner or family doctor is often the first step and can refer you onward. Other routes include psychologists, psychiatrists, counsellors, community mental-health teams, employee or student assistance programmes, and university or workplace support services.',
          'In many countries you can self-refer to talking therapies without a doctor\'s letter. Cost and waiting times vary; it is reasonable to ask about fees, sliding scales and waiting lists before committing.',
        ],
      },
      {
        heading: 'What to expect',
        paragraphs: [
          'An assessment is a conversation, not a test you can fail. A clinician will ask what has been happening, how long for, and how it affects your life. You can bring notes, ask questions, and bring someone with you if that helps. You are allowed to say if a clinician does not feel like the right fit and ask about alternatives.',
          'Talking therapies such as cognitive behavioural therapy are well evidenced for anxiety and depression. Medication is prescribed by a qualified clinician when appropriate; never start, stop or change it based on something you read online, including this library.',
        ],
      },
      {
        heading: 'It is not a last resort',
        paragraphs: [
          'Getting help early usually makes things easier, not harder. Seeking support is not a sign of weakness or failure, and it does not commit you to anything beyond one conversation. If the first attempt is difficult, try a different route — the goal is to find support that fits.',
        ],
      },
    ],
    takeaways: [
      'Seek help when symptoms persist, worsen, or limit daily life.',
      'Immediate risk means crisis or emergency services now.',
      'A GP or doctor is a normal first step.',
      'You can ask about cost, waiting times and therapy options.',
    ],
    links: [
      {
        label: 'Mental health — World Health Organization',
        href: 'https://www.who.int/health-topics/mental-health',
      },
      {
        label: 'Find a helpline in your country',
        href: 'https://findahelpline.com',
      },
    ],
  },
  {
    id: 'digital-wellbeing',
    categoryId: 'digital',
    title: 'Staying online without losing your peace',
    summary:
      'Social feeds are designed to hold attention. A few deliberate boundaries protect your mood without requiring a full digital detox.',
    readMinutes: 3,
    sections: [
      {
        heading: 'Not all screen time is equal',
        paragraphs: [
          'Research on screen time and wellbeing is mixed, and the number of hours is a crude measure. How you use a platform matters more: active conversation with people you know tends to feel different from passive scrolling through curated lives. Comparison, rumination and late-night use are the patterns most consistently linked with feeling worse.',
          'It is also worth asking what you are escaping. If you reach for your phone whenever you feel anxious, bored or lonely, the phone is numbing the feeling rather than solving it. Noticing that is the first change.',
        ],
      },
      {
        heading: 'Small boundaries that hold',
        paragraphs: [
          'Make the first ten minutes of your day phone-free — without it, your mood often starts out shaped by other people\'s news. Keep screens out of the bedroom, or at least out of arm\'s reach overnight. Turn off non-essential notifications so the app does not decide when you are interrupted.',
          'Curate deliberately: unfollow accounts that leave you feeling worse, and follow ones that inform or genuinely interest you. Set a timer for use in the evening rather than relying on willpower. Treat these as experiments and keep what actually helps.',
        ],
      },
      {
        heading: 'When the community is the support',
        paragraphs: [
          'Online communities can be a real source of support, especially when local services are hard to reach. The same caution applies: avoid spaces that encourage crisis as a way of belonging, and prefer spaces with clear moderation and kindness norms.',
          'If being online is consistently making things worse, or you find yourself unable to stop despite wanting to, it is worth talking it through with someone. If your use is tied to anxiety, depression or loneliness, treating the underlying difficulty usually helps more than deleting an app.',
        ],
      },
    ],
    takeaways: [
      'How you use a platform matters more than total hours.',
      'Protect the first and last hour of your day.',
      'Turn off non-essential notifications and curate your feed.',
      'If it is consistently making things worse, talk to someone.',
    ],
    links: [
      {
        label: 'Mental health and digital lives — WHO',
        href: 'https://www.who.int/health-topics/mental-health',
      },
    ],
  },
  {
    id: 'myths-vs-facts',
    categoryId: 'myths',
    title: 'Myths vs facts about mental health',
    summary:
      'Misconceptions keep people from asking for help. These are the ones worth correcting.',
    readMinutes: 3,
    sections: [
      {
        heading: 'Myth: mental health problems are a sign of weakness',
        paragraphs: [
          'Fact: mental-health conditions are common, affect people of every background, and have biological, psychological and social contributors. Asking for help requires effort and courage. Most people who receive support describe it as a practical step, not a character test.',
        ],
      },
      {
        heading: 'Myth: therapy is just talking, so it is the same as talking to a friend',
        paragraphs: [
          'Fact: friends are essential, and they are not trained clinicians. Therapists use structured approaches, assessment and evidence-based methods, and they are bound by confidentiality and professional standards. A friend can sit with you in distress; a therapist can help you change patterns.',
        ],
      },
      {
        heading: 'Myth: talking about suicide will give someone the idea',
        paragraphs: [
          'Fact: asking directly about suicidal thoughts does not increase risk and can open a conversation the person could not start. If you are worried, ask plainly, listen without judgement, and help the person reach crisis or emergency services if needed.',
        ],
      },
      {
        heading: 'Myth: medication is the only or the best treatment',
        paragraphs: [
          'Fact: treatment varies. Talking therapies, lifestyle support, social connection and, for some people, medication can all play a part. Decisions about medication belong with a qualified clinician who knows your history — never from an article or an app.',
        ],
      },
      {
        heading: 'Myth: children and teenagers do not experience mental-health problems',
        paragraphs: [
          'Fact: children and young people can experience anxiety, low mood and other difficulties. They often show it through behaviour rather than words — withdrawal, irritability, changes in school performance or sleep. Taking it seriously early is protective, and support is available through schools, GPs and youth services.',
        ],
      },
      {
        heading: 'Myth: therapy takes years before anything changes',
        paragraphs: [
          'Fact: many structured therapies are time-limited and focused, with useful change often happening within weeks. Some people need longer support, and some need only a few sessions. You can ask a clinician what a realistic plan looks like for your situation.',
        ],
      },
      {
        heading: 'Myth: you can tell if someone is "really" struggling by looking',
        paragraphs: [
          'Fact: many people appear fine while working hard to seem okay. If someone tells you they are struggling, believe them, and treat their account as real even when their presentation does not match your expectations.',
        ],
      },
    ],
    takeaways: [
      'Mental-health conditions are common and treatable.',
      'Therapy is structured work, not a substitute for friendship.',
      'Asking about suicide directly is safer than avoiding it.',
      'Treatment decisions belong with a qualified clinician.',
    ],
    links: [
      {
        label: 'Mental health fact sheet — WHO',
        href: 'https://www.who.int/news-room/fact-sheets/detail/mental-health-strengthening-our-response',
      },
      {
        label: 'Find a helpline in your country',
        href: 'https://findahelpline.com',
      },
    ],
  },
];

export const WELLNESS_DISCLAIMER =
  'This library is general education, not medical advice, diagnosis or treatment. If you are struggling, speak to a qualified professional. If you are in immediate danger, contact your local emergency number.';

export default WELLNESS_RESOURCES;
