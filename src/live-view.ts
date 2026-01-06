// src/live-view.ts - Screen Assistant Module
export {};

import { User } from 'firebase/auth';

// ==================== TYPES ====================
interface ScreenAnalysis {
    type: 'code' | 'definition' | 'error' | 'question' | 'general';
    content: string;
    suggestion: string;
    confidence: number;
}

interface SuggestionAction {
    label: string;
    action: () => void;
}

// ==================== STATE ====================
let isScreenAssistActive = false;
let screenCaptureInterval: number | null = null;
let lastAnalyzedContent = '';
let currentUser: User | null = null;
let geminiApiKey: string | null = null;
let mediaStream: MediaStream | null = null;

// ==================== DOM ELEMENTS ====================
const screenAssistButton = document.getElementById('screen-assist-button') as HTMLButtonElement;
const screenAssistOverlay = document.getElementById('screen-assist-overlay') as HTMLDivElement;
const screenAssistSuggestions = document.getElementById('screen-assist-suggestions') as HTMLDivElement;

// ==================== SCREEN CAPTURE ====================
async function captureScreen(): Promise<string | null> {
    try {
        // If we don't have an active stream, request one
        if (!mediaStream) {
            mediaStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    frameRate: { ideal: 1, max: 5 }
                }
            } as any);
            
            // Handle stream ending (user clicks "Stop Sharing")
            mediaStream.getVideoTracks()[0].onended = () => {
                console.log('Screen sharing stopped by user');
                stopScreenMonitoring();
            };
        }

        // Create video element to capture frame
        const video = document.createElement('video');
        video.srcObject = mediaStream;
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;

        // Wait for video to be ready
        await new Promise<void>((resolve) => {
            video.onloadedmetadata = () => {
                video.play().then(() => resolve());
            };
        });

        // Wait a bit for the frame to be available
        await new Promise(resolve => setTimeout(resolve, 100));

        // Create canvas to extract frame
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
            console.error('Failed to get canvas context');
            return null;
        }

        // Draw current frame
        ctx.drawImage(video, 0, 0);

        // Convert to base64
        const base64Image = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
        
        // Clean up video element
        video.srcObject = null;
        
        return base64Image;
    } catch (error) {
        console.error('Screen capture error:', error);
        
        // If user denied permission or cancelled
        if (error instanceof Error) {
            if (error.name === 'NotAllowedError') {
                showToast('Screen sharing permission denied', 3000);
            } else if (error.name === 'AbortError') {
                showToast('Screen sharing cancelled', 2000);
            }
        }
        
        // Stop monitoring if capture fails
        stopScreenMonitoring();
        return null;
    }
}

// ==================== AI ANALYSIS ====================
async function analyzeScreenContent(imageBase64: string): Promise<ScreenAnalysis | null> {
    if (!geminiApiKey) {
        console.error('API key not available');
        return null;
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-exp-1206:generateContent?key=${geminiApiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        role: 'user',
                        parts: [
                            {
                                inlineData: {
                                    data: imageBase64,
                                    mimeType: 'image/jpeg'
                                }
                            },
                            {
                                text: `Analyze this screen capture and identify if there's anything I can help with. 
                                
Look for:
1. Code snippets - offer to explain, fix bugs, or provide complete solutions
2. Technical terms (like "encapsulation", "polymorphism") - offer definitions
3. Error messages - offer solutions
4. Questions visible on screen - offer to answer
5. Complex diagrams or concepts - offer to explain

Respond ONLY in this exact JSON format (no markdown, no extra text):
{
    "type": "code|definition|error|question|general",
    "content": "brief description of what you found",
    "suggestion": "short actionable suggestion (max 60 chars)",
    "confidence": 0.0-1.0
}

If nothing actionable found, return:
{
    "type": "general",
    "content": "nothing detected",
    "suggestion": "",
    "confidence": 0
}`
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.4,
                        maxOutputTokens: 500
                    }
                })
            }
        );

        if (!response.ok) {
            throw new Error('AI analysis failed');
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        
        // Clean and parse JSON
        const cleanText = text.replace(/```json|```/g, '').trim();
        const analysis: ScreenAnalysis = JSON.parse(cleanText);
        
        return analysis;
    } catch (error) {
        console.error('AI analysis error:', error);
        return null;
    }
}

