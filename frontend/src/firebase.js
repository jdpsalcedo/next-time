import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCnGcZk16pBvXyFN-3zPTDL-6olRZ94l5Q',
  authDomain: 'next-time-8844f.firebaseapp.com',
  projectId: 'next-time-8844f',
  storageBucket: 'next-time-8844f.firebasestorage.app',
  messagingSenderId: '434250373365',
  appId: '1:434250373365:web:a0c984198b0092f8600dbc',
  measurementId: 'G-YWKS1M1Z3E',
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});
