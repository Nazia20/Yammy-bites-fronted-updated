import { useCallback, useEffect, useRef, useState, ReactNode } from 'react';
import { AppState, Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, User } from 'firebase/auth';
import { router } from 'expo-router';

import { auth } from '@/firebaseConfig';
import { api } from '@/config';
import { getToken } from '@/lib/session';
import { showReadyNotification } from '@/lib/notifications';
import { colors } from '@/constants/colors';

const POLL_MS = 5000;
const KEY = 'yb_notified_ready';

// Watches the customer's orders. When one turns "ready": plays a sound, shows a popup and a notification.
export function OrderWatcher({ children }: { children: ReactNode }) {
  const [popup, setPopup] = useState<{ orderId: string; restaurantName: string } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const notified = useRef<Set<string> | null>(null);
  const player = useAudioPlayer(require('../../assets/sounds/ready.wav'));

  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  const ring = useCallback(() => {
    try {
      player.seekTo(0);
      player.play();
    } catch {}
  }, [player]);

  const check = useCallback(async () => {
    if (!getToken()) return;
    try {
      if (!notified.current) {
        const saved = await AsyncStorage.getItem(KEY);
        notified.current = new Set(saved ? JSON.parse(saved) : []);
      }
      const res = await api.get('/orders/mine');
      const orders: any[] = res.data || [];
      let fresh: any = null;
      for (const o of orders) {
        if (o.status === 'ready' && !notified.current.has(o.orderId)) {
          notified.current.add(o.orderId);
          fresh = fresh || o;
        }
      }
      if (fresh) {
        await AsyncStorage.setItem(KEY, JSON.stringify([...notified.current].slice(-100)));
        ring();
        showReadyNotification(fresh.orderId);
        setPopup({ orderId: fresh.orderId, restaurantName: fresh.restaurantName || '' });
      }
    } catch {
      // network hiccup, try again on the next tick
    }
  }, [ring]);

  useEffect(() => {
    if (!user) {
      notified.current = null;
      return;
    }
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      check();
      timer = setInterval(check, POLL_MS);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', (s) => (s === 'active' ? start() : stop()));
    return () => {
      stop();
      sub.remove();
    };
  }, [user, check]);

  return (
    <>
      {children}
      <Modal visible={!!popup} transparent animationType="fade" onRequestClose={() => setPopup(null)}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.emoji}>🍽️</Text>
            <Text style={styles.title}>Your food is ready!</Text>
            <Text style={styles.body}>
              Order {popup?.orderId}
              {popup?.restaurantName ? ` at ${popup.restaurantName}` : ''} is ready for pickup.
            </Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => {
                setPopup(null);
                router.push('/orders' as any);
              }}
            >
              <Text style={styles.buttonText}>View order</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPopup(null)}>
              <Text style={styles.dismiss}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 28 },
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: 24, alignItems: 'center' },
  emoji: { fontSize: 48 },
  title: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary, marginTop: 8 },
  body: { color: colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  button: { backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 32, borderRadius: 10, marginTop: 20 },
  buttonText: { color: colors.surface, fontWeight: '700' },
  dismiss: { color: colors.textSecondary, marginTop: 14 },
});
