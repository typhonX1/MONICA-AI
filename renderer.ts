// --- Webkit SpeechRecognition & Related Interfaces ---

interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;

  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;

  start(): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionErrorEvent extends Event {
  error:
    | 'no-speech'
    | 'aborted'
    | 'audio-capture'
    | 'network'
    | 'not-allowed'
    | 'service-not-allowed'
    | 'bad-grammar'
    | 'language-not-supported';
  message: string;
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

declare var webkitSpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};

declare global {
  interface Window {
    webkitSpeechRecognition: typeof webkitSpeechRecognition;
    electronAPI: {
      getMicrophoneAccess: () => Promise<MediaStream>;
    };
  }
}

// The rest of your renderer.ts should follow below this section.


// --- DOM Elements ---
const apiKeyScreen = document.getElementById('api-key-screen');
const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement | null;
const submitApiKeyButton = document.getElementById('submit-api-key');

const chatInterface = document.getElementById('chat-interface');
const chatContainer = document.getElementById('chat-container') as HTMLDivElement | null;
const promptInput = document.getElementById('prompt-input') as HTMLTextAreaElement;
const sendButton = document.getElementById('send-button') as HTMLButtonElement;
const micButton = document.getElementById('mic-button') as HTMLButtonElement;
const clearChatButton = document.getElementById('clear-chat') as HTMLButtonElement;

// --- State Variables ---
let geminiApiKey: string | null = null;
let chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
let isGeneratingResponse = false;
let speechRecognition: InstanceType<SpeechRecognition> | null = null;
let silenceTimeout: NodeJS.Timeout | null = null;

const GEMINI_MODEL_ID = 'gemini-2.0-flash';
const API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const SILENCE_TIMEOUT_MS = 2000;

