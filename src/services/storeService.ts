import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  deleteDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  CustomerProfile,
  Order,
  OrderStatus,
  OrderTrackingSummary,
  PaymentStatus,
  Product,
} from '../types/store';
import { SEED_PRODUCTS } from '../data/seedCatalog';

export function sanitizeProductPayload(
  input: Omit<Product, 'createdAt' | 'updatedAt'>,
  isNew: boolean,
  existingCreatedAt?: unknown
) {
  const cleanId = input.id.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
  const colors = input.colors.map((c) => c.trim()).filter(Boolean).slice(0, 10);
  const sizes = input.sizes.map((s) => s.trim()).filter(Boolean).slice(0, 20);

  const normalizedSizeStock: Record<string, number> = {};
  let computedStock = 0;
  for (const size of sizes) {
    const qty = Math.max(0, Math.floor(Number(input.sizeStock?.[size] ?? 0)));
    normalizedSizeStock[size] = qty;
    computedStock += qty;
  }

  const base: Record<string, unknown> = {
    id: cleanId,
    name: input.name.trim().slice(0, 120),
    brand: input.brand.trim().slice(0, 80),
    category: input.category,
    ageGroup: input.ageGroup,
    description: input.description.trim().slice(0, 1500),
    price: Math.max(1, Math.min(500000, Number(input.price))),
    discountPercent: Math.max(0, Math.min(90, Number(input.discountPercent || 0))),
    imageUrl: input.imageUrl.trim().slice(0, 1000),
    colors: colors.length > 0 ? colors : ['Classic Black'],
    sizes: sizes.length > 0 ? sizes : ['US 8'],
    sizeStock: normalizedSizeStock,
    stock: computedStock,
    lowStockThreshold: Math.max(0, Math.min(1000, Math.floor(Number(input.lowStockThreshold ?? 5)))),
    featured: Boolean(input.featured),
    newArrival: Boolean(input.newArrival),
    bestSeller: Boolean(input.bestSeller),
    active: Boolean(input.active),
    updatedAt: serverTimestamp(),
  };

  if (input.driveFileId && input.driveFileId.trim()) {
    base.driveFileId = input.driveFileId.trim().slice(0, 256);
  }

  if (isNew) {
    base.createdAt = serverTimestamp();
  } else if (existingCreatedAt) {
    base.createdAt = existingCreatedAt;
  }

  return base;
}

export function subscribeProducts(
  onData: (products: Product[]) => void,
  onError?: (err: Error) => void
) {
  const path = 'products';
  const q = query(collection(db, path));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ ...(d.data() as Product), id: d.id }));
      onData(items);
    },
    (error) => {
      if (onError) onError(error);
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {
        // Logged by handleFirestoreError
      }
    }
  );
}

