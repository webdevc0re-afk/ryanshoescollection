import React, { useEffect, useState } from 'react';
import { Search, PackageCheck, Clock, Truck, CheckCircle, XCircle } from 'lucide-react';
import { Order, OrderStatus, OrderTrackingSummary, formatDateTime, formatPHP } from '../types/store';
import { lookupOrderTracking } from '../services/storeService';

interface TrackOrderViewProps {
  initialTrackingCode?: string;
  customerOrders: Order[];
}

const STEPS: OrderStatus[] = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Delivered'];

export const TrackOrderView: React.FC<TrackOrderViewProps> = ({
  initialTrackingCode = '',
  customerOrders,
}) => {
  const [queryCode, setQueryCode] = useState(initialTrackingCode);
  const [result, setResult] = useState<OrderTrackingSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');

  const runSearch = async (code: string) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setLoading(true);
    setSearched(true);
    setError('');
    try {
      const data = await lookupOrderTracking(clean);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to look up tracking number.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialTrackingCode) {
      setQueryCode(initialTrackingCode);
      runSearch(initialTrackingCode);
    }
  }, [initialTrackingCode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(queryCode);
  };

  const activeStepIndex = result ? STEPS.indexOf(result.orderStatus) : -1;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="mb-8">
        <p className="text-xs font-medium text-zinc-500 mb-1">RYAN'S SHOES COLLECTION</p>
        <h1 className="font-display text-3xl font-bold text-zinc-950 tracking-tight mb-2">
          Track Your Order
        </h1>
        <p className="text-sm text-zinc-600">
          Enter your order tracking reference code (for example, <span className="font-mono">RSC-2026-482910</span>) to check live fulfillment and payment status.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={queryCode}
            onChange={(e) => setQueryCode(e.target.value)}
            placeholder="Enter Tracking Code (RSC-2026-...)"
            className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-lg text-sm font-mono uppercase focus:outline-none focus:border-zinc-950"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !queryCode.trim()}
          className="px-6 py-3 bg-zinc-950 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {loading ? 'Checking...' : 'Check Status'}
        </button>
      </form>

      {customerOrders.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-medium text-zinc-500 mb-2.5">Your Recent Orders</p>
          <div className="flex flex-wrap gap-2">
            {customerOrders.slice(0, 5).map((ord) => (
              <button
                key={ord.id}
                type="button"
                onClick={() => {
                  setQueryCode(ord.trackingCode);
                  runSearch(ord.trackingCode);
                }}
                className="px-3 py-1.5 bg-white border border-zinc-200 rounded-md text-xs font-mono text-zinc-800 hover:border-zinc-950 transition-colors"
              >
                {ord.trackingCode} · {ord.orderStatus}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 mb-6">
          {error}
        </div>
      )}

      {searched && !loading && !result && !error && (
        <div className="bg-white border border-zinc-200 rounded-xl p-8 text-center">
          <p className="font-display text-base font-semibold text-zinc-950 mb-1">
            No order found for "{queryCode.trim().toUpperCase()}"
          </p>
          <p className="text-sm text-zinc-500">
            Double-check your tracking reference from your order confirmation summary.
          </p>
        </div>
      )}

      {result && (
        <div className="bg-white border border-zinc-200 rounded-xl p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 pb-6 mb-6 border-b border-zinc-200">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Tracking Reference</p>
              <h2 className="font-mono text-xl font-bold text-zinc-950">{result.trackingCode}</h2>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs text-zinc-500 mb-1">Current Status</p>
              <p className="text-sm font-semibold text-zinc-950">
                {result.orderStatus} · {result.paymentStatus}
              </p>
            </div>
          </div>

          {result.orderStatus === 'Cancelled' ? (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800 mb-6">
              <XCircle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-semibold">Order Cancelled</p>
                <p className="text-xs mt-0.5">{result.trackingNotes || 'This order was cancelled.'}</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-2 mb-8">
              {STEPS.map((step, idx) => {
                const completed = activeStepIndex >= idx;
                const Icon =
                  idx === 0
                    ? Clock
                    : idx === 1
                      ? PackageCheck
                      : idx === 3
                        ? Truck
                        : CheckCircle;
                return (
                  <div key={step} className="text-center">
                    <div
                      className={`h-1.5 rounded-full mb-3 ${
                        completed ? 'bg-zinc-950' : 'bg-zinc-200'
                      }`}
                    />
                    <div className="flex flex-col items-center gap-1">
                      <Icon
                        className={`w-4 h-4 ${completed ? 'text-zinc-950' : 'text-zinc-300'}`}
                      />
                      <span
                        className={`text-[11px] font-medium ${
                          completed ? 'text-zinc-950' : 'text-zinc-400'
                        }`}
                      >
                        {step}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-zinc-50 border border-zinc-200 rounded-lg p-4 text-sm">
            <div>
              <p className="text-xs text-zinc-500">Payment Method</p>
              <p className="font-medium text-zinc-900 mt-0.5">{result.paymentMethod}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Pairs Ordered</p>
              <p className="font-medium text-zinc-900 tabular-nums mt-0.5">{result.itemCount}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Order Total</p>
              <p className="font-semibold text-zinc-950 tabular-nums mt-0.5">
                {formatPHP(result.totalAmount)}
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Last Updated</p>
              <p className="text-xs font-medium text-zinc-800 mt-1">
                {formatDateTime(result.updatedAt)}
              </p>
            </div>
          </div>

          {result.trackingNotes && (
            <p className="text-xs text-zinc-600 mt-4">
              Store Update: <span className="text-zinc-900">{result.trackingNotes}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};
