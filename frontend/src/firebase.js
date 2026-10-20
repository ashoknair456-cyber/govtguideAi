// Reusable Firebase configuration for GovGuide AI.
//
// All values are read from Vite environment variables (see frontend/.env).
// Firebase Web App config values are NOT secret - they identify your public
// web app and are safe to expose in the browser bundle. Never put real
// secrets (like the Firebase service account / server key) here.
//
// If any required value is missing, `isFirebaseConfigured` is false and the
// rest of the app keeps working normally (Google sign-in simply stays off).
// This guarantees importing this module can never crash the dashboard or any
// other existing feature.

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// The minimum set of fields Firebase needs before Google sign-in can work.
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
);

let app = null;
let auth = null;

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);

  // Reuse a single configured Google provider instance.
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  auth._googleProvider = provider;
}

// Lazily provide the provider so it is always the configured instance.
export function getGoogleProvider() {
  if (!isFirebaseConfigured) return null;
  if (!auth._googleProvider) {
    auth._googleProvider = new GoogleAuthProvider();
    auth._googleProvider.setCustomParameters({ prompt: 'select_account' });
  }
  return auth._googleProvider;
}

export { app, auth, signInWithPopup, GoogleAuthProvider };
export default app;
