import { createContext, useContext, useState, ReactNode } from 'react';

export type CartItem = {
  id: string;
  name: string;
  price: number;
  restaurantName: string;
  restaurantId: string;
  quantity: number;
};

type CartContextType = {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'>) => boolean;
  removeFromCart: (id: string) => void;
  increaseQuantity: (id: string) => void;
  decreaseQuantity: (id: string) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  restaurantId: string | null;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const restaurantId = items.length ? items[0].restaurantId : null;

  // One order belongs to one food center. Returns false if the item is from a different center.
  const addToCart = (newItem: Omit<CartItem, 'quantity'>) => {
    if (items.length && items[0].restaurantId !== newItem.restaurantId) return false;
    setItems((prev) => {
      const existing = prev.find((item) => item.id === newItem.id);
      if (existing) {
        return prev.map((item) =>
          item.id === newItem.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...newItem, quantity: 1 }];
    });
    return true;
  };

  const removeFromCart = (id: string) => setItems((prev) => prev.filter((item) => item.id !== id));

  const increaseQuantity = (id: string) =>
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: Math.min(20, item.quantity + 1) } : item))
    );

  const decreaseQuantity = (id: string) =>
    setItems((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, quantity: item.quantity - 1 } : item))
        .filter((item) => item.quantity > 0)
    );

  const clearCart = () => setItems([]);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addToCart, removeFromCart, increaseQuantity, decreaseQuantity, clearCart, totalItems, totalPrice, restaurantId }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
}
