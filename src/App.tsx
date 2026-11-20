import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Menu, ShoppingBag, X } from 'lucide-react';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  db,
  signInWithGoogleCustomer,
  signOutStoreUser,
  subscribeToAuth,
  testFirestoreConnection,
} from './lib/firebase';
import { CartItem, Order, Product, getEffectivePrice } from './types/store';
import { SEED_PRODUCTS } from './data/seedCatalog';
import {
  seedInitialCatalogIfEmpty,
  subscribeCustomerOrders,
  subscribeProducts,
} from './services/storeService';
import { ErrorBoundary } from './components/ErrorBoundary';
import { StorefrontView } from './components/StorefrontView';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutView } from './components/CheckoutView';
import { TrackOrderView } from './components/TrackOrderView';
import { CustomerAccountView } from './components/CustomerAccountView';
import { AdminDashboardView } from './components/AdminDashboardView';
import { RobotChatWidget } from './components/RobotChatWidget';

type AppRoute = 'shop' | 'checkout' | 'track' | 'account' | 'admin';

const CART_STORAGE_KEY = 'rsc_shopping_bag_v1';

function StoreApp() {
  const [route, setRoute] = useState<AppRoute>('shop');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [firestoreProducts, setFirestoreProducts] = useState<Product[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [trackingLookupCode, setTrackingLookupCode] = useState('');

  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore storage quota errors
    }
  }, [cart]);

  useEffect(() => {
    testFirestoreConnection();

    // Check URL ?track= parameter (e.g., return from PayMongo/Maya checkout)
    const params = new URLSearchParams(window.location.search);
    const trackParam = params.get('track');
    if (trackParam) {
      setTrackingLookupCode(trackParam);
      setRoute('track');
    }

    const unsubAuth = subscribeToAuth(async (authUser) => {
      setUser(authUser);
      if (!authUser) {
        setIsAdmin(false);
        setCustomerOrders([]);
        return;
      }

      const isBootAdmin =
        authUser.emailVerified && authUser.email === BOOTSTRAP_ADMIN_EMAIL;
      if (isBootAdmin) {
        setIsAdmin(true);
        return;
      }

      try {
        const adminSnap = await getDoc(doc(db, 'admins', authUser.uid));
        setIsAdmin(adminSnap.exists() && authUser.emailVerified);
      } catch {
        setIsAdmin(false);
      }
    });

    const unsubProducts = subscribeProducts(
      (items) => {
        setFirestoreProducts(items);
        setProductsLoaded(true);
      },
      () => {
        setProductsLoaded(true);
      }
    );

    return () => {
      unsubAuth();
      unsubProducts();
    };
  }, []);

  // Automatically initialize Firestore catalog once an admin signs in and catalog is empty
  useEffect(() => {
    if (isAdmin && productsLoaded && firestoreProducts.length === 0) {
      seedInitialCatalogIfEmpty().catch(() => undefined);
    }
  }, [isAdmin, productsLoaded, firestoreProducts.length]);

  useEffect(() => {
    if (!user) return;
    const unsubOrders = subscribeCustomerOrders(user.uid, (orders) => {
      setCustomerOrders(orders);
    });
    return () => unsubOrders();
  }, [user]);

  const displayProducts: Product[] = useMemo(() => {
    if (firestoreProducts.length > 0) return firestoreProducts;
    return SEED_PRODUCTS as Product[];
  }, [firestoreProducts]);

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const handleAddToCart = (
    product: Product,
    size: string,
    color: string,
    quantity: number
  ) => {
    const unitPrice = getEffectivePrice(product.price, product.discountPercent);
    const maxStock = Number(product.sizeStock?.[size] ?? 0);

    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (i) => i.productId === product.id && i.size === size && i.color === color
      );
      if (existingIdx >= 0) {
        const updated = [...prev];
        const nextQty = Math.min(maxStock, updated[existingIdx].quantity + quantity);
        updated[existingIdx] = { ...updated[existingIdx], quantity: nextQty, maxStock };
        return updated;
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          brand: product.brand,
          imageUrl: product.imageUrl,
          size,
          color,
          unitPrice,
          originalPrice: product.price,
          discountPercent: product.discountPercent,
          quantity: Math.min(maxStock, quantity),
          maxStock,
        },
      ];
    });
    setSelectedProduct(null);
    setCartOpen(true);
  };

  const handleUpdateCartQty = (
    productId: string,
    size: string,
    color: string,
    nextQty: number
  ) => {
    if (nextQty <= 0) {
      handleRemoveCartItem(productId, size, color);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item.productId === productId && item.size === size && item.color === color
          ? { ...item, quantity: Math.min(item.maxStock, nextQty) }
          : item
      )
    );
  };

  const handleRemoveCartItem = (productId: string, size: string, color: string) => {
    setCart((prev) =>
      prev.filter(
        (item) =>
          !(item.productId === productId && item.size === size && item.color === color)
      )
    );
  };

  const handleNavigate = (nextRoute: AppRoute) => {
    setRoute(nextRoute);
    setMobileNavOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSignIn = async () => {
    await signInWithGoogleCustomer();
  };

  const handleSignOut = async () => {
    await signOutStoreUser();
    if (route === 'admin') setRoute('shop');
  };

  const navItems: Array<{ id: AppRoute; label: string }> = [
    { id: 'shop', label: 'Collection' },
    { id: 'track', label: 'Track Order' },
    { id: 'account', label: user ? 'My Account' : 'Sign In' },
    { id: 'admin', label: 'Admin' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-950">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-zinc-200">
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark (single text element) */}
          <button
            type="button"
            onClick={() => handleNavigate('shop')}
            className="font-display text-base sm:text-lg font-bold tracking-tight text-zinc-950 whitespace-nowrap shrink-0 text-left"
          >
            RYAN'S SHOES COLLECTION
          </button>

          {/* Zone 2: Clean Text Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                  route === item.id
                    ? 'text-zinc-950 border-zinc-950'
                    : 'border-transparent hover:text-zinc-950'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 Primary Action + Mobile Menu Trigger */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setCartOpen(true)}
              className="px-4 py-2 bg-zinc-950 text-white text-xs sm:text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 tabular-nums"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Bag ({cartCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileNavOpen((o) => !o)}
              className="md:hidden p-2 text-zinc-700 hover:text-zinc-950 border border-zinc-200 rounded-lg"
              aria-label="Toggle navigation menu"
            >
              {mobileNavOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer Nav */}
        {mobileNavOpen && (
          <div className="md:hidden border-t border-zinc-200 bg-white px-6 py-3 flex flex-col gap-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavigate(item.id)}
                className={`text-left py-2 text-sm font-medium ${
                  route === item.id ? 'text-zinc-950 font-semibold' : 'text-zinc-600'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {route === 'shop' && (
          <StorefrontView
            products={displayProducts}
            loading={!productsLoaded && firestoreProducts.length === 0 && false}
            onSelectProduct={(prod) => setSelectedProduct(prod)}
            onNavigateTrack={() => handleNavigate('track')}
          />
        )}

        {route === 'checkout' && (
          <CheckoutView
            user={user}
            items={cart}
            onSignIn={handleSignIn}
            onBackToShop={() => handleNavigate('shop')}
            onOrderSuccess={() => setCart([])}
            onTrackOrder={(code) => {
              setTrackingLookupCode(code);
              handleNavigate('track');
            }}
          />
        )}

        {route === 'track' && (
          <TrackOrderView
            initialTrackingCode={trackingLookupCode}
            customerOrders={customerOrders}
          />
        )}

        {route === 'account' && (
          <CustomerAccountView
            user={user}
            orders={customerOrders}
            onSignIn={handleSignIn}
            onSignOut={handleSignOut}
            onTrackOrder={(code) => {
              setTrackingLookupCode(code);
              handleNavigate('track');
            }}
          />
        )}

        {route === 'admin' && (
          <AdminDashboardView
            user={user}
            isAdmin={isAdmin}
            products={displayProducts}
            onSignIn={handleSignIn}
          />
        )}
      </main>

      {/* Quiet Editorial Footer */}
      <footer className="bg-white border-t border-zinc-200">
        <div className="max-w-[1280px] mx-auto px-6 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="font-display text-sm font-bold text-zinc-950 tracking-tight">
              RYAN'S SHOES COLLECTION
            </p>
            <p className="text-xs text-zinc-500 mt-1">
              Footwear for ages 10 to 60 · Nationwide Philippines shipping · COD, GCash & Maya
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-zinc-600">
            <button type="button" onClick={() => handleNavigate('shop')} className="hover:text-zinc-950">
              Collection
            </button>
            <button type="button" onClick={() => handleNavigate('track')} className="hover:text-zinc-950">
              Track Order
            </button>
            <button type="button" onClick={() => handleNavigate('account')} className="hover:text-zinc-950">
              Customer Account
            </button>
            <button type="button" onClick={() => handleNavigate('admin')} className="hover:text-zinc-950">
              Admin Dashboard
            </button>
            <span className="text-zinc-400">© {new Date().getFullYear()} RYAN'S SHOES COLLECTION</span>
          </div>
        </div>
      </footer>

      {/* Modals & Drawers */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={handleAddToCart}
      />

      <CartDrawer
        open={cartOpen}
        items={cart}
        onClose={() => setCartOpen(false)}
        onUpdateQty={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onCheckout={() => {
          setCartOpen(false);
          handleNavigate('checkout');
        }}
      />

      <RobotChatWidget
        products={displayProducts}
        onSelectProduct={(prod) => setSelectedProduct(prod)}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreApp />
    </ErrorBoundary>
  );
}
