import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Send, X, Sparkles, ArrowRight, RotateCcw } from 'lucide-react';
import { Product, formatPHP, getEffectivePrice } from '../types/store';

interface RobotChatWidgetProps {
  products: Product[];
  onSelectProduct: (product: Product) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  vibe: 'kids' | 'adult';
}

type AudienceVibe = 'kids' | 'adult';

const QUICK_PROMPTS: Record<AudienceVibe, string[]> = {
  kids: [
    'Best sneakers for ages 10 to 17?',
    'Unsay nindot nga sapatos para sa 10–17 yrs old?',
    'Anong magandang sapatos pang-school o sports?',
    'Asa dapit inyong store ug unsa contact number?',
    'Pwede ba COD, GCash, o Maya sa pagbayad?',
    'What cool colors & sizes are in stock?',
  ],
  adult: [
    'Where is your store located & contact number?',
    'Unsay available nga komportableng sapatos (40–60 yrs old)?',
    'Magkano shipping fee at may free shipping ba?',
    'How do COD, GCash, and Maya payments work?',
    'Asa sa Minglanilla, Cebu mo ug pwede ba mag-contact?',
    'Paano i-track ang order ko sa RYAN\'S SHOES COLLECTION?',
  ],
};

const STORE_CONTACT_LINE = 'Minglanilla, Cebu · Contact: 09153824116';

