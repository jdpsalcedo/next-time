import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDqd0tLgOqE6kXrl0j_kqAi1l1n3xzV8DA',
  authDomain: 'next-time-io.firebaseapp.com',
  projectId: 'next-time-io',
  storageBucket: 'next-time-io.firebasestorage.app',
  messagingSenderId: '715251567931',
  appId: '1:715251567931:web:4fda84811d3047243e7b1e',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
