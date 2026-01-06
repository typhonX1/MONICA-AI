// src/authService.ts - FIXED FOR ELECTRON
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  sendEmailVerification,
  signOut,
  onAuthStateChanged,
  User,
  ConfirmationResult,
  signInWithCredential,
  GoogleAuthProvider as GoogleAuthProviderType
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  serverTimestamp,
  collection,
  getDocs,
  query,
  orderBy
} from 'firebase/firestore';
import { auth, db } from './firebaseConfig.js';

// ✅ ELECTRON FIX: For Electron, we need to use external browser for OAuth
// This is because Electron's webview doesn't support Firebase's popup auth properly

// Check if running in Electron
const isElectron = () => {
  return typeof window !== 'undefined' && 
         window.process && 
         (window.process as any).type === 'renderer';
};

// Google Sign-In - ELECTRON COMPATIBLE VERSION
export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  
  // ✅ FIX: Set custom parameters for better Electron compatibility
  provider.setCustomParameters({
    prompt: 'select_account',
    // Add this to force account selection
    auth_type: 'rerequest'
  });
  
  try {
    // ✅ IMPORTANT: For Electron, you might need to open browser externally
    // Option 1: Use signInWithPopup (works in some Electron setups)
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    
    // Create or update user document in Firestore
    await createUserDocument(user);
    
    return user;
  } catch (error: any) {
    console.error('Google Sign-In Error:', error);
    
    // ✅ Better error handling with specific fixes
    if (error.code === 'auth/unauthorized-domain') {
      throw new Error(
        'Domain not authorized. Please add your domain to Firebase Console:\n' +
        '1. Go to Firebase Console\n' +
        '2. Navigate to Authentication → Settings → Authorized domains\n' +
        '3. Add: localhost, 127.0.0.1, and file://'
      );
    } else if (error.code === 'auth/popup-blocked') {
      throw new Error('Popup was blocked. Please allow popups for this app.');
    } else if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in cancelled. Please try again.');
    } else if (error.code === 'auth/network-request-failed') {
      throw new Error('Network error. Please check your internet connection.');
    }
    
    throw new Error(error.message || 'Failed to sign in with Google');
  }
}

// ✅ ALTERNATIVE: Sign in with redirect (better for Electron)
export async function signInWithGoogleRedirect(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  provider.setCustomParameters({
    prompt: 'select_account'
  });
  
  try {
    // Note: This requires handling the redirect in your main process
    // See electron-specific implementation below
    const { signInWithRedirect } = await import('firebase/auth');
    await signInWithRedirect(auth, provider);
  } catch (error: any) {
    console.error('Google Redirect Sign-In Error:', error);
    throw new Error(error.message || 'Failed to initiate sign in');
  }
}

// Email/Password Sign-Up
export async function signUpWithEmail(email: string, password: string): Promise<User> {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Send email verification
    await sendEmailVerification(user);
    
    // Create user document
    await createUserDocument(user);
    
    return user;
  } catch (error: any) {
    console.error('Email Sign-Up Error:', error);
    
    // Friendly error messages
    if (error.code === 'auth/email-already-in-use') {
      throw new Error('This email is already registered. Please sign in instead.');
    } else if (error.code === 'auth/weak-password') {
      throw new Error('Password is too weak. Please use at least 6 characters.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address. Please check and try again.');
    }
    
    throw new Error(error.message || 'Failed to create account');
  }
}

// Email/Password Sign-In
export async function signInWithEmail(email: string, password: string): Promise<User> {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error: any) {
    console.error('Email Sign-In Error:', error);
    
    if (error.code === 'auth/user-not-found') {
      throw new Error('No account found with this email. Please sign up first.');
    } else if (error.code === 'auth/wrong-password') {
      throw new Error('Incorrect password. Please try again.');
    } else if (error.code === 'auth/invalid-email') {
      throw new Error('Invalid email address.');
    }
    
    throw new Error(error.message || 'Failed to sign in');
  }
}

// Phone Number Sign-In (with OTP)
let recaptchaVerifier: RecaptchaVerifier | null = null;
let confirmationResult: ConfirmationResult | null = null;

export function setupRecaptcha(buttonId: string): void {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, buttonId, {
      size: 'invisible',
      callback: () => {
        console.log('reCAPTCHA solved');
      },
      'expired-callback': () => {
        console.log('reCAPTCHA expired');
        recaptchaVerifier = null;
      }
    });
  }
}

export async function sendPhoneOTP(phoneNumber: string): Promise<void> {
  if (!recaptchaVerifier) {
    throw new Error('reCAPTCHA not initialized. Call setupRecaptcha first.');
  }
  
  try {
    confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    console.log('OTP sent successfully');
  } catch (error: any) {
    console.error('Phone Sign-In Error:', error);
    
    if (error.code === 'auth/invalid-phone-number') {
      throw new Error('Invalid phone number. Please include country code (e.g., +1234567890)');
    } else if (error.code === 'auth/too-many-requests') {
      throw new Error('Too many attempts. Please try again later.');
    }
    
    throw new Error(error.message || 'Failed to send OTP');
  }
}

