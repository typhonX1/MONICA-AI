// src/renderer-with-auth.ts - COMPLETE VERSION WITH ALL FEATURES
export {};

// Import authentication services
import {
  signInWithGoogle,
  signUpWithEmail,
  signInWithEmail,
  setupRecaptcha,
  sendPhoneOTP,
  verifyPhoneOTP,
  logout,
  setUsername,
  getUsername,
  storeApiKey,
  getApiKey,
  saveChatSession,
  loadChatSessions,
  deleteChatSession as deleteFirebaseSession,
  saveUserSettings,
  loadUserSettings,
  observeAuthState
} from './authService.js';
import { User } from 'firebase/auth';
import { initializeScreenAssist, toggleScreenAssist } from './live-view.js';
// Define global types
declare global {
    interface Window {
        electronAPI: {
            setApiKey: (apiKey: string) => void;
            sendMessage: (message: string, apiKey: string) => void;
            onApiKeyReceived: (callback: (success: boolean) => void) => void;
            onMessageProcessed: (callback: (data: { success: boolean }) => void) => void;
        };
        jspdf: any;
        hljs: any;
    }
}

type GeminiPart = 
    | { text: string } 
    | { inlineData: { data: string; mimeType: string } };

// ==================== DOM ELEMENTS ====================
// Authentication elements
const authScreen = document.getElementById('auth-screen');
const usernameScreen = document.getElementById('username-screen');
const apiKeyScreen = document.getElementById('api-key-screen');
const chatInterface = document.getElementById('chat-interface');

// Auth views
const signinView = document.getElementById('signin-view');
const signupView = document.getElementById('signup-view');
const phoneView = document.getElementById('phone-view');

// Auth buttons
const googleSigninBtn = document.getElementById('google-signin-btn');
const emailSigninBtn = document.getElementById('email-signin-btn');
const emailSignupBtn = document.getElementById('email-signup-btn');
const phoneSigninToggleBtn = document.getElementById('phone-signin-toggle-btn');
const sendOtpBtn = document.getElementById('send-otp-btn');
const verifyOtpBtn = document.getElementById('verify-otp-btn');
const showSignupLink = document.getElementById('show-signup');
const showSigninLink = document.getElementById('show-signin');
const backToSigninLink = document.getElementById('back-to-signin');
const logoutBtn = document.getElementById('logout-btn');
const logoutBtnHeader = document.getElementById('logout-btn-header') as HTMLButtonElement;

// Auth inputs
const signinEmail = document.getElementById('signin-email') as HTMLInputElement;
const signinPassword = document.getElementById('signin-password') as HTMLInputElement;
const signupEmail = document.getElementById('signup-email') as HTMLInputElement;
const signupPassword = document.getElementById('signup-password') as HTMLInputElement;
const signupPasswordConfirm = document.getElementById('signup-password-confirm') as HTMLInputElement;
const phoneNumber = document.getElementById('phone-number') as HTMLInputElement;
const otpCode = document.getElementById('otp-code') as HTMLInputElement;
const otpInputContainer = document.getElementById('otp-input-container');

// Username screen
const usernameInput = document.getElementById('username-input') as HTMLInputElement;
const saveUsernameBtn = document.getElementById('save-username-btn');
const usernameError = document.getElementById('username-error');

// API Key screen
const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
const submitApiKeyButton = document.getElementById('submit-api-key');
const welcomeUsername = document.getElementById('welcome-username');

// Error/Success messages
const authError = document.getElementById('auth-error');
const authSuccess = document.getElementById('auth-success');

// Chat interface elements
const chatContainer = document.getElementById('chat-container') as HTMLDivElement | null;
const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
const sendButton = document.getElementById('send-button') as HTMLButtonElement;
const micButton = document.getElementById('mic-button') as HTMLButtonElement;
const newChatButton = document.getElementById('new-chat-button') as HTMLButtonElement;
const historyContainer = document.getElementById('history-container') as HTMLDivElement;
const clearCurrentChatButton = document.getElementById('clear-current-chat-button') as HTMLButtonElement;

// New Feature Elements
const searchToggleButton = document.getElementById('search-toggle-button') as HTMLButtonElement;
const searchContainer = document.getElementById('search-container') as HTMLDivElement;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const searchPrevButton = document.getElementById('search-prev') as HTMLButtonElement;
const searchNextButton = document.getElementById('search-next') as HTMLButtonElement;
const searchCloseButton = document.getElementById('search-close') as HTMLButtonElement;
const exportButton = document.getElementById('export-button') as HTMLButtonElement;
const settingsButton = document.getElementById('settings-button') as HTMLButtonElement;
const attachFileButton = document.getElementById('attach-file-button') as HTMLButtonElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const tokenCounter = document.getElementById('token-count') as HTMLSpanElement;
const offlineIndicator = document.getElementById('offline-indicator') as HTMLDivElement;

// Modal Elements
const settingsModal = document.getElementById('settings-modal') as HTMLDivElement;
const closeSettingsButton = document.getElementById('close-settings') as HTMLButtonElement;
const exportModal = document.getElementById('export-modal') as HTMLDivElement;
const closeExportButton = document.getElementById('close-export') as HTMLButtonElement;
const shortcutsModal = document.getElementById('shortcuts-modal') as HTMLDivElement;
const closeShortcutsButton = document.getElementById('close-shortcuts') as HTMLButtonElement;
const editModal = document.getElementById('edit-modal') as HTMLDivElement;
const closeEditModalButton = document.getElementById('close-edit-modal') as HTMLButtonElement;
const editMessageInput = document.getElementById('edit-message-input') as HTMLTextAreaElement;
const saveEditedMessageButton = document.getElementById('save-edited-message') as HTMLButtonElement;

// Settings Elements
const themeToggle = document.getElementById('theme-toggle') as HTMLDivElement;
const settingsApiKeyInput = document.getElementById('settings-api-key') as HTMLInputElement;
const temperatureSlider = document.getElementById('temperature-slider') as HTMLInputElement;
const temperatureValue = document.getElementById('temperature-value') as HTMLSpanElement;
const maxTokensInput = document.getElementById('max-tokens-input') as HTMLInputElement;
const systemPromptInput = document.getElementById('system-prompt-input') as HTMLTextAreaElement;
const backupButton = document.getElementById('backup-button') as HTMLButtonElement;
const restoreButton = document.getElementById('restore-button') as HTMLButtonElement;
const restoreInput = document.getElementById('restore-input') as HTMLInputElement;
const languageSelect = document.getElementById('language-select') as HTMLSelectElement;
const saveSettingsButton = document.getElementById('save-settings') as HTMLButtonElement;

// Export Buttons
const exportPdfButton = document.getElementById('export-pdf') as HTMLButtonElement;
const exportTextButton = document.getElementById('export-text') as HTMLButtonElement;
const exportJsonButton = document.getElementById('export-json') as HTMLButtonElement;

// ==================== STATE VARIABLES ====================
let currentUser: User | null = null;
let currentUsername: string = '';
let geminiApiKey: string | null = null;
let chatHistory: { role: 'user' | 'model'; parts: GeminiPart[] }[] = [];
let isGeneratingResponse = false;

// MediaRecorder state
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: BlobPart[] = [];
let mediaStream: MediaStream | null = null;
let isRecording = false;

