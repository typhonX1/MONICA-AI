// src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// Node.js APIs. The contextBridge module is used to safely expose
// a limited set of IPC methods to the renderer process.
contextBridge.exposeInMainWorld('electronAPI', {
  // IPC methods you already had
  setApiKey: (apiKey: string) => ipcRenderer.send('set-api-key', apiKey),
  sendMessage: (message: string, apiKey: string) => ipcRenderer.send('send-message', message, apiKey),
  onApiKeyReceived: (callback: (success: boolean) => void) => ipcRenderer.on('api-key-received', (event, success) => callback(success)),
  onMessageProcessed: (callback: (data: { success: boolean }) => void) => ipcRenderer.on('message-processed', (event, data) => callback(data)),

  // New method for microphone access - combined into the same object
  getMicrophoneAccess: async () => {
    // This call will prompt the user for microphone access if not already granted.
    // The renderer process calls this method via electronAPI.getMicrophoneAccess()
    return await navigator.mediaDevices.getUserMedia({ audio: true });
  }
});