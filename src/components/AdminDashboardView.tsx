import React, { useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  DatabaseBackup,
  Plus,
  Pencil,
  Trash2,
  Upload,
  FolderOpen,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import {
  AgeGroup,
  CustomerProfile,
  Order,
  OrderStatus,
  PaymentStatus,
  Product,
  ProductCategory,
  formatDateTime,
  formatPHP,
  getEffectivePrice,
} from '../types/store';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  GOOGLE_DRIVE_FOLDER_ID,
  GOOGLE_SHEETS_ID,
  connectGoogleWorkspace,
  getWorkspaceAccessToken,
} from '../lib/firebase';
import {
  adminUpdateOrderStatusAndStock,
  fetchAllCustomersForAdmin,
  removeProduct,
  saveProduct,
  seedInitialCatalogIfEmpty,
  subscribeAllOrdersForAdmin,
} from '../services/storeService';
import { GoogleSignInButton } from './GoogleSignInButton';
import { ResilientImage } from './ResilientImage';
import { ConfirmActionModal } from './ConfirmActionModal';

interface AdminDashboardViewProps {
  user: User | null;
  isAdmin: boolean;
  products: Product[];
  onSignIn: () => Promise<void>;
}

type AdminTab = 'overview' | 'products' | 'orders' | 'customers' | 'backups';

const CATEGORIES: ProductCategory[] = [
  'Running',
  'Court & Casual',
  'Loafers & Dress',
  'Trail & Outdoor',
  'Kids & Youth',
  'Comfort Walking',
];

const AGE_GROUPS: AgeGroup[] = [
  'All Ages (10-60)',
  'Kids & Youth (10-17)',
  'Adults (18-45)',
  'Mature Comfort (46-60)',
];

const ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Processing',
  'Shipped',
  'Delivered',
  'Cancelled',
];

const PAYMENT_STATUSES: PaymentStatus[] = [
  'Pending COD Collection',
  'Awaiting Verification',
  'Verified & Paid',
  'Payment Rejected',
  'Refunded',
];

const STUDIO_PRESET_IMAGES = [
  { label: 'Cobalt Knit Runner', url: '/src/assets/images/shoe_runner_cobalt_1795196861534.jpg' },
  { label: 'Ivory Court Sneaker', url: '/src/assets/images/shoe_court_ivory_1795196862813.jpg' },
  { label: 'Espresso Penny Loafer', url: '/src/assets/images/shoe_loafer_espresso_1795196860943.jpg' },
  { label: 'Obsidian Trail Shoe', url: '/src/assets/images/shoe_trail_obsidian_1795196862883.jpg' },
  { label: 'Crimson Youth Sneaker', url: '/src/assets/images/shoe_youth_crimson_1795196861921.jpg' },
  { label: 'Sand Comfort Slip-On', url: '/src/assets/images/shoe_slipon_sand_1795196862601.jpg' },
];

interface DriveFileItem {
  id: string;
  name: string;
  mimeType?: string;
  thumbnailLink?: string;
  webViewLink?: string;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  user,
  isAdmin,
  products,
  onSignIn,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState<'All' | OrderStatus>('All');

  const [bannerMessage, setBannerMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [workspaceToken, setWorkspaceToken] = useState<string | null>(() => getWorkspaceAccessToken());
  const [connectingWorkspace, setConnectingWorkspace] = useState(false);

  // Product Form Modal state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [pName, setPName] = useState('');
  const [pBrand, setPBrand] = useState('');
  const [pCategory, setPCategory] = useState<ProductCategory>('Running');
  const [pAgeGroup, setPAgeGroup] = useState<AgeGroup>('All Ages (10-60)');
  const [pDescription, setPDescription] = useState('');
  const [pPrice, setPPrice] = useState('2995');
  const [pDiscount, setPDiscount] = useState('0');
  const [pImageUrl, setPImageUrl] = useState(STUDIO_PRESET_IMAGES[0].url);
  const [pDriveFileId, setPDriveFileId] = useState('');
  const [pColorsText, setPColorsText] = useState('Classic Black, Chalk White');
  const [pSizeStockText, setPSizeStockText] = useState('US 6: 6, US 7: 8, US 8: 10, US 9: 8, US 10: 5');
  const [pLowThreshold, setPLowThreshold] = useState('5');
  const [pFeatured, setPFeatured] = useState(true);
  const [pNewArrival, setPNewArrival] = useState(true);
  const [pBestSeller, setPBestSeller] = useState(false);
  const [pActive, setPActive] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  const [productModalError, setProductModalError] = useState('');

  // Drive Upload & Picker
  const [uploadingDrive, setUploadingDrive] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveFileItem[]>([]);
  const [loadingDriveFiles, setLoadingDriveFiles] = useState(false);

  // Google Sheets Backup State
  const [sheetsMeta, setSheetsMeta] = useState<{ title: string; tabs: Array<{ title: string }> } | null>(null);
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);
  const [syncingSheets, setSyncingSheets] = useState(false);

  // Delete Product Confirm State
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState(false);

