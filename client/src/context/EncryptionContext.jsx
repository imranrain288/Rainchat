import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from './AuthContext';

const EncryptionContext = createContext(null);
const DATABASE_NAME = 'rainchat-encryption';
const DATABASE_VERSION = 1;
const KEY_STORE = 'identities';

const toBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
};

const fromBase64 = (value) => {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const openKeyDatabase = () => new Promise((resolve, reject) => {
  if (!globalThis.indexedDB) {
    reject(new Error('This browser does not support secure local key storage.'));
    return;
  }
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => request.result.createObjectStore(KEY_STORE);
  request.onerror = () => reject(request.error || new Error('Could not open encryption key storage.'));
  request.onsuccess = () => resolve(request.result);
});

const readIdentity = async (userId) => {
  const database = await openKeyDatabase();
  const result = await new Promise((resolve, reject) => {
    const transaction = database.transaction(KEY_STORE, 'readonly');
    const request = transaction.objectStore(KEY_STORE).get(userId);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Could not read the local encryption key.'));
  });
  database.close();
  return result;
};

const writeIdentity = async (userId, identity) => {
  const database = await openKeyDatabase();
  try {
    await new Promise((resolve, reject) => {
    const transaction = database.transaction(KEY_STORE, 'readwrite');
    transaction.objectStore(KEY_STORE).add(identity, userId);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error || new Error('Could not save the local encryption key.'));
    transaction.onabort = () => reject(transaction.error || new Error('Could not save the local encryption key.'));
    });
  } catch (error) {
    database.close();
    const existingIdentity = await readIdentity(userId);
    if (existingIdentity) return existingIdentity;
    throw error;
  }
  database.close();
  return identity;
};

const createIdentity = async () => {
  const generated = await crypto.subtle.generateKey({
    name: 'RSA-OAEP',
    modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]),
    hash: 'SHA-256',
  }, true, ['encrypt', 'decrypt']);
  const publicKey = toBase64(await crypto.subtle.exportKey('spki', generated.publicKey));
  const privateJwk = await crypto.subtle.exportKey('jwk', generated.privateKey);
  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['decrypt'],
  );
  return { publicKey, privateKey };
};

