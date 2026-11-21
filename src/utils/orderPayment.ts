import RazorpayCheckout from 'react-native-razorpay';
import { triggerOrderCompleteNotification } from './orderNotification';

type RazorpayModule = {
  open?: (options: Record<string, unknown>) => Promise<unknown>;
};

export async function startOrderPayment({
  keyId,
  amountInPaise,
  appName = 'Yummy',
  orderId,
  onOrderSuccess,
  onOrderError,
}: {
  keyId: string;
  amountInPaise: number;
  appName?: string;
  orderId?: string;
  onOrderSuccess?: (paymentData: unknown) => void;
  onOrderError?: (error: unknown) => void;
}) {
  const razorpay = RazorpayCheckout as unknown as RazorpayModule;

  if (!razorpay || typeof razorpay.open !== 'function') {
    const err = new Error('Razorpay native module is not available in this build.');
    onOrderError?.(err);
    return;
  }

  const options = {
    description: 'Food Order Payment',
    currency: 'INR',
    key: keyId,
    amount: amountInPaise,
    name: appName,
    ...(orderId ? { order_id: orderId } : {}),
  };

  try {
    const paymentData = await razorpay.open(options);
    await triggerOrderCompleteNotification();
    onOrderSuccess?.(paymentData);
  } catch (error) {
    onOrderError?.(error);
  }
}