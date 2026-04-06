const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const keyManager = require('./crypto/keyManager');
const encryptor = require('./crypto/encryptor');
const signer = require('./crypto/signer');
const keyStorage = require('./crypto/keyStorage');
const contractCli = require('./crypto/contractCli');

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    title: 'IBM Confidential Computing Contract Generator',
    icon: path.join(__dirname, '../assets/icon.png'),
    frame: false,  // Remove the default title bar
    titleBarStyle: 'hidden',  // Hide title bar on macOS
    autoHideMenuBar: true  // Hide the menu bar
  });

  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Clear session data when window is closed
  win.on('close', () => {
    // Clear all session data
    win.webContents.session.clearStorageData({
      storages: ['localstorage', 'sessionstorage', 'cookies']
    }).catch(err => {
      console.error('Failed to clear storage:', err);
    });
  });

  return win;
};

// ============================================================================
// IPC Handlers - Crypto Operations
// ============================================================================

// Key Generation
ipcMain.handle('crypto:generateIdentityKeyPair', async () => {
  try {
    return await keyManager.generateIdentityKeyPair();
  } catch (error) {
    throw new Error(`Key generation failed: ${error.message}`);
  }
});

ipcMain.handle('crypto:generateAttestationKeyPair', async () => {
  try {
    return await keyManager.generateAttestationKeyPair();
  } catch (error) {
    throw new Error(`Attestation key generation failed: ${error.message}`);
  }
});

ipcMain.handle('crypto:generateSymmetricKey', () => {
  try {
    return keyManager.generateSymmetricKey().toString('base64');
  } catch (error) {
    throw new Error(`Symmetric key generation failed: ${error.message}`);
  }
});

ipcMain.handle('crypto:computeFingerprint', (event, publicKeyPem) => {
  try {
    return keyManager.computeFingerprint(publicKeyPem);
  } catch (error) {
    throw new Error(`Fingerprint computation failed: ${error.message}`);
  }
});

// Encryption/Decryption
ipcMain.handle('crypto:encryptWithSymmetricKey', async (event, data, keyBase64) => {
  try {
    const key = Buffer.from(keyBase64, 'base64');
    return encryptor.encryptWithSymmetricKey(data, key);
  } catch (error) {
    throw new Error(`Encryption failed: ${error.message}`);
  }
});

ipcMain.handle('crypto:decryptWithSymmetricKey', async (event, encrypted, keyBase64) => {
  try {
    const key = Buffer.from(keyBase64, 'base64');
    return encryptor.decryptWithSymmetricKey(encrypted, key);
  } catch (error) {
    throw new Error(`Decryption failed: ${error.message}`);
  }
});

// Key Wrapping
ipcMain.handle('crypto:wrapSymmetricKey', async (event, keyBase64, publicKeyPem) => {
  try {
    const key = Buffer.from(keyBase64, 'base64');
    return encryptor.wrapSymmetricKey(key, publicKeyPem);
  } catch (error) {
    throw new Error(`Key wrapping failed: ${error.message}`);
  }
});

ipcMain.handle('crypto:unwrapSymmetricKey', async (event, wrappedKey, privateKeyPem) => {
  try {
    const unwrapped = encryptor.unwrapSymmetricKey(wrappedKey, privateKeyPem);
    return unwrapped.toString('base64');
  } catch (error) {
    throw new Error(`Key unwrapping failed: ${error.message}`);
  }
});

// Hashing and Signing
ipcMain.handle('crypto:hash', (event, data) => {
  try {
    return signer.hash(data);
  } catch (error) {
    throw new Error(`Hashing failed: ${error.message}`);
  }
});

ipcMain.handle('crypto:hashFile', async (event, filePath) => {
  try {
    return await signer.hashFile(filePath);
  } catch (error) {
    throw new Error(`File hashing failed: ${error.message}`);
  }
});

ipcMain.handle('crypto:sign', (event, hash, privateKeyPem) => {
  try {
    return signer.sign(hash, privateKeyPem);
  } catch (error) {
    throw new Error(`Signing failed: ${error.message}`);
  }
});

ipcMain.handle('crypto:verify', (event, hash, signature, publicKeyPem) => {
  try {
    return signer.verify(hash, signature, publicKeyPem);
  } catch (error) {
    throw new Error(`Signature verification failed: ${error.message}`);
  }
});

