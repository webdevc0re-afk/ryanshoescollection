export type ProductCategory =
  | 'Running'
  | 'Court & Casual'
  | 'Loafers & Dress'
  | 'Trail & Outdoor'
  | 'Kids & Youth'
  | 'Comfort Walking';

export type AgeGroup =
  | 'Kids & Youth (10-17)'
  | 'Adults (18-45)'
  | 'Mature Comfort (46-60)'
  | 'All Ages (10-60)';

export type OrderStatus =
  | 'Pending'
  | 'Confirmed'
  | 'Processing'
  | 'Shipped'
  | 'Delivered'
  | 'Cancelled';

export type PaymentMethod = 'COD' | 'GCash' | 'Maya';

export type PaymentStatus =
  | 'Pending COD Collection'
  | 'Awaiting Verification'
  | 'Verified & Paid'
  | 'Payment Rejected'
  | 'Refunded';

export type ShippingRegion =
  | 'Metro Manila'
  | 'Luzon Provincial'
  | 'Visayas'
  | 'Mindanao';

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  ageGroup: AgeGroup;
  description: string;
  price: number;
  discountPercent: number;
  imageUrl: string;
  driveFileId?: string;
  colors: string[];
  sizes: string[];
  sizeStock: Record<string, number>;
  stock: number;
  lowStockThreshold: number;
  featured: boolean;
  newArrival: boolean;
  bestSeller: boolean;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CartItem {
  productId: string;
  name: string;
  brand: string;
  imageUrl: string;
  size: string;
  color: string;
  unitPrice: number;
  originalPrice: number;
  discountPercent: number;
  quantity: number;
  maxStock: number;
}

export interface CustomerProfile {
  uid: string;
  email: string;
  fullName: string;
  phone: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  preferredAgeGroup?: string;
  role: 'customer';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OrderItem {
  productId: string;
  name: string;
  brand: string;
  size: string;
  color: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  imageUrl: string;
}

export interface Order {
  id: string;
  trackingCode: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
  contactNumber: string;
  deliveryAddress: string;
  region: ShippingRegion;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  paymentSenderNumber: string;
  paymentStatus: PaymentStatus;
  orderStatus: OrderStatus;
  stockDeducted: boolean;
  trackingNotes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface OrderTrackingSummary {
  trackingCode: string;
  customerId: string;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  itemCount: number;
  totalAmount: number;
  trackingNotes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const SHIPPING_FEES: Record<ShippingRegion, number> = {
  'Metro Manila': 85,
  'Luzon Provincial': 135,
  'Visayas': 175,
  'Mindanao': 195,
};

export const FREE_SHIPPING_THRESHOLD = 3500;

export function calculateShippingFee(subtotal: number, region: ShippingRegion): number {
  if (subtotal <= 0) return 0;
  if (subtotal >= FREE_SHIPPING_THRESHOLD) return 0;
  return SHIPPING_FEES[region] ?? 135;
}

export function getEffectivePrice(price: number, discountPercent: number): number {
  if (!discountPercent || discountPercent <= 0) return Math.round(price);
  return Math.round(price * (1 - discountPercent / 100));
}

export function formatPHP(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateTime(ts: unknown): string {
  if (!ts) return 'Just now';
  try {
    if (typeof ts === 'object' && ts !== null && 'toDate' in ts && typeof (ts as { toDate: () => Date }).toDate === 'function') {
      return (ts as { toDate: () => Date }).toDate().toLocaleString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    }
    if (ts instanceof Date) {
      return ts.toLocaleString('en-PH');
    }
    if (typeof ts === 'string' || typeof ts === 'number') {
      return new Date(ts).toLocaleString('en-PH');
    }
  } catch {
    return '—';
  }
  return '—';
}
