import React, { useState, useRef, useEffect } from 'react';

/* ===============================================================
   MindBot — Mental Health Support Chatbot
   Rule-based + keyword-driven empathetic responses
   No external API needed — works offline / on Firebase hosting
   =============================================================== */

const BOT_NAME = 'MindBot';

const responses = {
  greetings: {
    patterns: ['hello', 'hi', 'hey', 'good morning', 'good evening', 'namaste'],
    replies: [
      "Hello 💚 I'm MindBot, your mental wellness companion. How are you feeling today?",
      "Hi there 🌟 I'm here to listen and support you. What's on your mind?",
      "Hey 👋 It's good to see you. How can I support you today?",
    ],
  },
  anxiety: {
    patterns: ['anxious', 'anxiety', 'panic', 'panic attack', 'stressed', 'stress', 'nervous', 'worried', 'worry', 'overwhelmed'],
    replies: [
      "I hear you — anxiety can feel really overwhelming 💙 One thing that helps many people is the 4-4-6 breathing technique: breathe in for 4 counts, hold for 4, exhale for 6. Would you like me to guide you through it?",
      "Anxiety is so hard to carry. You're not alone in this. 🤝 A grounding trick: name 5 things you can see right now around you. It helps bring you back to the present moment.",
      "That sounds really tough 💙 When anxiety hits hard, try placing your hand on your chest and taking slow, deep breaths. Feel your heartbeat slow. You're safe. Would you like to talk more about what's triggering this?",
    ],
  },
  depression: {
    patterns: ['depressed', 'depression', 'sad', 'hopeless', 'empty', 'numb', 'worthless', 'no point', 'meaningless', 'low', 'down'],
    replies: [
      "I'm really sorry you're feeling this way 💙 Depression lies to us — it tells us things won't get better, but that's not the truth. You reaching out here shows strength. Would you like to talk about what you're going through?",
      "What you're feeling is real and it matters. 💚 Depression can make everything feel heavy. Even small steps count — getting up, drinking water, being here. Is there anything specific weighing on you today?",
      "You don't have to pretend to be okay here 🌿 I'm listening. Sometimes just naming what we feel helps. Can you tell me a bit more about how you've been feeling?",
    ],
  },
  crisis: {
    patterns: ['suicide', 'suicidal', 'kill myself', 'end my life', 'want to die', 'don\'t want to live', 'hurt myself', 'self harm', 'cutting', 'no reason to live'],
    replies: [
      "🚨 I'm very concerned about you right now and I want you to know your life matters deeply. Please reach out to a crisis counselor right now — call **988** (free, 24/7) or text HOME to **741741**. They are trained to help and will listen without judgment. Are you safe right now?",
    ],
  },
  breathing: {
    patterns: ['breathe', 'breathing', 'breath', 'calm down', 'relax', 'grounding'],
    replies: [
      "Let's do this together 🌬️\n\nBox Breathing:\n1. **Inhale** for 4 counts...\n2. **Hold** for 4 counts...\n3. **Exhale** slowly for 6 counts...\n4. **Repeat** 3-4 times.\n\nThis activates your parasympathetic nervous system and reduces cortisol. You can also try this on our [Crisis page](/crisis). How do you feel?",
    ],
  },
  sleep: {
    patterns: ['sleep', 'insomnia', 'can\'t sleep', 'tired', 'exhausted', 'fatigue'],
    replies: [
      "Sleep and mental health are deeply connected 🌙 Some helpful tips: keep a consistent bedtime, avoid screens 30 mins before bed, try progressive muscle relaxation, and limit caffeine after 2pm. Are you having trouble sleeping regularly?",
    ],
  },
  lonely: {
    patterns: ['lonely', 'alone', 'isolated', 'nobody cares', 'no friends', 'no one understands'],
    replies: [
      "Loneliness can feel so painful. 💙 But you're not truly alone — you're here, and there's a whole community of people in this space who understand. Would you like to browse our support boards? Real people are there, sharing and supporting each other.",
      "I hear you, and I'm glad you reached out. 🌿 Feeling unseen is one of the hardest experiences. You deserve connection and support. Our community boards are a good place to share — anonymously and without judgment.",
    ],
  },
  help: {
    patterns: ['help', 'need help', 'what can you do', 'support'],
    replies: [
      "Here's how I can help you 💚\n\n• **Talk** — Share what's on your mind, anytime\n• **Breathing exercises** — I'll guide you\n• **Resources** — Point you to crisis lines & boards\n• **Coping tips** — For anxiety, depression, stress\n\nYou can also explore our community boards, or visit the [Crisis page](/crisis) for immediate resources. What would you like?",
    ],
  },
  resources: {
    patterns: ['resources', 'hotline', 'therapy', 'therapist', 'professional', 'doctor', 'psychiatrist', '988', '741741'],
    replies: [
      "Here are key mental health resources 📚\n\n🆘 **Crisis Lifeline:** Call or text **988**\n💬 **Crisis Text Line:** Text HOME to **741741**\n🚑 **Emergency:** Call **911**\n\nFor ongoing support:\n• [Browse community boards](/)\n• [Full crisis resources](/crisis)\n• [Community guidelines](/guidelines)\n\nProfessional therapy is always the best option for ongoing care.",
    ],
  },
  gratitude: {
    patterns: ['thank', 'thanks', 'helpful', 'appreciate'],
    replies: [
      "You're so welcome 💚 I'm always here. Taking care of your mental health takes courage — be proud of yourself for showing up.",
      "Happy to be here for you 🌟 Remember, you can always come back to chat whenever you need.",
    ],
  },
  default: [
    "I hear you, and I want you to know you're not alone 💙 Can you tell me more about what you're going through? I'm here to listen.",
    "Thank you for sharing that with me 🌿 Mental health journeys are complex. Would you like some coping strategies, or would you prefer to just talk?",
    "I'm listening and I care about how you're feeling. What would be most helpful right now — talking it through, breathing exercises, or finding community support?",
  ],
};

