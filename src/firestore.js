import { db } from "./firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

/**
 * Cria o perfil do usuário em users/{uid} se não existir.
 * Esse doc é a base para permissões (role), CRGR, território, organização etc.
 */
export async function ensureUserProfile(user, extra = {}) {
  if (!user?.uid) return;

  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email ?? null,
      name: user.displayName ?? null,
      role: extra.role ?? "comunidade", // default
      crgrIds: extra.crgrIds ?? [],     // vínculo com CRGR
      territoryId: extra.territoryId ?? null,
      orgId: extra.orgId ?? null,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...extra,
    });
  }
}
