// app/lib/firebase.server.ts
import "server-only";

import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

function getFirebaseConfig() {
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
  };

  // 최소 안전장치: 빠진 값이 있으면 바로 에러로 알려주기
  for (const [k, v] of Object.entries(cfg)) {
    if (!v) throw new Error(`Missing Firebase env: ${k}`);
  }

  return cfg;
}

export function getDb() {
  const app = getApps().length ? getApps()[0] : initializeApp(getFirebaseConfig());
  return getFirestore(app);
}