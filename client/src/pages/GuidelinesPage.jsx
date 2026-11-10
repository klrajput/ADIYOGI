import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import PageHeader from '../components/common/PageHeader';
import { Icon } from '../components/common/Icons';
import usePageTitle from '../hooks/usePageTitle';
import { PEER_SUPPORT_DISCLAIMER } from '../lib/constants';

const SECTIONS = [
  {
    id: 'respect',
    title: 'Respect and dignity',
    body: [
      'Everyone here is carrying something. Treat that as true even when you disagree with how someone expresses it.',
      'No insults, threats, demeaning language, or harassment — including in replies, tags, and aliases. You can disagree with a post without dismissing the person who wrote it.',
      'Do not tell people they are "attention seeking", "not trying hard enough", or that their experience is not real.',
    ],
  },
  {
    id: 'anonymity',
    title: 'Anonymity and privacy',
    body: [
      'AdiYogi gives everyone a server-issued alias. There is no public profile and no email requirement to post.',
      'Do not share identifying details about yourself or anyone else: full names, workplaces, addresses, phone numbers, social handles, or screenshots that reveal them.',
      'Do not try to work out who someone is, and do not ask them to identify themselves. Attempting to de-anonymise another person is a serious violation.',
    ],
  },
  {
    id: 'content-warnings',
    title: 'Content warnings',
    body: [
      'Use a content warning when a post describes self-harm, suicide, abuse, violence, graphic experiences, eating distress, or anything a reader might need to prepare for.',
      'Readers can choose to reveal content, so a warning is a courtesy rather than censorship. It helps people stay in the conversation on their own terms.',
      'Warnings are for genuine care, not for attention or shock value.',
    ],
  },
  {
    id: 'on-topic',
    title: 'Staying on topic',
    body: [
      'Keep discussions focused on mental-health support and on the theme of the board you are posting in.',
      'Write thread titles that describe the situation — "help" or "hi" alone makes it hard for the right people to find you.',
      'If a conversation drifts, start a new thread in the most suitable board instead of continuing an off-topic reply chain.',
    ],
  },
  {
    id: 'no-medical-advice',
    title: 'No medical advice or diagnosis',
    body: [
      'Do not diagnose anyone, prescribe or adjust medication, share dosages, or advise someone to stop treatment. This applies to responding to others as much as posting about yourself.',
      'You are welcome to share what helped you personally, framed as your experience ("what worked for me was…"), not as a prescription for someone else.',
      'AdiYogi is peer support. Nothing posted here is medical advice, and the AI companion is not a clinician.',
    ],
  },
  {
    id: 'reporting',
    title: 'Reporting harmful content',
    body: [
      'Every thread and reply has a Report action. Choose the reason that fits and add details if they help: spam, harassment, self-harm risk, graphic content, medical misinformation, or something else.',
      'Reports go to the moderation team, who can hide, lock, or remove content. Reports are not monitored 24/7 and are not a way to reach emergency help.',
      'Please report in good faith. Repeatedly filing false reports is itself a form of abuse.',
    ],
  },
  {
    id: 'crisis',
    title: 'Crisis support and its limits',
    body: [
      'AdiYogi cannot monitor the site in real time and cannot respond to an emergency. Automated assessments can surface resources when text suggests distress, but they are limited and can miss things.',
      'If you or someone else is in immediate danger, contact your local emergency number or a verified crisis line listed on the crisis support page.',
      'An automated assessment is not a diagnosis, and no label is attached to you. It exists only to make support easier to reach.',
    ],
  },
  {
    id: 'moderation',
    title: 'What moderation actually is',
    body: [
      'Moderation here is layered and human-led. Automated guards handle the basics: plain-text-only content, input validation, write and report rate limits, and duplicate-report checks.',
      'Moderators review reports and can hide, remove, lock, or pin content. Their decisions are recorded in an audit log.',
      'We do not claim AI-moderated 24/7 coverage. Response times vary, and some judgement calls will be imperfect.',
    ],
  },
  {
    id: 'accounts',
    title: 'Accounts and anonymity',
    body: [
      'Reading, posting, replying, chatting, and reporting all work with an anonymous session. No email is needed.',
      'Accounts are optional. They add continuity across devices and are required for moderation roles. Posts still use your alias, and your email is never shown to other people.',
      'You can delete your account and content at any time from the preferences page.',
    ],
  },
  {
    id: 'enforcement',
    title: 'When guidelines are broken',
    body: [
      'Content that breaks these guidelines may be hidden or removed, and a thread may be locked to stop further harm.',
      'Repeated or severe harm can lead to an account being suspended. We do not publish a strike count, because context and intent matter.',
      'If your content was removed and you are unsure why, read this page again first — the reason will almost always be one of the sections above.',
    ],
  },
  {
    id: 'help',
    title: 'Where to get help',
    body: [
      'Peer support is valuable, but it is not a substitute for professional care. If things feel unmanageable, please consider reaching out to a doctor, therapist, or local support service.',
      'For anything urgent, use the crisis support page — it lists verified regional lines, text services, and an international directory. Those services are staffed by trained people; this forum is not.',
    ],
  },
];