// Multi-session history state
type SessionData = { title: string, history: typeof chatHistory };
let allSessions: { [key: string]: SessionData } = {};
let currentSessionId: string = 'default';

// Voice Activity Detection state
const SILENCE_THRESHOLD_MS = 10000;
const VAD_CHECK_INTERVAL_MS = 200;
let silenceTimer: number = 0;
let vadInterval: ReturnType<typeof setInterval> | null = null;

// Web Audio API Variables
let audioContext: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let volumeDataArray = new Uint8Array(2048);

// New Feature State
let currentSearchIndex = -1;
let searchMatches: HTMLElement[] = [];
let userSettings = {
    temperature: 1.0,
    maxTokens: 2048,
    systemPrompt: '',
    language: 'en',
    darkMode: true,
    apiProvider: 'gemini' as 'gemini' | 'groq'
};
let attachedFiles: File[] = [];
let totalTokens = 0;

// File preview container element
let filePreviewContainer: HTMLDivElement | null = null;

// API Configuration
let apiProvider: 'gemini' | 'groq' = 'gemini';
let groqApiKey: string | null = null;

const API_CONFIGS = {
    gemini: {
        modelId: 'gemini-exp-1206',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
        endpoint: (model: string, key: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`
    },
    groq: {
        modelId: 'llama-3.1-8b-instant',
        baseUrl: 'https://api.groq.com/openai/v1',
        endpoint: (model: string, key: string) => `https://api.groq.com/openai/v1/chat/completions`
    }
};
const MIME_TYPE = 'audio/webm';

// Translation object for multi-language support
const translations: { [key: string]: { [key: string]: string } } = {
    en: {
        welcome: 'Hello! I am Monica. I can now understand your voice commands!',
        placeholder: 'Message Monica...',
        recording: 'Recording voice command... Speak now!',
        sessionCleared: 'Session cleared. How can I help you now?'
    },
    es: {
        welcome: '¡Hola! Soy Monica. ¡Ahora puedo entender tus comandos de voz!',
        placeholder: 'Mensaje a Monica...',
        recording: 'Grabando comando de voz... ¡Habla ahora!',
        sessionCleared: 'Sesión limpiada. ¿Cómo puedo ayudarte ahora?'
    },
    fr: {
        welcome: 'Bonjour! Je suis Monica. Je peux maintenant comprendre vos commandes vocales!',
        placeholder: 'Message à Monica...',
        recording: 'Enregistrement de commande vocale... Parlez maintenant!',
        sessionCleared: 'Session effacée. Comment puis-je vous aider maintenant?'
    },
    de: {
        welcome: 'Hallo! Ich bin Monica. Ich kann jetzt Ihre Sprachbefehle verstehen!',
        placeholder: 'Nachricht an Monica...',
        recording: 'Sprachbefehl aufnehmen... Sprechen Sie jetzt!',
        sessionCleared: 'Sitzung gelöscht. Wie kann ich Ihnen jetzt helfen?'
    },
    zh: {
        welcome: '你好！我是Monica。我现在可以理解你的语音命令了！',
        placeholder: '给Monica发消息...',
        recording: '正在录制语音命令...现在说话！',
        sessionCleared: '会话已清除。我现在能帮你什么？'
    },
    ja: {
        welcome: 'こんにちは！私はMonicaです。音声コマンドを理解できるようになりました！',
        placeholder: 'Monicaにメッセージ...',
        recording: '音声コマンドを録音中...今すぐ話してください！',
        sessionCleared: 'セッションがクリアされました。今、どのようにお手伝いできますか？'
    },
    hi: {
        welcome: 'नमस्ते! मैं Monica हूं। अब मैं आपके वॉइस कमांड समझ सकती हूं!',
        placeholder: 'Monica को संदेश...',
        recording: 'वॉइस कमांड रिकॉर्ड कर रहे हैं... अभी बोलें!',
        sessionCleared: 'सत्र साफ़ किया गया। अब मैं आपकी कैसे मदद कर सकती हूं?'
    }
};

// ==================== UTILITY FUNCTIONS ====================
function translate(key: string): string {
    return translations[userSettings.language]?.[key] || translations['en'][key] || key;
}

function showError(message: string): void {
    if (authError) {
        authError.textContent = message;
        authError.style.display = 'block';
        setTimeout(() => {
            authError.style.display = 'none';
        }, 5000);
    }
}

function showSuccess(message: string): void {
    if (authSuccess) {
        authSuccess.textContent = message;
        authSuccess.style.display = 'block';
        setTimeout(() => {
            authSuccess.style.display = 'none';
        }, 3000);
    }
}

function showToast(message: string, duration: number = 3000): void {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

function updateTokenCounter(): void {
    let total = 0;
    chatHistory.forEach(msg => {
        msg.parts.forEach(part => {
            if ('text' in part) {
                total += estimateTokens(part.text);
            }
        });
    });
    totalTokens = total;
    if (tokenCounter) tokenCounter.textContent = total.toString();
}

function checkOnlineStatus(): void {
    if (!navigator.onLine) {
        offlineIndicator?.classList.add('active');
    } else {
        offlineIndicator?.classList.remove('active');
    }
}

function generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

function generateSessionTitle(): string {
    const now = new Date();
    const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const dateString = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `Session (${dateString} ${timeString})`;
}

// ==================== AUTHENTICATION HANDLERS ====================
async function handleGoogleSignIn(): Promise<void> {
    try {
        const user = await signInWithGoogle();
        currentUser = user;
        await checkUserSetup();
    } catch (error: any) {
        showError(error.message);
    }
}

async function handleEmailSignUp(): Promise<void> {
    const email = signupEmail.value.trim();
    const password = signupPassword.value;
    const confirmPassword = signupPasswordConfirm.value;
    
    if (!email || !password) {
        showError('Please fill in all fields');
        return;
    }
    
    if (password.length < 6) {
        showError('Password must be at least 6 characters');
        return;
    }
    
    if (password !== confirmPassword) {
        showError('Passwords do not match');
        return;
    }
    
    try {
        const user = await signUpWithEmail(email, password);
        currentUser = user;
        showSuccess('Account created! Please check your email for verification.');
        await checkUserSetup();
    } catch (error: any) {
        showError(error.message);
    }
}

async function handleEmailSignIn(): Promise<void> {
    const email = signinEmail.value.trim();
    const password = signinPassword.value;
    
    if (!email || !password) {
        showError('Please fill in all fields');
        return;
    }
    
    try {
        const user = await signInWithEmail(email, password);
        currentUser = user;
        await checkUserSetup();
    } catch (error: any) {
        showError(error.message);
    }
}

async function handlePhoneSignIn(): Promise<void> {
    const phone = phoneNumber.value.trim();
    
    if (!phone || phone.length < 10) {
        showError('Please enter a valid phone number with country code (e.g., +1234567890)');
        return;
    }
    
    try {
        setupRecaptcha('recaptcha-container');
        await sendPhoneOTP(phone);
        showSuccess('OTP sent! Please check your phone.');
        otpInputContainer!.style.display = 'block';
    } catch (error: any) {
        showError(error.message);
    }
}

async function handleOTPVerification(): Promise<void> {
    const otp = otpCode.value.trim();
    
    if (otp.length !== 6) {
        showError('Please enter a 6-digit OTP');
        return;
    }
    
    try {
        const user = await verifyPhoneOTP(otp);
        currentUser = user;
        await checkUserSetup();
    } catch (error: any) {
        showError(error.message);
    }
}

async function checkUserSetup(): Promise<void> {
    if (!currentUser) return;
    
    const username = await getUsername(currentUser.uid);
    
    if (!username) {
        authScreen!.style.display = 'none';
        usernameScreen!.style.display = 'flex';
    } else {
        currentUsername = username;
        const storedKey = await getApiKey(currentUser.uid);
        
        if (!storedKey) {
            authScreen!.style.display = 'none';
            usernameScreen!.style.display = 'none';
            apiKeyScreen!.style.display = 'flex';
            welcomeUsername!.textContent = `Welcome, ${currentUsername}!`;
        } else {
            // Parse stored key
            if (storedKey.startsWith('groq:')) {
                apiProvider = 'groq';
                groqApiKey = storedKey.substring(5);
            } else {
                apiProvider = 'gemini';
                geminiApiKey = storedKey;
            }
            
            await loadUserData();
            showChatInterface();
        }
    }
}

async function handleUsernameSave(): Promise<void> {
    const username = usernameInput.value.trim();
    
    if (!username || username.length < 2) {
        if (usernameError) {
            usernameError.textContent = 'Username must be at least 2 characters';
            usernameError.style.display = 'block';
        }
        return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        if (usernameError) {
            usernameError.textContent = 'Username can only contain letters, numbers, and underscores';
            usernameError.style.display = 'block';
        }
        return;
    }
    
    try {
        await setUsername(currentUser!.uid, username);
        currentUsername = username;
        
        usernameScreen!.style.display = 'none';
        apiKeyScreen!.style.display = 'flex';
        welcomeUsername!.textContent = `Welcome, ${currentUsername}!`;
    } catch (error: any) {
        if (usernameError) {
            usernameError.textContent = error.message;
            usernameError.style.display = 'block';
        }
    }
}

async function handleApiKeySave(): Promise<void> {
    const apiKey = apiKeyInput.value.trim();
    
    if (!apiKey) {
        showError('Please enter a valid API key');
        return;
    }
    
    try {
        // Store with provider prefix
        const keyToStore = apiProvider === 'groq' ? `groq:${apiKey}` : apiKey;
        await storeApiKey(currentUser!.uid, keyToStore);
        
        // Set the correct variable
        if (apiProvider === 'gemini') {
            geminiApiKey = apiKey;
        } else {
            groqApiKey = apiKey;
        }
        
        console.log(`Saved ${apiProvider} API key:`, apiKey.substring(0, 15) + '...');
        
        await loadUserData();
        showChatInterface();
    } catch (error: any) {
        showError(error.message);
    }
}

async function loadUserData(): Promise<void> {
    if (!currentUser) return;
    
    try {
        const sessions = await loadChatSessions(currentUser.uid);
        allSessions = sessions;
        
        const settings = await loadUserSettings(currentUser.uid);
        if (settings) {
            Object.assign(userSettings, settings);
            apiProvider = settings.apiProvider || 'gemini';
        }
        
        // Load API key from Firebase
        const storedKey = await getApiKey(currentUser.uid);
        console.log('Fetched API key from Firebase:', storedKey?.substring(0, 20) + '...');
        
        if (storedKey) {
            if (storedKey.startsWith('groq:')) {
                apiProvider = 'groq';
                groqApiKey = storedKey.substring(5); // Remove 'groq:' prefix
                console.log('Using Groq API key:', groqApiKey?.substring(0, 15) + '...');
            } else {
                apiProvider = 'gemini';
                geminiApiKey = storedKey;
                console.log('Using Gemini API key:', geminiApiKey?.substring(0, 15) + '...');
            }
        }
        
        if (Object.keys(allSessions).length > 0) {
            const sessionKeys = Object.keys(allSessions).sort().reverse();
            currentSessionId = sessionKeys[0];
            loadSession(currentSessionId);
        } else {
            currentSessionId = generateSessionId();
            allSessions[currentSessionId] = {
                title: generateSessionTitle(),
                history: []
            };
        }
        
        renderHistoryList();
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

function showChatInterface(): void {
    authScreen!.style.display = 'none';
    usernameScreen!.style.display = 'none';
    apiKeyScreen!.style.display = 'none';
    chatInterface!.classList.remove('hidden');
    
    appendMessage('model', `Welcome back, ${currentUsername}! How can I help you today?`, false);
    promptInput.focus();
    updateTokenCounter();
}

async function handleLogout(): Promise<void> {
    try {
        if (currentSessionId && chatHistory.length > 0) {
            await saveChatSessionToFirebase();
        }
        
        // Clear the API key from Firestore before logging out
        if (currentUser) {
            await storeApiKey(currentUser.uid, '');
            console.log('API key cleared from Firebase');
        }
        
        await logout();
        
        // Clear ALL user data
        currentUser = null;
        currentUsername = '';
        geminiApiKey = null;
        chatHistory = [];
        allSessions = {};
        currentSessionId = 'default';
        
        // Clear the chat container
        if (chatContainer) chatContainer.innerHTML = '';
        
        // Clear the history sidebar
        if (historyContainer) historyContainer.innerHTML = '';
        
        // Hide chat interface and show auth screen
        chatInterface!.classList.add('hidden');
        authScreen!.style.display = 'flex';
        usernameScreen!.style.display = 'none';
        apiKeyScreen!.style.display = 'none';
        
        // Show sign-in view (not signup)
        signinView!.style.display = 'block';
        signupView!.style.display = 'none';
        phoneView!.style.display = 'none';
        
        // Clear all input fields
        if (signinEmail) signinEmail.value = '';
        if (signinPassword) signinPassword.value = '';
        if (signupEmail) signupEmail.value = '';
        if (signupPassword) signupPassword.value = '';
        if (signupPasswordConfirm) signupPasswordConfirm.value = '';
        if (phoneNumber) phoneNumber.value = '';
        if (otpCode) otpCode.value = '';
        if (usernameInput) usernameInput.value = '';
        if (apiKeyInput) apiKeyInput.value = '';
        
        console.log('Logged out successfully - all data cleared');
        showSuccess('Signed out successfully');
    } catch (error: any) {
        console.error('Logout error:', error);
        showError(error.message);
    }
}

async function saveChatSessionToFirebase(): Promise<void> {
    if (!currentUser || !currentSessionId) return;
    
    try {
        await saveChatSession(currentUser.uid, currentSessionId, {
            title: allSessions[currentSessionId]?.title || generateSessionTitle(),
            history: chatHistory
        });
    } catch (error) {
        console.error('Error saving session:', error);
    }
}

// ==================== HISTORY MANAGEMENT FUNCTIONS ====================
function renderHistoryList(): void {
    if (!historyContainer) return;
    historyContainer.innerHTML = '';

    const sessionKeys = Object.keys(allSessions).sort().reverse();

    sessionKeys.forEach(id => {
        const session = allSessions[id];
        const entry = document.createElement('div');
        entry.classList.add('sidebar-item', 'hover:bg-[#2C313C]', 'text-gray-400');
        entry.setAttribute('data-session-id', id);
        
        entry.innerHTML = `
            <span class="sidebar-item-content" title="${session.title}">${session.title}</span>
            <i class="fas fa-trash-alt delete-session-btn" data-delete-id="${id}"></i>
        `;

        if (id === currentSessionId) {
            entry.classList.add('bg-[#2C313C]', 'text-white');
        }

        const contentSpan = entry.querySelector('.sidebar-item-content') as HTMLElement;
        if (contentSpan) {
            contentSpan.addEventListener('click', () => loadSession(id));
        }

        const deleteButton = entry.querySelector('.delete-session-btn') as HTMLElement;
        if (deleteButton) {
            deleteButton.addEventListener('click', (event) => {
                event.stopPropagation();
                deleteSession(id);
            });
        }
        
        historyContainer.appendChild(entry);
    });
}

function deleteSession(sessionId: string): void {
    if (!allSessions[sessionId]) return;

    if (!confirm(`Are you sure you want to delete session: ${allSessions[sessionId].title}?`)) {
        return;
    }

    delete allSessions[sessionId];
    
    if (sessionId === currentSessionId) {
        clearChat();
    } else {
        renderHistoryList();
    }

    if (currentUser) {
        deleteFirebaseSession(currentUser.uid, sessionId).catch(err => {
            console.error('Error deleting session from Firebase:', err);
        });
    }
    
    showToast('Session deleted');
}

function loadSession(sessionId: string): void {
    if (isGeneratingResponse) return;
    if (!allSessions[sessionId]) return;

    if (currentSessionId && currentSessionId !== sessionId && allSessions[currentSessionId]) {
        if (chatHistory.length > 0) {
            allSessions[currentSessionId] = {
                title: allSessions[currentSessionId].title || generateSessionTitle(),
                history: chatHistory
            };
            saveChatSessionToFirebase();
        }
    }

    currentSessionId = sessionId;
    const sessionData = allSessions[sessionId];
    chatHistory = sessionData.history || [];

    if (chatContainer) chatContainer.innerHTML = '';
    chatHistory.forEach(m => {
        const textPart = m.parts.find(p => 'text' in p);
        if (textPart && 'text' in textPart) {
            const isAudio = m.role === 'user' && textPart.text === "Audio message submitted.";
            const displayMessage = isAudio ? 'Recording sent for transcription.' : textPart.text;
            appendMessage(m.role, displayMessage, isAudio);
        }
    });
    
    if (chatHistory.length === 0) {
        appendMessage('model', translate('welcome'), false);
    }

    renderHistoryList();
    promptInput.focus();
    adjustTextareaHeight();
    updateTokenCounter();
}

// ==================== VAD & VISUALIZATION LOGIC ====================
function getVolumeLevel(): number {
    if (!analyserNode || !volumeDataArray) return 0;
    
    analyserNode.getByteTimeDomainData(volumeDataArray!);
    
    let sum = 0;
    for (const amplitude of volumeDataArray) {
        const normalized = (amplitude / 128) - 1;
        sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / volumeDataArray.length);
    
    return Math.floor(rms * 255);
}

function startSilenceDetection(): void {
    silenceTimer = 0;
    stopSilenceDetection();

    vadInterval = setInterval(() => {
        if (!isRecording) {
            stopSilenceDetection();
            return;
        }

        const volume = getVolumeLevel();
        const SILENCE_THRESHOLD_VOLUME = 15;
        const IS_SILENCE = (volume < SILENCE_THRESHOLD_VOLUME);

        if (IS_SILENCE) {
            silenceTimer += VAD_CHECK_INTERVAL_MS;
            if (silenceTimer >= SILENCE_THRESHOLD_MS) {
                console.log(`Auto-stopping recording due to ${SILENCE_THRESHOLD_MS/1000}s silence.`);
                stopRecording();
            }
        } else {
            silenceTimer = 0;
        }
    }, VAD_CHECK_INTERVAL_MS);
}

function stopSilenceDetection(): void {
    if (vadInterval) {
        clearInterval(vadInterval);
        vadInterval = null;
    }
    
    if (audioContext) {
        audioContext.close().catch(e => console.error("Error closing AudioContext:", e));
        audioContext = null;
        analyserNode = null;
        volumeDataArray = new Uint8Array(2048);
    }
}

// ==================== MESSAGE FUNCTIONS ====================
function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            } else {
                reject(new Error("Failed to convert blob to base64 string."));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

function createMessageActions(messageBubble: HTMLElement, role: 'user' | 'model', text: string, messageIndex: number): void {
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'action-btn';
    copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
    copyBtn.title = 'Copy';
    copyBtn.onclick = () => {
        navigator.clipboard.writeText(text);
        showToast('Copied to clipboard');
    };
    actions.appendChild(copyBtn);
    
    if (role === 'user') {
        const editBtn = document.createElement('button');
        editBtn.className = 'action-btn';
        editBtn.innerHTML = '<i class="fas fa-edit"></i>';
        editBtn.title = 'Edit';
        editBtn.onclick = () => editMessage(messageIndex);
        actions.appendChild(editBtn);
    }
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn';
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.title = 'Delete';
    deleteBtn.onclick = () => deleteMessage(messageIndex);
    actions.appendChild(deleteBtn);
    
    if (role === 'model' && messageIndex === chatHistory.length - 1) {
        const regenBtn = document.createElement('button');
        regenBtn.className = 'action-btn';
        regenBtn.innerHTML = '<i class="fas fa-redo"></i>';
        regenBtn.title = 'Regenerate';
        regenBtn.onclick = () => regenerateResponse();
        actions.appendChild(regenBtn);
    }
    
    messageBubble.appendChild(actions);
}

function handleSaveEdit(): void {
    const newText = editMessageInput.value.trim();
    const indexStr = editMessageInput.dataset.messageIndex;
    const index = indexStr ? parseInt(indexStr) : -1;

    if (index === -1 || index >= chatHistory.length) {
        showToast('Error: Could not find message to edit');
        return;
    }
    
    const message = chatHistory[index];
    const textPart = message.parts.find(p => 'text' in p);
    const originalText = textPart && 'text' in textPart ? textPart.text : '';

    editMessageInput.dataset.messageIndex = '';
    editModal.classList.remove('active');
    closeSearch();

    if (newText && newText !== originalText) {
        chatHistory = chatHistory.slice(0, index);
        
        if (chatContainer) chatContainer.innerHTML = '';
        chatHistory.forEach(m => {
            const tp = m.parts.find(p => 'text' in p);
            if (tp && 'text' in tp) {
                appendMessage(m.role, tp.text, false);
            }
        });
        
        handleMessage(newText);
    } else {
        showToast('No changes made.');
    }
}

function editMessage(index: number): void {
    if (isGeneratingResponse) return;
    if (index >= chatHistory.length) return;
    
    const message = chatHistory[index];
    if (message.role !== 'user') return;
    
    const textPart = message.parts.find(p => 'text' in p);
    if (!textPart || !('text' in textPart)) return;
    
    editMessageInput.value = textPart.text;
    editMessageInput.dataset.messageIndex = index.toString();
    editModal.classList.add('active');
    editMessageInput.focus();
}

function deleteMessage(index: number): void {
    if (isGeneratingResponse) return;
    if (!confirm('Delete this message and all following messages?')) return;
    
    chatHistory = chatHistory.slice(0, index);
    
    if (chatContainer) chatContainer.innerHTML = '';
    chatHistory.forEach(m => {
        const textPart = m.parts.find(p => 'text' in p);
        if (textPart && 'text' in textPart) {
            appendMessage(m.role, textPart.text, false);
        }
    });
    
    if (chatHistory.length === 0) {
        appendMessage('model', translate('welcome'), false);
    }
    
    saveChatSessionToFirebase();
    updateTokenCounter();
    showToast('Message deleted');
}

function regenerateResponse(): void {
    if (isGeneratingResponse) return;
    if (chatHistory.length < 2) return;
    
    chatHistory.pop();
    
    const lastUserMsg = chatHistory[chatHistory.length - 1];
    if (lastUserMsg.role === 'user') {
        const textPart = lastUserMsg.parts.find(p => 'text' in p);
        if (textPart && 'text' in textPart) {
            const messages = chatContainer?.querySelectorAll('.message-bubble');
            if (messages && messages.length > 0) {
                messages[messages.length - 1].remove();
            }
            
            chatHistory.pop();
            handleMessage(textPart.text);
        }
    }
}

function processCodeBlocks(text: string): string {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

    return text.replace(codeBlockRegex, (match, language, code) => {
        const lang = language || 'plaintext';
        const highlightedCode = window.hljs?.highlight(code.trim(), { language: lang })?.value || code.trim();

        return `<div class="code-block-container">
            <div class="code-block-header">
                <span class="code-language">${lang}</span>
                <button class="copy-code-btn">
                    <i class="fas fa-copy mr-1"></i> Copy
                </button>
            </div>
            <pre><code class="hljs language-${lang}">${highlightedCode}</code></pre>
        </div>`;
    });
}

function attachCopyCodeListeners(): void {
    document.querySelectorAll('.copy-code-btn').forEach(button => {
        button.removeEventListener('click', handleCopyButtonClick);
        button.addEventListener('click', handleCopyButtonClick);
    });
}

function handleCopyButtonClick(this: HTMLButtonElement, event: Event): void {
    const codeElement = this.closest('.code-block-container')?.querySelector('pre code');
    if (codeElement) {
        const rawText = codeElement.textContent || '';
        navigator.clipboard.writeText(rawText);

        showToast('Code copied');
        
        this.innerHTML = '<i class="fas fa-check mr-1"></i> Copied!';
        this.disabled = true;
        setTimeout(() => {
            this.innerHTML = '<i class="fas fa-copy mr-1"></i> Copy';
            this.disabled = false;
        }, 2000);
    }
}

function appendMessage(role: 'user' | 'model', text: string, isAudio: boolean = false): void {
    const messageBubble = document.createElement('div');
    messageBubble.classList.add('message-bubble', 'flex', 'flex-col', 'max-w-3/4', 'rounded-xl', 'p-3', 'shadow-sm');
    messageBubble.setAttribute('data-message-index', (chatHistory.length - 1).toString());
    
    if (role === 'user') {
        messageBubble.classList.add('user-message', 'bg-blue-600', 'text-white', 'self-end', 'rounded-br-none');
    } else {
        messageBubble.classList.add('ai-message', 'bg-gray-200', 'text-gray-800', 'self-start', 'rounded-bl-none');
    }

    let content = isAudio ? `<i class="fas fa-microphone-alt text-lg mr-2"></i> ${text}` : processCodeBlocks(text);
    messageBubble.innerHTML = `<p class="whitespace-pre-wrap">${content}</p>`;
    
    if (chatContainer) {
        chatContainer.appendChild(messageBubble);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    if (role === 'model' || !isAudio) {
        attachCopyCodeListeners();
    }
    
    const messageIndex = chatHistory.length - 1;
    createMessageActions(messageBubble, role, text, messageIndex);
    
    updateTokenCounter();
}

function showLoadingIndicator(): HTMLElement {
    const loadingBubble = document.createElement('div');
    loadingBubble.classList.add('message-bubble', 'ai-message', 'self-start', 'flex', 'items-center', 'space-x-1', 'rounded-bl-none');
    loadingBubble.id = 'loading-indicator';
    loadingBubble.innerHTML = `
        <div class="typing-indicator">
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
            <span class="typing-dot"></span>
        </div>`;
    if (chatContainer) {
        chatContainer.appendChild(loadingBubble);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    return loadingBubble;
}

function hideLoadingIndicator(indicator: HTMLElement): void {
    if (indicator && chatContainer?.contains(indicator)) {
        chatContainer.removeChild(indicator);
    }
}

async function handleMessage(prompt?: string, audioBlob?: Blob): Promise<void> {
    if (isGeneratingResponse) return;
    
    const currentApiKey = apiProvider === 'gemini' ? geminiApiKey : groqApiKey;
    
    console.log('Current provider:', apiProvider);
    console.log('Gemini key:', geminiApiKey?.substring(0, 15) + '...');
    console.log('Groq key:', groqApiKey?.substring(0, 15) + '...');
    console.log('Using key:', currentApiKey?.substring(0, 15) + '...');
    
    if (!currentApiKey || currentApiKey.trim() === '') {
        alert('API Key is missing. Please enter your API key in settings.');
        settingsModal.classList.add('active'); // Open settings automatically
        return;
    }

    isGeneratingResponse = true;
    promptInput.value = '';
    promptInput.style.height = 'auto';
    sendButton.disabled = true;
    micButton.disabled = true;

    let currentMessageParts: GeminiPart[] = [];

    try {
        if (audioBlob) {
            const base64Audio = await blobToBase64(audioBlob);
            currentMessageParts.push({
                inlineData: { data: base64Audio, mimeType: MIME_TYPE }
            });
            currentMessageParts.push({ text: "Audio message submitted." });
            appendMessage('user', 'Recording sent for transcription.', true);
        } else if (prompt) {
            currentMessageParts.push({ text: prompt });
            appendMessage('user', prompt, false);
        }

        if (attachedFiles.length > 0) {
            for (const file of attachedFiles) {
                const base64File = await fileToBase64(file);
                currentMessageParts.push({
                    inlineData: { data: base64File, mimeType: file.type }
                });
            }
            attachedFiles = [];
            renderFilePreview();
        }

        chatHistory.push({ role: 'user', parts: currentMessageParts });

        const loadingIndicator = showLoadingIndicator();

        let response;
        let modelMessage;

        if (apiProvider === 'gemini') {
            // Gemini API Request
            console.log('Using Gemini API with key:', geminiApiKey?.substring(0, 15) + '...');
            
            response = await fetch(API_CONFIGS.gemini.endpoint(API_CONFIGS.gemini.modelId, geminiApiKey!), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: chatHistory,
                    generationConfig: {
                        temperature: userSettings.temperature,
                        maxOutputTokens: userSettings.maxTokens
                    },
                    systemInstruction: userSettings.systemPrompt ? { parts: [{ text: userSettings.systemPrompt }] } : undefined
                })
            });

            hideLoadingIndicator(loadingIndicator);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Failed to get response from Gemini API');
            }

            const data = await response.json();
            modelMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response from model.';

        } else {
            // Groq API Request
            console.log('Using Groq API with key:', groqApiKey?.substring(0, 15) + '...');
            
            // Convert chatHistory to Groq format
            const groqMessages = chatHistory.map(msg => {
                const textPart = msg.parts.find(p => 'text' in p);
                return {
                    role: msg.role === 'model' ? 'assistant' : 'user',
                    content: textPart && 'text' in textPart ? textPart.text : ''
                };
            });

            // Add system prompt if exists
            if (userSettings.systemPrompt) {
                groqMessages.unshift({
                    role: 'system',
                    content: userSettings.systemPrompt
                });
            }

            response = await fetch(API_CONFIGS.groq.endpoint(API_CONFIGS.groq.modelId, groqApiKey!), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${groqApiKey}`
                },
                body: JSON.stringify({
                    model: API_CONFIGS.groq.modelId,
                    messages: groqMessages,
                    temperature: userSettings.temperature,
                    max_tokens: userSettings.maxTokens
                })
            });

            hideLoadingIndicator(loadingIndicator);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Failed to get response from Groq API');
            }

            const data = await response.json();
            modelMessage = data.choices?.[0]?.message?.content || 'No response from model.';
        }

        chatHistory.push({ role: 'model', parts: [{ text: modelMessage }] });
        appendMessage('model', modelMessage, false);

        await saveChatSessionToFirebase();

    } catch (error) {
        console.error('Error in handleMessage:', error);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
        appendMessage('model', `Error: ${errorMsg}`, false);
    } finally {
        isGeneratingResponse = false;
        sendButton.disabled = false;
        micButton.disabled = false;
        promptInput.focus();
    }
}

async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            } else {
                reject(new Error("Failed to convert file to base64 string."));
            }
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ==================== VOICE RECORDING FUNCTIONS ====================
async function startRecording(): Promise<void> {
    if (isRecording) return;

    try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(mediaStream);
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = 2048;
        source.connect(analyserNode);
        volumeDataArray = new Uint8Array(analyserNode.fftSize);

        const options = { mimeType: MIME_TYPE };
        mediaRecorder = new MediaRecorder(mediaStream, options);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event: BlobEvent) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: MIME_TYPE });
            audioChunks = [];
            await handleMessage(undefined, audioBlob);
        };

        mediaRecorder.start();
        isRecording = true;
        micButton.classList.add('mic-listening');
        promptInput.placeholder = translate('recording');
        
        startSilenceDetection();

    } catch (error) {
        console.error('Error starting recording:', error);
        alert('Could not access microphone. Please check permissions.');
    }
}

function stopRecording(): void {
    if (!isRecording || !mediaRecorder) return;

    isRecording = false;
    micButton.classList.remove('mic-listening');
    promptInput.placeholder = translate('placeholder');

    stopSilenceDetection();

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
}

function toggleRecording(): void {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

// ==================== FILE PREVIEW FUNCTIONS ====================
function createFilePreviewContainer(): void {
    if (!filePreviewContainer) {
        filePreviewContainer = document.createElement('div');
        filePreviewContainer.id = 'file-preview-container';
        filePreviewContainer.style.cssText = `
            display: none;
            padding: 0.75rem 1rem;
            background-color: var(--color-bg-secondary);
            border-top: 1px solid #4B5563;
            max-width: 1000px;
            margin: 0 auto;
            width: 100%;
            flex-wrap: wrap;
            gap: 0.5rem;
        `;
        
        const inputFooter = document.querySelector('.input-footer');
        if (inputFooter) {
            inputFooter.parentNode?.insertBefore(filePreviewContainer, inputFooter);
        }
    }
}

function renderFilePreview(): void {
    createFilePreviewContainer();
    
    if (!filePreviewContainer) return;
    
    if (attachedFiles.length === 0) {
        filePreviewContainer.style.display = 'none';
        filePreviewContainer.innerHTML = '';
        return;
    }
    
    filePreviewContainer.style.display = 'flex';
    filePreviewContainer.innerHTML = '';
    
    attachedFiles.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.style.cssText = `
            display: flex;
            align-items: center;
            gap: 0.5rem;
            background: #4B5563;
            padding: 0.5rem 0.75rem;
            border-radius: 8px;
            font-size: 0.875rem;
            color: white;
        `;
        
        const icon = document.createElement('i');
        if (file.type.startsWith('image/')) {
            icon.className = 'fas fa-image';
        } else if (file.type === 'application/pdf') {
            icon.className = 'fas fa-file-pdf';
        } else {
            icon.className = 'fas fa-file';
        }
        
        const fileName = document.createElement('span');
        fileName.textContent = file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name;
        fileName.title = file.name;
        
        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '<i class="fas fa-times"></i>';
        removeBtn.style.cssText = `
            background: transparent;
            border: none;
            color: #EF4444;
            cursor: pointer;
            padding: 0.25rem;
            margin-left: 0.25rem;
        `;
        removeBtn.onclick = () => removeAttachedFile(index);
        
        fileItem.appendChild(icon);
        fileItem.appendChild(fileName);
        fileItem.appendChild(removeBtn);
        if (filePreviewContainer) {
            filePreviewContainer.appendChild(fileItem);
        }
    });
}

function removeAttachedFile(index: number): void {
    attachedFiles.splice(index, 1);
    renderFilePreview();
    showToast('File removed');
}

// ==================== CHAT MANAGEMENT FUNCTIONS ====================
function clearChat(): void {
    if (isGeneratingResponse) return;
    
    if (chatHistory.length > 0) {
        saveChatSessionToFirebase();
    }

    const newId = generateSessionId();
    currentSessionId = newId;
    chatHistory = [];
    
    allSessions[newId] = {
        title: generateSessionTitle(),
        history: []
    };
    
    if (chatContainer) chatContainer.innerHTML = '';
    appendMessage('model', translate('sessionCleared'), false);
    
    renderHistoryList();
    promptInput.focus();
    updateTokenCounter();
}

function adjustTextareaHeight(): void {
    promptInput.style.height = 'auto';
    const maxHeight = window.innerHeight * 0.25;
    const scrollHeight = promptInput.scrollHeight;
    promptInput.style.height = Math.min(scrollHeight, maxHeight) + 'px';
}

// ==================== SEARCH FUNCTIONS ====================
function highlightSearchMatches(query: string): void {
    searchMatches = [];
    currentSearchIndex = -1;
    
    const messages = chatContainer?.querySelectorAll('.message-bubble p');
    if (!messages) return;
    
    messages.forEach(msg => {
        const originalText = msg.textContent || '';
        msg.innerHTML = originalText;
        
        if (query.trim()) {
            const regex = new RegExp(`(${query})`, 'gi');
            const highlighted = originalText.replace(regex, '<span class="search-highlight">$1</span>');
            msg.innerHTML = highlighted;
            
            const highlights = msg.querySelectorAll('.search-highlight');
            highlights.forEach(h => searchMatches.push(h as HTMLElement));
        }
    });
    
    if (searchMatches.length > 0) {
        currentSearchIndex = 0;
        scrollToSearchMatch(0);
    }
}

function scrollToSearchMatch(index: number): void {
    if (index < 0 || index >= searchMatches.length) return;
    
    searchMatches.forEach((match, i) => {
        if (i === index) {
            match.style.backgroundColor = 'orange';
            match.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            match.style.backgroundColor = 'yellow';
        }
    });
}

function searchNext(): void {
    if (searchMatches.length === 0) return;
    currentSearchIndex = (currentSearchIndex + 1) % searchMatches.length;
    scrollToSearchMatch(currentSearchIndex);
}

function searchPrev(): void {
    if (searchMatches.length === 0) return;
    currentSearchIndex = (currentSearchIndex - 1 + searchMatches.length) % searchMatches.length;
    scrollToSearchMatch(currentSearchIndex);
}

function closeSearch(): void {
    searchContainer?.classList.remove('active');
    searchInput.value = '';
    highlightSearchMatches('');
}

// ==================== EXPORT FUNCTIONS ====================
function exportAsText(): void {
    let text = 'Monica Chat Export\n';
    text += '===================\n\n';
    
    chatHistory.forEach(msg => {
        const role = msg.role === 'user' ? 'You' : 'Monica';
        const textPart = msg.parts.find(p => 'text' in p);
        if (textPart && 'text' in textPart) {
            text += `${role}: ${textPart.text}\n\n`;
        }
    });
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monica-chat-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Chat exported as text');
}

function exportAsJson(): void {
    const data = {
        exportDate: new Date().toISOString(),
        sessionTitle: allSessions[currentSessionId]?.title || 'Untitled',
        chatHistory: chatHistory
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monica-chat-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Chat exported as JSON');
}

function exportAsPdf(): void {
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        doc.setFontSize(16);
        doc.text('Monica Chat Export', 20, 20);
        doc.setFontSize(10);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 20, 30);
        
        let yPosition = 40;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 20;
        const lineHeight = 7;
        
        chatHistory.forEach((msg) => {
            const role = msg.role === 'user' ? 'You' : 'Monica';
            const textPart = msg.parts.find(p => 'text' in p);
            
            if (textPart && 'text' in textPart) {
                const text = textPart.text;
                const lines = doc.splitTextToSize(`${role}: ${text}`, 170);
                
                if (yPosition + (lines.length * lineHeight) > pageHeight - margin) {
                    doc.addPage();
                    yPosition = margin;
                }
                
                doc.setFont(undefined, msg.role === 'user' ? 'bold' : 'normal');
                doc.text(lines, margin, yPosition);
                yPosition += lines.length * lineHeight + 5;
            }
        });
        
        doc.save(`monica-chat-${Date.now()}.pdf`);
        showToast('Chat exported as PDF');
    } catch (error) {
        console.error('PDF export error:', error);
        showToast('PDF export failed');
    }
}

// ==================== SETTINGS FUNCTIONS ====================
function loadSettings(): void {
    temperatureSlider.value = (userSettings.temperature * 10).toString();
    temperatureValue.textContent = userSettings.temperature.toFixed(1);
    maxTokensInput.value = userSettings.maxTokens.toString();
    systemPromptInput.value = userSettings.systemPrompt;
    languageSelect.value = userSettings.language;
    
    // Set API provider radio button
    const providerRadio = document.querySelector(`input[name="api-provider"][value="${apiProvider}"]`) as HTMLInputElement;
    if (providerRadio) {
        providerRadio.checked = true;
    }
    
    if (userSettings.darkMode) {
        document.body.classList.remove('light-mode');
        themeToggle.classList.add('active');
    } else {
        document.body.classList.add('light-mode');
        themeToggle.classList.remove('active');
    }
    
    // Show the correct API key based on provider
    const currentApiKey = apiProvider === 'gemini' ? geminiApiKey : groqApiKey;
    if (currentApiKey && settingsApiKeyInput) {
        settingsApiKeyInput.value = currentApiKey;
    } else {
        settingsApiKeyInput.value = '';
    }
    
    console.log('Loaded settings - Provider:', apiProvider, 'Key:', currentApiKey?.substring(0, 15) + '...');
}

async function saveSettings(): Promise<void> {
    userSettings.temperature = parseFloat(temperatureSlider.value) / 10;
    userSettings.maxTokens = parseInt(maxTokensInput.value);
    userSettings.systemPrompt = systemPromptInput.value.trim();
    userSettings.language = languageSelect.value;
    
    // Get current provider from radio button
    const selectedProvider = (document.querySelector('input[name="api-provider"]:checked') as HTMLInputElement)?.value as 'gemini' | 'groq';
    if (selectedProvider) {
        apiProvider = selectedProvider;
        userSettings.apiProvider = selectedProvider;
    }
    
    const newApiKey = settingsApiKeyInput.value.trim();
    if (newApiKey && currentUser) {
        try {
            if (apiProvider === 'gemini') {
                if (newApiKey.length < 30) {
                    showToast('Invalid Gemini API key - key seems too short');
                    return;
                }
                geminiApiKey = newApiKey;
                await storeApiKey(currentUser.uid, newApiKey);
                console.log('Saved Gemini key:', newApiKey.substring(0, 15) + '...');
                showToast('Gemini API Key updated successfully!');
            } else {
                if (newApiKey.length < 30) {
                    showToast('Invalid Groq API key - key seems too short');
                    return;
                }
                groqApiKey = newApiKey;
                await storeApiKey(currentUser.uid, `groq:${newApiKey}`);
                console.log('Saved Groq key:', newApiKey.substring(0, 15) + '...');
                showToast('Groq API Key updated successfully!');
            }
        } catch (error) {
            console.error('Error saving API key:', error);
            showToast('Failed to save API key');
            return;
        }
    }
    
    if (currentUser) {
        await saveUserSettings(currentUser.uid, userSettings);
    }
    
    // Verify the key was set
    console.log('After save - Provider:', apiProvider);
    console.log('After save - Gemini key:', geminiApiKey?.substring(0, 15));
    console.log('After save - Groq key:', groqApiKey?.substring(0, 15));
    
    settingsModal.classList.remove('active');
    showToast('Settings saved - Ready to chat!');
    
    promptInput.placeholder = translate('placeholder');
}

function toggleTheme(): void {
    userSettings.darkMode = !userSettings.darkMode;
    
    if (userSettings.darkMode) {
        document.body.classList.remove('light-mode');
        themeToggle.classList.add('active');
    } else {
        document.body.classList.add('light-mode');
        themeToggle.classList.remove('active');
    }
}

// ==================== BACKUP/RESTORE FUNCTIONS ====================
function backupData(): void {
    const backup = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        allSessions: allSessions,
        userSettings: userSettings,
        apiKey: geminiApiKey
    };
    
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monica-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup created successfully');
}

function restoreData(): void {
    restoreInput.click();
}

function handleRestoreFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const backup = JSON.parse(e.target?.result as string);
            
            if (backup.allSessions) {
                allSessions = backup.allSessions;
            }
            
            if (backup.userSettings) {
                userSettings = { ...userSettings, ...backup.userSettings };
            }
            
            if (backup.apiKey) {
                geminiApiKey = backup.apiKey;
            }
            
            renderHistoryList();
            loadSettings();
            showToast('Backup restored successfully');
            
            if (confirm('Restart required to apply all changes. Restart now?')) {
                location.reload();
            }
        } catch (error) {
            console.error('Restore error:', error);
            alert('Failed to restore backup. Invalid file format.');
        }
    };
    reader.readAsText(file);
}

// ==================== EVENT LISTENERS ====================
// Authentication listeners
googleSigninBtn?.addEventListener('click', handleGoogleSignIn);
emailSigninBtn?.addEventListener('click', handleEmailSignIn);
emailSignupBtn?.addEventListener('click', handleEmailSignUp);
phoneSigninToggleBtn?.addEventListener('click', () => {
    signinView!.style.display = 'none';
    phoneView!.style.display = 'block';
});
sendOtpBtn?.addEventListener('click', handlePhoneSignIn);
verifyOtpBtn?.addEventListener('click', handleOTPVerification);
backToSigninLink?.addEventListener('click', (e) => {
    e.preventDefault();
    phoneView!.style.display = 'none';
    signinView!.style.display = 'block';
});

showSignupLink?.addEventListener('click', (e) => {
    e.preventDefault();
    signinView!.style.display = 'none';
    signupView!.style.display = 'block';
});
showSigninLink?.addEventListener('click', (e) => {
    e.preventDefault();
    signupView!.style.display = 'none';
    signinView!.style.display = 'block';
});

saveUsernameBtn?.addEventListener('click', handleUsernameSave);
submitApiKeyButton?.addEventListener('click', handleApiKeySave);
logoutBtn?.addEventListener('click', handleLogout);
logoutBtnHeader?.addEventListener('click', handleLogout);  // ✅ ADD THIS LINE

// API Provider selection listeners
document.querySelectorAll('input[name="api-provider"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        apiProvider = (e.target as HTMLInputElement).value as 'gemini' | 'groq';
        const currentKey = apiProvider === 'gemini' ? geminiApiKey : groqApiKey;
        if (settingsApiKeyInput && currentKey) {
            settingsApiKeyInput.value = currentKey;
        }
    });
});

document.querySelectorAll('input[name="api-provider-initial"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        apiProvider = (e.target as HTMLInputElement).value as 'gemini' | 'groq';
    });
});

// Clear API Key button
// Clear API Key button
const clearApiKeyBtn = document.getElementById('clear-api-key-btn') as HTMLButtonElement;
clearApiKeyBtn?.addEventListener('click', async () => {
    if (confirm('This will clear your stored API key. You will need to enter it again. Continue?')) {
        if (currentUser) {
            await storeApiKey(currentUser.uid, '');
            geminiApiKey = null;
            groqApiKey = null;
            console.log('API key cleared from Firebase');
            
            // Reload to clear everything
            location.reload();
        }
    }
});

// Screen Assistant Integration
window.addEventListener('request-screen-assist-toggle', () => {
    toggleScreenAssist(currentUser, geminiApiKey || groqApiKey);
});

window.addEventListener('screen-assist-action', (e: Event) => {
    const customEvent = e as CustomEvent;
    const { prompt } = customEvent.detail;
    handleMessage(prompt);
});

// Chat interface listeners
sendButton.addEventListener('click', () => {
    const text = promptInput.value.trim();
    if (text) handleMessage(text);
});

promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = promptInput.value.trim();
        if (text && !isGeneratingResponse) handleMessage(text);
    }
});

promptInput.addEventListener('input', adjustTextareaHeight);

micButton.addEventListener('click', toggleRecording);

newChatButton.addEventListener('click', clearChat);

clearCurrentChatButton.addEventListener('click', () => {
    if (confirm('Clear current chat session?')) {
        clearChat();
    }
});

// Search functionality
searchToggleButton.addEventListener('click', () => {
    searchContainer.classList.toggle('active');
    if (searchContainer.classList.contains('active')) {
        searchInput.focus();
    }
});

searchInput.addEventListener('input', (e) => {
    highlightSearchMatches((e.target as HTMLInputElement).value);
});

searchPrevButton.addEventListener('click', searchPrev);
searchNextButton.addEventListener('click', searchNext);
searchCloseButton.addEventListener('click', closeSearch);

// Export functionality
exportButton.addEventListener('click', () => {
    exportModal.classList.add('active');
});

closeExportButton.addEventListener('click', () => {
    exportModal.classList.remove('active');
});

exportPdfButton.addEventListener('click', () => {
    exportAsPdf();
    exportModal.classList.remove('active');
});

exportTextButton.addEventListener('click', () => {
    exportAsText();
    exportModal.classList.remove('active');
});

exportJsonButton.addEventListener('click', () => {
    exportAsJson();
    exportModal.classList.remove('active');
});

// Settings functionality
settingsButton.addEventListener('click', () => {
    settingsModal.classList.add('active');
    loadSettings();
});

closeSettingsButton.addEventListener('click', () => {
    settingsModal.classList.remove('active');
});

saveSettingsButton.addEventListener('click', saveSettings);

themeToggle.addEventListener('click', toggleTheme);

temperatureSlider.addEventListener('input', (e) => {
    const value = parseFloat((e.target as HTMLInputElement).value) / 10;
    temperatureValue.textContent = value.toFixed(1);
});

backupButton.addEventListener('click', backupData);
restoreButton.addEventListener('click', restoreData);
restoreInput.addEventListener('change', handleRestoreFile);

// File attachment
attachFileButton.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    
    if (files.length > 0) {
        attachedFiles.push(...files);
        renderFilePreview();
        showToast(`${files.length} file(s) attached`);
    }
    
    input.value = '';
});

// Edit Modal functionality
saveEditedMessageButton?.addEventListener('click', handleSaveEdit);

closeEditModalButton?.addEventListener('click', () => {
    editModal?.classList.remove('active');
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case 'n':
                e.preventDefault();
                clearChat();
                break;
            case 'f':
                e.preventDefault();
                searchToggleButton.click();
                break;
            case ',':
                e.preventDefault();
                settingsButton.click();
                break;
            case 'l':
                e.preventDefault();
                if (confirm('Clear current chat?')) clearChat();
                break;
            case 'e':
                e.preventDefault();
                exportButton.click();
                break;
            case '/':
                e.preventDefault();
                shortcutsModal.classList.add('active');
                break;
        }
    }
    
    if (e.key === 'Escape') {
        promptInput.focus();
        settingsModal.classList.remove('active');
        exportModal.classList.remove('active');
        shortcutsModal.classList.remove('active');
        editModal.classList.remove('active');
        closeSearch();
    }
});

closeShortcutsButton?.addEventListener('click', () => {
    shortcutsModal.classList.remove('active');
});

// Online/offline status
window.addEventListener('online', checkOnlineStatus);
window.addEventListener('offline', checkOnlineStatus);

// Close modals when clicking outside
[settingsModal, exportModal, shortcutsModal, editModal].forEach(modal => {
    modal?.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });
});

// ==================== INITIALIZATION ====================
function initializeApp(): void {
    checkOnlineStatus();
      // Initialize Screen Assistant
    initializeScreenAssist();
    observeAuthState((user: User | null) => {
        if (user) {
            currentUser = user;
            checkUserSetup();
        } else {
            authScreen!.style.display = 'flex';
            chatInterface!.classList.add('hidden');
        }
    });
}

// Start the application
initializeApp();