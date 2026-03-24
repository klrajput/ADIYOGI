// Firebase Configuration
// Replace these values with your actual Firebase project credentials
const firebaseConfig = {
    apiKey: "AIzaSyCCvZ_meLs6xSGK3IMmINZ3xkclV9PeKF4",
    authDomain: "adiyogi-4ffe4.firebaseapp.com",
    projectId: "adiyogi-4ffe4",
    storageBucket: "adiyogi-4ffe4.firebasestorage.app",
    messagingSenderId: "258471915641",
    appId: "1:258471915641:web:66adbd1f8244f60cea24a8"
};

// Declare Firebase services globally
let auth;
let db;

// Verify config is loaded
if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "AIzaSyCCvZ_meLs6xSGK3IMmINZ3xkclV9PeKF4") {
    console.error('❌ Firebase configuration is missing or incomplete!');
    console.error('Please check your firebase-config.js file');
} else {
    console.log('✅ Firebase configuration loaded:', {
        projectId: firebaseConfig.projectId,
        authDomain: firebaseConfig.authDomain
    });
}

try {
    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    console.log('✅ Firebase initialized successfully');
    
    // Initialize Firebase services
    auth = firebase.auth();
    db = firebase.firestore();
    
    // Test Firebase connection
    auth.onAuthStateChanged((user) => {
        console.log('✅ Firebase Auth is working');
    });
    
    // Enable offline persistence
    db.enablePersistence()
        .then(() => {
            console.log('✅ Firestore offline persistence enabled');
        })
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                console.log('⚠️ Persistence failed - multiple tabs open');
            } else if (err.code == 'unimplemented') {
                console.log('⚠️ Persistence not supported in this browser');
            } else {
                console.error('❌ Persistence error:', err);
            }
        });
        
} catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    console.error('Please check your Firebase configuration and internet connection');
}
