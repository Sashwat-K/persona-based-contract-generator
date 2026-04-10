const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const keyManager = require('./crypto/keyManager');
const encryptor = require('./crypto/encryptor');
const signer = require('./crypto/signer');
const keyStorage = require('./crypto/keyStorage');
const contractCli = require('./crypto/contractCli');

const createWindow = () => {
  const isDev = process.env.NODE_ENV === 'development';
  
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Disable web security in development to bypass CORS
      webSecurity: !isDev
    },
    title: 'IBM Confidential Computing Contract Generator',
    icon: path.join(__dirname, '../assets/icon.png'),
    frame: false,  // Remove the default title bar
    titleBarStyle: 'hidden',  // Hide title bar on macOS
    autoHideMenuBar: true  // Hide the menu bar
  });

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
    certPath = await contractCli.saveCertToTempFile(certContent);
    const encrypted = await contractCli.encryptSection(plainText, certPath);
    return encrypted;
  } catch (error) {
    throw new Error(`Contract encryption failed: ${error.message}`);
  } finally {
    if (certPath) {
      await contractCli.cleanupTempFile(certPath);
    }
  }
});

// Streaming encrypt: emits terminal log lines back to renderer via webContents.send
ipcMain.handle('contractCli:encryptSectionStream', async (event, plainText, certContent) => {
  const { spawn } = require('child_process');
  const { promises: fs } = require('fs');
  const path = require('path');
  const os = require('os');

  const send = (type, line) => {
    try { event.sender.send('contractCli:terminalLine', { type, line }); } catch (_) {}
  };

  const ts = Date.now();
  let certPath = null;
  try {
    certPath = path.join(os.tmpdir(), `hpcr-cert-${ts}.pem`);
    await fs.writeFile(certPath, certContent, 'utf8');

    const cliPath = process.env.CONTRACT_CLI_PATH || 'contract-cli';
    send('cmd', `$ ${cliPath} encrypt-string --in - --cert ${certPath}`);

    const child = spawn(cliPath, ['encrypt-string', '--in', '-', '--cert', certPath]);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
      data.toString().split('\n').filter(Boolean).forEach(l => send('stdout', l));
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
      data.toString().split('\n').filter(Boolean).forEach(l => send('stderr', l));
    });

    // contract-cli expects stdin when --in is '-'
    child.stdin.write(plainText);
    child.stdin.end();

    await new Promise((resolve, reject) => {
      child.on('close', (code) => {
        if (code !== 0) reject(new Error(`contract-cli exited with code ${code}: ${stderr}`));
        else resolve();
      });
      child.on('error', reject);
    });

    send('success', 'Encryption complete.');
    send('result', stdout.trim());
    return stdout.trim();
  } catch (error) {
    send('error', `Error: ${error.message}`);
    throw new Error(`Contract encryption failed: ${error.message}`);
  } finally {
    if (certPath) { try { await fs.unlink(certPath); } catch (_) {} }
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
// IPC Handlers - Auditor Operations
// ============================================================================

// Generate signing key pair (RSA-4096), write to folder with passphrase-encrypted private key
ipcMain.handle('auditor:generateSigningKey', async (event, { folderPath, passphrase }) => {
  const { promises: fs } = require('fs');
  const path = require('path');
  const crypto = require('crypto');
  const { promisify } = require('util');
  const generateKeyPair = promisify(crypto.generateKeyPair);

  const send = (type, line) => {
    try { event.sender.send('auditor:terminalLine', { type, line }); } catch (_) {}
  };

  send('cmd', '$ node:crypto  generateKeyPair("rsa", { modulusLength: 4096 })');
  const { publicKey, privateKey } = await generateKeyPair('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: {
      type: 'pkcs8', format: 'pem',
      cipher: 'aes-256-cbc', passphrase
    }
  });

  const pubPath = path.join(folderPath, 'signing-public.pem');
  const privPath = path.join(folderPath, 'signing-private.pem');
  await fs.writeFile(pubPath, publicKey, 'utf8');
  await fs.writeFile(privPath, privateKey, 'utf8');
  send('stdout', 'Written: ' + pubPath);
  send('stdout', 'Written: ' + privPath);
  send('success', 'Signing key pair generated (RSA-4096, private key encrypted with AES-256-CBC).');
  return { publicKey, publicKeyPath: pubPath, privateKeyPath: privPath };
});

