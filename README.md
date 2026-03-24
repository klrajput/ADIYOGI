<p align="center">
  <h1 align="center">🕉️ AdiYogi — Mental Health Platform</h1>
  <p align="center">
    An anonymous, spiritually-themed mental health support platform with community forums, AI-powered chatbot, and crisis resources.
  </p>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React 18" />
  <img src="https://img.shields.io/badge/Firebase-9-FFCA28?logo=firebase&logoColor=black" alt="Firebase" />
  <img src="https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="License" />
</p>

---

## ✨ Overview

**AdiYogi** is a holistic mental health support platform that blends modern technology with spiritual aesthetics inspired by Indian mythology. Users can anonymously share their thoughts, receive AI-driven support, and access crisis resources — all within a calming, beautifully designed interface.

### Key Features

- 🛡️ **Anonymous Forum** — Post confessions and perspectives with spiritual pseudonyms  
- 🤖 **AI Chatbot** — Context-aware mental health support powered by NLP  
- 🚨 **Crisis Detection** — Automated flagging of distress signals with helpline resources  
- 🎨 **Premium UI** — Dark-mode glassmorphism design with smooth micro-animations  
- 🔥 **Firebase Backend** — Real-time database, authentication, and cloud functions  
- 📱 **Fully Responsive** — Works seamlessly across desktop, tablet, and mobile  

---

## 📁 Repository Structure

```
adiyogi-mental-health-platform/
│
├── src/                        # Main React application
│   ├── components/             # Reusable UI components
│   │   ├── Board/              #   Forum board components
│   │   ├── Common/             #   Shared/generic components
│   │   ├── Layout/             #   Header, Navigation, Footer
│   │   ├── Moderation/         #   Content moderation UI
│   │   ├── Post/               #   Post display & creation
│   │   └── Thread/             #   Thread view components
│   ├── pages/                  # Route-level page components
│   ├── hooks/                  # Custom React hooks (useAuth, etc.)
│   ├── utils/                  # Utility modules (forum store, crisis detection)
│   ├── firebase/               # Firebase configuration
│   ├── data/                   # Static data (board definitions)
│   ├── styles/                 # Global CSS styles & themes
│   ├── App.js                  # Root application component
│   └── index.js                # Entry point
│
├── community-forum/            # Standalone community forum (HTML/CSS/JS)
│   ├── index.html
│   ├── app.js
│   ├── styles.css
│   ├── firebase-config.js
│   └── README.md
│
├── mythology-app/              # Mythology-themed React app with Express backend
│   ├── src/                    #   React frontend (components, pages, hooks)
│   ├── server/                 #   Express.js backend
│   └── public/                 #   Static assets & fonts
│
├── chatbot/                    # AI chatbot service
│   ├── packages/
│   │   ├── client/             #   Chat UI client
│   │   └── phase1-chatbot-service/ # NLP chatbot backend
│   ├── libs/                   #   Shared libraries
│   └── config/                 #   Chatbot configuration
│
├── functions/                  # Firebase Cloud Functions (TypeScript)
│   └── src/
│       ├── analytics/
│       ├── moderation/
│       ├── notifications/
│       └── utils/
│
├── config/                     # Webpack & build configuration
│   ├── webpack.config.js
│   ├── webpackDevServer.config.js
│   └── jest/
│
├── scripts/                    # Build & dev server scripts
├── tests/                      # Test suites
│   ├── __mocks__/
│   ├── components/
│   ├── integration/
│   └── utils/
│
├── public/                     # Static public assets
├── docs/                       # Project documentation
│   ├── database-guide.md
│   └── sharing-guide.md
│
├── firebase.json               # Firebase project configuration
├── firestore.rules             # Firestore security rules
├── firestore.indexes.json      # Firestore indexes
├── package.json                # Dependencies & scripts
└── .gitignore                  # Git ignore rules
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Node.js | ≥ 14 | [nodejs.org](https://nodejs.org/) |
| npm | ≥ 6 | Comes with Node.js |
| Firebase CLI | Latest | `npm i -g firebase-tools` |

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/adiyogi-mental-health-platform.git
cd adiyogi-mental-health-platform

# 2. Install dependencies
npm install

# 3. Set up environment variables
#    Create a .env file in the project root:
cat > .env << 'EOF'
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
EOF

# 4. Start the development server
npm start
```

The app will open at **http://localhost:3000**.

---

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start the development server with hot reload |
| `npm run build` | Create optimized production build |
| `npm test` | Run the test suite |
| `npm run deploy` | Build and deploy to Firebase Hosting |

---

## 🔥 Firebase Setup

1. Create a project at [Firebase Console](https://console.firebase.google.com/)
2. Enable **Authentication** (Email/Password)
3. Enable **Cloud Firestore**
4. Copy your project credentials into the `.env` file (see installation above)
5. Deploy security rules:

```bash
firebase login
firebase deploy --only firestore:rules
```

See [docs/database-guide.md](docs/database-guide.md) for detailed database management instructions.

---

## 🌐 Deployment

### Firebase Hosting (Recommended)

```bash
npm run build
firebase deploy
```

### Vercel

```bash
npx -y vercel
```

### Netlify

```bash
npm run build
# Upload the build/ folder to Netlify
```

See [docs/sharing-guide.md](docs/sharing-guide.md) for more deployment options and sharing instructions.

---

## 🧩 Sub-Projects

| Module | Path | Description |
|--------|------|-------------|
| **Main App** | `src/` | Core React application — anonymous forum with dark glassmorphism UI |
| **Community Forum** | `community-forum/` | Standalone HTML/CSS/JS forum with Firebase integration |
| **Mythology App** | `mythology-app/` | Full-stack React + Express app with mythology-themed mental health features |
| **AI Chatbot** | `chatbot/` | NLP-powered chatbot service with a client UI |
| **Cloud Functions** | `functions/` | Firebase Cloud Functions for moderation, analytics, and notifications |

---

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, React Router, CSS3 (Glassmorphism) |
| **Backend** | Node.js, Express.js, Firebase Cloud Functions |
| **Database** | Cloud Firestore, Local Storage (offline fallback) |
| **Auth** | Firebase Authentication |
| **AI/ML** | NLP Chatbot (Python + Node.js) |
| **Hosting** | Firebase Hosting |
| **Build** | Webpack 5, Babel |
| **Testing** | Jest, React Testing Library |

---

## 🤝 Contributing

1. Fork the repository  
2. Create a feature branch: `git checkout -b feature/amazing-feature`  
3. Commit your changes: `git commit -m 'Add amazing feature'`  
4. Push to the branch: `git push origin feature/amazing-feature`  
5. Open a Pull Request  

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<p align="center">
  <strong>May this platform bring peace and support to all who need it.</strong> 🕉️✨
</p>
