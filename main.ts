import { app, BrowserWindow, ipcMain, IpcMainEvent } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url'; // <--- ADD THIS
import { dirname } from 'path';     // <--- ADD THIS

// Manually define __filename and __dirname for ES Module context
const __filename = fileURLToPath(import.meta.url); // <--- ADD THIS
const __dirname = dirname(__filename);             // <--- ADD THIS

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
//if (require('electron-squirrel-startup')) {
// app.quit();
//}

let mainWindow: BrowserWindow | null;

const createWindow = (): void => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    height: 720,
    width: 1080,
    minHeight: 600,
    minWidth: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Path to our preload script
      nodeIntegration: false, // Is default value, but good to be explicit
      contextIsolation: true, // Is default value, but good to be explicit
      webSecurity: false // IMPORTANT: Disable for local development if you encounter CORS issues with API calls. Re-enable for production.
    },
  });

  // Load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, '../src/index.html'));

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// IPC Main listener for handling API key submission (though we'll primarily handle it in renderer for simplicity)
ipcMain.on('set-api-key', (event: IpcMainEvent, apiKey: string) => {
  console.log('API Key received in main process:', apiKey ? '****' + apiKey.slice(-4) : 'No key');
  // In a real app, you might validate or store this more securely.
  // For this example, the renderer will manage the API key directly for LLM calls.
  event.reply('api-key-received', true);
});

// IPC Main listener for handling chat messages
ipcMain.on('send-message', async (event: IpcMainEvent, message: string, apiKey: string) => {
  console.log('Message received in main process:', message);
  // This is where you would typically make the LLM API call.
  // For this example, we'll make the LLM call directly in the renderer process
  // to simplify the IPC communication for the API key.
  // However, if you wanted to keep the API key more secure, you'd make the call here.
  // The renderer will handle the LLM call for now.
  event.reply('message-processed', { success: true });
});