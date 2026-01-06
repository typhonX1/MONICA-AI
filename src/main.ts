import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Define __filename and __dirname for ES Module context
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;

const createWindow = async (): Promise<void> => {
  mainWindow = new BrowserWindow({
    height: 720,
    width: 1080,
    minHeight: 600,
    minWidth: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
  });

  // Determine the correct path to index.html
  let indexPath: string;
  
  if (app.isPackaged) {
    indexPath = path.join(__dirname, '..', 'index.html');
  } else {
    indexPath = path.join(__dirname, '..', 'index.html');
  }

  console.log('__dirname:', __dirname);
  console.log('Loading index.html from:', indexPath);

  try {
    await mainWindow.loadFile(indexPath);
    console.log('Successfully loaded:', mainWindow.webContents.getURL());
  } catch (error) {
    console.error('Failed to load index.html:', error);
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', validatedURL, errorDescription);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Successfully loaded:', mainWindow?.webContents.getURL());
  });
  
  mainWindow.webContents.openDevTools();
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});