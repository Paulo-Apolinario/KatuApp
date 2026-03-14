import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD6IRXDWKGQM--iOU1uIldHARlqI4lK7t8",
  authDomain: "katuapp-89a18.firebaseapp.com",
  projectId: "katuapp-89a18",
  storageBucket: "katuapp-89a18.firebasestorage.app",
  messagingSenderId: "1063154391684",
  appId: "1:1063154391684:web:27689da196afe10cbfc0d1",
  measurementId: "G-N2PG8MT9NZ",
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
export default app;