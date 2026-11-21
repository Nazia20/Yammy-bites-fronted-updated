import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from '@/config';

// Show banners + play sound even while the app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function setupChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('orders', {
    name: 'Order updates',
    importance: Notifications.AndroidImportance.MAX,
    sound: 'ready.wav', // file from assets/sounds, registered in app.json
    vibrationPattern: [0, 400, 200, 400],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

export async function askPermission() {
  await setupChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

// Gets the phone's push token and gives it to the backend (for alerts when the app is closed)
export async function registerPush() {
  try {
    if (!Device.isDevice) return;
    if (!(await askPermission())) return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await api.post('/push/register', { token });
  } catch (e) {
    console.log('Push registration skipped:', (e as Error).message);
  }
}

export async function unregisterPush() {
  try {
    await api.post('/push/unregister');
  } catch {}
}

export async function showReadyNotification(orderId: string) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your food is ready! 🍽️',
        body: `Order ${orderId} is ready for pickup.`,
        sound: 'ready.wav',
        data: { orderId },
      },
      trigger: Platform.OS === 'android' ? { channelId: 'orders' } : null,
    });
  } catch (e) {
    console.log('Local notification failed:', (e as Error).message);
  }
}