export const EncryptionProvider = ({ children }) => {
  const { user } = useAuth();
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [identity, setIdentity] = useState(null);

  const resetEncryptionIdentity = useCallback(async () => {
    if (!user?._id) throw new Error('Sign in before resetting encryption.');

    setStatus('loading');
    setError('');
    try {
      const localIdentity = await readIdentity(user._id);
      const nextIdentity = localIdentity || await createIdentity();
      const savedIdentity = localIdentity || await writeIdentity(user._id, nextIdentity);
      await api.resetEncryptionKey(savedIdentity.publicKey);
      if (user?._id) {
        setIdentity({ ...savedIdentity, userId: user._id });
        setStatus('ready');
      }
    } catch (resetError) {
      setStatus('error');
      throw resetError;
    }
  }, [user?._id]);

  useEffect(() => {
    let active = true;
    setIdentity(null);
    setError('');
    if (!user?._id) {
      setStatus('disabled');
      return () => { active = false; };
    }

    setStatus('loading');
    const initializeIdentity = async () => {
      try {
        if (!globalThis.crypto?.subtle) throw new Error('Web Crypto is unavailable. Open RainChat over HTTPS or localhost.');
        const [serverIdentity, localIdentity] = await Promise.all([
          api.getEncryptionKey(),
          readIdentity(user._id),
        ]);

        if (localIdentity) {
          if (serverIdentity.publicKey && serverIdentity.publicKey !== localIdentity.publicKey) {
            throw new Error('This browser key does not match the account key. Messages are locked to the device holding the original key.');
          }
          if (!serverIdentity.publicKey) await api.registerEncryptionKey(localIdentity.publicKey);
          if (active) {
            setIdentity({ ...localIdentity, userId: user._id });
            setStatus('ready');
          }
          return;
        }

        if (serverIdentity.publicKey) {
          throw new Error('This account already has an encryption key on another device. Sign in from the device that created it; key recovery is not configured.');
        }

        const generatedIdentity = await createIdentity();
        const newIdentity = await writeIdentity(user._id, generatedIdentity);
        await api.registerEncryptionKey(newIdentity.publicKey);
        if (active) {
          setIdentity({ ...newIdentity, userId: user._id });
          setStatus('ready');
        }
      } catch (initializationError) {
        if (active) {
          setError(initializationError.message || 'Could not initialize end-to-end encryption.');
          setStatus('error');
        }
      }
    };
    initializeIdentity();
    return () => { active = false; };
  }, [user?._id]);

  const encryptContent = useCallback(async (content, recipients = [], attachmentName = '') => {
    if (status !== 'ready' || !identity || identity.userId !== user?._id) {
      throw new Error(error || 'End-to-end encryption is not ready on this device.');
    }
    const recipientMap = new Map([[user._id, { userId: user._id, encryptionPublicKey: identity.publicKey }]]);
    recipients.forEach((recipient) => {
      if (!recipient?._id || String(recipient._id) === user._id) return;
      if (!recipient.encryptionPublicKey) {
        throw new Error(`End-to-end encryption is not set up for ${recipient.fullName || 'a group member'}. Ask them to sign in and retry.`);
      }
      recipientMap.set(String(recipient._id), {
        userId: String(recipient._id),
        encryptionPublicKey: recipient.encryptionPublicKey,
      });
    });
    const recipientEntries = [...recipientMap.values()];
    if (recipientEntries.length < 2) throw new Error('A chat participant has no encryption key yet. Ask them to sign in and retry.');

    const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      new TextEncoder().encode(JSON.stringify({ payloadVersion: 1, content, attachmentName })),
    );
    const rawAesKey = await crypto.subtle.exportKey('raw', aesKey);
    const keys = await Promise.all(recipientEntries.map(async (recipient) => {
      const publicKey = await crypto.subtle.importKey(
        'spki',
        fromBase64(recipient.encryptionPublicKey),
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        false,
        ['encrypt'],
      );
      const wrappedKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawAesKey);
      return { userId: recipient.userId, wrappedKey: toBase64(wrappedKey) };
    }));

    return {
      content: toBase64(ciphertext),
      encryption: { version: 1, iv: toBase64(iv), keys },
    };
  }, [error, identity, status, user]);

  const decryptMessage = useCallback(async (message) => {
    if (!message) return message;
    let decrypted = message;
    if (message.encryption?.version === 1) {
      try {
        if (!identity?.privateKey || identity.userId !== user?._id) throw new Error('Local key unavailable');
        const keys = message.encryption.keys || [];
        const ownKey = keys.find((entry) => String(entry.userId?._id || entry.userId) === user._id);
        if (!ownKey) throw new Error('No key envelope for this account');
        const wrappedAesKey = fromBase64(ownKey.wrappedKey);
        const rawAesKey = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, identity.privateKey, wrappedAesKey);
        const aesKey = await crypto.subtle.importKey('raw', rawAesKey, 'AES-GCM', false, ['decrypt']);
        const cleartext = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: fromBase64(message.encryption.iv) },
          aesKey,
          fromBase64(message.content),
        );
        const decodedContent = new TextDecoder().decode(cleartext);
        let payload;
        try {
          payload = JSON.parse(decodedContent);
        } catch {
          payload = null;
        }
        decrypted = payload?.payloadVersion === 1
          ? { ...message, content: payload.content, attachmentName: payload.attachmentName || '', decryptionFailed: false }
          : { ...message, content: decodedContent, decryptionFailed: false };
      } catch {
        decrypted = { ...message, content: 'Unable to decrypt this message on this device.', decryptionFailed: true };
      }
    }
    if (message.replyTo) decrypted = { ...decrypted, replyTo: await decryptMessage(message.replyTo) };
    return decrypted;
  }, [identity, user?._id]);

  const createCallKey = useCallback(async (recipientPublicKey) => {
    if (status !== 'ready' || !identity || identity.userId !== user?._id) {
      throw new Error(error || 'End-to-end encryption is not ready on this device.');
    }
    if (!recipientPublicKey) throw new Error('This user has not set up encryption on their device yet.');
    const generatedKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const rawKey = await crypto.subtle.exportKey('raw', generatedKey);
    const mediaKey = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt', 'decrypt']);
    const publicKey = await crypto.subtle.importKey(
      'spki',
      fromBase64(recipientPublicKey),
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt'],
    );
    const wrappedMediaKey = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, rawKey);
    return { mediaKey, wrappedMediaKey: toBase64(wrappedMediaKey) };
  }, [error, identity, status, user?._id]);

  const unwrapCallKey = useCallback(async (wrappedMediaKey) => {
    if (status !== 'ready' || !identity || identity.userId !== user?._id) {
      throw new Error(error || 'End-to-end encryption is not ready on this device.');
    }
    const rawKey = await crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      identity.privateKey,
      fromBase64(wrappedMediaKey),
    );
    return crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt', 'decrypt']);
  }, [error, identity, status, user?._id]);

  return (
    <EncryptionContext.Provider value={{ status, error, publicKey: identity?.publicKey || '', encryptContent, decryptMessage, createCallKey, unwrapCallKey, resetEncryptionIdentity }}>
      {children}
    </EncryptionContext.Provider>
  );
};

export const useEncryption = () => {
  const context = useContext(EncryptionContext);
  if (!context) throw new Error('useEncryption must be used within an EncryptionProvider');
  return context;
};