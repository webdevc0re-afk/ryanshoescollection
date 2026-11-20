import React, { useMemo, useState } from 'react';
import { Search, ArrowRight, SlidersHorizontal } from 'lucide-react';
import {
  AgeGroup,
  Product,
  ProductCategory,
  formatPHP,
  getEffectivePrice,
} from '../types/store';
import { ResilientImage } from './ResilientImage';

interface StorefrontViewProps {
  products: Product[];
  loading: boolean;
  onSelectProduct: (product: Product) => void;
  onNavigateTrack: () => void;
}

const CATEGORIES: Array<'All' | ProductCategory> = [
  'All',
  'Running',
  'Court & Casual',
  'Loafers & Dress',
  'Trail & Outdoor',
  'Kids & Youth',
  'Comfort Walking',
];

const AGE_GROUPS: Array<'All' | AgeGroup> = [
  'All',
  'All Ages (10-60)',
  'Kids & Youth (10-17)',
  'Adults (18-45)',
  'Mature Comfort (46-60)',
];

type MerchFilter = 'All' | 'Featured' | 'New Arrivals' | 'Best Sellers';
type SortOption = 'featured' | 'price-asc' | 'price-desc';

export const StorefrontView: React.FC<StorefrontViewProps> = ({
  products,
  loading,
  onSelectProduct,
  onNavigateTrack,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'All' | ProductCategory>('All');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<'All' | AgeGroup>('All');
  const [merchFilter, setMerchFilter] = useState<MerchFilter>('All');
  const [sortBy, setSortBy] = useState<SortOption>('featured');

  const activeProducts = useMemo(() => products.filter((p) => p.active !== false), [products]);

  const filteredProducts = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = activeProducts.filter((p) => {
      if (selectedCategory !== 'All' && p.category !== selectedCategory) return false;
      if (selectedAgeGroup !== 'All' && p.ageGroup !== selectedAgeGroup && p.ageGroup !== 'All Ages (10-60)') {
        return false;
      }
      if (merchFilter === 'Featured' && !p.featured) return false;
      if (merchFilter === 'New Arrivals' && !p.newArrival) return false;
      if (merchFilter === 'Best Sellers' && !p.bestSeller) return false;
      if (q) {
        const hay = `${p.name} ${p.brand} ${p.category} ${p.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === 'price-asc') {
      return [...list].sort(
        (a, b) =>
          getEffectivePrice(a.price, a.discountPercent) -
          getEffectivePrice(b.price, b.discountPercent)
      );
    }
    if (sortBy === 'price-desc') {
      return [...list].sort(
        (a, b) =>
          getEffectivePrice(b.price, b.discountPercent) -
          getEffectivePrice(a.price, a.discountPercent)
      );
    }
    return [...list].sort((a, b) => Number(b.featured) - Number(a.featured));
  }, [activeProducts, searchTerm, selectedCategory, selectedAgeGroup, merchFilter, sortBy]);

  const scrollToCatalog = () => {
    const el = document.getElementById('catalog-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-zinc-50 text-zinc-950">
      {/* Section 1: Architectural Split Hero */}
      <section className="border-b border-zinc-200 bg-white">
        <div className="max-w-[1280px] mx-auto px-6 py-10 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          <div className="lg:col-span-5 flex flex-col justify-center">
            <p className="text-xs font-medium text-zinc-500 tracking-wide mb-4">
              Ages 10 to 60 · Philippines Nationwide Delivery
            </p>
            <h1 className="font-display text-[clamp(2.25rem,4vw,3.5rem)] font-bold tracking-tight text-zinc-950 leading-[1.08] mb-5 text-balance">
              Everyday Footwear Built for Every Step.
            </h1>
            <p className="text-base text-zinc-600 leading-relaxed mb-8 max-w-lg">
              From junior court sneakers to breathable daily runners, handcrafted leather loafers, and cushioned comfort walkers — curated for Filipino families with Cash on Delivery, GCash, and Maya.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={scrollToCatalog}
                className="px-6 py-3 bg-zinc-950 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
              >
                <span>Shop Collection</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onNavigateTrack}
                className="px-5 py-3 bg-white text-zinc-800 border border-zinc-200 text-sm font-medium rounded-lg hover:border-zinc-400 transition-colors whitespace-nowrap"
              >
                Track Order
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 relative rounded-xl overflow-hidden bg-zinc-100 border border-zinc-200 min-h-[300px] lg:min-h-[440px]">
            <ResilientImage
              src="/src/assets/images/hero_shoes_showcase_1795196861632.jpg"
              alt="RYAN'S SHOES COLLECTION studio showcase featuring leather court sneakers, running shoes, and loafers"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />
            <div className="absolute bottom-5 left-5 right-5 flex flex-wrap items-end justify-between gap-4 text-white">
              <div>
                <p className="text-xs text-zinc-200 mb-1">2026 Studio Release</p>
                <p className="font-display text-lg font-semibold">
                  RYAN'S SHOES COLLECTION
                </p>
              </div>
              <p className="text-xs text-zinc-200 tabular-nums">
                Free nationwide shipping on orders ₱3,500+
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Interactive Footwear Catalog */}
      <section id="catalog-section" className="max-w-[1280px] mx-auto px-6 py-12 lg:py-16">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h2 className="font-display text-2xl lg:text-3xl font-bold text-zinc-950 tracking-tight mb-1.5">
              Footwear Collection
            </h2>
            <p className="text-sm text-zinc-600">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'model' : 'models'} available across youth and adult sizing.
            </p>
          </div>

          {/* Search & Merchandising Spotlight Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search shoes, brands..."
                className="pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-950 w-56 sm:w-64"
              />
            </div>

            <select
              value={selectedAgeGroup}
              onChange={(e) => setSelectedAgeGroup(e.target.value as 'All' | AgeGroup)}
              aria-label="Filter by age group"
              className="px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-800 focus:outline-none focus:border-zinc-950"
            >
              {AGE_GROUPS.map((age) => (
                <option key={age} value={age}>
                  {age === 'All' ? 'All Ages (10-60)' : age}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              aria-label="Sort products"
              className="px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-800 focus:outline-none focus:border-zinc-950"
            >
              <option value="featured">Sort: Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Category & Spotlight Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 mb-8 border-b border-zinc-200">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  selectedCategory === category
                    ? 'bg-zinc-950 text-white'
                    : 'bg-white text-zinc-600 border border-zinc-200 hover:text-zinc-950 hover:border-zinc-300'
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 bg-zinc-200/70 rounded-lg self-start lg:self-auto">
            {(['All', 'Featured', 'New Arrivals', 'Best Sellers'] as MerchFilter[]).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setMerchFilter(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  merchFilter === tab
                    ? 'bg-white text-zinc-950 shadow-sm'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* 3-Column Product Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="bg-white border border-zinc-200 rounded-xl overflow-hidden animate-pulse">
                <div className="aspect-[4/3] bg-zinc-100" />
                <div className="p-5 space-y-3">
                  <div className="h-3 w-1/2 bg-zinc-100 rounded" />
                  <div className="h-5 w-3/4 bg-zinc-100 rounded" />
                  <div className="h-4 w-1/3 bg-zinc-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-xl p-12 text-center">
            <SlidersHorizontal className="w-8 h-8 text-zinc-300 mx-auto mb-3" />
            <h3 className="font-display text-lg font-semibold text-zinc-950 mb-1">
              No matching shoes found
            </h3>
            <p className="text-sm text-zinc-500 mb-5">
              Adjust your search keyword, age group, or category filter to view available footwear.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('All');
                setSelectedAgeGroup('All');
                setMerchFilter('All');
              }}
              className="px-4 py-2 bg-zinc-950 text-white text-sm font-medium rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {filteredProducts.map((product) => {
              const effPrice = getEffectivePrice(product.price, product.discountPercent);
              const isOut = product.stock <= 0;
              const isLow = product.stock > 0 && product.stock <= product.lowStockThreshold;
              const labelTag = product.newArrival
                ? 'New Arrival'
                : product.bestSeller
                  ? 'Best Seller'
                  : '';

              return (
                <article
                  key={product.id}
                  onClick={() => onSelectProduct(product)}
                  className="group bg-white border border-zinc-200 rounded-xl overflow-hidden cursor-pointer transition-transform duration-150 hover:-translate-y-0.5 hover:border-zinc-300 flex flex-col"
                >
                  <div className="aspect-[4/3] bg-zinc-100 overflow-hidden relative">
                    <ResilientImage
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <p className="text-xs text-zinc-500 mb-1.5 truncate">
                        {product.brand} · {product.category}
                        {labelTag ? ` · ${labelTag}` : ''}
                      </p>
                      <h3 className="font-display text-base font-semibold text-zinc-950 mb-1 line-clamp-1">
                        {product.name}
                      </h3>
                      <p className="text-xs text-zinc-500 mb-4 line-clamp-2 leading-relaxed">
                        {product.ageGroup} — {product.colors.join(', ')}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-3">
                      <div className="flex items-baseline gap-2 tabular-nums">
                        <span className="text-[15px] font-semibold text-zinc-950">
                          {formatPHP(effPrice)}
                        </span>
                        {product.discountPercent > 0 && (
                          <span className="text-xs text-zinc-400 line-through">
                            {formatPHP(product.price)}
                          </span>
                        )}
                      </div>

                      <span
                        className={`text-xs font-medium tabular-nums ${
                          isOut
                            ? 'text-red-700'
                            : isLow
                              ? 'text-amber-700'
                              : 'text-zinc-600'
                        }`}
                      >
                        {isOut
                          ? 'Out of Stock'
                          : isLow
                            ? `Low Stock (${product.stock})`
                            : `In Stock (${product.stock})`}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Section 3: Brand Promise & Philippine Payment Reliability */}
      <section className="bg-zinc-950 text-white border-t border-zinc-900">
        <div className="max-w-[1280px] mx-auto px-6 py-14 lg:py-18 grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
          <div>
            <p className="text-xs text-zinc-400 mb-2">01. Multi-Generation Fit</p>
            <h3 className="font-display text-lg font-semibold mb-2">
              Calibrated for Ages 10 to 60
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Every silhouette in RYAN'S SHOES COLLECTION lists exact per-size inventory from junior US 3Y up to adult US 12 with arch-friendly comfort options.
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-2">02. Local Checkout Trust</p>
            <h3 className="font-display text-lg font-semibold mb-2">
              COD, GCash & Maya Verified
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Pay securely upon delivery or via GCash and Maya merchant transfer with transaction reference verification and live order status tracking.
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-400 mb-2">03. Live Inventory Accuracy</p>
            <h3 className="font-display text-lg font-semibold mb-2">
              Real-Time Stock Sync
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Confirmed orders automatically update size-level warehouse stock so every pair reserved for your shipment is verified before dispatch.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