// ==================== UI RENDERING ====================
function showSuggestion(analysis: ScreenAnalysis): void {
    if (analysis.confidence < 0.3 || !analysis.suggestion) {
        hideSuggestion();
        return;
    }

    // Don't show duplicate suggestions
    if (analysis.content === lastAnalyzedContent) {
        return;
    }
    lastAnalyzedContent = analysis.content;

    screenAssistOverlay.style.display = 'flex';
    
    const actions: SuggestionAction[] = [];

    switch (analysis.type) {
        case 'code':
            actions.push(
                {
                    label: '📝 Explain Code',
                    action: () => handleAction('explain', analysis)
                },
                {
                    label: '🔧 Fix Issues',
                    action: () => handleAction('fix', analysis)
                },
                {
                    label: '💡 Suggest Improvements',
                    action: () => handleAction('improve', analysis)
                }
            );
            break;
        
        case 'definition':
            actions.push(
                {
                    label: '📖 Define Term',
                    action: () => handleAction('define', analysis)
                },
                {
                    label: '🎓 Explain with Example',
                    action: () => handleAction('explain-example', analysis)
                }
            );
            break;
        
        case 'error':
            actions.push(
                {
                    label: '🔍 Diagnose Error',
                    action: () => handleAction('diagnose', analysis)
                },
                {
                    label: '✅ Provide Solution',
                    action: () => handleAction('solve', analysis)
                }
            );
            break;
        
        case 'question':
            actions.push(
                {
                    label: '💬 Answer Question',
                    action: () => handleAction('answer', analysis)
                },
                {
                    label: '📚 Detailed Explanation',
                    action: () => handleAction('detailed', analysis)
                }
            );
            break;
        
        default:
            hideSuggestion();
            return;
    }

    // Render suggestion UI
    screenAssistSuggestions.innerHTML = `
        <div class="suggestion-card">
            <div class="suggestion-icon">${getIconForType(analysis.type)}</div>
            <div class="suggestion-text">
                <p class="suggestion-title">${analysis.suggestion}</p>
                <p class="suggestion-desc">${analysis.content}</p>
            </div>
            <div class="suggestion-actions">
                ${actions.map(action => `
                    <button class="suggestion-btn" data-action="${action.label}">
                        ${action.label}
                    </button>
                `).join('')}
                <button class="suggestion-dismiss">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;

    // Attach event listeners
    actions.forEach((action, index) => {
        const btn = screenAssistSuggestions.querySelectorAll('.suggestion-btn')[index] as HTMLButtonElement;
        btn?.addEventListener('click', action.action);
    });

    const dismissBtn = screenAssistSuggestions.querySelector('.suggestion-dismiss') as HTMLButtonElement;
    dismissBtn?.addEventListener('click', hideSuggestion);
}

function hideSuggestion(): void {
    screenAssistOverlay.style.display = 'none';
    screenAssistSuggestions.innerHTML = '';
}

function getIconForType(type: string): string {
    const icons = {
        'code': '💻',
        'definition': '📖',
        'error': '❌',
        'question': '❓',
        'general': '💡'
    };
    return icons[type as keyof typeof icons] || '💡';
}

// ==================== ACTION HANDLERS ====================
async function handleAction(actionType: string, analysis: ScreenAnalysis): Promise<void> {
    hideSuggestion();
    
    // Create prompt based on action type
    let prompt = '';
    
    switch (actionType) {
        case 'explain':
            prompt = `I see this code on my screen: "${analysis.content}". Please explain what it does in simple terms.`;
            break;
        case 'fix':
            prompt = `I have this code with potential issues: "${analysis.content}". Please identify and fix any bugs or problems.`;
            break;
        case 'improve':
            prompt = `Here's some code: "${analysis.content}". How can I improve it? Suggest optimizations and best practices.`;
            break;
        case 'define':
            prompt = `I see the term "${analysis.content}" on my screen. Please define it clearly.`;
            break;
        case 'explain-example':
            prompt = `Explain "${analysis.content}" with a practical example.`;
            break;
        case 'diagnose':
            prompt = `I'm seeing this error: "${analysis.content}". What's causing it?`;
            break;
        case 'solve':
            prompt = `I have this error: "${analysis.content}". How do I fix it? Provide a complete solution.`;
            break;
        case 'answer':
            prompt = `I see this question: "${analysis.content}". Please answer it.`;
            break;
        case 'detailed':
            prompt = `Regarding: "${analysis.content}". Please provide a detailed, comprehensive explanation.`;
            break;
    }

    // Send to main chat (trigger message in renderer)
    const event = new CustomEvent('screen-assist-action', {
        detail: { prompt }
    });
    window.dispatchEvent(event);
}