// Generate signing certificate (self-signed X.509) via Node forge-style using crypto + asn1
// Uses openssl subprocess for simplicity and correctness
ipcMain.handle('auditor:generateSigningCert', async (event, {
  folderPath, passphrase,
  country, state, locality, organisation, unit, domain, email
}) => {
  const { spawn } = require('child_process');
  const { promises: fs } = require('fs');
  const path = require('path');
  const os = require('os');

  const send = (type, line) => {
    try { event.sender.send('auditor:terminalLine', { type, line }); } catch (_) {}
  };

  const keyPath = path.join(folderPath, 'signing-private.pem');
  const certPath = path.join(folderPath, 'signing-cert.pem');
  const pubPath = path.join(folderPath, 'signing-public.pem');

  const subject = `/C=${country}/ST=${state}/L=${locality}/O=${organisation}/OU=${unit}/CN=${domain}/emailAddress=${email}`;

  // Write passphrase to temp file to avoid shell exposure
  const passFile = path.join(os.tmpdir(), `signing-pass-${Date.now()}.txt`);
  await fs.writeFile(passFile, passphrase, 'utf8');

  const runCmd = (args) => new Promise((resolve, reject) => {
    send('cmd', '$ openssl ' + args.join(' '));
    const child = spawn('openssl', args);
    let stderr = '';
    child.stdout.on('data', d => d.toString().split('\n').filter(Boolean).forEach(l => send('stdout', l)));
    child.stderr.on('data', d => {
      stderr += d.toString();
      d.toString().split('\n').filter(Boolean).forEach(l => send('stdout', l));
    });
    child.on('close', code => code === 0 ? resolve() : reject(new Error('openssl failed: ' + stderr)));
    child.on('error', reject);
  });

  try {
    // Generate encrypted RSA-4096 private key
    await runCmd(['genrsa', '-aes256', '-passout', `file:${passFile}`, '-out', keyPath, '4096']);
    send('success', 'Private key generated.');

    // Generate self-signed certificate (valid 3650 days / 10 years)
    await runCmd([
      'req', '-new', '-x509', '-days', '3650',
      '-key', keyPath, '-passin', `file:${passFile}`,
      '-out', certPath,
      '-subj', subject
    ]);
    send('success', 'Self-signed certificate generated.');

    // Extract public key from cert
    await runCmd(['x509', '-in', certPath, '-noout', '-pubkey', '-out', pubPath]);
    send('success', 'Public key extracted from certificate.');

    // Show cert info
    await runCmd(['x509', '-in', certPath, '-noout', '-subject', '-dates']);

    send('result', 'Signing certificate ready: ' + certPath);

    const certContent = await fs.readFile(certPath, 'utf8');
    const pubContent = await fs.readFile(pubPath, 'utf8');
    return { certificate: certContent, publicKey: pubContent, certPath, keyPath, publicKeyPath: pubPath };
  } finally {
    try { await fs.unlink(passFile); } catch (_) {}
  }
});

// Generate attestation key pair (RSA-4096), write to folder with passphrase
ipcMain.handle('auditor:generateAttestationKey', async (event, { folderPath, passphrase }) => {
  const { promises: fs } = require('fs');
  const path = require('path');
  const crypto = require('crypto');
  const { promisify } = require('util');
  const generateKeyPair = promisify(crypto.generateKeyPair);

  const send = (type, line) => {
    try { event.sender.send('auditor:terminalLine', { type, line }); } catch (_) {}
  };

  send('cmd', '$ node:crypto  generateKeyPair("rsa", { modulusLength: 4096 })  [attestation]');
  const { publicKey, privateKey } = await generateKeyPair('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: {
      type: 'pkcs8', format: 'pem',
      cipher: 'aes-256-cbc', passphrase
    }
  });

  const pubPath = path.join(folderPath, 'attestation-public.pem');
  const privPath = path.join(folderPath, 'attestation-private.pem');
  await fs.writeFile(pubPath, publicKey, 'utf8');
  await fs.writeFile(privPath, privateKey, 'utf8');
  send('stdout', 'Written: ' + pubPath);
  send('stdout', 'Written: ' + privPath);
  send('success', 'Attestation key pair generated (RSA-4096, private key encrypted with AES-256-CBC).');
  return { publicKey, publicKeyPath: pubPath, privateKeyPath: privPath };
});

