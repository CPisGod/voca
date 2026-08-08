// firebase-config.js
// vocab-7e5f4 프로젝트의 Firebase 설정값입니다.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDHOPc0yRieu8iz6I3T-PAtAuy_VIgpW64',
  authDomain: 'vocab-7e5f4.firebaseapp.com',
  projectId: 'vocab-7e5f4',
  storageBucket: 'vocab-7e5f4.firebasestorage.app',
  messagingSenderId: '206932344638',
  appId: '1:206932344638:web:4b9fdb3d93f26fc4e7b66f',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