function appendMessage(role: 'user' | 'model', text: string) {
  const messageBubble = document.createElement('div');
  messageBubble.classList.add('message-bubble', 'flex', 'flex-col', 'max-w-3/4', 'rounded-xl', 'p-3', 'shadow-sm');
  if (role === 'user') {
    messageBubble.classList.add('bg-blue-600', 'text-white', 'self-end', 'rounded-br-none');
  } else {
    messageBubble.classList.add('bg-gray-200', 'text-gray-800', 'self-start', 'rounded-bl-none');
  }
  messageBubble.innerHTML = `<p class="whitespace-pre-wrap">${text}</p>`;
  if (chatContainer) {
    chatContainer.appendChild(messageBubble);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

function showLoadingIndicator() {
  const loadingBubble = document.createElement('div');
  loadingBubble.classList.add('message-bubble', 'ai-message', 'self-start', 'flex', 'items-center', 'space-x-1', 'rounded-bl-none');
  loadingBubble.id = 'loading-indicator';
  loadingBubble.innerHTML = `
    <span class="loading-dot w-2 h-2 bg-gray-500 rounded-full"></span>
    <span class="loading-dot w-2 h-2 bg-gray-500 rounded-full"></span>
    <span class="loading-dot w-2 h-2 bg-gray-500 rounded-full"></span>`;
  if (chatContainer) {
    chatContainer.appendChild(loadingBubble);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
  return loadingBubble;
}

function hideLoadingIndicator(indicator: HTMLElement) {
  if (indicator && chatContainer?.contains(indicator)) {
    chatContainer.removeChild(indicator);
  }
}

async function handleApiKeySubmission() {
  if (!apiKeyInput) return;
  const key = apiKeyInput.value.trim();
  if (key) {
    geminiApiKey = key;
    localStorage.setItem('geminiApiKey', key);
    apiKeyScreen?.classList.add('hidden');
    chatInterface?.classList.remove('hidden');
    promptInput.focus();
    appendMessage('model', 'Hello! I am Gemini. How can I help you today?');
  } else {
    alert('Please enter a valid API key.');
  }
}

async function sendMessage() {
  const prompt = promptInput.value.trim();
  if (!prompt || isGeneratingResponse) return;
  if (!geminiApiKey) {
    alert('API Key is missing. Please restart the application and enter your API key.');
    return;
  }

  isGeneratingResponse = true;
  promptInput.value = '';
  promptInput.style.height = 'auto';
  sendButton.disabled = true;
  micButton.disabled = true;

  appendMessage('user', prompt);
  chatHistory.push({ role: 'user', parts: [{ text: prompt }] });
  const loadingIndicator = showLoadingIndicator();

  try {
    const payload = {
      contents: chatHistory,
      generationConfig: {}
    };

    const apiUrl = `${API_BASE_URL}/${GEMINI_MODEL_ID}:generateContent?key=${geminiApiKey}`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`API Error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();
    const reply = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (reply) {
      appendMessage('model', reply);
      chatHistory.push({ role: 'model', parts: [{ text: reply }] });
    } else {
      appendMessage('model', 'Sorry, I could not generate a response. Please try again.');
    }
  } catch (error: any) {
    appendMessage('model', `Error: ${error.message}`);
    console.error('Error calling Gemini API:', error);
  } finally {
    hideLoadingIndicator(loadingIndicator);
    isGeneratingResponse = false;
    sendButton.disabled = false;
    micButton.disabled = false;
    promptInput.focus();
  }
}

function adjustTextareaHeight() {
  promptInput.style.height = 'auto';
  promptInput.style.height = promptInput.scrollHeight + 'px';
}

function clearChat() {
  chatHistory = [];
  if (chatContainer) chatContainer.innerHTML = '';
  appendMessage('model', 'Hello! I am Gemini. How can I help you today?');
  localStorage.removeItem('chatHistory');
}

function startSpeechRecognition() {
  if (!('webkitSpeechRecognition' in window)) {
    appendMessage('model', 'Speech Recognition is not supported.');
    return;
  }

  if (speechRecognition) speechRecognition.stop();
  speechRecognition = new window.webkitSpeechRecognition();
  speechRecognition.continuous = false;
  speechRecognition.interimResults = true;
  speechRecognition.lang = 'en-US';

  let finalTranscript = '';

  speechRecognition.onresult = (event: SpeechRecognitionEvent) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; ++i) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalTranscript += transcript;
      else interim += transcript;
    }
    promptInput.value = finalTranscript + interim;
    adjustTextareaHeight();
    resetSilenceTimer();
  };

  speechRecognition.onstart = () => {
    micButton.classList.add('mic-listening');
    promptInput.placeholder = 'Listening...';
    resetSilenceTimer();
  };

  speechRecognition.onend = () => {
    micButton.classList.remove('mic-listening');
    promptInput.placeholder = 'Message Gemini...';
    if (finalTranscript) {
      promptInput.value = finalTranscript.trim();
      adjustTextareaHeight();
    }
    clearSilenceTimer();
  };

  speechRecognition.onerror = (event: SpeechRecognitionErrorEvent) => {
    micButton.classList.remove('mic-listening');
    promptInput.placeholder = 'Message Gemini...';
    appendMessage('model', `Speech recognition error: ${event.error}`);
    clearSilenceTimer();
  };

  speechRecognition.start();
}

function stopSpeechRecognition() {
  if (speechRecognition) {
    speechRecognition.stop();
    clearSilenceTimer();
    micButton.classList.remove('mic-listening');
    promptInput.placeholder = 'Message Gemini...';
  }
}

function resetSilenceTimer() {
  clearSilenceTimer();
  silenceTimeout = setTimeout(() => {
    stopSpeechRecognition();
  }, SILENCE_TIMEOUT_MS);
}

function clearSilenceTimer() {
  if (silenceTimeout) {
    clearTimeout(silenceTimeout);
    silenceTimeout = null;
  }
}

// --- Event Listeners ---
submitApiKeyButton?.addEventListener('click', handleApiKeySubmission);
apiKeyInput?.addEventListener('keypress', (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    handleApiKeySubmission();
  }
});
sendButton.addEventListener('click', sendMessage);
promptInput.addEventListener('keypress', (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
});
promptInput.addEventListener('input', adjustTextareaHeight);
clearChatButton.addEventListener('click', clearChat);

micButton.addEventListener('click', () => {
  if (micButton.classList.contains('mic-listening')) stopSpeechRecognition();
  else startSpeechRecognition();
});

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  const storedApiKey = localStorage.getItem('geminiApiKey');
  if (storedApiKey) {
    geminiApiKey = storedApiKey;
    apiKeyScreen?.classList.add('hidden');
    chatInterface?.classList.remove('hidden');
    promptInput.focus();
    const storedChat = localStorage.getItem('chatHistory');
    if (storedChat) {
      try {
        chatHistory = JSON.parse(storedChat);
        chatHistory.forEach(m => appendMessage(m.role, m.parts[0].text));
      } catch {
        chatHistory = [];
        appendMessage('model', 'Hello! I am Gemini. How can I help you today?');
      }
    } else {
      appendMessage('model', 'Hello! I am Gemini. How can I help you today?');
    }
  } else {
    apiKeyScreen?.classList.remove('hidden');
    chatInterface?.classList.add('hidden');
    apiKeyInput?.focus();
  }
});

window.addEventListener('beforeunload', () => {
  localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
});

console.log(MediaRecorder.isTypeSupported('audio/webm'));
console.log(MediaRecorder.isTypeSupported('audio/webm;codecs=opus'));

window.electronAPI.getMicrophoneAccess()
  .then((stream: MediaStream) => {
    // handle stream if needed
  })
  .catch((error: any) => {
    console.error('Microphone access error:', error);
    appendMessage('model', 'Unable to access microphone. Please check permissions.');
  });

export {}