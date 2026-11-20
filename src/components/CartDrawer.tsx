import React from 'react';
import { X, Minus, Plus, Trash2, ShoppingBag } from 'lucide-react';
import { CartItem, FREE_SHIPPING_THRESHOLD, formatPHP } from '../types/store';
import { ResilientImage } from './ResilientImage';

interface CartDrawerProps {
  open: boolean;
  items: CartItem[];
  onClose: () => void;
  onUpdateQty: (productId: string, size: string, color: string, nextQty: number) => void;
  onRemoveItem: (productId: string, size: string, color: string) => void;
  onCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  open,
  items,
  onClose,
  onUpdateQty,
  onRemoveItem,
  onCheckout,
}) => {
  if (!open) return null;

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const freeShippingRemaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-zinc-950/50 backdrop-blur-[2px]">
      <div
        className="w-full max-w-md bg-white h-full flex flex-col border-l border-zinc-200 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Shopping Bag"
      >
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-4 h-4 text-zinc-900" />
            <h2 className="font-display text-base font-semibold text-zinc-950">
              Shopping Bag ({totalCount})
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-zinc-950 rounded-md transition-colors"
            aria-label="Close shopping bag"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Free shipping indicator */}
        {items.length > 0 && (
          <div className="px-6 py-2.5 bg-zinc-50 border-b border-zinc-200 text-xs text-zinc-600">
            {freeShippingRemaining === 0 ? (
              <span className="font-medium text-emerald-700">
                Your order qualifies for free nationwide shipping.
              </span>
            ) : (
              <span>
                Add <strong className="tabular-nums text-zinc-900">{formatPHP(freeShippingRemaining)}</strong> more for free nationwide shipping.
              </span>
            )}
          </div>
        )}

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4 divide-y divide-zinc-200">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <ShoppingBag className="w-10 h-10 text-zinc-300 mb-3" strokeWidth={1.5} />
              <p className="font-display text-base font-semibold text-zinc-900 mb-1">
                Your bag is empty
              </p>
              <p className="text-sm text-zinc-500 max-w-xs mb-6">
                Browse footwear for ages 10 to 60 and select your size to begin.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-zinc-950 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
              >
                Explore Shoes
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={`${item.productId}-${item.size}-${item.color}`}
                className="py-4 flex gap-4"
              >
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-zinc-100 shrink-0 border border-zinc-200">
                  <ResilientImage src={item.imageUrl} alt={item.name} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-zinc-950 truncate">
                      {item.name}
                    </h3>
                    <button
                      type="button"
                      onClick={() => onRemoveItem(item.productId, item.size, item.color)}
                      className="text-zinc-400 hover:text-red-700 p-1 transition-colors shrink-0"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-xs text-zinc-500 mt-0.5">
                    {item.color} · {item.size} · {item.maxStock} in stock
                  </p>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center border border-zinc-200 rounded-md h-8">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateQty(item.productId, item.size, item.color, item.quantity - 1)
                        }
                        className="px-2 h-full text-zinc-600 hover:text-zinc-950"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-7 text-center text-xs font-medium tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateQty(item.productId, item.size, item.color, item.quantity + 1)
                        }
                        disabled={item.quantity >= item.maxStock}
                        className="px-2 h-full text-zinc-600 hover:text-zinc-950 disabled:opacity-35"
                        aria-label="Increase quantity"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <span className="text-sm font-semibold text-zinc-950 tabular-nums">
                      {formatPHP(item.unitPrice * item.quantity)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-6 border-t border-zinc-200 bg-zinc-50">
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span className="text-zinc-600">Subtotal</span>
              <span className="font-semibold text-zinc-950 tabular-nums">
                {formatPHP(subtotal)}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              Shipping fee calculated by Philippine region at checkout.
            </p>
            <button
              type="button"
              onClick={onCheckout}
              className="w-full py-3 px-4 bg-zinc-950 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Proceed to Checkout
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
