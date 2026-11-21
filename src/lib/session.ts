import AsyncStorage from '@react-native-async-storage/async-storage';

// Backend JWT, kept in memory and mirrored to storage
let token: string | null = null;

export const getToken = () => token;

export async function setToken(t: string | null) {
  token = t;
  if (t) await AsyncStorage.setItem('yb_token', t);
  else await AsyncStorage.removeItem('yb_token');
}

export async function loadToken() {
  token = await AsyncStorage.getItem('yb_token');
  return token;
}

// Phone typed on the sign-up screen, sent to the backend on first sign-in
export async function savePendingPhone(phone: string) {
  await AsyncStorage.setItem('yb_phone', phone);
}
export async function takePendingPhone() {
  const p = await AsyncStorage.getItem('yb_phone');
  return p || undefined;
}
