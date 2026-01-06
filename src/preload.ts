// src/preload.ts
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  setApiKey: (apiKey: string) => ipcRenderer.send('set-api-key', apiKey),
  sendMessage: (message: string, apiKey: string) => ipcRenderer.send('send-message', message, apiKey),
  onApiKeyReceived: (callback: (success: boolean) => void) => 
    ipcRenderer.on('api-key-received', (event: Electron.IpcRendererEvent, success: boolean) => callback(success)),
  onMessageProcessed: (callback: (data: { success: boolean }) => void) => 
    ipcRenderer.on('message-processed', (event: Electron.IpcRendererEvent, data: { success: boolean }) => callback(data))
});