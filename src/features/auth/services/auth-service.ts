import { signInWithEmailAndPassword, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "@/shared/firebase/firebase-client";

export async function signInWithPassword(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email.trim(), password);
}

export async function signOut() {
  await firebaseSignOut(auth);
}
