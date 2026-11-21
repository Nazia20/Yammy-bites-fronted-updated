import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useCart } from '@/context/cart-context';
import { colors } from '@/constants/colors';
import { api } from '@/config';

// Maps the URL slug (whatever the restaurant-list screen links with, e.g. /menu/nescafe)
// to the real MongoDB restaurantId. Update the keys on the left if your restaurant-list
// screen uses different slugs than these.
const RESTAURANT_IDS: Record<string, string> = {
  nescafe: '6a8bd9192caadbaa8c868324',
  canteen: '6a9f61b9f1aaa4b040d7f9ee',
  ccd: '6a9f627a7468fb0ea3d9d0c9', // Xpress (Café Coffee Day)
  xpress: '6a9f627a7468fb0ea3d9d0c9',
  pandajunction: '6a9f62edc7d1a15dfd33dd92',
  jumbo: '6aab8d5e72c5cec5d4c376f4',
};

// The /api/menu/:restaurantId route only returns menu items, not the restaurant's
// name, so we look the display name up locally from the same slug used above.
const RESTAURANT_NAMES: Record<string, string> = {
  nescafe: 'Nescafe',
  canteen: 'Canteen',
  ccd: 'Xpress (Café Coffee Day)',
  xpress: 'Xpress (Café Coffee Day)',
  pandajunction: 'Panda Junction',
  jumbo: 'Jumbo',
};

type MenuItem = {
  _id: string;
  name: string;
  price: number;
  type: string;
  isAvailable: boolean;
  quantity: number;
};

export default function MenuScreen() {
  const { center } = useLocalSearchParams<{ center: string }>();
  const restaurantId = RESTAURANT_IDS[center as string];

  const [items, setItems] = useState<MenuItem[]>([]);
  const restaurantName = RESTAURANT_NAMES[center as string] || '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const { addToCart, totalItems } = useCart();

  useEffect(() => {
    if (!restaurantId) {
      setError('Restaurant not found');
      setLoading(false);
      return;
    }

    const fetchMenu = async () => {
      try {
        const res = await api.get(`/menu/${restaurantId}`);
        setItems(res.data.items || res.data);
      } catch (err) {
        console.error('Failed to load menu:', err);
        setError('Could not load menu. Check your connection and try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchMenu();
  }, [restaurantId]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 60 }} />
      </View>
    );
  }

  if (error || !restaurantId) {
    return (
      <View style={styles.container}>
        <Text style={styles.headerText}>{error || 'Menu not found'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerText}>{restaurantName || 'Menu'}</Text>
        <TouchableOpacity style={styles.cartButton} onPress={() => router.push('/cart')}>
          <Text style={styles.cartButtonText}>Cart ({totalItems})</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const outOfStock = !item.isAvailable || item.quantity <= 0;
          return (
            <View style={[styles.itemRow, outOfStock && styles.itemRowDisabled]}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemText}>{item.name}</Text>
                <Text style={styles.itemPrice}>₹{item.price}</Text>
                {outOfStock && <Text style={styles.outOfStockText}>Out of stock</Text>}
              </View>
              <TouchableOpacity
                style={[styles.addButton, outOfStock && styles.addButtonDisabled]}
                disabled={outOfStock}
                onPress={() => {
                  const ok = addToCart({
                    id: item._id,
                    name: item.name,
                    price: item.price,
                    restaurantName: restaurantName || (center as string),
                    restaurantId,
                  });
                  if (!ok) {
                    Alert.alert(
                      'Different food center',
                      'Your cart has items from another food center. Place or clear that order first.'
                    );
                  }
                }}
              >
                <Text style={styles.addButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingTop: 60, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerText: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary, flex: 1 },
  cartButton: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  cartButtonText: { color: colors.surface, fontWeight: '600', fontSize: 13 },
  listContent: { gap: 12, paddingBottom: 40 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemRowDisabled: { opacity: 0.5 },
  itemInfo: { flex: 1 },
  itemText: { color: colors.textPrimary, fontSize: 16 },
  itemPrice: { color: colors.textSecondary, fontSize: 14, marginTop: 4 },
  outOfStockText: { color: colors.outOfStock, fontSize: 12, marginTop: 4, fontWeight: '600' },
  addButton: { backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  addButtonDisabled: { backgroundColor: colors.border },
  addButtonText: { color: colors.surface, fontWeight: '600' },
});