export async function seedInitialCatalogIfEmpty(): Promise<number> {
  const path = 'products';
  try {
    const snap = await getDocs(collection(db, path));
    if (!snap.empty) return 0;

    const batch = writeBatch(db);
    for (const item of SEED_PRODUCTS) {
      const ref = doc(db, path, item.id);
      batch.set(ref, sanitizeProductPayload(item, true));
    }
    await batch.commit();
    return SEED_PRODUCTS.length;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveProduct(
  product: Omit<Product, 'createdAt' | 'updatedAt'>,
  isNew: boolean,
  existingCreatedAt?: unknown
): Promise<void> {
  const cleanId = product.id.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
  const path = `products/${cleanId}`;
  try {
    if (isNew) {
      await setDoc(doc(db, 'products', cleanId), sanitizeProductPayload({ ...product, id: cleanId }, true));
    } else {
      await updateDoc(
        doc(db, 'products', cleanId),
        sanitizeProductPayload({ ...product, id: cleanId }, false, existingCreatedAt)
      );
    }
  } catch (error) {
    handleFirestoreError(error, isNew ? OperationType.CREATE : OperationType.UPDATE, path);
  }
}

export async function removeProduct(productId: string): Promise<void> {
  const path = `products/${productId}`;
  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function getCustomerProfile(uid: string): Promise<CustomerProfile | null> {
  const path = `customers/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'customers', uid));
    return snap.exists() ? (snap.data() as CustomerProfile) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function upsertCustomerProfile(
  uid: string,
  profile: Omit<CustomerProfile, 'uid' | 'role' | 'createdAt' | 'updatedAt'>
): Promise<void> {
  const path = `customers/${uid}`;
  try {
    const ref = doc(db, 'customers', uid);
    const existing = await getDoc(ref);

    const payload: Record<string, unknown> = {
      uid,
      email: profile.email.trim().slice(0, 200),
      fullName: profile.fullName.trim().slice(0, 120),
      phone: profile.phone.trim().slice(0, 30),
      address: profile.address.trim().slice(0, 300),
      city: profile.city.trim().slice(0, 100),
      province: profile.province.trim().slice(0, 100),
      postalCode: profile.postalCode.trim().slice(0, 20),
      preferredAgeGroup: (profile.preferredAgeGroup || 'All Ages (10-60)').slice(0, 60),
      role: 'customer',
      updatedAt: serverTimestamp(),
    };

    if (!existing.exists()) {
      payload.createdAt = serverTimestamp();
      await setDoc(ref, payload);
    } else {
      payload.createdAt = existing.data().createdAt;
      await updateDoc(ref, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchAllCustomersForAdmin(): Promise<CustomerProfile[]> {
  const path = 'customers';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map((d) => d.data() as CustomerProfile);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export function generateTrackingCode(): string {
  const now = new Date();
  const y = now.getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `RSC-${y}-${rand}`;
}

export async function createCustomerOrder(
  orderInput: Omit<Order, 'id' | 'trackingCode' | 'orderStatus' | 'stockDeducted' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in with Google to place an order.');

  const orderId = generateTrackingCode();
  const path = `orders/${orderId}`;

  const paymentStatus: PaymentStatus =
    orderInput.paymentMethod === 'COD' ? 'Pending COD Collection' : 'Awaiting Verification';

  const initialNotes =
    orderInput.paymentMethod === 'COD'
      ? 'Order placed with Cash on Delivery. Pending store confirmation.'
      : `Order placed via ${orderInput.paymentMethod}. Payment reference awaiting admin verification.`;

  const orderDoc = {
    id: orderId,
    trackingCode: orderId,
    customerId: user.uid,
    customerEmail: orderInput.customerEmail.trim().slice(0, 200),
    customerName: orderInput.customerName.trim().slice(0, 120),
    contactNumber: orderInput.contactNumber.trim().slice(0, 30),
    deliveryAddress: orderInput.deliveryAddress.trim().slice(0, 400),
    region: orderInput.region,
    items: orderInput.items.slice(0, 30),
    subtotal: Number(orderInput.subtotal),
    shippingFee: Number(orderInput.shippingFee),
    totalAmount: Number(orderInput.totalAmount),
    paymentMethod: orderInput.paymentMethod,
    paymentReference: (orderInput.paymentReference || '').trim().slice(0, 120),
    paymentSenderNumber: (orderInput.paymentSenderNumber || '').trim().slice(0, 30),
    paymentStatus,
    orderStatus: 'Pending' as OrderStatus,
    stockDeducted: false,
    trackingNotes: initialNotes,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const trackingDoc = {
    trackingCode: orderId,
    customerId: user.uid,
    orderStatus: 'Pending' as OrderStatus,
    paymentStatus,
    paymentMethod: orderInput.paymentMethod,
    itemCount: orderInput.items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: Number(orderInput.totalAmount),
    trackingNotes: initialNotes,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'orders', orderId), orderDoc);
    batch.set(doc(db, 'orderTracking', orderId), trackingDoc);
    await batch.commit();
    return orderId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeCustomerOrders(
  customerId: string,
  onData: (orders: Order[]) => void
) {
  const path = 'orders';
  const q = query(
    collection(db, path),
    where('customerId', '==', customerId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ ...(d.data() as Order), id: d.id })));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {
        // Logged
      }
    }
  );
}

export function subscribeAllOrdersForAdmin(onData: (orders: Order[]) => void) {
  const path = 'orders';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => ({ ...(d.data() as Order), id: d.id })));
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch {
        // Logged
      }
    }
  );
}

export async function lookupOrderTracking(trackingCode: string): Promise<OrderTrackingSummary | null> {
  const cleanCode = trackingCode.trim().toUpperCase();
  if (!cleanCode || !/^[a-zA-Z0-9_\-]+$/.test(cleanCode)) return null;
  const path = `orderTracking/${cleanCode}`;
  try {
    const snap = await getDoc(doc(db, 'orderTracking', cleanCode));
    return snap.exists() ? (snap.data() as OrderTrackingSummary) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function customerSubmitPaymentRef(
  orderId: string,
  paymentReference: string,
  paymentSenderNumber: string
): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    await updateDoc(doc(db, 'orders', orderId), {
      paymentReference: paymentReference.trim().slice(0, 120),
      paymentSenderNumber: paymentSenderNumber.trim().slice(0, 30),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function customerCancelPendingOrder(orderId: string): Promise<void> {
  const path = `orders/${orderId}`;
  try {
    const batch = writeBatch(db);
    const note = 'Cancelled by customer prior to store confirmation.';
    batch.update(doc(db, 'orders', orderId), {
      orderStatus: 'Cancelled',
      trackingNotes: note,
      updatedAt: serverTimestamp(),
    });
    batch.update(doc(db, 'orderTracking', orderId), {
      orderStatus: 'Cancelled',
      trackingNotes: note,
      updatedAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Admin Order Status & Automatic Stock Deduction Transaction.
 * Automatically deducts ordered quantities from product sizeStock & total stock
 * when an order transitions to Confirmed / Processing / Shipped / Delivered (if not yet deducted).
 * Automatically restores stock if a deducted order is Cancelled.
 */
export async function adminUpdateOrderStatusAndStock(params: {
  orderId: string;
  nextOrderStatus: OrderStatus;
  nextPaymentStatus: PaymentStatus;
  trackingNotes: string;
}): Promise<{ stockAction: 'deducted' | 'restored' | 'unchanged' }> {
  const { orderId, nextOrderStatus, nextPaymentStatus, trackingNotes } = params;
  const path = `orders/${orderId}`;

  try {
    let stockAction: 'deducted' | 'restored' | 'unchanged' = 'unchanged';

    await runTransaction(db, async (tx) => {
      const orderRef = doc(db, 'orders', orderId);
      const trackingRef = doc(db, 'orderTracking', orderId);

      const orderSnap = await tx.get(orderRef);
      if (!orderSnap.exists()) {
        throw new Error(`Order ${orderId} not found.`);
      }
      const order = orderSnap.data() as Order;

      const shouldDeduct =
        !order.stockDeducted &&
        (nextOrderStatus === 'Confirmed' ||
          nextOrderStatus === 'Processing' ||
          nextOrderStatus === 'Shipped' ||
          nextOrderStatus === 'Delivered');

      const shouldRestore = order.stockDeducted && nextOrderStatus === 'Cancelled';

      let nextStockDeducted = order.stockDeducted;

      if (shouldDeduct || shouldRestore) {
        // Group quantities per productId first so multiple sizes of the same shoe combine cleanly
        const uniqueProductIds = Array.from(new Set(order.items.map((i) => i.productId)));
        const productSnaps = await Promise.all(
          uniqueProductIds.map((pid) => tx.get(doc(db, 'products', pid)))
        );

        const productMap = new Map<string, Product>();
        productSnaps.forEach((snap, idx) => {
          if (snap.exists()) {
            productMap.set(uniqueProductIds[idx], snap.data() as Product);
          }
        });

        for (const item of order.items) {
          const prod = productMap.get(item.productId);
          if (!prod) continue;

          const sizeStock = { ...(prod.sizeStock || {}) };
          const currentQty = Number(sizeStock[item.size] ?? 0);

          if (shouldDeduct) {
            if (currentQty < item.quantity) {
              throw new Error(
                `Insufficient stock for ${prod.name} (${item.size}). Available: ${currentQty}, Ordered: ${item.quantity}.`
              );
            }
            sizeStock[item.size] = currentQty - item.quantity;
          } else if (shouldRestore) {
            sizeStock[item.size] = currentQty + item.quantity;
          }

          const totalStock = Object.values(sizeStock).reduce((sum, v) => sum + Number(v || 0), 0);
          productMap.set(item.productId, {
            ...prod,
            sizeStock,
            stock: totalStock,
          });
        }

        for (const [pid, updatedProd] of productMap.entries()) {
          tx.update(doc(db, 'products', pid), {
            sizeStock: updatedProd.sizeStock,
            stock: updatedProd.stock,
            updatedAt: serverTimestamp(),
          });
        }

        if (shouldDeduct) {
          nextStockDeducted = true;
          stockAction = 'deducted';
        } else if (shouldRestore) {
          nextStockDeducted = false;
          stockAction = 'restored';
        }
      }

      const cleanNotes = trackingNotes.trim().slice(0, 500);

      tx.update(orderRef, {
        orderStatus: nextOrderStatus,
        paymentStatus: nextPaymentStatus,
        stockDeducted: nextStockDeducted,
        trackingNotes: cleanNotes,
        updatedAt: serverTimestamp(),
      });

      tx.update(trackingRef, {
        orderStatus: nextOrderStatus,
        paymentStatus: nextPaymentStatus,
        trackingNotes: cleanNotes,
        updatedAt: serverTimestamp(),
      });
    });

    return { stockAction };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Insufficient stock')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
