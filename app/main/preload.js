const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  // Shell operations
  shell: {
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url)
  },
  
  // Crypto operations
  crypto: {
    generateIdentityKeyPair: () =>
      ipcRenderer.invoke('crypto:generateIdentityKeyPair'),
    
    generateAttestationKeyPair: () =>
      ipcRenderer.invoke('crypto:generateAttestationKeyPair'),
    
    generateSymmetricKey: () =>
      ipcRenderer.invoke('crypto:generateSymmetricKey'),
    
    computeFingerprint: (publicKeyPem) =>
      ipcRenderer.invoke('crypto:computeFingerprint', publicKeyPem),
    
    encryptWithSymmetricKey: (data, key) =>
      ipcRenderer.invoke('crypto:encryptWithSymmetricKey', data, key),
    
    decryptWithSymmetricKey: (encrypted, key) =>
      ipcRenderer.invoke('crypto:decryptWithSymmetricKey', encrypted, key),
    
    wrapSymmetricKey: (symmetricKey, recipientPublicKey) =>
      ipcRenderer.invoke('crypto:wrapSymmetricKey', symmetricKey, recipientPublicKey),
    
    unwrapSymmetricKey: (wrappedKey, privateKey) =>
      ipcRenderer.invoke('crypto:unwrapSymmetricKey', wrappedKey, privateKey),
    
    hash: (data) =>
      ipcRenderer.invoke('crypto:hash', data),
    
    hashFile: (filePath) =>
      ipcRenderer.invoke('crypto:hashFile', filePath),
    
    sign: (hash, privateKey) =>
      ipcRenderer.invoke('crypto:sign', hash, privateKey),
    
    verify: (hash, signature, publicKey) =>
      ipcRenderer.invoke('crypto:verify', hash, signature, publicKey),
    
    storePrivateKey: (userId, key) =>
      ipcRenderer.invoke('crypto:storePrivateKey', userId, key),
    
    getPrivateKey: (userId) =>
      ipcRenderer.invoke('crypto:getPrivateKey', userId),
    
    deletePrivateKey: (userId) =>
      ipcRenderer.invoke('crypto:deletePrivateKey', userId),
    
    hasPrivateKey: (userId) =>
      ipcRenderer.invoke('crypto:hasPrivateKey', userId)
  },
  
  // contract-cli operations
  contractCli: {
    encryptSection: (plainText, certContent) =>
      ipcRenderer.invoke('contractCli:encryptSection', plainText, certContent),
    
    assembleContract: (sections) =>
      ipcRenderer.invoke('contractCli:assembleContract', sections)
  },
  
  // File operations
  file: {
    selectFile: (options) =>
      ipcRenderer.invoke('file:selectFile', options),
    
    saveFile: (defaultPath, content) =>
      ipcRenderer.invoke('file:saveFile', defaultPath, content),
    
    readFile: (path) =>
      ipcRenderer.invoke('file:readFile', path)
  },
  
  // Directory selection
  selectDirectory: () =>
    ipcRenderer.invoke('file:selectDirectory'),
  
  // Window controls
  minimizeWindow: () =>
    ipcRenderer.invoke('window:minimize'),
  
  maximizeWindow: () =>
    ipcRenderer.invoke('window:maximize'),
  
  closeWindow: () =>
    ipcRenderer.invoke('window:close')
});