const RobotMascotSvg: React.FC<{ vibe: AudienceVibe; thinking?: boolean }> = ({
  vibe,
  thinking = false,
}) => {
  const accentFill = vibe === 'kids' ? '#F59E0B' : '#14B8A6';
  const visorBg = vibe === 'kids' ? '#0C4A6E' : '#0F172A';

  return (
    <motion.svg
      width="36"
      height="36"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      animate={thinking ? { rotate: [-4, 4, -4] } : { y: [0, -2, 0] }}
      transition={{ duration: thinking ? 0.6 : 2.6, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden="true"
    >
      {/* Antenna */}
      <line x1="24" y1="6" x2="24" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
      <motion.circle
        cx="24"
        cy="5"
        r="3.2"
        fill={accentFill}
        animate={{ scale: [1, 1.25, 1] }}
        transition={{ duration: 1.6, repeat: Infinity }}
      />
      {/* Head Chassis */}
      <rect x="9" y="12" width="30" height="24" rx="8" fill="#FFFFFF" stroke="currentColor" strokeWidth="2.2" />
      {/* Side Ears */}
      <rect x="4" y="20" width="4" height="9" rx="2" fill={accentFill} />
      <rect x="40" y="20" width="4" height="9" rx="2" fill={accentFill} />
      {/* Visor */}
      <rect x="13" y="16" width="22" height="12" rx="4.5" fill={visorBg} />
      {/* Expressive Eyes */}
      <motion.circle
        cx="19"
        cy="22"
        r="2.3"
        fill={vibe === 'kids' ? '#38BDF8' : '#5EEAD4'}
        animate={{ scaleY: [1, 1, 0.15, 1] }}
        transition={{ duration: 3.4, repeat: Infinity, times: [0, 0.9, 0.95, 1] }}
      />
      <motion.circle
        cx="29"
        cy="22"
        r="2.3"
        fill={vibe === 'kids' ? '#38BDF8' : '#5EEAD4'}
        animate={{ scaleY: [1, 1, 0.15, 1] }}
        transition={{ duration: 3.4, repeat: Infinity, times: [0, 0.9, 0.95, 1] }}
      />
      {/* Cheerful Smile */}
      <path
        d="M19 31C20.5 32.8 27.5 32.8 29 31"
        stroke={visorBg}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </motion.svg>
  );
};

export const RobotChatWidget: React.FC<RobotChatWidgetProps> = ({
  products,
  onSelectProduct,
}) => {
  const [open, setOpen] = useState(false);
  const [vibe, setVibe] = useState<AudienceVibe>('adult');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'model',
      vibe: 'adult',
      text: "Maayong adlaw! Magandang araw! Hi there!\n\nI'm RyanBot, your friendly 24/7 shoe buddy at RYAN'S SHOES COLLECTION (Minglanilla, Cebu · Contact: 09153824116). Feel free to chat with me in English, Cebuano, or Tagalog! Ask about shoe sizes (ages 10 to 60), stock, prices, shipping, or COD, GCash & Maya — or tap a question below!",
    },
  ]);

  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, open]);

  const findMentionedProducts = (text: string): Product[] => {
    const lower = text.toLowerCase();
    return products
      .filter((p) => p.active !== false && lower.includes(p.name.toLowerCase()))
      .slice(0, 3);
  };

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    setErrorMsg('');
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      vibe,
      text: trimmed,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);

    try {
      const catalogContext = products
        .filter((p) => p.active !== false)
        .map((p) => ({
          name: p.name,
          brand: p.brand,
          category: p.category,
          ageGroup: p.ageGroup,
          price: p.price,
          discountPercent: p.discountPercent,
          effectivePrice: getEffectivePrice(p.price, p.discountPercent),
          stock: p.stock,
          sizes: p.sizes,
          colors: p.colors,
        }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audienceMode: vibe,
          catalogContext,
          messages: nextHistory.map((m) => ({
            role: m.role,
            text: m.text,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to reach RyanBot right now.');
      }

      const botMsg: ChatMessage = {
        id: `m-${Date.now()}`,
        role: 'model',
        vibe,
        text: data.reply,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to reach AI assistant.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleReset = () => {
    setErrorMsg('');
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'model',
        vibe,
        text:
          vibe === 'kids'
            ? "Hey champ! Maayong adlaw! Kumusta! I'm RyanBot, your friendly sneaker buddy at RYAN'S SHOES COLLECTION (Minglanilla, Cebu · 09153824116). Chat with me in English, Cebuano, or Tagalog about awesome shoes for school, sports, or hanging out!"
            : "Maayong adlaw! Magandang araw! I'm RyanBot, your 24/7 footwear concierge at RYAN'S SHOES COLLECTION (Minglanilla, Cebu · Contact: 09153824116). Ask me in English, Cebuano, or Tagalog about sizes (ages 10–60), comfort picks, stock, shipping, or COD, GCash & Maya!",
      },
    ]);
  };

  const isKids = vibe === 'kids';

  return (
    <>
      {/* Floating Animated Robot Launcher */}
      <div className="fixed bottom-4 right-4 z-40">
        <AnimatePresence>
          {!open && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.9, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 12 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.18 }}
              onClick={() => setOpen(true)}
              className={`h-13 px-4 rounded-full shadow-lg border flex items-center gap-2.5 text-white transition-colors ${
                isKids
                  ? 'bg-gradient-to-r from-sky-600 to-emerald-600 border-sky-400/40'
                  : 'bg-gradient-to-r from-blue-700 to-teal-700 border-blue-500/40'
              }`}
              aria-label="Open RyanBot AI Shoe Assistant"
            >
              <span className="text-zinc-900">
                <RobotMascotSvg vibe={vibe} />
              </span>
              <div className="text-left pr-1">
                <p className="text-xs font-bold leading-tight whitespace-nowrap">
                  Ask RyanBot AI
                </p>
                <p className="text-[11px] text-white/85 leading-tight whitespace-nowrap">
                  EN · Cebuano · Tagalog
                </p>
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Animated Positive-Vibe Chat Window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] sm:w-[400px] h-[560px] max-h-[82vh] bg-white border border-zinc-200 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
            role="dialog"
            aria-label="RyanBot AI Robot Inquiries"
          >
            {/* Cheerful Positive Header */}
            <div
              className={`px-4 py-3.5 text-white transition-colors duration-200 ${
                isKids
                  ? 'bg-gradient-to-r from-sky-600 via-cyan-600 to-emerald-600'
                  : 'bg-gradient-to-r from-blue-700 via-blue-800 to-teal-700'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="text-zinc-900 shrink-0">
                    <RobotMascotSvg vibe={vibe} thinking={loading} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display text-sm font-bold truncate">
                      RyanBot · RYAN'S SHOES COLLECTION
                    </h2>
                    <p className="text-[11px] text-white/90 truncate">
                      {STORE_CONTACT_LINE}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={handleReset}
                    title="New conversation"
                    aria-label="Reset chat"
                    className="p-1.5 rounded-lg text-white/85 hover:text-white hover:bg-white/15 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close chat"
                    className="p-1.5 rounded-lg text-white/85 hover:text-white hover:bg-white/15 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Kids vs Adult Positive Vibe Switcher */}
              <div className="mt-3 flex items-center gap-1.5 bg-black/15 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setVibe('kids')}
                  className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    isKids
                      ? 'bg-white text-sky-800 shadow-sm'
                      : 'text-white/90 hover:text-white'
                  }`}
                >
                  Kids & Youth Vibe (10–17)
                </button>
                <button
                  type="button"
                  onClick={() => setVibe('adult')}
                  className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                    !isKids
                      ? 'bg-white text-blue-900 shadow-sm'
                      : 'text-white/90 hover:text-white'
                  }`}
                >
                  Adult & Family Vibe (18–60)
                </button>
              </div>
            </div>

            {/* Message Feed */}
            <div
              className={`flex-1 overflow-y-auto p-4 space-y-3.5 transition-colors ${
                isKids ? 'bg-sky-50/40' : 'bg-slate-50/60'
              }`}
            >
              {messages.map((msg) => {
                const isBot = msg.role === 'model';
                const matchedProducts = isBot ? findMentionedProducts(msg.text) : [];

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}
                  >
                    <div
                      className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${
                        isBot
                          ? isKids
                            ? 'bg-white border border-sky-200 text-zinc-800 rounded-tl-sm shadow-xs'
                            : 'bg-white border border-teal-200/80 text-zinc-800 rounded-tl-sm shadow-xs'
                          : isKids
                            ? 'bg-gradient-to-r from-sky-600 to-emerald-600 text-white rounded-tr-sm'
                            : 'bg-gradient-to-r from-blue-700 to-teal-700 text-white rounded-tr-sm'
                      }`}
                    >
                      {msg.text}
                    </div>

                    {/* Clickable Product Recommendations mentioned by RyanBot */}
                    {matchedProducts.length > 0 && (
                      <div className="mt-2 space-y-1.5 w-full max-w-[86%]">
                        {matchedProducts.map((prod) => (
                          <button
                            key={prod.id}
                            type="button"
                            onClick={() => {
                              setOpen(false);
                              onSelectProduct(prod);
                            }}
                            className="w-full p-2 bg-white border border-zinc-200 hover:border-blue-600 rounded-xl flex items-center justify-between gap-2.5 text-left transition-colors"
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-zinc-950 truncate">
                                {prod.name}
                              </p>
                              <p className="text-[11px] text-zinc-500 tabular-nums">
                                {formatPHP(getEffectivePrice(prod.price, prod.discountPercent))} · {prod.stock} pairs left
                              </p>
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {loading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-start"
                >
                  <div className="bg-white border border-zinc-200 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
                    {[0, 1, 2].map((dot) => (
                      <motion.span
                        key={dot}
                        className={`w-2 h-2 rounded-full ${
                          isKids ? 'bg-sky-500' : 'bg-teal-600'
                        }`}
                        animate={{ y: [0, -4, 0] }}
                        transition={{
                          duration: 0.6,
                          repeat: Infinity,
                          delay: dot * 0.14,
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}

              {messages.length === 1 && !loading && (
                <div className="pt-1 space-y-1.5">
                  <p className="text-[11px] font-medium text-zinc-500 px-1">
                    Possible questions (English · Cebuano · Tagalog):
                  </p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {QUICK_PROMPTS[vibe].map((q) => (
                      <button
                        key={`intro-${q}`}
                        type="button"
                        onClick={() => sendMessage(q)}
                        className={`text-left px-3 py-2 rounded-xl text-xs font-medium border transition-colors flex items-center justify-between gap-2 ${
                          isKids
                            ? 'bg-white border-sky-200 text-sky-900 hover:bg-sky-50'
                            : 'bg-white border-teal-200 text-zinc-800 hover:bg-teal-50/70'
                        }`}
                      >
                        <span>{q}</span>
                        <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-60" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
                  {errorMsg}
                </div>
              )}

              <div ref={scrollEndRef} />
            </div>

            {/* Quick Inquiry Prompts */}
            <div className="px-3.5 py-2 bg-white border-t border-zinc-100 flex items-center gap-1.5 overflow-x-auto">
              <Sparkles
                className={`w-3.5 h-3.5 shrink-0 ${
                  isKids ? 'text-amber-500' : 'text-teal-600'
                }`}
              />
              {QUICK_PROMPTS[vibe].map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={loading}
                  onClick={() => sendMessage(q)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border whitespace-nowrap shrink-0 transition-colors ${
                    isKids
                      ? 'bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100'
                      : 'bg-teal-50 border-teal-200 text-teal-900 hover:bg-teal-100'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Message Input Form */}
            <form
              onSubmit={handleSubmit}
              className="p-3 bg-white border-t border-zinc-200 flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isKids
                    ? 'Ask in English, Cebuano, or Tagalog...'
                    : 'Type in English, Cebuano, or Tagalog...'
                }
                disabled={loading}
                className="flex-1 px-3.5 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-blue-600"
              />
              <motion.button
                type="submit"
                whileTap={{ scale: 0.94 }}
                disabled={loading || !input.trim()}
                aria-label="Send inquiry"
                className={`p-2.5 rounded-xl text-white transition-colors disabled:opacity-40 shrink-0 ${
                  isKids
                    ? 'bg-sky-600 hover:bg-sky-700'
                    : 'bg-blue-700 hover:bg-blue-800'
                }`}
              >
                <Send className="w-4 h-4" />
              </motion.button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