// Generate encrypted environment artifact only (decrypt env, inject signing key/cert, re-encrypt with HPCR cert)
ipcMain.handle('auditor:generateEncryptedEnv', async (event, {
  encryptedEnvPayload,   // JSON string: {iv, authTag, encrypted}
  wrappedSymmetricKey,   // base64 wrapped AES key
  signingCertContent,    // PEM signing cert/public key to inject into env
  certContent,           // HPCR encryption certificate content
  auditorPrivateKeyPem,  // Auditor identity private key (unencrypted PEM) for unwrapping
}) => {
  const { spawn } = require('child_process');
  const { promises: fs } = require('fs');
  const path = require('path');
  const os = require('os');
  const crypto = require('crypto');

  const send = (type, line) => {
    try { event.sender.send('auditor:terminalLine', { type, line }); } catch (_) {}
  };

  const ts = Date.now();
  const certPath = path.join(os.tmpdir(), `hpcr-cert-${ts}.pem`);
  try {
    // 1) Unwrap AES key
    send('cmd', '$ node:crypto  privateDecrypt({ key, oaepHash: "sha256" }, wrappedKey)  [unwrap AES key]');
    const wrappedKeyBuf = Buffer.from(wrappedSymmetricKey, 'base64');
    const aesKeyBuf = crypto.privateDecrypt(
      { key: auditorPrivateKeyPem, oaepHash: 'sha256', padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
      wrappedKeyBuf
    );
    send('success', 'AES symmetric key unwrapped.');

    // 2) Decrypt environment section
    send('cmd', '$ node:crypto  createDecipheriv("aes-256-gcm", aesKey, iv)  [decrypt env]');
    const envObj = JSON.parse(encryptedEnvPayload);
    const iv = Buffer.from(envObj.iv, 'base64');
    const authTag = Buffer.from(envObj.authTag, 'base64');
    const encryptedBuf = Buffer.from(envObj.encrypted, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKeyBuf, iv);
    decipher.setAuthTag(authTag);
    const plainEnv = Buffer.concat([decipher.update(encryptedBuf), decipher.final()]).toString('utf8');
    send('success', 'Environment section decrypted (' + plainEnv.length + ' bytes).');

    // 3) Inject signing key/certificate into env yaml
    send('cmd', '$ inject signingKey into env YAML');
    const signingKeyBase64 = Buffer.from(signingCertContent).toString('base64');
    const envWithCert = plainEnv.trimEnd() + '\nsigningKey: ' + signingKeyBase64 + '\n';
    send('stdout', 'Injected signingKey into env section.');
    send('stdout', '--- env YAML (debug) ---');
    envWithCert.split('\n').forEach(l => send('stdout', l));
    send('stdout', '--- end env YAML ---');

    // 4) Encrypt env via contract-cli
    await fs.writeFile(certPath, certContent, 'utf8');
    const cliPath = process.env.CONTRACT_CLI_PATH || 'contract-cli';
    send('cmd', `$ ${cliPath} encrypt-string --in - --cert ${certPath}  [env section]`);

    const encryptedEnv = await new Promise((resolve, reject) => {
      const child = spawn(cliPath, ['encrypt-string', '--in', '-', '--cert', certPath]);
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', d => { stdout += d; d.toString().split('\n').filter(Boolean).forEach(l => send('stdout', l)); });
      child.stderr.on('data', d => { stderr += d; d.toString().split('\n').filter(Boolean).forEach(l => send('stderr', l)); });
      child.on('close', code => code === 0 ? resolve(stdout.trim()) : reject(new Error(`contract-cli exited ${code}: ${stderr.trim()}`)));
      child.on('error', reject);
      child.stdin.write(envWithCert);
      child.stdin.end();
    });

    send('success', 'Environment section encrypted with HPCR certificate.');
    send('result', 'Encrypted env artifact ready.');
    return { encryptedEnv };
  } finally {
    try { await fs.unlink(certPath); } catch (_) {}
  }
});

// Encrypt attestation public key only using HPCR certificate
ipcMain.handle('auditor:encryptAttestationPublicKey', async (event, {
  attestationPublicKey,
  certContent,
}) => {
  const { spawn } = require('child_process');
  const { promises: fs } = require('fs');
  const path = require('path');
  const os = require('os');

  const send = (type, line) => {
    try { event.sender.send('auditor:terminalLine', { type, line }); } catch (_) {}
  };

  const ts = Date.now();
  const certPath = path.join(os.tmpdir(), `hpcr-cert-${ts}.pem`);
  try {
    await fs.writeFile(certPath, certContent, 'utf8');
    const cliPath = process.env.CONTRACT_CLI_PATH || 'contract-cli';
    send('cmd', `$ ${cliPath} encrypt-string --in - --cert ${certPath}  [attestation public key]`);

    const encryptedAttestationPubKey = await new Promise((resolve, reject) => {
      const child = spawn(cliPath, ['encrypt-string', '--in', '-', '--cert', certPath]);
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', d => { stdout += d; d.toString().split('\n').filter(Boolean).forEach(l => send('stdout', l)); });
      child.stderr.on('data', d => { stderr += d; d.toString().split('\n').filter(Boolean).forEach(l => send('stderr', l)); });
      child.on('close', code => code === 0 ? resolve(stdout.trim()) : reject(new Error(`contract-cli exited ${code}: ${stderr.trim()}`)));
      child.on('error', reject);
      child.stdin.write(attestationPublicKey);
      child.stdin.end();
    });

    send('success', 'Attestation public key encrypted with HPCR certificate.');
    send('result', 'Encrypted attestation public key ready.');
    return { encryptedAttestationPubKey };
  } finally {
    try { await fs.unlink(certPath); } catch (_) {}
  }
});

// Decrypt env section (unwrap AES key + AES-GCM decrypt), inject signing cert,
// then contract-cli encrypt env + attestation pubkey (streaming terminal output)
ipcMain.handle('auditor:encryptEnvAndAttestation', async (event, {
  encryptedEnvPayload,   // JSON string: {iv, authTag, encrypted}
  wrappedSymmetricKey,   // base64 wrapped AES key
  signingCertContent,    // PEM signing cert to inject into env
  attestationPublicKey,  // PEM attestation public key to encrypt
  certContent,           // HPCR encryption certificate content
  auditorPrivateKeyPem   // Auditor's identity private key (unencrypted PEM) for unwrapping
}) => {
  const { spawn } = require('child_process');
  const { promises: fs } = require('fs');
  const path = require('path');
  const os = require('os');
  const crypto = require('crypto');

  const send = (type, line) => {
    try { event.sender.send('auditor:terminalLine', { type, line }); } catch (_) {}
  };

  const ts = Date.now();
  const tmpFiles = [];
  const tmp = (name) => { const p = path.join(os.tmpdir(), `hpcr-${name}-${ts}`); tmpFiles.push(p); return p; };

  try {
    // 1. Unwrap AES symmetric key using Auditor's identity private key (RSA-OAEP)
    send('cmd', '$ node:crypto  privateDecrypt({ key, oaepHash: "sha256" }, wrappedKey)  [unwrap AES key]');
    const wrappedKeyBuf = Buffer.from(wrappedSymmetricKey, 'base64');
    const aesKeyBuf = crypto.privateDecrypt(
      { key: auditorPrivateKeyPem, oaepHash: 'sha256', padding: crypto.constants.RSA_PKCS1_OAEP_PADDING },
      wrappedKeyBuf
    );
    send('success', 'AES symmetric key unwrapped.');

    // 2. AES-256-GCM decrypt the environment section
    send('cmd', '$ node:crypto  createDecipheriv("aes-256-gcm", aesKey, iv)  [decrypt env]');
    const envObj = JSON.parse(encryptedEnvPayload);
    const iv = Buffer.from(envObj.iv, 'base64');
    const authTag = Buffer.from(envObj.authTag, 'base64');
    const encryptedBuf = Buffer.from(envObj.encrypted, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', aesKeyBuf, iv);
    decipher.setAuthTag(authTag);
    const plainEnv = Buffer.concat([decipher.update(encryptedBuf), decipher.final()]).toString('utf8');
    send('success', 'Environment section decrypted (' + plainEnv.length + ' bytes).');

    // 3. Inject signingKey into environment YAML as a root-level base64 value
    send('cmd', '$ inject signingKey into env YAML');
    const signingKeyBase64 = Buffer.from(signingCertContent).toString('base64');
    const envWithCert = plainEnv.trimEnd() + '\nsigningKey: ' + signingKeyBase64 + '\n';
    send('stdout', 'Injected signingKey into env section.');
    send('stdout', '--- env YAML (debug) ---');
    envWithCert.split('\n').forEach(l => send('stdout', l));
    send('stdout', '--- end env YAML ---');

    // 4. Encrypt env + attestation pubkey via contract-cli using stdin (--in -)
    const certPath = tmp('hpcr.pem');
    await fs.writeFile(certPath, certContent, 'utf8');

    const cliPath = process.env.CONTRACT_CLI_PATH || 'contract-cli';

    const runCli = (content, label) => new Promise((resolve, reject) => {
      send('cmd', `$ ${cliPath} encrypt-string --in - --cert ${certPath}  [${label}]`);
      const child = spawn(cliPath, ['encrypt-string', '--in', '-', '--cert', certPath]);
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', d => { stdout += d; d.toString().split('\n').filter(Boolean).forEach(l => send('stdout', l)); });
      child.stderr.on('data', d => { stderr += d; d.toString().split('\n').filter(Boolean).forEach(l => send('stderr', l)); });
      child.on('close', code => code === 0 ? resolve(stdout.trim()) : reject(new Error(`contract-cli exited ${code}: ${stderr.trim()}`)));
      child.on('error', reject);
      child.stdin.write(content);
      child.stdin.end();
    });

    const encryptedEnv = await runCli(envWithCert, 'env section');
    send('success', 'Environment section encrypted with HPCR certificate.');

    const encryptedAttestationPubKey = await runCli(attestationPublicKey, 'attestation public key');
    send('success', 'Attestation public key encrypted with HPCR certificate.');

    send('result', 'Both artifacts ready for contract assembly.');
    return { encryptedEnv, encryptedAttestationPubKey };
  } finally {
    for (const f of tmpFiles) { try { await fs.unlink(f); } catch (_) {} }
  }
});

// Sign contract YAML (workload + env) using contract-cli sign-contract
// Produces the envWorkloadSignature value for the final contract
ipcMain.handle('auditor:signContract', async (event, {
  contractYaml,       // workload + env YAML string to sign
  signingKeyPath,     // path to encrypted RSA private key PEM
  signingPassphrase,  // passphrase to decrypt the private key
}) => {
  const { spawn } = require('child_process');

  const send = (type, line) => {
    try { event.sender.send('auditor:terminalLine', { type, line }); } catch (_) {}
  };

  const cliPath = process.env.CONTRACT_CLI_PATH || 'contract-cli';
  send('cmd', `$ cat contract.yaml | ${cliPath} sign-contract --in - --password <passphrase> --priv ${signingKeyPath}`);

  return new Promise((resolve, reject) => {
    const child = spawn(cliPath, [
      'sign-contract',
      '--in', '-',
      '--password', signingPassphrase,
      '--priv', signingKeyPath,
    ]);

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', d => { stdout += d; d.toString().split('\n').filter(Boolean).forEach(l => send('stdout', l)); });
    child.stderr.on('data', d => { stderr += d; d.toString().split('\n').filter(Boolean).forEach(l => send('stderr', l)); });
    child.on('close', code => {
      if (code === 0) {
        send('success', 'Contract signed successfully.');
        resolve(stdout.trim());
      } else {
        reject(new Error(`contract-cli sign-contract exited ${code}: ${stderr.trim()}`));
      }
    });
    child.on('error', reject);
    child.stdin.write(contractYaml);
    child.stdin.end();
  });
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