export default function GuidelinesPage() {
  usePageTitle('Community guidelines');

  return (
    <div className="container-page py-10 sm:py-14">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          eyebrow="Community"
          title="Community guidelines"
          description="These guidelines exist so that a difficult moment does not become a harder one. They apply to every board, reply, tag, and alias."
        />

        <div className="grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
          <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-muted">On this page</p>
            <ol className="mt-3 space-y-1.5 border-l border-line">
              {SECTIONS.map((section, index) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="block border-l-2 border-transparent py-1 pl-3 text-sm text-ink-muted transition-colors hover:border-primary-400 hover:text-ink"
                  >
                    <span className="mr-1.5 text-xs text-ink-muted">{String(index + 1).padStart(2, '0')}</span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
            <div className="mt-6 rounded-lg border border-crisis-200 bg-crisis-50 p-4">
              <p className="text-xs font-semibold text-crisis-700">In an emergency</p>
              <p className="mt-1 text-xs leading-relaxed text-crisis-700/90">
                Do not wait for a reply here. Contact your local emergency number or a crisis line.
              </p>
              <Button to="/crisis" variant="crisis" size="sm" className="mt-3">
                Crisis support
              </Button>
            </div>
          </nav>

          <div className="min-w-0">
            <div className="rounded-lg border border-line bg-surface p-5 sm:p-6">
              <p className="text-sm leading-relaxed text-ink-muted">
                AdiYogi is a peer-support community for mental health. It is not therapy, diagnosis, or emergency care.
                It is also, deliberately, not a popularity contest: there are no follower counts, no engagement
                rankings, and no notifications designed to pull you back after a hard post.
              </p>
            </div>

            <div className="mt-10 space-y-10">
              {SECTIONS.map((section, index) => (
                <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`}>
                  <p className="eyebrow text-ink-muted">
                    <span className="mr-2 text-accent-500">{String(index + 1).padStart(2, '0')}</span>
                    Guideline
                  </p>
                  <h2 id={`${section.id}-heading`} className="mt-1 font-serif text-2xl text-ink">
                    {section.title}
                  </h2>
                  <div className="mt-3 space-y-3">
                    {section.body.map((paragraph) => (
                      <p key={paragraph} className="text-sm leading-relaxed text-ink-muted sm:text-[15px]">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-12 rounded-xl border border-line bg-surface p-6">
              <h2 className="font-serif text-xl text-ink">Ready to take part?</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                Reading is always open. When you feel ready, choose a board and start where you are.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button to="/community">Browse boards</Button>
                <Button to="/preferences" variant="secondary">
                  Your preferences and data
                </Button>
                <Button to="/crisis" variant="ghost" className="text-crisis-700 hover:bg-crisis-50">
                  <Icon name="heart" className="h-4 w-4" />
                  Crisis support
                </Button>
              </div>
              <p className="mt-5 text-xs leading-relaxed text-ink-muted">{PEER_SUPPORT_DISCLAIMER}</p>
              <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                See also:{' '}
                <Link to="/crisis" className="link">
                  crisis support
                </Link>{' '}
                ·{' '}
                <Link to="/resources" className="link">
                  wellbeing resources
                </Link>{' '}
                ·{' '}
                <Link to="/preferences" className="link">
                  privacy and your data
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
