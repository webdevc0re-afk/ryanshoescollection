import React, { useState, useEffect } from 'react';
import { X, Minus, Plus, Check } from 'lucide-react';
import { Product, formatPHP, getEffectivePrice } from '../types/store';
import { ResilientImage } from './ResilientImage';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (product: Product, size: string, color: string, quantity: number) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  onClose,
  onAddToCart,
}) => {
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [addedFeedback, setAddedFeedback] = useState(false);

  useEffect(() => {
    if (!product) return;
    const firstInStockSize =
      product.sizes.find((s) => (product.sizeStock?.[s] ?? 0) > 0) || product.sizes[0] || '';
    setSelectedSize(firstInStockSize);
    setSelectedColor(product.colors[0] || 'Classic');
    setQuantity(1);
    setAddedFeedback(false);
  }, [product]);

  if (!product) return null;

  const effectivePrice = getEffectivePrice(product.price, product.discountPercent);
  const availableForSize = Number(product.sizeStock?.[selectedSize] ?? 0);
  const isOutOfStock = product.stock <= 0 || availableForSize <= 0;

  const handleSizeSelect = (size: string) => {
    setSelectedSize(size);
    const maxForNew = Number(product.sizeStock?.[size] ?? 0);
    setQuantity(maxForNew > 0 ? Math.min(quantity, maxForNew) : 1);
  };

  const handleAdd = () => {
    if (isOutOfStock || !selectedSize) return;
    onAddToCart(product, selectedSize, selectedColor, quantity);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1400);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-[2px] flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      <div className="bg-white border border-zinc-200 rounded-xl max-w-4xl w-full overflow-hidden shadow-2xl my-auto">
        <div className="grid grid-cols-1 md:grid-cols-12">
          {/* Left Image Gallery */}
          <div className="md:col-span-6 bg-zinc-100 relative aspect-[4/3] md:aspect-auto md:min-h-[460px]">
            <ResilientImage
              src={product.imageUrl}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Right Contiguous Purchase Module */}
          <div className="md:col-span-6 p-6 md:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-4 mb-3">
                <p className="text-xs font-medium text-zinc-500">
                  {product.brand} · {product.category} · {product.ageGroup}
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-zinc-400 hover:text-zinc-900 rounded-md transition-colors shrink-0"
                  aria-label="Close product details"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h2 className="font-display text-2xl font-bold text-zinc-950 tracking-tight mb-2">
                {product.name}
              </h2>

              <div className="flex items-baseline gap-3 mb-4 tabular-nums">
                <span className="text-xl font-semibold text-zinc-950">
                  {formatPHP(effectivePrice)}
                </span>
                {product.discountPercent > 0 && (
                  <>
                    <span className="text-sm text-zinc-400 line-through">
                      {formatPHP(product.price)}
                    </span>
                    <span className="text-xs font-medium text-blue-700">
                      Save {product.discountPercent}%
                    </span>
                  </>
                )}
              </div>

              <p className="text-sm text-zinc-600 leading-relaxed mb-6">
                {product.description}
              </p>

              {/* Colorway Selector */}
              <div className="mb-5">
                <div className="flex items-center justify-between text-xs font-medium text-zinc-700 mb-2">
                  <span>Colorway</span>
                  <span className="text-zinc-500">{selectedColor}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {product.colors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                        selectedColor === color
                          ? 'bg-zinc-950 text-white border-zinc-950'
                          : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shoe Size Selector with Available Stock */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-xs font-medium text-zinc-700 mb-2">
                  <span>Select Size</span>
                  <span className="tabular-nums text-zinc-500">
                    {availableForSize > 0
                      ? `${availableForSize} pairs available in ${selectedSize}`
                      : 'Selected size out of stock'}
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {product.sizes.map((size) => {
                    const count = Number(product.sizeStock?.[size] ?? 0);
                    const disabled = count <= 0;
                    const active = selectedSize === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        disabled={disabled}
                        onClick={() => handleSizeSelect(size)}
                        className={`py-2 px-2 text-xs font-medium rounded-md border transition-colors tabular-nums text-center ${
                          disabled
                            ? 'bg-zinc-50 text-zinc-300 border-zinc-200 cursor-not-allowed line-through'
                            : active
                              ? 'bg-zinc-950 text-white border-zinc-950'
                              : 'bg-white text-zinc-800 border-zinc-200 hover:border-zinc-400'
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Quantity & Add to Bag */}
            <div className="pt-4 border-t border-zinc-200 flex items-center gap-3">
              <div className="flex items-center border border-zinc-200 rounded-lg h-11">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={isOutOfStock || quantity <= 1}
                  className="px-3 h-full text-zinc-600 hover:text-zinc-950 disabled:opacity-40"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-9 text-center text-sm font-medium tabular-nums">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(availableForSize, q + 1))}
                  disabled={isOutOfStock || quantity >= availableForSize}
                  className="px-3 h-full text-zinc-600 hover:text-zinc-950 disabled:opacity-40"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleAdd}
                disabled={isOutOfStock}
                className="flex-1 h-11 px-5 bg-zinc-950 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {addedFeedback ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Added to Bag</span>
                  </>
                ) : isOutOfStock ? (
                  <span>Out of Stock</span>
                ) : (
                  <span>Add to Bag · {formatPHP(effectivePrice * quantity)}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
