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
  getDocs,
  addDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  writeBatch,
  limit,
  startAfter,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

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

export { 
    serverTimestamp, 
    Timestamp, 
    writeBatch, 
    runTransaction, 
    doc, 
    collection, 
    orderBy, 
    limit, 
    deleteDoc,
    getDocs,
    getDoc,
    query,
    where,
    startAfter
};

export function getAuthInstance() { return auth; }
export function getDbInstance() { return db; }