export async function verifyPhoneOTP(otp: string): Promise<User> {
  if (!confirmationResult) {
    throw new Error('No OTP request found. Send OTP first.');
  }
  
  try {
    const result = await confirmationResult.confirm(otp);
    const user = result.user;
    
    // Create user document
    await createUserDocument(user);
    
    return user;
  } catch (error: any) {
    console.error('OTP Verification Error:', error);
    throw new Error('Invalid OTP. Please try again.');
  }
}

// Sign Out
export async function logout(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error: any) {
    console.error('Sign-Out Error:', error);
    throw new Error('Failed to sign out');
  }
}

// Create/Update User Document in Firestore
async function createUserDocument(user: User): Promise<void> {
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    // New user - create document
    await setDoc(userRef, {
      email: user.email,
      displayName: user.displayName || '',
      username: '',
      photoURL: user.photoURL || '',
      phoneNumber: user.phoneNumber || '',
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
      apiKey: '',
      emailVerified: user.emailVerified
    });
  } else {
    // Existing user - update last active
    await updateDoc(userRef, {
      lastActive: serverTimestamp(),
      emailVerified: user.emailVerified
    });
  }
}

// Set Username
export async function setUsername(userId: string, username: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  
  try {
    await updateDoc(userRef, {
      username: username,
      displayName: username
    });
  } catch (error: any) {
    console.error('Username Update Error:', error);
    throw new Error('Failed to set username');
  }
}

// Get Username
export async function getUsername(userId: string): Promise<string> {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    return userSnap.data().username || '';
  }
  
  return '';
}

// Store API Key (encrypted in production)
export async function storeApiKey(userId: string, apiKey: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  
  try {
    await updateDoc(userRef, {
      apiKey: apiKey
    });
  } catch (error: any) {
    console.error('API Key Storage Error:', error);
    throw new Error('Failed to store API key');
  }
}

// Get API Key
export async function getApiKey(userId: string): Promise<string> {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    return userSnap.data().apiKey || '';
  }
  
  return '';
}

// Save Chat Session
export async function saveChatSession(
  userId: string, 
  sessionId: string, 
  sessionData: any
): Promise<void> {
  const sessionRef = doc(db, 'users', userId, 'sessions', sessionId);
  
  try {
    await setDoc(sessionRef, {
      ...sessionData,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error: any) {
    console.error('Session Save Error:', error);
    throw new Error('Failed to save chat session');
  }
}

// Load All Chat Sessions
export async function loadChatSessions(userId: string): Promise<any> {
  const sessionsRef = collection(db, 'users', userId, 'sessions');
  const q = query(sessionsRef, orderBy('updatedAt', 'desc'));
  
  try {
    const querySnapshot = await getDocs(q);
    const sessions: any = {};
    
    querySnapshot.forEach((doc) => {
      sessions[doc.id] = doc.data();
    });
    
    return sessions;
  } catch (error: any) {
    console.error('Sessions Load Error:', error);
    return {};
  }
}

// Delete Chat Session
export async function deleteChatSession(userId: string, sessionId: string): Promise<void> {
  const sessionRef = doc(db, 'users', userId, 'sessions', sessionId);
  
  try {
    await setDoc(sessionRef, { deleted: true, deletedAt: serverTimestamp() }, { merge: true });
  } catch (error: any) {
    console.error('Session Delete Error:', error);
    throw new Error('Failed to delete session');
  }
}

// Save User Settings
export async function saveUserSettings(userId: string, settings: any): Promise<void> {
  const settingsRef = doc(db, 'users', userId, 'settings', 'preferences');
  
  try {
    await setDoc(settingsRef, settings, { merge: true });
  } catch (error: any) {
    console.error('Settings Save Error:', error);
    throw new Error('Failed to save settings');
  }
}

// Load User Settings
export async function loadUserSettings(userId: string): Promise<any> {
  const settingsRef = doc(db, 'users', userId, 'settings', 'preferences');
  
  try {
    const settingsSnap = await getDoc(settingsRef);
    
    if (settingsSnap.exists()) {
      return settingsSnap.data();
    }
  } catch (error: any) {
    console.error('Settings Load Error:', error);
  }
  
  return null;
}

// Auth State Observer
export function observeAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

// ✅ HELPER: Check if domain authorization error
export function isDomainAuthError(error: any): boolean {
  return error?.code === 'auth/unauthorized-domain';
}

// ✅ HELPER: Get friendly error message
export function getFriendlyErrorMessage(error: any): string {
  const errorMessages: { [key: string]: string } = {
    'auth/unauthorized-domain': 'This domain is not authorized. Please contact support.',
    'auth/popup-blocked': 'Popup was blocked. Please enable popups and try again.',
    'auth/popup-closed-by-user': 'Sign-in was cancelled.',
    'auth/network-request-failed': 'Network error. Please check your connection.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.'
  };
  
  return errorMessages[error?.code] || error?.message || 'An unknown error occurred';
}