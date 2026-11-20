import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { ArrowLeft, CheckCircle2, ShieldCheck, ExternalLink } from 'lucide-react';
import {
  CartItem,
  CustomerProfile,
  PaymentMethod,
  ShippingRegion,
  calculateShippingFee,
  formatPHP,
} from '../types/store';
import { createCustomerOrder, getCustomerProfile, upsertCustomerProfile } from '../services/storeService';
import { GoogleSignInButton } from './GoogleSignInButton';
import { ResilientImage } from './ResilientImage';

interface CheckoutViewProps {
  user: User | null;
  items: CartItem[];
  onSignIn: () => Promise<void>;
  onBackToShop: () => void;
  onOrderSuccess: (trackingCode: string) => void;
  onTrackOrder: (trackingCode: string) => void;
}

interface GatewayStatus {
  paymongoConfigured: boolean;
  mayaConfigured: boolean;
  gcashMode: string;
  mayaMode: string;
  merchantAccounts: {
    gcashNumber: string;
    gcashName: string;
    mayaNumber: string;
    mayaName: string;
  };
}

export const CheckoutView: React.FC<CheckoutViewProps> = ({
  user,
  items,
  onSignIn,
  onBackToShop,
  onOrderSuccess,
  onTrackOrder,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [region, setRegion] = useState<ShippingRegion>('Metro Manila');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('COD');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentSenderNumber, setPaymentSenderNumber] = useState('');

  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatus | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmedTrackingCode, setConfirmedTrackingCode] = useState<string | null>(null);
  const [officialGatewayUrl, setOfficialGatewayUrl] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/payments/gateway-status')
      .then((r) => r.json())
      .then((data) => setGatewayStatus(data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!user) return;
    setCustomerName((prev) => prev || user.displayName || '');
    getCustomerProfile(user.uid)
      .then((profile: CustomerProfile | null) => {
        if (!profile) return;
        if (profile.fullName) setCustomerName(profile.fullName);
        if (profile.phone) setContactNumber(profile.phone);
        if (profile.address) setStreetAddress(profile.address);
        if (profile.city) setCity(profile.city);
        if (profile.province) setProvince(profile.province);
        if (profile.postalCode) setPostalCode(profile.postalCode);
      })
      .catch(() => undefined);
  }, [user]);

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const shippingFee = calculateShippingFee(subtotal, region);
  const totalAmount = subtotal + shippingFee;

  const handleGoogleLogin = async () => {
    setSigningIn(true);
    setErrorMsg('');
    try {
      await onSignIn();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setSigningIn(false);
    }
  };

  const validateForm = (): string | null => {
    if (!user) return 'Please sign in with Google to place and track your order.';
    if (items.length === 0) return 'Your shopping bag is empty.';
    if (customerName.trim().length < 2) return 'Please enter your full name.';
    if (!/^[0-9+\-\s()]{7,20}$/.test(contactNumber.trim())) {
      return 'Please enter a valid Philippine contact number (e.g., 0917 555 0123).';
    }
    if (streetAddress.trim().length < 5 || city.trim().length < 2 || province.trim().length < 2) {
      return 'Please provide your complete street address, city, and province.';
    }
    if (paymentMethod === 'GCash' || paymentMethod === 'Maya') {
      const gatewayReady =
        (paymentMethod === 'GCash' && gatewayStatus?.paymongoConfigured) ||
        (paymentMethod === 'Maya' && (gatewayStatus?.mayaConfigured || gatewayStatus?.paymongoConfigured));
      if (!gatewayReady) {
        if (paymentReference.trim().length < 6) {
          return `Please enter your ${paymentMethod} transaction reference number after completing the transfer.`;
        }
        if (paymentSenderNumber.trim().length < 7) {
          return `Please enter the ${paymentMethod} mobile number used for your transfer.`;
        }
      }
    }
    return null;
  };

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const validationErr = validateForm();
    if (validationErr) {
      setErrorMsg(validationErr);
      return;
    }
    if (!user) return;

    setSubmitting(true);
    try {
      const fullDeliveryAddress = `${streetAddress.trim()}, ${city.trim()}, ${province.trim()}${
        postalCode.trim() ? ` ${postalCode.trim()}` : ''
      }`;

      // Persist/update customer profile defaults cleanly
      await upsertCustomerProfile(user.uid, {
        email: user.email || '',
        fullName: customerName.trim(),
        phone: contactNumber.trim(),
        address: streetAddress.trim(),
        city: city.trim(),
        province: province.trim(),
        postalCode: postalCode.trim(),
      });

      const orderItems = items.map((item) => ({
        productId: item.productId,
        name: item.name,
        brand: item.brand,
        size: item.size,
        color: item.color,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.unitPrice * item.quantity,
        imageUrl: item.imageUrl,
      }));

      const trackingCode = await createCustomerOrder({
        customerId: user.uid,
        customerEmail: user.email || '',
        customerName: customerName.trim(),
        contactNumber: contactNumber.trim(),
        deliveryAddress: fullDeliveryAddress,
        region,
        items: orderItems,
        subtotal,
        shippingFee,
        totalAmount,
        paymentMethod,
        paymentReference: paymentMethod === 'COD' ? '' : paymentReference.trim(),
        paymentSenderNumber: paymentMethod === 'COD' ? '' : paymentSenderNumber.trim(),
        paymentStatus: paymentMethod === 'COD' ? 'Pending COD Collection' : 'Awaiting Verification',
        trackingNotes: '',
      });

      // Check if an official payment gateway checkout URL is configured for GCash / Maya
      if (paymentMethod === 'GCash' || paymentMethod === 'Maya') {
        const intentRes = await fetch('/api/payments/create-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method: paymentMethod,
            orderId: trackingCode,
            amount: totalAmount,
            customerName: customerName.trim(),
            customerEmail: user.email || '',
            contactNumber: contactNumber.trim(),
          }),
        });
        const intentData = await intentRes.json();
        if (intentData?.gatewayConfigured && intentData?.checkoutUrl) {
          setOfficialGatewayUrl(intentData.checkoutUrl);
        }
      }

      setConfirmedTrackingCode(trackingCode);
      onOrderSuccess(trackingCode);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmedTrackingCode) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="bg-white border border-zinc-200 rounded-xl p-8">
          <div className="w-11 h-11 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mb-5">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <p className="text-xs font-medium text-zinc-500 mb-1">
            RYAN'S SHOES COLLECTION · Order Received
          </p>
          <h1 className="font-display text-2xl font-bold text-zinc-950 mb-3">
            Order #{confirmedTrackingCode} Placed
          </h1>
          <p className="text-sm text-zinc-600 leading-relaxed mb-6">
            {paymentMethod === 'COD'
              ? 'Your Cash on Delivery order is awaiting store confirmation. Our team will verify availability and dispatch your pair shortly.'
              : officialGatewayUrl
                ? `Complete your ${paymentMethod} payment via the official checkout portal below. Your order will be confirmed automatically once verified.`
                : `Your ${paymentMethod} reference number (${paymentReference}) has been recorded with status "Awaiting Verification". Once verified by our store admin, your order moves to Confirmed and inventory is reserved.`}
          </p>

          <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 mb-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-zinc-500">Tracking Reference</p>
              <p className="font-mono font-semibold text-zinc-950 mt-0.5">{confirmedTrackingCode}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Total Amount</p>
              <p className="font-semibold text-zinc-950 tabular-nums mt-0.5">
                {formatPHP(totalAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Payment Method</p>
              <p className="font-medium text-zinc-900 mt-0.5">{paymentMethod}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Payment Status</p>
              <p className="font-medium text-amber-700 mt-0.5">
                {paymentMethod === 'COD' ? 'Pending COD Collection' : 'Awaiting Verification'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {officialGatewayUrl && (
              <a
                href={officialGatewayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2.5 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-800 transition-colors inline-flex items-center gap-2"
              >
                <span>Pay with Official {paymentMethod} Gateway</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              type="button"
              onClick={() => onTrackOrder(confirmedTrackingCode)}
              className="px-5 py-2.5 bg-zinc-950 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Track Order Status
            </button>
            <button
              type="button"
              onClick={onBackToShop}
              className="px-5 py-2.5 bg-white border border-zinc-200 text-zinc-800 text-sm font-medium rounded-lg hover:bg-zinc-50 transition-colors"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10">
      <button
        type="button"
        onClick={onBackToShop}
        className="inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-950 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Collection</span>
      </button>

      <div className="mb-8">
        <p className="text-xs font-medium text-zinc-500 mb-1">RYAN'S SHOES COLLECTION</p>
        <h1 className="font-display text-3xl font-bold text-zinc-950 tracking-tight">
          Checkout & Payment
        </h1>
      </div>

      {!user && (
        <div className="bg-white border border-zinc-200 rounded-xl p-6 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-semibold text-zinc-950 mb-1">
              Sign in required to place an order
            </h2>
            <p className="text-sm text-zinc-600">
              Sign in with Google to save your Philippine delivery details, verify payments, and track your order history.
            </p>
          </div>
          <GoogleSignInButton onClick={handleGoogleLogin} disabled={signingIn} />
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Delivery & Payment Details */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-zinc-200 rounded-xl p-6">
            <h2 className="font-display text-lg font-semibold text-zinc-950 mb-4">
              1. Customer & Delivery Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Juan Dela Cruz"
                  className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Contact Number *
                </label>
                <input
                  type="tel"
                  required
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  placeholder="0917 555 0123"
                  className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-950"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Complete Street Address & Barangay *
                </label>
                <input
                  type="text"
                  required
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="House/Unit No., Street, Barangay"
                  className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  City / Municipality *
                </label>
                <input
                  type="text"
                  required
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Quezon City"
                  className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Province *
                </label>
                <input
                  type="text"
                  required
                  value={province}
                  onChange={(e) => setProvince(e.target.value)}
                  placeholder="Metro Manila"
                  className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Postal Code
                </label>
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  placeholder="1100"
                  className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-950"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                  Shipping Region *
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value as ShippingRegion)}
                  className="w-full px-3.5 py-2.5 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:border-zinc-950"
                >
                  <option value="Metro Manila">Metro Manila (₱85)</option>
                  <option value="Luzon Provincial">Luzon Provincial (₱135)</option>
                  <option value="Visayas">Visayas (₱175)</option>
                  <option value="Mindanao">Mindanao (₱195)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 2. Payment Method */}
          <div className="bg-white border border-zinc-200 rounded-xl p-6">
            <h2 className="font-display text-lg font-semibold text-zinc-950 mb-4">
              2. Payment Method
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
              {(['COD', 'GCash', 'Maya'] as PaymentMethod[]).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`p-3.5 rounded-lg border text-left transition-colors ${
                    paymentMethod === method
                      ? 'border-zinc-950 bg-zinc-950 text-white'
                      : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400'
                  }`}
                >
                  <p className="text-sm font-semibold">
                    {method === 'COD' ? 'Cash on Delivery' : method}
                  </p>
                  <p
                    className={`text-xs mt-0.5 ${
                      paymentMethod === method ? 'text-zinc-300' : 'text-zinc-500'
                    }`}
                  >
                    {method === 'COD'
                      ? 'Pay upon courier arrival'
                      : 'E-wallet transfer & verify'}
                  </p>
                </button>
              ))}
            </div>

            {paymentMethod === 'COD' ? (
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4 text-sm text-zinc-600">
                <p className="font-medium text-zinc-900 mb-1">Cash on Delivery Instructions</p>
                <p>
                  Prepare exact amount of <strong className="tabular-nums text-zinc-950">{formatPHP(totalAmount)}</strong> upon delivery. Orders are confirmed by our team before dispatch.
                </p>
              </div>
            ) : (
              <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-zinc-950">
                      {paymentMethod} Merchant Payment Instructions
                    </p>
                    <p className="text-xs text-zinc-600 mt-1">
                      Send exactly <strong className="tabular-nums text-zinc-950">{formatPHP(totalAmount)}</strong> to our verified merchant account, then enter your transaction reference number below.
                    </p>
                  </div>
                  <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0" />
                </div>

                <div className="bg-white border border-zinc-200 rounded-lg p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-zinc-500 block">Account Name</span>
                    <span className="font-semibold text-zinc-950">
                      {paymentMethod === 'GCash'
                        ? gatewayStatus?.merchantAccounts.gcashName || "RYAN'S SHOES COLLECTION"
                        : gatewayStatus?.merchantAccounts.mayaName || "RYAN'S SHOES COLLECTION"}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 block">{paymentMethod} Number</span>
                    <span className="font-mono font-semibold text-zinc-950">
                      {paymentMethod === 'GCash'
                        ? gatewayStatus?.merchantAccounts.gcashNumber || '0917-555-0148'
                        : gatewayStatus?.merchantAccounts.mayaNumber || '0918-555-0192'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                      {paymentMethod} Reference Number *
                    </label>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="e.g. 9024 8812 34011"
                      className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-lg text-sm font-mono focus:outline-none focus:border-zinc-950"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                      Sender Mobile Number *
                    </label>
                    <input
                      type="tel"
                      value={paymentSenderNumber}
                      onChange={(e) => setPaymentSenderNumber(e.target.value)}
                      placeholder="09XX XXX XXXX"
                      className="w-full px-3.5 py-2.5 bg-white border border-zinc-200 rounded-lg text-sm font-mono focus:outline-none focus:border-zinc-950"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Order Summary */}
        <div className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl p-6 lg:sticky lg:top-24">
          <h2 className="font-display text-lg font-semibold text-zinc-950 mb-4">
            Order Summary ({items.reduce((s, i) => s + i.quantity, 0)})
          </h2>

          <div className="divide-y divide-zinc-200 mb-5 max-h-80 overflow-y-auto">
            {items.map((item) => (
              <div
                key={`${item.productId}-${item.size}-${item.color}`}
                className="py-3 flex items-center gap-3"
              >
                <div className="w-14 h-14 rounded-md overflow-hidden bg-zinc-100 border border-zinc-200 shrink-0">
                  <ResilientImage src={item.imageUrl} alt={item.name} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-950 truncate">{item.name}</p>
                  <p className="text-xs text-zinc-500">
                    {item.color} · {item.size} · Qty {item.quantity}
                  </p>
                </div>
                <span className="text-sm font-medium text-zinc-950 tabular-nums">
                  {formatPHP(item.unitPrice * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          <div className="space-y-2.5 pt-4 border-t border-zinc-200 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-zinc-600">Subtotal</span>
              <span className="font-medium text-zinc-950 tabular-nums">{formatPHP(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-zinc-600">Shipping ({region})</span>
              <span className="font-medium text-zinc-950 tabular-nums">
                {shippingFee === 0 ? 'Free' : formatPHP(shippingFee)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-3 border-t border-zinc-200 text-base">
              <span className="font-semibold text-zinc-950">Total</span>
              <span className="font-bold text-zinc-950 tabular-nums">{formatPHP(totalAmount)}</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !user || items.length === 0}
            className="w-full mt-6 py-3 px-4 bg-zinc-950 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Placing Order...' : `Confirm Order · ${formatPHP(totalAmount)}`}
          </button>
        </div>
      </form>
    </div>
  );
};
