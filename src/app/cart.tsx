import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Switch, TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import RazorpayCheckout from 'react-native-razorpay';

import { useCart } from '@/context/cart-context';
import { colors } from '@/constants/colors';
import { api, errorMessage } from '@/config';
import { askPermission } from '@/lib/notifications';

const PARCEL_FEE = 10; // same as the backend rule

type Method = 'upi' | 'wallet';

export default function CartScreen() {
  const { items, increaseQuantity, decreaseQuantity, totalPrice, clearCart, restaurantId } = useCart();

  const [method, setMethod] = useState<Method>('upi');
  const [parcel, setParcel] = useState(false);
  const [note, setNote] = useState('');
  const [rules, setRules] = useState({ allowParcel: false, liveCounter: false });
  const [balance, setBalance] = useState<number | null>(null);
  const [hasPhone, setHasPhone] = useState(true);
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);

  // Cart rules (parcel / special instructions), wallet balance and whether a phone number is saved
  useEffect(() => {
    if (!restaurantId) return;
    api.get('/restaurants').then((r) => {
      const list = Array.isArray(r.data) ? r.data : r.data.restaurants || [];
      const mine = list.find((x: any) => String(x._id) === restaurantId);
      if (mine) setRules({ allowParcel: !!mine.allowParcel, liveCounter: !!mine.liveCounter });
    }).catch(() => {});
    api.get('/wallet').then((r) => setBalance(r.data.balance)).catch(() => {});
    api.get('/auth/me').then((r) => setHasPhone(!!r.data.phone)).catch(() => {});
  }, [restaurantId]);

  const fee = parcel && rules.allowParcel ? PARCEL_FEE : 0;
  const payable = totalPrice + fee;

  const finish = async (order: any) => {
    clearCart();
    askPermission(); // make sure the "food ready" alert is allowed
    const wait = order.estimatedWaitMins > 0 ? `\nEstimated wait: ~${order.estimatedWaitMins} min.` : '';
    Alert.alert('Order placed ✅', `Your order ID is ${order.orderId}.${wait}\nWe will alert you when it is ready.`);
    router.replace('/orders' as any);
  };

  const placeOrder = async () => {
    if (busy) return;
    if (!hasPhone) {
      if (!/^\d{10}$/.test(phone.trim())) {
        Alert.alert('Phone number', 'Enter a valid 10-digit phone number to order.');
        return;
      }
      try {
        await api.patch('/auth/me', { phone: phone.trim() });
        setHasPhone(true);
      } catch (e) {
        Alert.alert('Error', errorMessage(e));
        return;
      }
    }

    setBusy(true);
    let orderId = '';
    try {
      const res = await api.post('/orders', {
        restaurantId,
        items: items.map((i) => ({ menuItemId: i.id, quantity: i.quantity })),
        paymentMethod: method,
        parcel: parcel && rules.allowParcel,
        instructions: rules.liveCounter ? note : '',
      });
      const order = res.data;
      orderId = order.orderId;

      if (method === 'wallet') {
        await finish(order);
        return;
      }

      // 1) ask the backend to create the Razorpay payment
      const start = (await api.post('/payment/start', { orderId })).data;

      // 2) open Razorpay checkout (UPI apps, cards, netbanking)
      let paid: any;
      try {
        paid = await RazorpayCheckout.open({
          key: start.keyId,
          amount: start.amount,
          currency: 'INR',
          order_id: start.razorpayOrderId,
          name: 'Yum Bites',
          description: `Order ${orderId}`,
          prefill: { email: start.email, contact: start.contact, name: start.name },
          theme: { color: colors.primary },
        });
      } catch (e: any) {
        // cancelled or failed: backend releases the stock (or keeps the order if money did arrive)
        const r = await api.post('/payment/abandon', { orderId }).catch(() => null);
        if (r?.data?.paid) {
          const o = (await api.get(`/orders/${orderId}`)).data;
          await finish(o);
        } else {
          Alert.alert('Payment not completed', e?.description || 'The payment was cancelled. No money was taken.');
        }
        return;
      }

      // 3) backend checks the signature and the amount with Razorpay
      try {
        const verified = await api.post('/payment/verify', {
          orderId,
          razorpayPaymentId: paid.razorpay_payment_id,
          razorpayOrderId: paid.razorpay_order_id,
          razorpaySignature: paid.razorpay_signature,
        });
        await finish(verified.data);
      } catch (e) {
        const r = await api.post('/payment/abandon', { orderId }).catch(() => null);
        if (r?.data?.paid) {
          const o = (await api.get(`/orders/${orderId}`)).data;
          await finish(o);
        } else {
          Alert.alert('Payment problem', errorMessage(e, 'We could not confirm your payment.'));
        }
      }
    } catch (e) {
      Alert.alert('Could not place order', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (items.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.headerText}>Your Cart</Text>
        <Text style={styles.emptyText}>Your cart is empty</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Browse Food Centers</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const walletShort = balance !== null && balance < payable;

  return (
    <View style={styles.container}>
      <Text style={styles.headerText}>Your Cart</Text>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemRestaurant}>{item.restaurantName}</Text>
              <Text style={styles.itemPrice}>₹{item.price} each</Text>
            </View>
            <View style={styles.quantityControls}>
              <TouchableOpacity style={styles.qtyButton} onPress={() => decreaseQuantity(item.id)}>
                <Text style={styles.qtyButtonText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.qtyText}>{item.quantity}</Text>
              <TouchableOpacity style={styles.qtyButton} onPress={() => increaseQuantity(item.id)}>
                <Text style={styles.qtyButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={{ gap: 12, marginTop: 8 }}>
            {rules.allowParcel && (
              <View style={styles.optionRow}>
                <Text style={styles.optionText}>Parcel (+₹{PARCEL_FEE})</Text>
                <Switch value={parcel} onValueChange={setParcel} trackColor={{ true: colors.primary }} />
              </View>
            )}
            {rules.liveCounter && (
              <TextInput
                style={styles.input}
                placeholder="Special instructions (optional)"
                placeholderTextColor={colors.textSecondary}
                value={note}
                onChangeText={setNote}
                maxLength={200}
              />
            )}
            {!hasPhone && (
              <TextInput
                style={styles.input}
                placeholder="Your phone number (10 digits)"
                placeholderTextColor={colors.textSecondary}
                value={phone}
                onChangeText={setPhone}
                keyboardType="number-pad"
                maxLength={10}
              />
            )}

            <Text style={styles.sectionTitle}>Pay with</Text>
            <TouchableOpacity
              style={[styles.methodCard, method === 'upi' && styles.methodActive]}
              onPress={() => setMethod('upi')}
            >
              <Text style={styles.methodTitle}>UPI / Card / Netbanking</Text>
              <Text style={styles.methodSub}>Secure payment by Razorpay</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.methodCard, method === 'wallet' && styles.methodActive]}
              onPress={() => setMethod('wallet')}
            >
              <Text style={styles.methodTitle}>Yum Bites Wallet</Text>
              <Text style={[styles.methodSub, method === 'wallet' && walletShort && { color: colors.error }]}>
                {balance === null ? 'Checking balance…' : `Balance ₹${balance}${walletShort ? ' (not enough)' : ''}`}
              </Text>
            </TouchableOpacity>
          </View>
        }
      />

      <View style={styles.footer}>
        <Text style={styles.totalText}>
          Total: ₹{payable}
          {fee > 0 ? `  (incl. ₹${fee} parcel)` : ''}
        </Text>
        <TouchableOpacity
          style={[styles.payButton, (busy || (method === 'wallet' && walletShort)) && { opacity: 0.6 }]}
          onPress={placeOrder}
          disabled={busy || (method === 'wallet' && walletShort)}
        >
          {busy ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.payButtonText}>{method === 'upi' ? `Pay ₹${payable}` : `Pay ₹${payable} from wallet`}</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.clearButton} onPress={clearCart} disabled={busy}>
          <Text style={styles.clearButtonText}>Clear Cart</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60, paddingHorizontal: 20 },
  headerText: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 20 },
  emptyText: { color: colors.textSecondary, fontSize: 16, marginTop: 40, textAlign: 'center' },
  backButton: { backgroundColor: colors.primary, padding: 14, borderRadius: 10, marginTop: 24, alignItems: 'center' },
  backButtonText: { color: colors.surface, fontWeight: '600' },
  listContent: { gap: 12, paddingBottom: 20 },
  itemRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 10, padding: 16, borderWidth: 1, borderColor: colors.border,
  },
  itemInfo: { flex: 1 },
  itemName: { color: colors.textPrimary, fontSize: 16, fontWeight: '600' },
  itemRestaurant: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  itemPrice: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  quantityControls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyButton: { backgroundColor: colors.primary, width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  qtyButtonText: { color: colors.surface, fontSize: 18, fontWeight: 'bold' },
  qtyText: { color: colors.textPrimary, fontSize: 16, fontWeight: '600', minWidth: 20, textAlign: 'center' },
  optionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: colors.border,
  },
  optionText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14,
    backgroundColor: colors.surface, color: colors.textPrimary, fontSize: 15,
  },
  sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: 'bold', marginTop: 8 },
  methodCard: { backgroundColor: colors.surface, borderRadius: 10, padding: 14, borderWidth: 2, borderColor: colors.border },
  methodActive: { borderColor: colors.primary },
  methodTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  methodSub: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, paddingVertical: 14, gap: 10 },
  totalText: { color: colors.textPrimary, fontSize: 20, fontWeight: 'bold' },
  payButton: { backgroundColor: colors.primary, padding: 16, borderRadius: 10, alignItems: 'center' },
  payButtonText: { color: colors.surface, fontWeight: '700', fontSize: 16 },
  clearButton: { backgroundColor: colors.outOfStock, padding: 12, borderRadius: 10, alignItems: 'center' },
  clearButtonText: { color: colors.surface, fontWeight: '600' },
});
