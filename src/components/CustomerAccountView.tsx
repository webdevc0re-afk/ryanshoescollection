import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { LogOut, UserCheck, Package } from 'lucide-react';
import { Order, formatDateTime, formatPHP } from '../types/store';
import {
  customerCancelPendingOrder,
  customerSubmitPaymentRef,
  getCustomerProfile,
  upsertCustomerProfile,
} from '../services/storeService';
import { GoogleSignInButton } from './GoogleSignInButton';
import { ConfirmActionModal } from './ConfirmActionModal';

interface CustomerAccountViewProps {
  user: User | null;
  orders: Order[];
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onTrackOrder: (trackingCode: string) => void;
}

export const CustomerAccountView: React.FC<CustomerAccountViewProps> = ({
  user,
  orders,
  onSignIn,
  onSignOut,
  onTrackOrder,
}) => {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [preferredAgeGroup, setPreferredAgeGroup] = useState('All Ages (10-60)');

  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Pending order payment reference update state
  const [editingOrderRefId, setEditingOrderRefId] = useState<string | null>(null);
  const [refCode, setRefCode] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [cancelOrderTarget, setCancelOrderTarget] = useState<Order | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    setFullName(user.displayName || '');
    getCustomerProfile(user.uid)
      .then((prof) => {
        if (!prof) return;
        setFullName(prof.fullName || user.displayName || '');
        setPhone(prof.phone || '');
        setAddress(prof.address || '');
        setCity(prof.city || '');
        setProvince(prof.province || '');
        setPostalCode(prof.postalCode || '');
        setPreferredAgeGroup(prof.preferredAgeGroup || 'All Ages (10-60)');
      })
      .catch(() => undefined);
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    setProfileSavedMsg('');
    setErrorMsg('');
    try {
      await upsertCustomerProfile(user.uid, {
        email: user.email || '',
        fullName: fullName.trim() || user.displayName || 'Customer',
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        province: province.trim(),
        postalCode: postalCode.trim(),
        preferredAgeGroup,
      });
      setProfileSavedMsg('Customer profile saved.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePaymentRef = async (orderId: string) => {
    if (!refCode.trim()) return;
    setActionBusy(true);
    setErrorMsg('');
    try {
      await customerSubmitPaymentRef(orderId, refCode, senderPhone);
      setEditingOrderRefId(null);
      setRefCode('');
      setSenderPhone('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to update reference.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelOrderTarget) return;
    setActionBusy(true);
    setErrorMsg('');
    try {
      await customerCancelPendingOrder(cancelOrderTarget.id);
      setCancelOrderTarget(null);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to cancel order.');
    } finally {
      setActionBusy(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16">
        <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center">
          <p className="text-xs font-medium text-zinc-500 mb-2">RYAN'S SHOES COLLECTION</p>
          <h1 className="font-display text-2xl font-bold text-zinc-950 mb-2">
            Customer Account & Order History
          </h1>
          <p className="text-sm text-zinc-600 mb-6">
            Sign in with Google to register your customer profile, save delivery addresses across the Philippines, and view your past shoe orders.
          </p>
          <div className="flex flex-col items-center gap-4">
            <GoogleSignInButton
              onClick={async () => {
                setAuthBusy(true);
                setErrorMsg('');
                try {
                  await onSignIn();
                } catch (err) {
                  setErrorMsg(err instanceof Error ? err.message : 'Google Sign-In failed.');
                } finally {
                  setAuthBusy(false);
                }
              }}
              disabled={authBusy}
            />
            {errorMsg && (
              <div className="w-full p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 text-left">
                {errorMsg}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-6 py-10">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pb-6 border-b border-zinc-200">
        <div>
          <p className="text-xs font-medium text-zinc-500 mb-1">RYAN'S SHOES COLLECTION · Customer Portal</p>
          <h1 className="font-display text-3xl font-bold text-zinc-950 tracking-tight">
            {user.displayName || 'Customer Account'}
          </h1>
          <p className="text-sm text-zinc-600 mt-0.5">{user.email}</p>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="px-4 py-2 bg-white border border-zinc-200 text-zinc-700 text-sm font-medium rounded-lg hover:bg-zinc-50 inline-flex items-center gap-2 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>

      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Profile Management */}
        <form
          onSubmit={handleSaveProfile}
          className="lg:col-span-5 bg-white border border-zinc-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2 mb-1">
            <UserCheck className="w-4 h-4 text-zinc-900" />
            <h2 className="font-display text-lg font-semibold text-zinc-950">
              Delivery Profile
            </h2>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3.5 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-950"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Mobile Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0917 555 0123"
              className="w-full px-3.5 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-950"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 mb-1">Street Address</label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="House/Unit, Street, Barangay"
              className="w-full px-3.5 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-950"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3.5 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Province</label>
              <input
                type="text"
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="w-full px-3.5 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-950"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Postal Code</label>
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                className="w-full px-3.5 py-2 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-zinc-950"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">Age Fit Group</label>
              <select
                value={preferredAgeGroup}
                onChange={(e) => setPreferredAgeGroup(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 rounded-lg text-sm bg-white focus:outline-none focus:border-zinc-950"
              >
                <option value="All Ages (10-60)">All Ages (10-60)</option>
                <option value="Kids & Youth (10-17)">Kids & Youth (10-17)</option>
                <option value="Adults (18-45)">Adults (18-45)</option>
                <option value="Mature Comfort (46-60)">Mature Comfort (46-60)</option>
              </select>
            </div>
          </div>

          {profileSavedMsg && (
            <p className="text-xs font-medium text-emerald-700">{profileSavedMsg}</p>
          )}

          <button
            type="submit"
            disabled={savingProfile}
            className="w-full py-2.5 px-4 bg-zinc-950 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          >
            {savingProfile ? 'Saving...' : 'Save Profile'}
          </button>
        </form>

        {/* Order History */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4 text-zinc-900" />
            <h2 className="font-display text-lg font-semibold text-zinc-950">
              Order History ({orders.length})
            </h2>
          </div>

          {orders.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-xl p-10 text-center">
              <p className="text-sm text-zinc-600">
                You haven't placed any orders yet. Explore RYAN'S SHOES COLLECTION to get started.
              </p>
            </div>
          ) : (
            orders.map((order) => (
              <div
                key={order.id}
                className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-zinc-100">
                  <div>
                    <p className="font-mono text-sm font-semibold text-zinc-950">
                      {order.trackingCode}
                    </p>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Placed {formatDateTime(order.createdAt)} · {order.paymentMethod}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm font-semibold text-zinc-950 tabular-nums">
                      {formatPHP(order.totalAmount)}
                    </p>
                    <p className="text-xs font-medium text-zinc-700 mt-0.5">
                      {order.orderStatus} · {order.paymentStatus}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 text-sm">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-zinc-700">
                      <span>
                        {item.quantity}x {item.name} ({item.size}, {item.color})
                      </span>
                      <span className="tabular-nums font-medium">{formatPHP(item.lineTotal)}</span>
                    </div>
                  ))}
                </div>

                {order.paymentReference && (
                  <p className="text-xs text-zinc-500">
                    Reference: <span className="font-mono text-zinc-800">{order.paymentReference}</span>
                  </p>
                )}

                {editingOrderRefId === order.id && (
                  <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-3.5 space-y-2.5">
                    <p className="text-xs font-medium text-zinc-800">
                      Update {order.paymentMethod} Transaction Reference
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <input
                        type="text"
                        value={refCode}
                        onChange={(e) => setRefCode(e.target.value)}
                        placeholder="Reference Number"
                        className="px-3 py-2 bg-white border border-zinc-200 rounded-md text-xs font-mono"
                      />
                      <input
                        type="tel"
                        value={senderPhone}
                        onChange={(e) => setSenderPhone(e.target.value)}
                        placeholder="Sender Mobile Number"
                        className="px-3 py-2 bg-white border border-zinc-200 rounded-md text-xs font-mono"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={actionBusy}
                        onClick={() => handleSavePaymentRef(order.id)}
                        className="px-3 py-1.5 bg-zinc-950 text-white text-xs font-medium rounded-md"
                      >
                        Save Reference
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingOrderRefId(null)}
                        className="px-3 py-1.5 bg-white border border-zinc-200 text-zinc-700 text-xs font-medium rounded-md"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onTrackOrder(order.trackingCode)}
                    className="px-3.5 py-1.5 bg-zinc-950 text-white text-xs font-medium rounded-md hover:bg-zinc-800 transition-colors"
                  >
                    View Tracking Timeline
                  </button>

                  {order.orderStatus === 'Pending' && order.paymentMethod !== 'COD' && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingOrderRefId(order.id);
                        setRefCode(order.paymentReference || '');
                        setSenderPhone(order.paymentSenderNumber || '');
                      }}
                      className="px-3.5 py-1.5 bg-white border border-zinc-200 text-zinc-800 text-xs font-medium rounded-md hover:border-zinc-400 transition-colors"
                    >
                      Update Payment Ref
                    </button>
                  )}

                  {order.orderStatus === 'Pending' && (
                    <button
                      type="button"
                      onClick={() => setCancelOrderTarget(order)}
                      className="px-3.5 py-1.5 bg-white border border-red-200 text-red-700 text-xs font-medium rounded-md hover:bg-red-50 transition-colors"
                    >
                      Cancel Order
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmActionModal
        open={Boolean(cancelOrderTarget)}
        title="Cancel Pending Order"
        description={`Are you sure you want to cancel order ${cancelOrderTarget?.trackingCode}? This cannot be undone.`}
        confirmLabel="Cancel Order"
        destructive
        busy={actionBusy}
        onCancel={() => setCancelOrderTarget(null)}
        onConfirm={handleConfirmCancel}
      />
    </div>
  );
};
