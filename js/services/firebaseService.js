// Serviço Firebase (agnóstico à UI) - ESM via CDN Firebase v10.14.1
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  addDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch,
  limit,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// Singletons
let app, auth, db;

export function initializeFirebase(config) {
  if (!app) {
    app = initializeApp(config);
    auth = getAuth(app);
    db = getFirestore(app);
  }
  return { app, auth, db };
}

export function monitorAuthState(onUserLoggedIn, onUserLoggedOut) {
  if (!auth) throw new Error("Firebase não inicializado.");
  return onAuthStateChanged(auth, (user) => {
    if (user) onUserLoggedIn?.(user);
    else onUserLoggedOut?.();
  });
}

// Auth API
export function signIn(email, password) {
  if (!auth) throw new Error("Firebase não inicializado.");
  return signInWithEmailAndPassword(auth, email, password);
}

export function signOutUser() {
  if (!auth) throw new Error("Firebase não inicializado.");
  return signOut(auth);
}

export function registerUser(email, password) {
  if (!auth) throw new Error("Firebase não inicializado.");
  return createUserWithEmailAndPassword(auth, email, password);
}

// Firestore listeners
export function createFirestoreListener(collectionPath, dataHandler, queryConstraints = []) {
  const colRef = collection(db, collectionPath);
  const builtQuery = queryConstraints?.length ? query(colRef, ...queryConstraints) : colRef;
  return onSnapshot(builtQuery, (snapshot) => {
    const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    dataHandler?.(data);
  }, (err) => console.error(`Error fetching ${collectionPath}:`, err));
}

export function createDocListener(collectionPath, id, dataHandler) {
  const ref = doc(db, collectionPath, id);
  return onSnapshot(ref, (snap) => dataHandler?.(snap.exists() ? snap.data() : null));
}

// Firestore CRUD helpers
export async function saveDocument(collectionPath, idOrNull, data, merge = true) {
  if (idOrNull) {
    await setDoc(doc(db, collectionPath, idOrNull), data, { merge });
    return { id: idOrNull, ...data };
  } else {
    const ref = await addDoc(collection(db, collectionPath), data);
    return { id: ref.id, ...data };
  }
}

export async function deleteDocument(collectionPath, id) {
  await deleteDoc(doc(db, collectionPath, id));
  return { id };
}

export async function getDocument(collectionPath, id) {
  const snap = await getDoc(doc(db, collectionPath, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// Transactions and batch
export { serverTimestamp, Timestamp, writeBatch, runTransaction, doc, collection, orderBy, limit };

// Singletons getters
export function getAuthInstance() { return auth; }
export function getDbInstance() { return db; }