  // Order Update State
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    const unsubOrders = subscribeAllOrdersForAdmin((data) => setOrders(data));
    fetchAllCustomersForAdmin()
      .then((list) => setCustomers(list))
      .catch(() => undefined);
    return () => unsubOrders();
  }, [isAdmin]);

  // Analytics Calculations
  const analytics = useMemo(() => {
    const validOrders = orders.filter((o) => o.orderStatus !== 'Cancelled');
    const totalRevenue = validOrders.reduce((s, o) => s + Number(o.totalAmount || 0), 0);
    const pendingOrders = orders.filter((o) => o.orderStatus === 'Pending').length;
    const completedOrders = orders.filter((o) => o.orderStatus === 'Delivered').length;
    const totalUnits = products.reduce((s, p) => s + Number(p.stock || 0), 0);
    const lowStockProducts = products.filter((p) => p.stock <= (p.lowStockThreshold ?? 5));

    const paymentBreakdown: Record<string, number> = { COD: 0, GCash: 0, Maya: 0 };
    validOrders.forEach((o) => {
      paymentBreakdown[o.paymentMethod] = (paymentBreakdown[o.paymentMethod] || 0) + o.totalAmount;
    });

    const categoryInventory: Record<string, number> = {};
    products.forEach((p) => {
      categoryInventory[p.category] = (categoryInventory[p.category] || 0) + p.stock;
    });

    return {
      totalRevenue,
      totalOrders: orders.length,
      pendingOrders,
      completedOrders,
      totalUnits,
      lowStockProducts,
      paymentBreakdown,
      categoryInventory,
    };
  }, [orders, products]);

  const filteredOrders = useMemo(() => {
    if (orderStatusFilter === 'All') return orders;
    return orders.filter((o) => o.orderStatus === orderStatusFilter);
  }, [orders, orderStatusFilter]);

  const openNewProductModal = () => {
    setEditingProduct(null);
    setPName('');
    setPBrand("Ryan's Footwear");
    setPCategory('Running');
    setPAgeGroup('All Ages (10-60)');
    setPDescription('');
    setPPrice('2995');
    setPDiscount('0');
    setPImageUrl(STUDIO_PRESET_IMAGES[0].url);
    setPDriveFileId('');
    setPColorsText('Slate Gray, Chalk White');
    setPSizeStockText('US 6: 5, US 7: 8, US 8: 10, US 9: 7, US 10: 4');
    setPLowThreshold('5');
    setPFeatured(false);
    setPNewArrival(true);
    setPBestSeller(false);
    setPActive(true);
    setProductModalError('');
    setProductModalOpen(true);
  };

  const openEditProductModal = (prod: Product) => {
    setEditingProduct(prod);
    setPName(prod.name);
    setPBrand(prod.brand);
    setPCategory(prod.category);
    setPAgeGroup(prod.ageGroup);
    setPDescription(prod.description);
    setPPrice(String(prod.price));
    setPDiscount(String(prod.discountPercent || 0));
    setPImageUrl(prod.imageUrl);
    setPDriveFileId(prod.driveFileId || '');
    setPColorsText(prod.colors.join(', '));
    setPSizeStockText(
      prod.sizes.map((s) => `${s}: ${prod.sizeStock?.[s] ?? 0}`).join(', ')
    );
    setPLowThreshold(String(prod.lowStockThreshold ?? 5));
    setPFeatured(Boolean(prod.featured));
    setPNewArrival(Boolean(prod.newArrival));
    setPBestSeller(Boolean(prod.bestSeller));
    setPActive(prod.active !== false);
    setProductModalError('');
    setProductModalOpen(true);
  };

  const parseSizeStock = (raw: string): { sizes: string[]; sizeStock: Record<string, number>; stock: number } => {
    const entries = raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    const sizes: string[] = [];
    const sizeStock: Record<string, number> = {};
    let stock = 0;

    for (const entry of entries) {
      const [labelPart, qtyPart] = entry.split(':');
      const sizeLabel = (labelPart || '').trim();
      if (!sizeLabel) continue;
      const qty = Math.max(0, Math.floor(Number((qtyPart || '0').trim()) || 0));
      if (!sizes.includes(sizeLabel)) sizes.push(sizeLabel);
      sizeStock[sizeLabel] = qty;
      stock += qty;
    }

    if (sizes.length === 0) {
      sizes.push('US 8');
      sizeStock['US 8'] = 0;
    }

    return { sizes, sizeStock, stock };
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProduct(true);
    setBannerMessage(null);
    setProductModalError('');
    try {
      const cleanName = pName.trim();
      const cleanBrand = pBrand.trim();
      const cleanDescription = pDescription.trim();
      const cleanImageUrl = pImageUrl.trim();
      const parsedPrice = Number(pPrice);
      const parsedDiscount = Number(pDiscount || 0);
      const parsedThreshold = Math.floor(Number(pLowThreshold || 0));

      if (!cleanName) {
        throw new Error('Product name is required (at least 1 non-space character).');
      }
      if (!cleanBrand) {
        throw new Error('Brand name is required (at least 1 non-space character).');
      }
      if (!cleanDescription) {
        throw new Error('Product description is required (at least 1 non-space character).');
      }
      if (!Number.isFinite(parsedPrice) || parsedPrice <= 0 || parsedPrice > 500000) {
        throw new Error('Price must be between ₱1 and ₱500,000.');
      }
      if (!Number.isFinite(parsedDiscount) || parsedDiscount < 0 || parsedDiscount > 90) {
        throw new Error('Discount must be between 0% and 90%.');
      }
      if (!Number.isFinite(parsedThreshold) || parsedThreshold < 0 || parsedThreshold > 1000) {
        throw new Error('Low-stock threshold must be between 0 and 1,000.');
      }
      if (!cleanImageUrl) {
        throw new Error('Product image URL is required.');
      }
      if (cleanImageUrl.length > 2000) {
        throw new Error('Image URL is too long (max 2,000 characters). Please upload your image to Google Drive instead of pasting raw image data.');
      }

      const { sizes, sizeStock, stock } = parseSizeStock(pSizeStockText);
      if (stock > 100000) {
        throw new Error('Total stock across all sizes cannot exceed 100,000 pairs.');
      }

      const colors = pColorsText
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

      const slug = cleanName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40);

      const generatedId =
        editingProduct?.id ||
        `rsc-${slug || 'shoe'}-${Date.now().toString().slice(-4)}`;

      await saveProduct(
        {
          id: generatedId,
          name: cleanName,
          brand: cleanBrand,
          category: pCategory,
          ageGroup: pAgeGroup,
          description: cleanDescription,
          price: parsedPrice,
          discountPercent: parsedDiscount,
          imageUrl: cleanImageUrl,
          driveFileId: pDriveFileId.trim() || undefined,
          colors: colors.length > 0 ? colors : ['Classic Black'],
          sizes,
          sizeStock,
          stock,
          lowStockThreshold: parsedThreshold,
          featured: pFeatured,
          newArrival: pNewArrival,
          bestSeller: pBestSeller,
          active: pActive,
        },
        !editingProduct,
        editingProduct?.createdAt
      );

      setProductModalOpen(false);
      setBannerMessage({
        type: 'success',
        text: editingProduct ? `Updated "${cleanName}" in Firestore.` : `Added "${cleanName}" to catalog.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save product.';
      setProductModalError(msg);
      setBannerMessage({
        type: 'error',
        text: msg,
      });
    } finally {
      setSavingProduct(false);
    }
  };

  const handleConfirmDeleteProduct = async () => {
    if (!deleteTarget) return;
    setDeletingProduct(true);
    try {
      await removeProduct(deleteTarget.id);
      setBannerMessage({ type: 'success', text: `Deleted "${deleteTarget.name}" from catalog.` });
      setDeleteTarget(null);
    } catch (err) {
      setBannerMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to delete product.',
      });
    } finally {
      setDeletingProduct(false);
    }
  };

  const handleConnectWorkspace = async () => {
    setConnectingWorkspace(true);
    setBannerMessage(null);
    try {
      const { accessToken } = await connectGoogleWorkspace();
      setWorkspaceToken(accessToken);
      setBannerMessage({
        type: 'success',
        text: 'Connected Google Drive & Google Sheets for image storage and backups.',
      });
      // Immediately inspect spreadsheet metadata
      const metaRes = await fetch(`/api/workspace/sheets/metadata?spreadsheetId=${encodeURIComponent(GOOGLE_SHEETS_ID)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (metaRes.ok) {
        const meta = await metaRes.json();
        setSheetsMeta(meta);
      }
    } catch (err) {
      setBannerMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Google Workspace connection failed.',
      });
    } finally {
      setConnectingWorkspace(false);
    }
  };

  const handleDriveFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProductModalError('');
    setUploadingDrive(true);
    try {
      let token = workspaceToken || getWorkspaceAccessToken();
      if (!token) {
        const connected = await connectGoogleWorkspace();
        token = connected.accessToken;
        setWorkspaceToken(token);
      }

      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read image file.'));
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/workspace/drive/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || 'image/jpeg',
          base64Data,
          folderId: GOOGLE_DRIVE_FOLDER_ID,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Google Drive upload failed.');

      setPImageUrl(data.imageUrl);
      setPDriveFileId(data.fileId);
      setBannerMessage({
        type: 'success',
        text: `Uploaded "${file.name}" to Google Drive folder.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed.';
      setProductModalError(msg);
      setBannerMessage({
        type: 'error',
        text: msg,
      });
    } finally {
      setUploadingDrive(false);
      e.target.value = '';
    }
  };

  const handleLoadDriveImages = async () => {
    const token = workspaceToken || getWorkspaceAccessToken();
    if (!token) {
      setBannerMessage({ type: 'error', text: 'Connect Google Drive & Sheets first.' });
      return;
    }
    setLoadingDriveFiles(true);
    try {
      const res = await fetch(
        `/api/workspace/drive/files?folderId=${encodeURIComponent(GOOGLE_DRIVE_FOLDER_ID)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to list Drive folder.');
      setDriveFiles(data.files || []);
    } catch (err) {
      setBannerMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to list Drive folder.',
      });
    } finally {
      setLoadingDriveFiles(false);
    }
  };

  const handleOrderTransition = async (
    order: Order,
    nextOrderStatus: OrderStatus,
    nextPaymentStatus: PaymentStatus,
    notes: string
  ) => {
    setUpdatingOrderId(order.id);
    setBannerMessage(null);
    try {
      const res = await adminUpdateOrderStatusAndStock({
        orderId: order.id,
        nextOrderStatus,
        nextPaymentStatus,
        trackingNotes: notes,
      });

      const stockNote =
        res.stockAction === 'deducted'
          ? ' Stock was automatically deducted from inventory.'
          : res.stockAction === 'restored'
            ? ' Previously deducted stock was restored to inventory.'
            : '';

      setBannerMessage({
        type: 'success',
        text: `Order ${order.trackingCode} updated to ${nextOrderStatus} (${nextPaymentStatus}).${stockNote}`,
      });
    } catch (err) {
      setBannerMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update order.',
      });
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleSyncSheetsBackup = async () => {
    const token = workspaceToken || getWorkspaceAccessToken();
    if (!token) return;
    setSyncingSheets(true);
    try {
      const res = await fetch('/api/workspace/sheets/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          spreadsheetId: GOOGLE_SHEETS_ID,
          products,
          orders: orders.map((o) => ({
            ...o,
            createdAtLabel: formatDateTime(o.createdAt),
          })),
          summary: {
            totalRevenue: analytics.totalRevenue,
            totalOrders: analytics.totalOrders,
            pendingOrders: analytics.pendingOrders,
            completedOrders: analytics.completedOrders,
            totalUnits: analytics.totalUnits,
            lowStockCount: analytics.lowStockProducts.length,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Google Sheets sync failed.');

      setSyncConfirmOpen(false);
      setBannerMessage({
        type: 'success',
        text: `Synced ${data.updatedCells} cells across ${data.syncedTabs.join(', ')} in Google Sheets (${data.spreadsheetTitle}).`,
      });
    } catch (err) {
      setSyncConfirmOpen(false);
      setBannerMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Sheets backup failed.',
      });
    } finally {
      setSyncingSheets(false);
    }
  };

  const downloadCsvReport = (type: 'inventory' | 'orders') => {
    const rows =
      type === 'inventory'
        ? [
            ['ID', 'Name', 'Brand', 'Category', 'Age Group', 'Price', 'Discount %', 'Stock', 'Low Threshold'],
            ...products.map((p) => [
              p.id,
              `"${p.name.replace(/"/g, '""')}"`,
              `"${p.brand.replace(/"/g, '""')}"`,
              p.category,
              p.ageGroup,
              p.price,
              p.discountPercent,
              p.stock,
              p.lowStockThreshold,
            ]),
          ]
        : [
            ['Tracking Code', 'Customer', 'Contact', 'Region', 'Payment Method', 'Reference', 'Payment Status', 'Order Status', 'Total PHP', 'Stock Deducted'],
            ...orders.map((o) => [
              o.trackingCode,
              `"${o.customerName.replace(/"/g, '""')}"`,
              o.contactNumber,
              o.region,
              o.paymentMethod,
              o.paymentReference || 'N/A',
              o.paymentStatus,
              o.orderStatus,
              o.totalAmount,
              o.stockDeducted ? 'Yes' : 'No',
            ]),
          ];

    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ryans-shoes-${type}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadJsonBackup = () => {
    const payload = {
      brand: "RYAN'S SHOES COLLECTION",
      exportedAt: new Date().toISOString(),
      products,
      orders,
      customers,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ryans-shoes-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16">
        <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center">
          <p className="text-xs font-medium text-zinc-500 mb-2">RYAN'S SHOES COLLECTION</p>
          <h1 className="font-display text-2xl font-bold text-zinc-950 mb-2">
            Store Admin Dashboard
          </h1>
          <p className="text-sm text-zinc-600 mb-6">
            Sign in with your authorized store administrator Google account ({BOOTSTRAP_ADMIN_EMAIL}) to manage products, verify payments, confirm orders, and sync Google Sheets backups.
          </p>
          <div className="flex justify-center">
            <GoogleSignInButton onClick={onSignIn} label="Sign in with Google Admin" />
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16">
        <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center">
          <p className="text-xs font-medium text-red-700 mb-2">Restricted Area</p>
          <h1 className="font-display text-2xl font-bold text-zinc-950 mb-2">
            Administrator Access Required
          </h1>
          <p className="text-sm text-zinc-600">
            Signed in as <span className="font-medium text-zinc-900">{user.email}</span>. Only authorized store administrators ({BOOTSTRAP_ADMIN_EMAIL}) can access inventory, payment verification, and database backup controls.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sidebar Navigation */}
        <aside className="lg:col-span-3 bg-white border border-zinc-200 rounded-xl p-4 space-y-1">
          <div className="px-3 py-2 mb-2 border-b border-zinc-100">
            <p className="text-xs font-medium text-zinc-500">Store Admin Console</p>
            <p className="font-display text-sm font-bold text-zinc-950 truncate">
              RYAN'S SHOES COLLECTION
            </p>
          </div>

          {[
            { id: 'overview', label: 'Overview & Analytics', icon: LayoutDashboard },
            { id: 'products', label: `Products (${products.length})`, icon: Package },
            { id: 'orders', label: `Orders & Payments (${orders.length})`, icon: ShoppingCart },
            { id: 'customers', label: `Customers (${customers.length})`, icon: Users },
            { id: 'backups', label: 'Sheets Backup & Drive', icon: DatabaseBackup },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id as AdminTab)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-zinc-950 text-white'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Main Workspace */}
        <div className="lg:col-span-9 space-y-6">
          {bannerMessage && (
            <div
              className={`p-4 rounded-xl border text-sm flex items-center justify-between gap-4 ${
                bannerMessage.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              <span>{bannerMessage.text}</span>
              <button
                type="button"
                onClick={() => setBannerMessage(null)}
                className="text-xs font-medium underline shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* TAB 1: OVERVIEW & ANALYTICS */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-zinc-950">
                    Sales & Inventory Overview
                  </h1>
                  <p className="text-sm text-zinc-500">
                    Live store metrics across RYAN'S SHOES COLLECTION.
                  </p>
                </div>
                {products.length === 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      const count = await seedInitialCatalogIfEmpty();
                      setBannerMessage({
                        type: 'success',
                        text: `Seeded ${count} footwear products into Firestore.`,
                      });
                    }}
                    className="px-4 py-2 bg-zinc-950 text-white text-sm font-medium rounded-lg hover:bg-zinc-800"
                  >
                    Seed Initial Catalog
                  </button>
                )}
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white border border-zinc-200 rounded-xl p-4">
                  <p className="text-xs text-zinc-500 mb-1">Total Sales</p>
                  <p className="font-display text-xl font-bold text-zinc-950 tabular-nums">
                    {formatPHP(analytics.totalRevenue)}
                  </p>
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl p-4">
                  <p className="text-xs text-zinc-500 mb-1">Total Orders</p>
                  <p className="font-display text-xl font-bold text-zinc-950 tabular-nums">
                    {analytics.totalOrders}
                  </p>
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl p-4">
                  <p className="text-xs text-zinc-500 mb-1">Pending Orders</p>
                  <p className="font-display text-xl font-bold text-amber-700 tabular-nums">
                    {analytics.pendingOrders}
                  </p>
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl p-4">
                  <p className="text-xs text-zinc-500 mb-1">Completed Orders</p>
                  <p className="font-display text-xl font-bold text-emerald-700 tabular-nums">
                    {analytics.completedOrders}
                  </p>
                </div>
                <div className="bg-white border border-zinc-200 rounded-xl p-4 col-span-2 md:col-span-1">
                  <p className="text-xs text-zinc-500 mb-1">Available Stock</p>
                  <p className="font-display text-xl font-bold text-zinc-950 tabular-nums">
                    {analytics.totalUnits} pairs
                  </p>
                </div>
              </div>

              {/* Charts Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-zinc-200 rounded-xl p-6">
                  <h2 className="font-display text-base font-semibold text-zinc-950 mb-4">
                    Sales by Payment Method
                  </h2>
                  <div className="space-y-3.5">
                    {(['COD', 'GCash', 'Maya'] as const).map((method) => {
                      const val = analytics.paymentBreakdown[method] || 0;
                      const max = Math.max(1, analytics.totalRevenue);
                      const pct = Math.round((val / max) * 100);
                      return (
                        <div key={method}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium text-zinc-800">{method}</span>
                            <span className="tabular-nums text-zinc-600">
                              {formatPHP(val)} ({pct}%)
                            </span>
                          </div>
                          <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-zinc-950 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-white border border-zinc-200 rounded-xl p-6">
                  <h2 className="font-display text-base font-semibold text-zinc-950 mb-4">
                    Inventory Units by Category
                  </h2>
                  <div className="space-y-3">
                    {CATEGORIES.map((cat) => {
                      const units = analytics.categoryInventory[cat] || 0;
                      const maxUnits = Math.max(1, analytics.totalUnits);
                      const pct = Math.round((units / maxUnits) * 100);
                      return (
                        <div key={cat}>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="font-medium text-zinc-800">{cat}</span>
                            <span className="tabular-nums text-zinc-600">{units} pairs</span>
                          </div>
                          <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-700 rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Low-Stock Notifications */}
              <div className="bg-white border border-zinc-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700" />
                    <h2 className="font-display text-base font-semibold text-zinc-950">
                      Low-Stock Notifications ({analytics.lowStockProducts.length})
                    </h2>
                  </div>
                </div>
                {analytics.lowStockProducts.length === 0 ? (
                  <p className="text-sm text-zinc-500">All products are above their low-stock thresholds.</p>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {analytics.lowStockProducts.map((p) => (
                      <div key={p.id} className="py-3 flex items-center justify-between gap-4 text-sm">
                        <div>
                          <p className="font-medium text-zinc-950">{p.name}</p>
                          <p className="text-xs text-zinc-500">
                            {p.category} · Threshold: {p.lowStockThreshold} pairs
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold text-amber-700 tabular-nums">
                            {p.stock} left
                          </span>
                          <button
                            type="button"
                            onClick={() => openEditProductModal(p)}
                            className="px-3 py-1.5 border border-zinc-200 rounded-md text-xs font-medium hover:border-zinc-950"
                          >
                            Restock
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: PRODUCTS & INVENTORY */}
          {activeTab === 'products' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-zinc-950">
                    Product & Inventory Management
                  </h1>
                  <p className="text-sm text-zinc-500">
                    Add, edit, or delete footwear models, manage per-size stock, and upload photos to Google Drive.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openNewProductModal}
                  className="px-4 py-2.5 bg-zinc-950 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 inline-flex items-center gap-2 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Shoe Product</span>
                </button>
              </div>

              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-600">
                        <th className="py-3 px-4">Product</th>
                        <th className="py-3 px-4">Category / Age</th>
                        <th className="py-3 px-4 text-right">Price</th>
                        <th className="py-3 px-4 text-right">Stock</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {products.map((prod) => (
                        <tr key={prod.id} className="hover:bg-zinc-50/70">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-md overflow-hidden bg-zinc-100 border border-zinc-200 shrink-0">
                                <ResilientImage src={prod.imageUrl} alt={prod.name} />
                              </div>
                              <div>
                                <p className="font-medium text-zinc-950">{prod.name}</p>
                                <p className="text-xs text-zinc-500">{prod.brand}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-xs text-zinc-600">
                            <p className="font-medium text-zinc-800">{prod.category}</p>
                            <p>{prod.ageGroup}</p>
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums">
                            <p className="font-medium text-zinc-950">
                              {formatPHP(getEffectivePrice(prod.price, prod.discountPercent))}
                            </p>
                            {prod.discountPercent > 0 && (
                              <p className="text-xs text-blue-700">{prod.discountPercent}% off</p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums">
                            <span
                              className={`font-medium ${
                                prod.stock <= prod.lowStockThreshold ? 'text-amber-700' : 'text-zinc-900'
                              }`}
                            >
                              {prod.stock} pairs
                            </span>
                          </td>
                          <td className="py-3 px-4 text-xs">
                            <span className={prod.active ? 'text-emerald-700 font-medium' : 'text-zinc-400'}>
                              {prod.active ? 'Active' : 'Hidden'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openEditProductModal(prod)}
                                className="p-2 text-zinc-600 hover:text-zinc-950 border border-zinc-200 rounded-md"
                                aria-label={`Edit ${prod.name}`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(prod)}
                                className="p-2 text-red-600 hover:text-red-800 border border-zinc-200 rounded-md"
                                aria-label={`Delete ${prod.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ORDERS & PAYMENTS */}
          {activeTab === 'orders' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-zinc-950">
                    Orders & Payment Verification
                  </h1>
                  <p className="text-sm text-zinc-500">
                    Confirming an order automatically deducts item quantities from warehouse inventory.
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {(['All', ...ORDER_STATUSES] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setOrderStatusFilter(status)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                        orderStatusFilter === status
                          ? 'bg-zinc-950 text-white border-zinc-950'
                          : 'bg-white text-zinc-600 border-zinc-200 hover:text-zinc-950'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {filteredOrders.length === 0 ? (
                <div className="bg-white border border-zinc-200 rounded-xl p-10 text-center text-sm text-zinc-500">
                  No orders in this status filter.
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredOrders.map((order) => (
                    <div
                      key={order.id}
                      className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4 pb-3 border-b border-zinc-100">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-sm font-bold text-zinc-950">
                              {order.trackingCode}
                            </span>
                            <span className="text-xs text-zinc-500">
                              {formatDateTime(order.createdAt)}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-zinc-900 mt-1">
                            {order.customerName} · {order.contactNumber}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {order.deliveryAddress} ({order.region})
                          </p>
                        </div>

                        <div className="text-left sm:text-right">
                          <p className="font-display text-lg font-bold text-zinc-950 tabular-nums">
                            {formatPHP(order.totalAmount)}
                          </p>
                          <p className="text-xs font-medium text-zinc-700">
                            {order.paymentMethod} · {order.paymentStatus}
                          </p>
                          {order.paymentReference && (
                            <p className="text-xs font-mono text-blue-700 mt-0.5">
                              Ref: {order.paymentReference} ({order.paymentSenderNumber})
                            </p>
                          )}
                          <p className="text-xs text-zinc-500 mt-0.5">
                            Stock Deducted: {order.stockDeducted ? 'Yes' : 'Pending Confirmation'}
                          </p>
                        </div>
                      </div>

                      <div className="text-xs text-zinc-700 space-y-1">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between">
                            <span>
                              {item.quantity}x {item.name} — {item.size}, {item.color}
                            </span>
                            <span className="tabular-nums font-medium">{formatPHP(item.lineTotal)}</span>
                          </div>
                        ))}
                      </div>

                      {/* Quick Action Controls */}
                      <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {order.paymentMethod !== 'COD' &&
                            order.paymentStatus === 'Awaiting Verification' && (
                              <button
                                type="button"
                                disabled={updatingOrderId === order.id}
                                onClick={() =>
                                  handleOrderTransition(
                                    order,
                                    order.orderStatus === 'Pending' ? 'Confirmed' : order.orderStatus,
                                    'Verified & Paid',
                                    `${order.paymentMethod} reference ${order.paymentReference} verified by admin.`
                                  )
                                }
                                className="px-3.5 py-1.5 bg-blue-700 text-white text-xs font-medium rounded-md hover:bg-blue-800 inline-flex items-center gap-1.5"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Verify Payment & Confirm</span>
                              </button>
                            )}

                          {order.orderStatus === 'Pending' && (
                            <button
                              type="button"
                              disabled={updatingOrderId === order.id}
                              onClick={() =>
                                handleOrderTransition(
                                  order,
                                  'Confirmed',
                                  order.paymentStatus,
                                  'Order confirmed. Inventory automatically deducted.'
                                )
                              }
                              className="px-3.5 py-1.5 bg-zinc-950 text-white text-xs font-medium rounded-md hover:bg-zinc-800"
                            >
                              Confirm Order (Deduct Stock)
                            </button>
                          )}

                          {order.orderStatus === 'Confirmed' && (
                            <button
                              type="button"
                              disabled={updatingOrderId === order.id}
                              onClick={() =>
                                handleOrderTransition(
                                  order,
                                  'Processing',
                                  order.paymentStatus,
                                  'Order packed and preparing for courier pickup.'
                                )
                              }
                              className="px-3.5 py-1.5 bg-zinc-950 text-white text-xs font-medium rounded-md"
                            >
                              Mark Processing
                            </button>
                          )}

                          {order.orderStatus === 'Processing' && (
                            <button
                              type="button"
                              disabled={updatingOrderId === order.id}
                              onClick={() =>
                                handleOrderTransition(
                                  order,
                                  'Shipped',
                                  order.paymentStatus,
                                  'Handed over to Philippine courier for delivery.'
                                )
                              }
                              className="px-3.5 py-1.5 bg-zinc-950 text-white text-xs font-medium rounded-md"
                            >
                              Mark Shipped
                            </button>
                          )}

                          {order.orderStatus === 'Shipped' && (
                            <button
                              type="button"
                              disabled={updatingOrderId === order.id}
                              onClick={() =>
                                handleOrderTransition(
                                  order,
                                  'Delivered',
                                  order.paymentMethod === 'COD' ? 'Verified & Paid' : order.paymentStatus,
                                  'Delivered to customer.'
                                )
                              }
                              className="px-3.5 py-1.5 bg-emerald-700 text-white text-xs font-medium rounded-md"
                            >
                              Mark Delivered
                            </button>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            aria-label="Manual order status override"
                            value={order.orderStatus}
                            disabled={updatingOrderId === order.id}
                            onChange={(e) =>
                              handleOrderTransition(
                                order,
                                e.target.value as OrderStatus,
                                order.paymentStatus,
                                `Status updated to ${e.target.value} by admin.`
                              )
                            }
                            className="px-2.5 py-1.5 border border-zinc-200 rounded-md text-xs bg-white"
                          >
                            {ORDER_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>

                          <select
                            aria-label="Manual payment status override"
                            value={order.paymentStatus}
                            disabled={updatingOrderId === order.id}
                            onChange={(e) =>
                              handleOrderTransition(
                                order,
                                order.orderStatus,
                                e.target.value as PaymentStatus,
                                `Payment status updated to ${e.target.value}.`
                              )
                            }
                            className="px-2.5 py-1.5 border border-zinc-200 rounded-md text-xs bg-white"
                          >
                            {PAYMENT_STATUSES.map((ps) => (
                              <option key={ps} value={ps}>
                                {ps}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CUSTOMERS */}
          {activeTab === 'customers' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-bold text-zinc-950">
                  Registered Customers
                </h1>
                <p className="text-sm text-zinc-500">
                  Customer directory with Philippine shipping profiles and order volume.
                </p>
              </div>

              <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-600">
                        <th className="py-3 px-4">Customer</th>
                        <th className="py-3 px-4">Contact</th>
                        <th className="py-3 px-4">Location</th>
                        <th className="py-3 px-4 text-right">Orders</th>
                        <th className="py-3 px-4 text-right">Total Spend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {customers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-zinc-500">
                            No registered customer profiles yet.
                          </td>
                        </tr>
                      ) : (
                        customers.map((cust) => {
                          const custOrders = orders.filter(
                            (o) => o.customerId === cust.uid && o.orderStatus !== 'Cancelled'
                          );
                          const spend = custOrders.reduce((s, o) => s + o.totalAmount, 0);
                          return (
                            <tr key={cust.uid}>
                              <td className="py-3 px-4">
                                <p className="font-medium text-zinc-950">{cust.fullName}</p>
                                <p className="text-xs text-zinc-500">{cust.email}</p>
                              </td>
                              <td className="py-3 px-4 text-xs font-mono text-zinc-700">
                                {cust.phone || '—'}
                              </td>
                              <td className="py-3 px-4 text-xs text-zinc-600">
                                {[cust.city, cust.province].filter(Boolean).join(', ') || '—'}
                              </td>
                              <td className="py-3 px-4 text-right tabular-nums font-medium">
                                {custOrders.length}
                              </td>
                              <td className="py-3 px-4 text-right tabular-nums font-semibold">
                                {formatPHP(spend)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: GOOGLE SHEETS BACKUP & GOOGLE DRIVE STORAGE */}
          {activeTab === 'backups' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-bold text-zinc-950">
                  Database Backups & Google Workspace
                </h1>
                <p className="text-sm text-zinc-500">
                  Sync RYAN'S SHOES COLLECTION inventory, orders, and payments to Google Sheets and manage product images in Google Drive.
                </p>
              </div>

              {/* Workspace Connection Card */}
              <div className="bg-white border border-zinc-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-base font-semibold text-zinc-950">
                    Google Drive & Google Sheets Connection
                  </h2>
                  <p className="text-xs text-zinc-600 mt-1 font-mono">
                    Sheets ID: {GOOGLE_SHEETS_ID} · Drive Folder: {GOOGLE_DRIVE_FOLDER_ID}
                  </p>
                  {sheetsMeta && (
                    <p className="text-xs text-emerald-700 font-medium mt-1.5">
                      Connected Spreadsheet: "{sheetsMeta.title}" ({sheetsMeta.tabs.map((t) => t.title).join(', ')})
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <GoogleSignInButton
                    onClick={handleConnectWorkspace}
                    disabled={connectingWorkspace}
                    label={workspaceToken ? 'Reconnect Drive & Sheets' : 'Connect Drive & Sheets'}
                  />
                  <button
                    type="button"
                    disabled={!workspaceToken || syncingSheets}
                    onClick={() => setSyncConfirmOpen(true)}
                    className="px-4 py-2.5 bg-zinc-950 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 disabled:bg-zinc-300 disabled:cursor-not-allowed inline-flex items-center gap-2 transition-colors whitespace-nowrap"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Sync Backup to Google Sheets</span>
                  </button>
                </div>
              </div>

              {/* Local CSV & JSON Reports */}
              <div className="bg-white border border-zinc-200 rounded-xl p-6">
                <h2 className="font-display text-base font-semibold text-zinc-950 mb-1">
                  Offline Reports & Database Export
                </h2>
                <p className="text-sm text-zinc-500 mb-4">
                  Download structured CSV spreadsheets or complete JSON database snapshots anytime.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => downloadCsvReport('inventory')}
                    className="px-4 py-2 bg-white border border-zinc-200 text-zinc-800 text-sm font-medium rounded-lg hover:border-zinc-950 inline-flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Inventory CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadCsvReport('orders')}
                    className="px-4 py-2 bg-white border border-zinc-200 text-zinc-800 text-sm font-medium rounded-lg hover:border-zinc-950 inline-flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export Orders & Payments CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={downloadJsonBackup}
                    className="px-4 py-2 bg-white border border-zinc-200 text-zinc-800 text-sm font-medium rounded-lg hover:border-zinc-950 inline-flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>Full JSON Snapshot</span>
                  </button>
                </div>
              </div>

              {/* Google Drive Folder Browser */}
              <div className="bg-white border border-zinc-200 rounded-xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div>
                    <h2 className="font-display text-base font-semibold text-zinc-950">
                      Google Drive Product Images Folder
                    </h2>
                    <p className="text-xs text-zinc-500 font-mono mt-0.5">
                      Folder ID: {GOOGLE_DRIVE_FOLDER_ID}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!workspaceToken || loadingDriveFiles}
                    onClick={handleLoadDriveImages}
                    className="px-3.5 py-2 bg-white border border-zinc-200 text-xs font-medium rounded-lg hover:border-zinc-950 disabled:opacity-40 inline-flex items-center gap-2"
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span>{loadingDriveFiles ? 'Loading...' : 'Refresh Drive Folder'}</span>
                  </button>
                </div>

                {driveFiles.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    {workspaceToken
                      ? 'Click "Refresh Drive Folder" to inspect stored shoe images, or upload directly when adding/editing a product.'
                      : 'Connect Google Drive & Sheets above to browse or upload files in your Drive folder.'}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {driveFiles.map((file) => (
                      <div key={file.id} className="border border-zinc-200 rounded-lg overflow-hidden bg-zinc-50">
                        <div className="aspect-[4/3] bg-zinc-100">
                          <ResilientImage
                            src={`https://drive.google.com/thumbnail?id=${file.id}&sz=w600`}
                            alt={file.name}
                          />
                        </div>
                        <div className="p-2.5 text-xs">
                          <p className="font-medium text-zinc-900 truncate">{file.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {productModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-zinc-200 rounded-xl max-w-2xl w-full p-6 md:p-8 my-auto max-h-[90vh] overflow-y-auto">
            <h2 className="font-display text-xl font-bold text-zinc-950 mb-4">
              {editingProduct ? `Edit Shoe: ${editingProduct.name}` : 'Add New Shoe Product'}
            </h2>

            {productModalError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 break-words">
                {productModalError}
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Brand *</label>
                  <input
                    type="text"
                    required
                    value={pBrand}
                    onChange={(e) => setPBrand(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Category *</label>
                  <select
                    value={pCategory}
                    onChange={(e) => setPCategory(e.target.value as ProductCategory)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Target Age Group *</label>
                  <select
                    value={pAgeGroup}
                    onChange={(e) => setPAgeGroup(e.target.value as AgeGroup)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white"
                  >
                    {AGE_GROUPS.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Price (PHP) *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={pPrice}
                    onChange={(e) => setPPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">Discount (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={pDiscount}
                    onChange={(e) => setPDiscount(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">Description *</label>
                <textarea
                  rows={2}
                  required
                  value={pDescription}
                  onChange={(e) => setPDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
                />
              </div>

              {/* Image URL + Google Drive Upload */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-medium text-zinc-800">
                    Product Photography (Google Drive or Studio Preset)
                  </label>
                  <label className="px-3 py-1.5 bg-white border border-zinc-200 rounded-md text-xs font-medium text-zinc-800 hover:border-zinc-950 cursor-pointer inline-flex items-center gap-1.5">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingDrive ? 'Uploading to Drive...' : 'Upload to Google Drive'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleDriveFileUpload}
                      disabled={uploadingDrive}
                      className="hidden"
                    />
                  </label>
                </div>

                <input
                  type="text"
                  required
                  value={pImageUrl}
                  onChange={(e) => setPImageUrl(e.target.value)}
                  placeholder="Image URL or /src/assets/images/..."
                  className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-mono"
                />

                <div className="flex flex-wrap gap-1.5">
                  {STUDIO_PRESET_IMAGES.map((preset) => (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => setPImageUrl(preset.url)}
                      className={`px-2.5 py-1 text-[11px] rounded border ${
                        pImageUrl === preset.url
                          ? 'bg-zinc-950 text-white border-zinc-950'
                          : 'bg-white text-zinc-700 border-zinc-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Available Colors (comma-separated)
                  </label>
                  <input
                    type="text"
                    required
                    value={pColorsText}
                    onChange={(e) => setPColorsText(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Low-Stock Alert Threshold
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={pLowThreshold}
                    onChange={(e) => setPLowThreshold(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1">
                  Sizes & Stock Quantities (format: Size: Qty, Size: Qty)
                </label>
                <input
                  type="text"
                  required
                  value={pSizeStockText}
                  onChange={(e) => setPSizeStockText(e.target.value)}
                  placeholder="US 6: 5, US 7: 8, US 8: 10, US 9: 6"
                  className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm font-mono"
                />
              </div>

              <div className="flex flex-wrap gap-5 pt-1 text-xs font-medium text-zinc-700">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={pFeatured} onChange={(e) => setPFeatured(e.target.checked)} />
                  <span>Featured</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={pNewArrival} onChange={(e) => setPNewArrival(e.target.checked)} />
                  <span>New Arrival</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={pBestSeller} onChange={(e) => setPBestSeller(e.target.checked)} />
                  <span>Best Seller</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={pActive} onChange={(e) => setPActive(e.target.checked)} />
                  <span>Active on Storefront</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-200">
                <button
                  type="button"
                  onClick={() => setProductModalOpen(false)}
                  className="px-4 py-2 border border-zinc-200 rounded-lg text-sm font-medium text-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-5 py-2 bg-zinc-950 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 disabled:opacity-50"
                >
                  {savingProduct ? 'Saving...' : editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Product Confirmation Modal */}
      <ConfirmActionModal
        open={Boolean(deleteTarget)}
        title="Delete Footwear Product"
        description={`Are you sure you want to permanently remove "${deleteTarget?.name}" from the storefront catalog?`}
        confirmLabel="Delete Product"
        destructive
        busy={deletingProduct}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDeleteProduct}
      />

      {/* Google Sheets Backup Confirmation Modal */}
      <ConfirmActionModal
        open={syncConfirmOpen}
        title="Sync Store Backup to Google Sheets"
        description="This will clear and overwrite the backup tabs in your connected Google Sheets spreadsheet with current store data."
        details={[
          `Spreadsheet ID: ${GOOGLE_SHEETS_ID}`,
          `Products_Inventory: ${products.length} footwear SKUs`,
          `Orders_Backup & Payments_Ledger: ${orders.length} order records`,
          `Sales_Summary: Revenue & inventory KPIs`,
        ]}
        confirmLabel="Confirm Sheets Sync"
        busy={syncingSheets}
        onCancel={() => setSyncConfirmOpen(false)}
        onConfirm={handleSyncSheetsBackup}
      />
    </div>
  );
};