const getResponse = (message) => {
  const lower = message.toLowerCase();
  // Crisis check first (highest priority)
  for (const pattern of responses.crisis.patterns) {
    if (lower.includes(pattern)) {
      return responses.crisis.replies[0];
    }
  }
  // Check other categories
  const categories = ['greetings', 'anxiety', 'depression', 'breathing', 'sleep', 'lonely', 'resources', 'gratitude', 'help'];
  for (const cat of categories) {
    const category = responses[cat];
    for (const pattern of category.patterns) {
      if (lower.includes(pattern)) {
        const r = category.replies;
        return r[Math.floor(Math.random() * r.length)];
      }
    }
  }
  const d = responses.default;
  return d[Math.floor(Math.random() * d.length)];
};

const formatMessage = (text) => {
  // Bold (**text**), newlines, links
  return text
    .split('\n')
    .map((line, i) => {
      const boldFormatted = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      const linkFormatted = boldFormatted.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" style="color:#FCD34D;font-weight:700;">$1</a>');
      return `<span key="${i}">${linkFormatted}</span>`;
    })
    .join('<br/>');
};

const QUICK_PROMPTS = [
  'I feel anxious 😰',
  'Guide my breathing 🌬️',
  'Crisis resources 🚨',
  'I feel lonely 💙',
  'I need support 🤝',
];