// Key Storage
ipcMain.handle('crypto:storePrivateKey', async (event, userId, privateKeyPem) => {
  try {
    await keyStorage.storePrivateKey(userId, privateKeyPem);
    return { success: true };
  } catch (error) {
    throw new Error(`Key storage failed: ${error.message}`);
  }
});

ipcMain.handle('crypto:getPrivateKey', async (event, userId) => {
  try {
    return await keyStorage.getPrivateKey(userId);
  } catch (error) {
    throw new Error(`Key retrieval failed: ${error.message}`);
  }
});

ipcMain.handle('crypto:deletePrivateKey', async (event, userId) => {
  try {
    await keyStorage.deletePrivateKey(userId);
    return { success: true };
  } catch (error) {
    throw new Error(`Key deletion failed: ${error.message}`);
  }
});

ipcMain.handle('crypto:hasPrivateKey', async (event, userId) => {
  try {
    return await keyStorage.hasPrivateKey(userId);
  } catch (error) {
    return false;
  }
});

// ============================================================================
// IPC Handlers - contract-cli Operations
// ============================================================================

ipcMain.handle('contractCli:encryptSection', async (event, plainText, certContent) => {
  let certPath = null;
  try {
    // Save cert to temp file
    certPath = await contractCli.saveCertToTempFile(certContent);
    
    // Encrypt section
    const encrypted = await contractCli.encryptSection(plainText, certPath);
    
    return encrypted;
  } catch (error) {
    throw new Error(`Contract encryption failed: ${error.message}`);
  } finally {
    // Cleanup temp file
    if (certPath) {
      await contractCli.cleanupTempFile(certPath);
    }
  }
});

ipcMain.handle('contractCli:assembleContract', async (event, sections) => {
  try {
    return contractCli.assembleContract(sections);
  } catch (error) {
    throw new Error(`Contract assembly failed: ${error.message}`);
  }
});

// ============================================================================
// IPC Handlers - Shell Operations
// ============================================================================

ipcMain.handle('shell:openExternal', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    throw new Error(`Failed to open external link: ${error.message}`);
  }
});

// ============================================================================
// IPC Handlers - Window Controls
// ============================================================================

ipcMain.handle('window:minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.minimize();
});

ipcMain.handle('window:maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.handle('window:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.close();
});

// ============================================================================
// IPC Handlers - File Operations
// ============================================================================

ipcMain.handle('file:selectFile', async (event, options) => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: options.filters || []
    });
    
    if (result.canceled) {
      return null;
    }
    
    const fs = require('fs').promises;
    const filePath = result.filePaths[0];
    const content = await fs.readFile(filePath, 'utf8');
    const stats = await fs.stat(filePath);
    
    return {
      path: filePath,
      name: path.basename(filePath),
      content,
      size: stats.size
    };
  } catch (error) {
    throw new Error(`File selection failed: ${error.message}`);
  }
});

ipcMain.handle('file:saveFile', async (event, defaultPath, content) => {
  try {
    const result = await dialog.showSaveDialog({
      defaultPath,
      filters: [
        { name: 'YAML Files', extensions: ['yaml', 'yml'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });
    
    if (result.canceled) {
      return null;
    }
    
    const fs = require('fs').promises;
    await fs.writeFile(result.filePath, content, 'utf8');
    
    return result.filePath;
  } catch (error) {
    throw new Error(`File save failed: ${error.message}`);
  }
});

ipcMain.handle('file:readFile', async (event, filePath) => {
  try {
    const fs = require('fs').promises;
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    throw new Error(`File read failed: ${error.message}`);
  }
});

ipcMain.handle('file:selectDirectory', async (event) => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory']
    });
    
    if (result.canceled) {
      return null;
    }
    
    return result.filePaths[0];
  } catch (error) {
    throw new Error(`Directory selection failed: ${error.message}`);
  }
});

// ============================================================================
// App Lifecycle
// ============================================================================

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // Clear all sessions before quitting
  const { session } = require('electron');
  session.defaultSession.clearStorageData({
    storages: ['localstorage', 'sessionstorage', 'cookies', 'indexdb']
  }).then(() => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  }).catch(err => {
    console.error('Failed to clear storage on quit:', err);
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
});

// Handle app quit
app.on('before-quit', () => {
  // Additional cleanup if needed
  console.log('App is quitting, clearing all session data...');
});
