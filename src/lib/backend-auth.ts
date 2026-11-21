import { auth } from '@/firebaseConfig';
import { api } from '@/config';
import { setToken, takePendingPhone } from '@/lib/session';

// Swap the Firebase login for a backend token. Needed before ordering/paying.
export async function signInToBackend(): Promise<{ name: string; phone?: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const idToken = await user.getIdToken(true);
  const phone = await takePendingPhone();
  const res = await api.post('/auth/firebase', { idToken, phone });
  await setToken(res.data.token);
  return { name: res.data.name, phone: res.data.phone };
}
