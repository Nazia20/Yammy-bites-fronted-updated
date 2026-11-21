import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, useColorScheme } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { OrderWatcher } from '@/components/order-watcher';
import { auth } from '@/firebaseConfig';
import { CartProvider } from '@/context/cart-context';
import { setToken } from '@/lib/session';
import { signInToBackend } from '@/lib/backend-auth';
import { registerPush } from '@/lib/notifications';
import { errorMessage } from '@/config';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        await setToken(null);
        router.replace('/login');
        return;
      }
      if (!user.emailVerified) {
        router.replace('/verify-email');
        return;
      }
      try {
        await signInToBackend();
        registerPush();
      } catch (e) {
        Alert.alert('Could not reach the server', errorMessage(e, 'Please check your connection.'));
      }
      router.replace('/(tabs)');
    });
    return unsubscribe;
  }, []);

  return (
    <CartProvider>
      <OrderWatcher>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <AnimatedSplashOverlay />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="login" />
            <Stack.Screen name="verify-email" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="cart" />
          </Stack>
        </ThemeProvider>
      </OrderWatcher>
    </CartProvider>
  );
}
