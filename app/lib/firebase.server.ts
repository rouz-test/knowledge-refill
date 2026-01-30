// app/lib/firebase.server.ts
import "server-only";

import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function getAdminCredential() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

  if (!projectId) throw new Error("Missing Firebase env: FIREBASE_ADMIN_PROJECT_ID");
  if (!clientEmail) throw new Error("Missing Firebase env: FIREBASE_ADMIN_CLIENT_EMAIL");
  if (!privateKeyRaw) throw new Error("Missing Firebase env: FIREBASE_ADMIN_PRIVATE_KEY");

  // `.env.local`에서 보통 `\n` 형태로 들어오므로 실제 줄바꿈으로 복원
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

  return cert({ projectId, clientEmail, privateKey });
}

export function getDb() {
  const app = getApps().length ? getApps()[0] : initializeApp({ credential: getAdminCredential() });
  return getFirestore(app);
}