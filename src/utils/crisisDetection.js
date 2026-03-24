// Crisis Detection Utility
// Monitors for crisis keywords and triggers appropriate responses

let crisisCallback = null;
let isMonitoring = false;
let isInitialized = false;

// Crisis keywords and phrases
const CRISIS_KEYWORDS = {
  immediate: [
    'suicide', 'kill myself', 'end it all', 'want to die', 'taking my life',
    'overdose', 'cutting myself', 'self harm', 'hurt myself', 
    'can\'t go on', 'no point living', 'better off dead'
  ],
  warning: [
    'depressed', 'hopeless', 'worthless', 'giving up', 'can\'t cope',
    'overwhelming', 'trapped', 'alone', 'desperate', 'crisis',
    'breaking point', 'losing control', 'panic attack', 'anxiety attack'
  ],
  help: [
    'need help', 'please help', 'someone help me', 'desperate for help',
    'cry for help', 'reaching out', 'don\'t know what to do'
  ]
};

// Initialize crisis detection system
export const initializeCrisisDetection = (callback) => {
  if (isInitialized) {
    return; // Prevent multiple initializations
  }
  
  crisisCallback = callback;
  isMonitoring = true;
  isInitialized = true;
  
  // Use setTimeout to avoid React lifecycle issues
  setTimeout(() => {
    // Monitor text inputs for crisis keywords
    monitorTextInputs();
    
    // Check URL for crisis-related content
    monitorURLChanges();
    
    console.log('Crisis detection system initialized');
  }, 100);
};

// Monitor text inputs across the application
const monitorTextInputs = () => {
  const checkText = (text) => {
    if (!text || typeof text !== 'string') return false;
    
    const lowerText = text.toLowerCase();
    const crisisLevel = detectCrisisLevel(lowerText);
    
    if (crisisLevel > 0) {
      triggerCrisisResponse(crisisLevel, text);
      return true;
    }
    return false;
  };

  // Monitor all text inputs and textareas
  document.addEventListener('input', (event) => {
    if (!isMonitoring) return;
    
    const target = event.target;
    if (target.tagName === 'TEXTAREA' || 
        (target.tagName === 'INPUT' && target.type === 'text')) {
      
      // Debounce to avoid excessive checking
      clearTimeout(target.crisisTimeout);
      target.crisisTimeout = setTimeout(() => {
        checkText(target.value);
      }, 1000);
    }
  });
};

// Monitor URL changes for crisis-related navigation
const monitorURLChanges = () => {
  const checkURL = () => {
    // Disabled URL monitoring for crisis keywords 
    // as it triggers alert banners redundantly on the crisis page itself
  };

  // Check current URL
  checkURL();
  
  // Monitor for URL changes
  window.addEventListener('popstate', checkURL);
  
  // Monitor programmatic navigation
  const originalPushState = window.history.pushState;
  window.history.pushState = function(...args) {
    originalPushState.apply(this, args);
    setTimeout(checkURL, 100);
  };
};

// Detect crisis level based on text content
const detectCrisisLevel = (text) => {
  let level = 0;
  
  // Check for immediate crisis keywords (level 3 - highest)
  for (const keyword of CRISIS_KEYWORDS.immediate) {
    if (text.includes(keyword)) {
      level = Math.max(level, 3);
    }
  }
  
  // Check for warning signs (level 2 - moderate)
  for (const keyword of CRISIS_KEYWORDS.warning) {
    if (text.includes(keyword)) {
      level = Math.max(level, 2);
    }
  }
  
  // Check for help requests (level 1 - low)
  for (const keyword of CRISIS_KEYWORDS.help) {
    if (text.includes(keyword)) {
      level = Math.max(level, 1);
    }
  }
  
  return level;
};

