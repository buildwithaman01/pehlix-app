import crypto from 'crypto';

// Use a fallback key for development only, throw in production
const getMasterKey = () => {
  const keyHex = process.env.DATABASE_ENCRYPTION_KEY;
  if (!keyHex) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_ENCRYPTION_KEY environment variable is required in production.');
    }
    // Fallback 32-byte key for local development (64 hex characters)
    return Buffer.from('8f4a2d8e9c0b1a3f5e7d6c8b9a0f2e1d4c3b5a7e9f0d1c2b3a4f5e6d7c8b9a0f', 'hex');
  }
  
  if (keyHex.length !== 64) {
    throw new Error('DATABASE_ENCRYPTION_KEY must be exactly a 64-character hex string (32 bytes).');
  }
  
  return Buffer.from(keyHex, 'hex');
};

/**
 * Encrypts a plaintext string using envelope encryption (AES-256-GCM).
 * Returns a formatted string prefixed with "__enc__:" and base64 encoded payload.
 */
export function encryptField(plaintext) {
  if (plaintext === null || plaintext === undefined) return plaintext;
  const plaintextStr = String(plaintext);
  
  const masterKey = getMasterKey();
  
  // 1. Generate a random 32-byte Data Encryption Key (DEK)
  const dek = crypto.randomBytes(32);
  
  // 2. Encrypt the plaintext using GCM
  const dataIv = crypto.randomBytes(12);
  const dataCipher = crypto.createCipheriv('aes-256-gcm', dek, dataIv);
  let ciphertext = dataCipher.update(plaintextStr, 'utf8', 'base64');
  ciphertext += dataCipher.final('base64');
  const dataAuthTag = dataCipher.getAuthTag().toString('base64');
  
  // 3. Encrypt the DEK using the Master Key
  const dekIv = crypto.randomBytes(12);
  const dekCipher = crypto.createCipheriv('aes-256-gcm', masterKey, dekIv);
  let encryptedDekBuf = dekCipher.update(dek);
  encryptedDekBuf = Buffer.concat([encryptedDekBuf, dekCipher.final()]);
  const dekAuthTag = dekCipher.getAuthTag().toString('base64');
  
  // 4. Bundle into payload
  const payload = {
    encryptedDek: encryptedDekBuf.toString('base64'),
    dekAuthTag: dekAuthTag,
    dekIv: dekIv.toString('base64'),
    ciphertext,
    authTag: dataAuthTag,
    iv: dataIv.toString('base64')
  };
  
  const serialized = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `__enc__:${serialized}`;
}

/**
 * Decrypts a formatted string that was encrypted using envelope encryption.
 * If the string does not start with "__enc__:", returns it as-is (backward compatible).
 */
export function decryptField(encryptedString) {
  if (!encryptedString || typeof encryptedString !== 'string' || !encryptedString.startsWith('__enc__:')) {
    return encryptedString;
  }
  
  try {
    const masterKey = getMasterKey();
    const serialized = encryptedString.substring(8); // Strip "__enc__:"
    const payload = JSON.parse(Buffer.from(serialized, 'base64').toString('utf8'));
    
    const { encryptedDek, dekAuthTag, dekIv, ciphertext, authTag, iv } = payload;
    
    // 1. Decrypt the DEK using Master Key
    const dekDecipher = crypto.createDecipheriv(
      'aes-256-gcm',
      masterKey,
      Buffer.from(dekIv, 'base64')
    );
    dekDecipher.setAuthTag(Buffer.from(dekAuthTag, 'base64'));
    let decryptedDek = dekDecipher.update(Buffer.from(encryptedDek, 'base64'));
    decryptedDek = Buffer.concat([decryptedDek, dekDecipher.final()]);
    const dek = decryptedDek;
    
    // 2. Decrypt the data using the DEK
    const dataDecipher = crypto.createDecipheriv(
      'aes-256-gcm',
      dek,
      Buffer.from(iv, 'base64')
    );
    dataDecipher.setAuthTag(Buffer.from(authTag, 'base64'));
    let plaintext = dataDecipher.update(Buffer.from(ciphertext, 'base64'), null, 'utf8');
    plaintext += dataDecipher.final('utf8');
    
    return plaintext;
  } catch (error) {
    console.error('[CryptoService] Failed to decrypt field:', error.message);
    // If decryption fails, return original string as fallback to prevent app crashes
    return encryptedString;
  }
}

/**
 * Rotates the Master Key for an encrypted payload.
 */
export function rotateMasterKey(encryptedString, oldMasterKeyHex, newMasterKeyHex) {
  if (!encryptedString || typeof encryptedString !== 'string' || !encryptedString.startsWith('__enc__:')) {
    return encryptedString;
  }
  
  const oldMasterKey = Buffer.from(oldMasterKeyHex, 'hex');
  const newMasterKey = Buffer.from(newMasterKeyHex, 'hex');
  
  const serialized = encryptedString.substring(8);
  const payload = JSON.parse(Buffer.from(serialized, 'base64').toString('utf8'));
  const { encryptedDek, dekAuthTag, dekIv, ciphertext, authTag, iv } = payload;
  
  // 1. Decrypt DEK with old master key
  const dekDecipher = crypto.createDecipheriv(
    'aes-256-gcm',
    oldMasterKey,
    Buffer.from(dekIv, 'base64')
  );
  dekDecipher.setAuthTag(Buffer.from(dekAuthTag, 'base64'));
  let decryptedDek = dekDecipher.update(Buffer.from(encryptedDek, 'base64'));
  decryptedDek = Buffer.concat([decryptedDek, dekDecipher.final()]);
  const dek = decryptedDek;
  
  // 2. Re-encrypt DEK with new master key
  const newDekIv = crypto.randomBytes(12);
  const newDekCipher = crypto.createCipheriv('aes-256-gcm', newMasterKey, newDekIv);
  let newEncryptedDekBuf = newDekCipher.update(dek);
  newEncryptedDekBuf = Buffer.concat([newEncryptedDekBuf, newDekCipher.final()]);
  const newDekAuthTag = newDekCipher.getAuthTag().toString('base64');
  
  // 3. Rebuild payload
  const newPayload = {
    encryptedDek: newEncryptedDekBuf.toString('base64'),
    dekAuthTag: newDekAuthTag,
    dekIv: newDekIv.toString('base64'),
    ciphertext,
    authTag,
    iv
  };
  
  const newSerialized = Buffer.from(JSON.stringify(newPayload)).toString('base64');
  return `__enc__:${newSerialized}`;
}

/**
 * Calculates a secure blind index (HMAC-SHA256) of a value for exact-match database queries.
 */
export function calculateBlindIndex(value, type = 'phone') {
  if (!value) return value;
  let cleanValue = String(value).trim();
  
  if (type === 'phone') {
    cleanValue = cleanValue.replace(/\D/g, '');
    if (cleanValue.length > 10) {
      cleanValue = cleanValue.slice(-10);
    }
  } else if (type === 'email') {
    cleanValue = cleanValue.toLowerCase();
  }
  
  const masterKey = getMasterKey();
  return crypto.createHmac('sha256', masterKey).update(cleanValue).digest('hex');
}