// ==================== SCREEN MONITORING ====================
async function startScreenMonitoring(): Promise<void> {
    if (screenCaptureInterval) return;

    console.log('Starting screen monitoring...');
    
    // Initial capture to get permission
    const initialCapture = await captureScreen();
    
    if (!initialCapture) {
        console.log('Initial capture failed, stopping monitoring');
        return;
    }

    // Analyze initial capture
    const initialAnalysis = await analyzeScreenContent(initialCapture);
    if (initialAnalysis && initialAnalysis.confidence > 0.3) {
        showSuggestion(initialAnalysis);
    }

    // Set up interval for continuous monitoring
    screenCaptureInterval = window.setInterval(async () => {
        if (!isScreenAssistActive) {
            stopScreenMonitoring();
            return;
        }

        const imageBase64 = await captureScreen();
        
        if (!imageBase64) {
            console.log('Capture failed, stopping monitoring');
            stopScreenMonitoring();
            return;
        }

        const analysis = await analyzeScreenContent(imageBase64);
        
        if (analysis && analysis.confidence > 0.3) {
            showSuggestion(analysis);
        }
    }, 8000); // Analyze every 8 seconds
}

function stopScreenMonitoring(): void {
    console.log('Stopping screen monitoring...');
    
    if (screenCaptureInterval) {
        clearInterval(screenCaptureInterval);
        screenCaptureInterval = null;
    }
    
    // Stop the media stream
    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    
    hideSuggestion();
    lastAnalyzedContent = '';
    isScreenAssistActive = false;
    
    // Update button UI
    if (screenAssistButton) {
        screenAssistButton.classList.remove('active-assist');
        screenAssistButton.innerHTML = '<i class="fas fa-eye"></i>';
        screenAssistButton.title = 'Enable Screen Assistant';
    }
}

// ==================== TOGGLE SCREEN ASSIST ====================
export async function toggleScreenAssist(user: User | null, apiKey: string | null): Promise<void> {
    currentUser = user;
    geminiApiKey = apiKey;

    console.log('Toggle screen assist called. Current state:', isScreenAssistActive);
    console.log('User:', currentUser?.email);
    console.log('API Key available:', !!geminiApiKey);

    if (!currentUser || !geminiApiKey) {
        alert('Please sign in and set up your API key first.');
        return;
    }

    // Toggle the state
    isScreenAssistActive = !isScreenAssistActive;

    if (isScreenAssistActive) {
        screenAssistButton.classList.add('active-assist');
        screenAssistButton.innerHTML = '<i class="fas fa-eye-slash"></i>';
        screenAssistButton.title = 'Disable Screen Assistant';
        
        // Show notification
        showToast('Screen Assistant Enabled - Click to allow screen sharing...', 4000);
        
        // Start monitoring
        await startScreenMonitoring();
        
        // Check if monitoring actually started
        if (!screenCaptureInterval) {
            console.log('Monitoring failed to start');
            isScreenAssistActive = false;
            screenAssistButton.classList.remove('active-assist');
            screenAssistButton.innerHTML = '<i class="fas fa-eye"></i>';
            screenAssistButton.title = 'Enable Screen Assistant';
        }
    } else {
        showToast('Screen Assistant Disabled', 2000);
        stopScreenMonitoring();
    }
}

// ==================== UTILITY FUNCTIONS ====================
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

// ==================== INITIALIZATION ====================
export function initializeScreenAssist(): void {
    console.log('Initializing screen assist...');
    
    if (!screenAssistButton) {
        console.error('Screen assist button not found!');
        return;
    }
    
    screenAssistButton.addEventListener('click', async () => {
        console.log('Screen assist button clicked');
        // Get current user and API key from main app
        const event = new CustomEvent('request-screen-assist-toggle');
        window.dispatchEvent(event);
    });

    // Handle cleanup on page unload
    window.addEventListener('beforeunload', () => {
        if (isScreenAssistActive) {
            stopScreenMonitoring();
        }
    });
    
    console.log('Screen assist initialized successfully');
}

// Export for external use
export function isScreenAssistEnabled(): boolean {
    return isScreenAssistActive;
}