// Trigger appropriate crisis response
const triggerCrisisResponse = (level, content) => {
  console.log(`Crisis detected (Level ${level}):`, content);
  
  if (crisisCallback) {
    crisisCallback(true, level);
  }
  
  // Show browser-level crisis help
  if (window.showCrisisHelp) {
    window.showCrisisHelp();
  }
  
  // Log crisis detection for moderation (anonymized)
  logCrisisEvent(level);
  
  // For immediate crisis (level 3), consider more aggressive intervention
  if (level === 3) {
    showImmediateCrisisModal();
  }
};

// Log crisis events (anonymized for safety tracking)
const logCrisisEvent = (level) => {
  const eventData = {
    timestamp: new Date().toISOString(),
    level: level,
    sessionId: localStorage.getItem('mh_chan_session'),
    url: window.location.pathname
  };
  
  // Store locally for now (in production, might send to monitoring service)
  const crisisLogs = JSON.parse(localStorage.getItem('crisis_events') || '[]');
  crisisLogs.push(eventData);
  
  // Keep only last 50 events to avoid storage issues
  const recentEvents = crisisLogs.slice(-50);
  localStorage.setItem('crisis_events', JSON.stringify(recentEvents));
};

// Show immediate crisis intervention modal
const showImmediateCrisisModal = () => {
  // Create and show crisis intervention modal
  const modal = document.createElement('div');
  modal.className = 'crisis-intervention-modal';
  modal.innerHTML = `
    <div class="crisis-modal-overlay">
      <div class="crisis-modal-content">
        <h2>🚨 We're Concerned About You</h2>
        <p>It seems like you might be going through a really tough time right now. You don't have to face this alone.</p>
        
        <div class="crisis-immediate-actions">
          <h3>Get Help Right Now:</h3>
          <a href="tel:988" class="crisis-call-button">
            📞 Call 988 - Suicide & Crisis Lifeline
          </a>
          <a href="sms:741741&body=HOME" class="crisis-text-button">
            💬 Text HOME to 741741 - Crisis Text Line
          </a>
          <p class="crisis-emergency">
            If you're in immediate physical danger, call <strong>911</strong>
          </p>
        </div>
        
        <div class="crisis-support-message">
          <p>These services are:</p>
          <ul>
            <li>✅ Free and confidential</li>
            <li>✅ Available 24/7</li>
            <li>✅ Staffed by trained counselors</li>
            <li>✅ There to listen without judgment</li>
          </ul>
          <p><strong>Your life has value and you matter.</strong></p>
        </div>
        
        <div class="crisis-modal-actions">
          <button onclick="this.parentElement.parentElement.parentElement.remove()" class="crisis-continue-button">
            I understand, continue to forum
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Auto-remove after 30 seconds if no interaction
  setTimeout(() => {
    if (modal.parentNode) {
      modal.remove();
    }
  }, 30000);
};

// Check if crisis detection should be shown for current context
export const shouldShowCrisisAlert = () => {
  const url = window.location.href.toLowerCase();
  const crisisKeywords = ['crisis', 'suicide', 'emergency', 'help'];
  
  return crisisKeywords.some(keyword => url.includes(keyword));
};

// Get crisis resources
export const getCrisisResources = async () => {
  try {
    const response = await fetch('/crisis-resources.json');
    return await response.json();
  } catch (error) {
    console.error('Failed to load crisis resources:', error);
    return {
      crisis_hotlines: {
        primary: {
          name: "988 Suicide & Crisis Lifeline",
          number: "988",
          description: "Free, confidential support for people in distress",
          available: "24/7"
        }
      }
    };
  }
};

// Disable crisis detection
export const disableCrisisDetection = () => {
  isMonitoring = false;
  crisisCallback = null;
};

// Enable crisis detection
export const enableCrisisDetection = () => {
  isMonitoring = true;
};

const crisisDetectionUtils = {
  initializeCrisisDetection,
  shouldShowCrisisAlert,
  getCrisisResources,
  disableCrisisDetection,
  enableCrisisDetection
};

export default crisisDetectionUtils;