const Chatbot = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'bot',
      text: "Hi there 💚 I'm **MindBot**, your anonymous mental wellness companion.\n\nI'm here to listen, provide coping strategies, and connect you with resources. How are you feeling today?",
      time: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
    if (open) setUnread(0);
  }, [messages, open]);

  const send = (text) => {
    if (!text.trim()) return;
    const userMsg = { id: Date.now(), role: 'user', text, time: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      const botText = getResponse(text);
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'bot', text: botText, time: new Date() }]);
      setIsTyping(false);
      if (!open) setUnread(n => n + 1);
    }, 900 + Math.random() * 600);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  const timeStr = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => { setOpen(o => !o); setUnread(0); }}
        style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: open ? 'var(--bg-secondary)' : 'linear-gradient(135deg, #10B981, #059669)',
          border: open ? '1px solid var(--border-default)' : 'none',
          boxShadow: '0 8px 30px rgba(16,185,129,0.4), 0 2px 8px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.6rem',
          zIndex: 9000,
          transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          transform: open ? 'scale(1)' : 'scale(1)',
        }}
        onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        aria-label={open ? 'Close MindBot' : 'Open MindBot chat'}
      >
        {open ? '✕' : '🧠'}
        {!open && unread > 0 && (
          <span style={{
            position: 'absolute',
            top: -4, right: -4,
            background: '#F43F5E',
            color: '#fff',
            width: 20, height: 20,
            borderRadius: '50%',
            fontSize: '0.7rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Inter', sans-serif",
            border: '2px solid var(--bg-primary)',
          }}>
            {unread}
          </span>
        )}
      </button>

      {/* Chat Window */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: '6rem',
          right: '2rem',
          width: 'min(380px, calc(100vw - 2rem))',
          height: 'min(540px, calc(100vh - 8rem))',
          background: 'rgba(17, 24, 39, 0.97)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(16,185,129,0.25)',
          borderRadius: '20px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(16,185,129,0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 8999,
          animation: 'fadeUp 0.3s ease',
        }}>
          {/* Header */}
          <div style={{
            padding: '1rem 1.25rem',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(10,15,30,0.9))',
            borderBottom: '1px solid rgba(16,185,129,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
          }}>
            <div style={{
              width: 40, height: 40,
              background: 'linear-gradient(135deg, #10B981, #059669)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.2rem',
              flexShrink: 0,
              boxShadow: '0 0 20px rgba(16,185,129,0.4)',
            }}>🧠</div>
            <div>
              <div style={{ fontWeight: 700, color: '#F8FAFC', fontSize: '0.95rem', fontFamily: "'Space Grotesk', sans-serif" }}>
                {BOT_NAME}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#6ee7b7', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: 6, height: 6, background: '#10B981', borderRadius: '50%', display: 'inline-block', animation: 'breathe 1.5s ease-in-out infinite' }} />
                Always here · 100% Anonymous
              </div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-tertiary)', textAlign: 'right' }}>
              <div>Mental Health</div>
              <div>Companion</div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {messages.map(msg => (
              <div key={msg.id} style={{
                display: 'flex',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                gap: '0.5rem',
                alignItems: 'flex-end',
                animation: 'fadeUp 0.3s ease',
              }}>
                {msg.role === 'bot' && (
                  <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #10B981, #059669)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', flexShrink: 0 }}>🧠</div>
                )}
                <div style={{
                  maxWidth: '78%',
                  padding: '0.65rem 0.9rem',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                    : 'rgba(255,255,255,0.06)',
                  border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.07)',
                  color: msg.role === 'user' ? '#1a0a00' : '#E2E8F0',
                  fontSize: '0.86rem',
                  lineHeight: 1.55,
                  fontFamily: "'Inter', sans-serif",
                }}>
                  <div dangerouslySetInnerHTML={{ __html: formatMessage(msg.text) }} />
                  <div style={{ fontSize: '0.65rem', color: msg.role === 'user' ? 'rgba(0,0,0,0.5)' : 'var(--text-tertiary)', marginTop: '0.3rem', textAlign: msg.role === 'user' ? 'left' : 'right' }}>
                    {timeStr(msg.time)}
                  </div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', animation: 'fadeIn 0.3s ease' }}>
                <div style={{ width: 28, height: 28, background: 'linear-gradient(135deg, #10B981, #059669)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem' }}>🧠</div>
                <div style={{ padding: '0.65rem 1rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px 16px 16px 4px', display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {[0, 0.2, 0.4].map((delay, i) => (
                    <span key={i} style={{ width: 6, height: 6, background: '#10B981', borderRadius: '50%', animation: `breathe 1s ease-in-out ${delay}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick Prompts */}
          <div style={{ padding: '0 0.875rem 0.625rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {QUICK_PROMPTS.map(p => (
              <button key={p} onClick={() => send(p)} style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#94A3B8',
                borderRadius: '9999px',
                padding: '0.25rem 0.6rem',
                fontSize: '0.72rem',
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif",
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
                onMouseEnter={e => { e.target.style.background = 'rgba(16,185,129,0.12)'; e.target.style.borderColor = 'rgba(16,185,129,0.3)'; e.target.style.color = '#6ee7b7'; }}
                onMouseLeave={e => { e.target.style.background = ''; e.target.style.borderColor = ''; e.target.style.color = ''; }}
              >{p}</button>
            ))}
          </div>

          {/* Input */}
          <form onSubmit={handleSubmit} style={{ padding: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Share what's on your mind…"
              style={{
                flex: 1,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                padding: '0.6rem 0.9rem',
                color: '#F8FAFC',
                fontSize: '0.875rem',
                fontFamily: "'Inter', sans-serif",
                outline: 'none',
                margin: 0,
                transition: 'border-color 0.2s ease',
              }}
              onFocus={e => e.target.style.borderColor = 'rgba(16,185,129,0.5)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
            <button
              type="submit"
              disabled={!input.trim()}
              style={{
                width: 40, height: 40,
                background: input.trim() ? 'linear-gradient(135deg, #10B981, #059669)' : 'rgba(255,255,255,0.05)',
                border: 'none',
                borderRadius: '12px',
                color: input.trim() ? '#fff' : '#64748B',
                cursor: input.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem',
                transition: 'all 0.2s ease',
                flexShrink: 0,
              }}
            >
              ➤
            </button>
          </form>

          {/* Disclaimer */}
          <div style={{ padding: '0.4rem 0.875rem 0.6rem', fontSize: '0.65rem', color: 'var(--text-tertiary)', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            Not a substitute for professional care · Crisis? Call <a href="tel:988" style={{ color: '#FCD34D' }}>988</a>
          </div>
        </div>
      )}
    </>
  );
};

export default Chatbot;
