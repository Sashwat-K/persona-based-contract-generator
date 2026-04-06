export const mockCryptoAction = async (actionName, setLog) => {
  setLog(prev => [...prev, `[INIT] Starting: ${actionName}`]);
  await new Promise(r => setTimeout(r, 600));
  setLog(prev => [...prev, `[PROCESS] Generating SHA-256 hash formatting...`]);
  await new Promise(r => setTimeout(r, 800));
  setLog(prev => [...prev, `[CRYPTO] Signing hash with registered local private key (RSA-PSS)...`]);
  await new Promise(r => setTimeout(r, 1000));
  setLog(prev => [...prev, `[SUCCESS] Signature payload generated. Transmitting to backend...`]);
  await new Promise(r => setTimeout(r, 500));
};
