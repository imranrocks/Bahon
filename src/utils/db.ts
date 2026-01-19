import { AppState } from '../types';

const DB_NAME = 'BahonLocalDB';
const STORE_NAME = 'appState';
const DB_VERSION = 1;

export const saveLocalState = async (state: AppState) => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(state, 'current');
      tx.oncomplete = () => resolve(true);
    };
    request.onerror = () => reject(request.error);
  });
};

export const getLocalState = async (): Promise<AppState | null> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction(STORE_NAME, 'readonly');
      const getReq = tx.objectStore(STORE_NAME).get('current');
      getReq.onsuccess = () => resolve(getReq.result || null);
    };
    request.onerror = () => reject(request.error);
  });
};
