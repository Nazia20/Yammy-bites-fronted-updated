import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { signOut } from 'firebase/auth';

import { auth } from '@/firebaseConfig';
import { api } from '@/config';
import { colors } from '@/constants/colors';
import { unregisterPush } from '@/lib/notifications';

const STATUS_LABEL: Record<string, string> = {
  placed: 'Order placed',
  preparing: 'Preparing',
  ready: 'Ready for pickup!',
  completed: 'Completed',
  cancelled: 'Cancelled',
};
const STATUS_COLOR: Record<string, string> = {
  placed: colors.accent,
  preparing: colors.accent,
  ready: '#2E9E4F',
  completed: colors.textSecondary,
  cancelled: colors.error,
};

export default function OrdersScreen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.get('/orders/mine');
      setOrders(res.data || []);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const logout = () =>
    Alert.alert('Sign out', 'Do you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await unregisterPush();
          await signOut(auth); // _layout.tsx sends you back to the login screen
        },
      },
    ]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerText}>My Orders</Text>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.signOut}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.orderId}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={<Text style={styles.empty}>No orders yet. Pick a food center on Home.</Text>}
        renderItem={({ item: o }) => {
          const awaitingPayment = o.paymentMethod === 'upi' && o.paymentStatus === 'pending' && o.status === 'placed';
          const label = awaitingPayment ? 'Awaiting payment' : STATUS_LABEL[o.status] || o.status;
          const color = awaitingPayment ? colors.textSecondary : STATUS_COLOR[o.status];
          return (
            <View style={[styles.card, o.status === 'ready' && styles.cardReady]}>
              <View style={styles.rowBetween}>
                <Text style={styles.orderId}>{o.orderId}</Text>
                <Text style={[styles.status, { color }]}>{label}</Text>
              </View>
              <Text style={styles.restaurant}>{o.restaurantName}</Text>
              {o.items.map((i: any) => (
                <Text key={i.menuItemId} style={styles.line}>
                  {i.quantity} × {i.name}
                </Text>
              ))}
              <View style={[styles.rowBetween, { marginTop: 8 }]}>
                <Text style={styles.total}>₹{o.total}</Text>
                <Text style={styles.meta}>
                  {o.paymentStatus === 'refunded' ? 'Refunded' : o.paymentStatus === 'paid' ? 'Paid' : o.paymentStatus}
                  {o.remainingMins > 0 ? `  •  ~${o.remainingMins} min left` : ''}
                </Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerText: { fontSize: 22, fontWeight: 'bold', color: colors.textPrimary },
  signOut: { color: colors.primary, fontWeight: '600' },
  list: { gap: 12, paddingBottom: 100 },
  empty: { color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border },
  cardReady: { borderColor: '#2E9E4F', borderWidth: 2 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId: { color: colors.textPrimary, fontWeight: 'bold', fontSize: 16 },
  status: { fontWeight: '700', fontSize: 13 },
  restaurant: { color: colors.textSecondary, fontSize: 12, marginTop: 2, marginBottom: 8 },
  line: { color: colors.textPrimary, fontSize: 14, marginTop: 2 },
  total: { color: colors.textPrimary, fontWeight: 'bold', fontSize: 16 },
  meta: { color: colors.textSecondary, fontSize: 12 },
});
