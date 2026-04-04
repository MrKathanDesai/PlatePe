import { useState, useMemo } from 'react';
import { 
  Search, 
  ShoppingCart, 
  ChevronLeft, 
  Plus, 
  Minus, 
  CreditCard, 
  Smartphone, 
  Banknote,
  CheckCircle2,
  Clock,
  ArrowRight,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Category, OrderItem, Modifier } from '../types';
import { PRODUCTS, CATEGORIES } from '../mockData';

type CustomerStep = 'Welcome' | 'Menu' | 'Cart' | 'Checkout' | 'Payment' | 'Status';

export default function CustomerView() {
  const [step, setStep] = useState<CustomerStep>('Welcome');
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORIES[0].id);
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Card' | 'Cash' | null>(null);

  const filteredProducts = useMemo(() => {
    return PRODUCTS.filter(p => 
      p.categoryId === selectedCategory && 
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [selectedCategory, searchQuery]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        modifiers: [],
        status: 'Pending'
      }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const tax = subtotal * 0.05;
  const total = subtotal + tax;

  const renderStep = () => {
    switch (step) {
      case 'Welcome':
        return (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full p-8 text-center bg-white"
          >
            <div className="w-24 h-24 bg-black rounded-3xl flex items-center justify-center mb-8">
              <span className="text-4xl font-black text-white tracking-tighter">P</span>
            </div>
            <h1 className="text-4xl font-black tracking-tighter uppercase mb-2">Welcome to PlatePe</h1>
            <p className="text-[#474747] font-medium mb-12">April Origin • Premium Hospitality</p>
            
            <button 
              onClick={() => setStep('Menu')}
              className="w-full max-w-xs bg-black text-white py-5 rounded-xl font-black uppercase tracking-widest text-sm flex items-center justify-center gap-3 active:scale-95 transition-all shadow-xl"
            >
              Start Order
              <ArrowRight size={20} />
            </button>
            
            <div className="mt-12 flex items-center gap-2 text-[#474747] text-xs font-bold uppercase tracking-widest opacity-40">
              <Info size={14} />
              Scan QR at table to link order
            </div>
          </motion.div>
        );

      case 'Menu':
        return (
          <div className="flex flex-col h-full bg-[#f9f9f9]">
            {/* Header */}
            <header className="px-6 py-6 bg-white border-b border-[#eeeeee] flex items-center justify-between sticky top-0 z-20">
              <button onClick={() => setStep('Welcome')} className="p-2 -ml-2">
                <ChevronLeft size={24} />
              </button>
              <div className="flex-1 px-4">
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Search menu..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#f3f3f3] border-none rounded-full px-10 py-2 text-sm focus:ring-2 focus:ring-black"
                  />
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#c6c6c6]" />
                </div>
              </div>
              <button 
                onClick={() => setStep('Cart')}
                className="relative p-2 bg-black text-white rounded-full"
              >
                <ShoppingCart size={20} />
                {cart.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#006c49] text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                    {cart.reduce((s, i) => s + i.quantity, 0)}
                  </span>
                )}
              </button>
            </header>

            {/* Categories */}
            <div className="flex gap-3 px-6 py-4 overflow-x-auto bg-white border-b border-[#eeeeee] scrollbar-hide">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    selectedCategory === cat.id 
                      ? 'bg-black text-white' 
                      : 'bg-[#f3f3f3] text-[#474747]'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto p-6 pb-24">
              <div className="grid grid-cols-2 gap-4">
                {filteredProducts.map(product => (
                  <div key={product.id} className="bg-white rounded-2xl overflow-hidden border border-[#eeeeee] flex flex-col shadow-sm">
                    <div className="aspect-square bg-[#f3f3f3] relative">
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      <button 
                        onClick={() => addToCart(product)}
                        className="absolute bottom-3 right-3 w-10 h-10 bg-black text-white rounded-full flex items-center justify-center shadow-lg active:scale-90 transition-all"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-sm leading-tight mb-1">{product.name}</h3>
                      <p className="text-black font-black">₹{product.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Bar */}
            {cart.length > 0 && (
              <div className="fixed bottom-6 left-6 right-6 z-30">
                <button 
                  onClick={() => setStep('Cart')}
                  className="w-full bg-[#006c49] text-white p-4 rounded-2xl flex items-center justify-between shadow-2xl active:scale-95 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="bg-white/20 px-2 py-1 rounded font-black text-xs">
                      {cart.reduce((s, i) => s + i.quantity, 0)} Items
                    </div>
                    <span className="font-bold text-sm uppercase tracking-widest">View Cart</span>
                  </div>
                  <span className="font-black text-lg">₹{total.toLocaleString()}</span>
                </button>
              </div>
            )}
          </div>
        );

      case 'Cart':
        return (
          <div className="flex flex-col h-full bg-white">
            <header className="px-6 py-6 border-b border-[#eeeeee] flex items-center gap-4">
              <button onClick={() => setStep('Menu')} className="p-2 -ml-2">
                <ChevronLeft size={24} />
              </button>
              <h2 className="text-xl font-black uppercase tracking-tight">Your Order</h2>
            </header>

            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
              {cart.map(item => (
                <div key={item.id} className="flex items-center justify-between">
                  <div className="flex-1">
                    <h4 className="font-bold text-base">{item.name}</h4>
                    <p className="text-sm font-black text-[#474747]">₹{item.price}</p>
                  </div>
                  <div className="flex items-center gap-4 bg-[#f3f3f3] rounded-xl p-1">
                    <button 
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm active:scale-90"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="font-black text-sm w-4 text-center">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-8 h-8 flex items-center justify-center bg-black text-white rounded-lg shadow-sm active:scale-90"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              ))}

              <div className="pt-4">
                <label className="text-[10px] font-bold uppercase text-[#474747] tracking-widest mb-3 block">Special Instructions</label>
                <textarea 
                  placeholder="Any allergies or special requests?"
                  className="w-full bg-[#f3f3f3] border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-black min-h-[100px]"
                />
              </div>
            </div>

            <div className="p-6 bg-[#f9f9f9] border-t border-[#eeeeee]">
              <div className="space-y-2 mb-6">
                <div className="flex justify-between text-sm text-[#474747]">
                  <span>Subtotal</span>
                  <span className="font-bold">₹{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm text-[#474747]">
                  <span>GST (5%)</span>
                  <span className="font-bold">₹{tax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-end pt-2">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#474747]">Total Amount</span>
                  <span className="text-3xl font-black tracking-tighter">₹{total.toLocaleString()}</span>
                </div>
              </div>
              <button 
                onClick={() => setStep('Checkout')}
                className="w-full bg-black text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm active:scale-95 transition-all"
              >
                Checkout
              </button>
            </div>
          </div>
        );

      case 'Checkout':
        return (
          <div className="flex flex-col h-full bg-white">
            <header className="px-6 py-6 border-b border-[#eeeeee] flex items-center gap-4">
              <button onClick={() => setStep('Cart')} className="p-2 -ml-2">
                <ChevronLeft size={24} />
              </button>
              <h2 className="text-xl font-black uppercase tracking-tight">Checkout</h2>
            </header>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#474747] mb-4">Order Summary</h3>
                <div className="bg-[#f3f3f3] rounded-2xl p-4 space-y-2">
                  {cart.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="font-medium">{item.quantity}× {item.name}</span>
                      <span className="font-black">₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                  <div className="border-t border-[#c6c6c6] pt-2 mt-2 flex justify-between font-black">
                    <span>Total</span>
                    <span>₹{total.toLocaleString()}</span>
                  </div>
                </div>
              </section>

              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#474747] mb-4">Payment Method</h3>
                <div className="space-y-3">
                  {[
                    { id: 'UPI', label: 'UPI (GPay, PhonePe, etc.)', icon: Smartphone, desc: 'Instant & Secure' },
                    { id: 'Card', label: 'Credit / Debit Card', icon: CreditCard, desc: 'Visa, Mastercard, Amex' },
                    { id: 'Cash', label: 'Pay at Counter', icon: Banknote, desc: 'Pay after your meal' },
                  ].map((method) => (
                    <button
                      key={method.id}
                      onClick={() => setPaymentMethod(method.id as any)}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                        paymentMethod === method.id 
                          ? 'border-black bg-black text-white' 
                          : 'border-[#eeeeee] bg-white text-black hover:border-[#c6c6c6]'
                      }`}
                    >
                      <div className={`p-3 rounded-xl ${paymentMethod === method.id ? 'bg-white/20' : 'bg-[#f3f3f3]'}`}>
                        <method.icon size={24} />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm">{method.label}</p>
                        <p className={`text-xs ${paymentMethod === method.id ? 'text-white/60' : 'text-[#474747]'}`}>{method.desc}</p>
                      </div>
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        paymentMethod === method.id ? 'border-white' : 'border-[#eeeeee]'
                      }`}>
                        {paymentMethod === method.id && <div className="w-3 h-3 bg-white rounded-full" />}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <div className="p-6 border-t border-[#eeeeee]">
              <button 
                disabled={!paymentMethod}
                onClick={() => setStep('Payment')}
                className="w-full bg-[#006c49] disabled:bg-[#c6c6c6] text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm active:scale-95 transition-all"
              >
                Confirm & Pay ₹{total.toLocaleString()}
              </button>
            </div>
          </div>
        );

      case 'Payment':
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center h-full p-8 text-center bg-white"
          >
            {paymentMethod === 'UPI' ? (
              <div className="w-full max-w-sm space-y-8">
                <h2 className="text-2xl font-black tracking-tighter uppercase">Scan to Pay</h2>
                <div className="bg-[#f3f3f3] p-8 rounded-3xl border-2 border-black inline-block">
                  <div className="w-48 h-48 bg-white rounded-xl flex items-center justify-center border border-[#eeeeee]">
                    {/* Mock QR Code */}
                    <div className="grid grid-cols-4 gap-1 p-4 opacity-20">
                      {Array.from({ length: 16 }).map((_, i) => (
                        <div key={i} className="w-8 h-8 bg-black rounded-sm" />
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-3xl font-black">₹{total.toLocaleString()}</p>
                  <p className="text-sm text-[#474747] font-medium">Order #0047 • Table 04</p>
                </div>
                <button 
                  onClick={() => setStep('Status')}
                  className="w-full bg-black text-white py-5 rounded-2xl font-black uppercase tracking-widest text-sm"
                >
                  I have paid
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="w-20 h-20 bg-[#d1fae5] text-[#006c49] rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 size={40} />
                </div>
                <h2 className="text-2xl font-black tracking-tighter uppercase">Processing Payment</h2>
                <p className="text-[#474747] font-medium">Please follow instructions on the card terminal</p>
                <button 
                  onClick={() => setStep('Status')}
                  className="text-sm font-bold uppercase tracking-widest text-black underline"
                >
                  Skip for demo
                </button>
              </div>
            )}
          </motion.div>
        );

      case 'Status':
        return (
          <div className="flex flex-col h-full bg-white p-8">
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
              <div className="relative">
                <div className="w-32 h-32 border-4 border-[#f3f3f3] border-t-[#006c49] rounded-full animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Clock size={40} className="text-[#006c49]" />
                </div>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-3xl font-black tracking-tighter uppercase">Order Confirmed</h2>
                <p className="text-[#474747] font-medium">Your order #0047 is being prepared</p>
              </div>

              <div className="w-full max-w-sm bg-[#f3f3f3] rounded-3xl p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-widest text-[#474747]">Est. Wait Time</span>
                  <span className="font-black">12-15 Mins</span>
                </div>
                <div className="h-2 bg-white rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '30%' }}
                    className="h-full bg-[#006c49]"
                  />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-[#006c49]">Chef is preparing your meal</p>
              </div>
            </div>

            <button 
              onClick={() => {
                setCart([]);
                setStep('Welcome');
              }}
              className="w-full border-2 border-black py-5 rounded-2xl font-black uppercase tracking-widest text-sm active:scale-95 transition-all"
            >
              Order More
            </button>
          </div>
        );
    }
  };

  return (
    <div className="h-full w-full max-w-md mx-auto bg-white shadow-2xl overflow-hidden relative font-sans">
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="h-full"
        >
          {renderStep()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
