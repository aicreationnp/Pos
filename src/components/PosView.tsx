import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Product,
  Category,
  BranchProduct,
  OrderItem,
  Order,
  PaymentMethod,
  ProductVariant,
  ProductAddOn,
} from '../types';
import {
  getCategories,
  getProducts,
  getBranchProducts,
  createOrder,
} from '../services/dbService';
import { ReceiptModal } from './ReceiptModal';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  CreditCard,
  Banknote,
  QrCode,
  CupSoda,
  Tag,
  AlertCircle,
  User,
  Phone,
  FileText,
  Sparkles,
  ShoppingBag,
} from 'lucide-react';

export const PosView: React.FC = () => {
  const { userProfile, currentBranchId, currentBranch, branches } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branchProducts, setBranchProducts] = useState<BranchProduct[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Cart State
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>('flat');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountTendered, setAmountTendered] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [showCustomerFields, setShowCustomerFields] = useState<boolean>(false);
  const [customTaxRate, setCustomTaxRate] = useState<number | null>(null);

  // Modal States
  const [selectedProductForCustomization, setSelectedProductForCustomization] = useState<Product | null>(null);
  const [tempVariant, setTempVariant] = useState<ProductVariant | undefined>(undefined);
  const [tempAddOns, setTempAddOns] = useState<ProductAddOn[]>([]);
  const [submittingOrder, setSubmittingOrder] = useState<boolean>(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Effective branch to use: if 'all', pick first available branch
  const activeBranch = useMemo(() => {
    if (currentBranch) return currentBranch;
    if (branches.length > 0) return branches[0];
    return null;
  }, [currentBranch, branches]);

  const activeBranchId = activeBranch?.id || '';

  // Load catalog and stock
  const loadCatalog = async () => {
    try {
      setLoading(true);
      const [cats, prods] = await Promise.all([getCategories(), getProducts()]);
      setCategories(cats.filter((c) => c.active));
      setProducts(prods.filter((p) => p.active));

      if (activeBranchId) {
        const bp = await getBranchProducts(activeBranchId);
        setBranchProducts(bp);
      }
    } catch (err) {
      console.error('Failed to load POS catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, [activeBranchId]);

  // Branch product map for fast lookup of stock & branch price override
  const branchProductMap = useMemo(() => {
    const map = new Map<string, BranchProduct>();
    for (const bp of branchProducts) {
      map.set(bp.productId, bp);
    }
    return map;
  }, [branchProducts]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategoryId === 'all' || p.categoryId === selectedCategoryId;
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategoryId, searchQuery]);

  // Add product to cart (or open customization modal if has variants/addons)
  const handleProductClick = (product: Product) => {
    if ((product.variants && product.variants.length > 0) || (product.addOns && product.addOns.length > 0)) {
      setSelectedProductForCustomization(product);
      setTempVariant(product.variants?.[0] || undefined);
      setTempAddOns([]);
    } else {
      addProductDirectly(product);
    }
  };

  const addProductDirectly = (
    product: Product,
    variant?: ProductVariant,
    addOns: ProductAddOn[] = []
  ) => {
    const bp = branchProductMap.get(product.id);
    const basePrice = bp?.priceOverride !== undefined ? bp.priceOverride : product.globalSellingPrice;
    const variantOffset = variant?.priceOffset || 0;
    const addOnsTotal = addOns.reduce((sum, a) => sum + a.price, 0);
    const unitPrice = basePrice + variantOffset + addOnsTotal;

    // Check stock limit if stock tracking is enabled
    const currentStock = bp ? bp.stockQuantity : 999;
    const isTracking = bp?.stockTrackingEnabled ?? true;

    // Find if exact same configuration exists in cart
    const existingIndex = cartItems.findIndex(
      (item) =>
        item.productId === product.id &&
        item.variant?.id === variant?.id &&
        JSON.stringify(item.selectedAddOns?.map((a) => a.id).sort()) ===
          JSON.stringify(addOns.map((a) => a.id).sort())
    );

    if (existingIndex > -1) {
      const existing = cartItems[existingIndex];
      if (isTracking && existing.quantity + 1 > currentStock) {
        setErrorMessage(`Cannot add more: Only ${currentStock} available in stock.`);
        return;
      }
      const updated = [...cartItems];
      updated[existingIndex] = {
        ...existing,
        quantity: existing.quantity + 1,
        itemSubtotal: (existing.quantity + 1) * existing.unitPrice,
      };
      setCartItems(updated);
    } else {
      if (isTracking && currentStock <= 0) {
        setErrorMessage(`Item is currently out of stock.`);
        return;
      }
      const newItem: OrderItem = {
        productId: product.id,
        productName: product.name,
        categoryName: categories.find((c) => c.id === product.categoryId)?.name,
        variant,
        selectedAddOns: addOns,
        unitPrice,
        quantity: 1,
        itemSubtotal: unitPrice,
      };
      setCartItems([...cartItems, newItem]);
    }
    setErrorMessage(null);
  };

  const handleUpdateQuantity = (index: number, delta: number) => {
    const item = cartItems[index];
    const bp = branchProductMap.get(item.productId);
    const currentStock = bp ? bp.stockQuantity : 999;
    const isTracking = bp?.stockTrackingEnabled ?? true;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      handleRemoveItem(index);
      return;
    }

    if (isTracking && newQty > currentStock) {
      setErrorMessage(`Cannot exceed available stock (${currentStock}).`);
      return;
    }

    const updated = [...cartItems];
    updated[index] = {
      ...item,
      quantity: newQty,
      itemSubtotal: newQty * item.unitPrice,
    };
    setCartItems(updated);
    setErrorMessage(null);
  };

  const handleRemoveItem = (index: number) => {
    const updated = cartItems.filter((_, i) => i !== index);
    setCartItems(updated);
  };

  const handleClearCart = () => {
    setCartItems([]);
    setDiscountValue(0);
    setAmountTendered('');
    setErrorMessage(null);
  };

  // Calculations
  const subtotal = useMemo(() => {
    return cartItems.reduce((sum, item) => sum + item.itemSubtotal, 0);
  }, [cartItems]);

  const discountAmount = useMemo(() => {
    if (!discountValue || discountValue <= 0) return 0;
    if (discountType === 'flat') {
      return Math.min(discountValue, subtotal);
    } else {
      return Math.min((subtotal * discountValue) / 100, subtotal);
    }
  }, [subtotal, discountValue, discountType]);

  const branchTaxRate = activeBranch?.taxRate !== undefined ? Number(activeBranch.taxRate) : 0;
  const effectiveTaxRate = customTaxRate !== null ? customTaxRate : branchTaxRate;
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = (taxableAmount * effectiveTaxRate) / 100;
  const totalAmount = Math.round((taxableAmount + taxAmount) * 100) / 100;

  const tenderedNum = parseFloat(amountTendered) || 0;
  const changeDue = paymentMethod === 'cash' && tenderedNum > totalAmount ? tenderedNum - totalAmount : 0;

  // Checkout submission
  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    if (!activeBranchId) {
      setErrorMessage('Please select a valid branch to complete sale.');
      return;
    }

    // Verify stock one last time before submitting
    for (const item of cartItems) {
      const bp = branchProductMap.get(item.productId);
      if (bp?.stockTrackingEnabled && item.quantity > bp.stockQuantity) {
        setErrorMessage(
          `Cannot checkout: "${item.productName}" exceeds available stock (${bp.stockQuantity}).`
        );
        return;
      }
    }

    try {
      setSubmittingOrder(true);
      setErrorMessage(null);

      const receiptNumber = `RCP-${Date.now().toString().slice(-6)}`;

      // Pristine sanitization of cart items (no undefined values)
      const cleanItems: OrderItem[] = cartItems.map((item) => {
        const itemObj: OrderItem = {
          productId: item.productId,
          productName: item.productName,
          categoryName: item.categoryName || 'Dessert',
          unitPrice: Number(item.unitPrice),
          quantity: Number(item.quantity),
          itemSubtotal: Number(item.itemSubtotal),
        };
        if (item.variant) itemObj.variant = item.variant;
        if (item.selectedAddOns && item.selectedAddOns.length > 0) itemObj.selectedAddOns = item.selectedAddOns;
        if (item.itemNotes) itemObj.itemNotes = item.itemNotes;
        return itemObj;
      });

      const orderData: Omit<Order, 'id'> = {
        receiptNumber,
        branchId: activeBranchId,
        branchName: activeBranch?.name || 'Central Branch',
        cashierId: userProfile?.id || 'cashier',
        cashierName: userProfile?.displayName || 'Cashier',
        status: 'completed',
        items: cleanItems,
        subtotal: Number(subtotal),
        discountAmount: Number(discountAmount),
        discountType,
        discountValue: Number(discountValue),
        taxAmount: Number(taxAmount),
        taxRate: Number(effectiveTaxRate),
        totalAmount: Number(totalAmount),
        paymentMethod,
        paymentStatus: 'paid',
        amountTendered: paymentMethod === 'cash' ? Number(tenderedNum || totalAmount) : Number(totalAmount),
        changeDue: paymentMethod === 'cash' ? Number(changeDue) : 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (customerName.trim()) orderData.customerName = customerName.trim();
      if (customerPhone.trim()) orderData.customerPhone = customerPhone.trim();
      if (orderNotes.trim()) orderData.orderNotes = orderNotes.trim();

      const orderId = await createOrder(orderData);
      const created: Order = { ...orderData, id: orderId };

      setCompletedOrder(created);
      // Reset cart
      setCartItems([]);
      setDiscountValue(0);
      setAmountTendered('');
      setCustomerName('');
      setCustomerPhone('');
      setOrderNotes('');
      // Reload branch stock
      await loadCatalog();
    } catch (err: any) {
      console.error('Checkout failed:', err);
      const detail = err?.message || String(err);
      setErrorMessage(`Checkout error: ${detail}`);
    } finally {
      setSubmittingOrder(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      {/* Branch notice if in consolidated view */}
      {currentBranchId === 'all' && (
        <div className="mb-4 bg-[#F8E7E5] border border-[#D98591]/40 rounded-xl p-3 flex items-center justify-between text-xs text-[#70445B]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#D98591]" />
            <span>
              Operating at: <strong className="font-semibold">{activeBranch?.name}</strong> (Branch Code:{' '}
              {activeBranch?.code})
            </span>
          </div>
          <span className="text-[11px] text-[#79696D]">Sales will be recorded under this active branch</span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-3 flex items-center gap-2 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} className="ml-auto font-bold text-rose-500">
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Section: Catalog & Search (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search & Categories Bar */}
          <div className="bg-[#FFFFFF] p-4 rounded-2xl border border-[#EADBD6] shadow-xs space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#79696D] absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Search falooda, milkshakes, kulfi, snacks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm rounded-xl border border-[#EADBD6] bg-[#FFFCF8] text-[#493A3E] focus:outline-none focus:ring-2 focus:ring-[#D98591]"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-xs text-[#79696D] hover:text-[#493A3E]"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedCategoryId('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  selectedCategoryId === 'all'
                    ? 'bg-[#70445B] text-white shadow-xs'
                    : 'bg-[#F8E7E5] text-[#493A3E] hover:bg-[#D98591]/20'
                }`}
              >
                All Menu ({products.length})
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategoryId(c.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    selectedCategoryId === c.id
                      ? 'bg-[#70445B] text-white shadow-xs'
                      : 'bg-[#F8E7E5] text-[#493A3E] hover:bg-[#D98591]/20'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          {loading ? (
            <div className="bg-[#FFFFFF] rounded-2xl p-12 text-center border border-[#EADBD6]">
              <CupSoda className="w-8 h-8 text-[#D98591] animate-bounce mx-auto mb-2" />
              <p className="text-sm font-medium text-[#79696D]">Loading delicious dessert catalog...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-[#FFFFFF] rounded-2xl p-12 text-center border border-[#EADBD6]">
              <CupSoda className="w-10 h-10 text-[#79696D]/40 mx-auto mb-2" />
              <p className="text-sm font-bold text-[#493A3E]">No dessert items found</p>
              <p className="text-xs text-[#79696D] mt-1">Try a different search keyword or category filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredProducts.map((p) => {
                const bp = branchProductMap.get(p.id);
                const price = bp?.priceOverride !== undefined ? bp.priceOverride : p.globalSellingPrice;
                const stock = bp ? bp.stockQuantity : 999;
                const isTracking = bp?.stockTrackingEnabled ?? true;
                const isOutOfStock = isTracking && stock <= 0;
                const isLowStock = isTracking && stock > 0 && stock <= (bp?.lowStockAlert || 10);

                return (
                  <div
                    key={p.id}
                    onClick={() => !isOutOfStock && handleProductClick(p)}
                    className={`group bg-[#FFFFFF] rounded-2xl p-3.5 border border-[#EADBD6] hover:border-[#D98591] transition-all duration-150 flex flex-col justify-between cursor-pointer shadow-xs hover:shadow-md ${
                      isOutOfStock ? 'opacity-50 cursor-not-allowed bg-neutral-50' : 'active:scale-98'
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between mb-2 text-[10px]">
                        <span className="font-mono text-[#79696D]">{p.sku}</span>
                        {isTracking && (
                          <span
                            className={`px-2 py-0.5 rounded-full font-semibold ${
                              isOutOfStock
                                ? 'bg-rose-100 text-rose-700'
                                : isLowStock
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {isOutOfStock ? 'Out of Stock' : `${stock} in stock`}
                          </span>
                        )}
                      </div>

                      {/* Product Name & Description */}
                      <h4 className="font-bold text-sm text-[#493A3E] group-hover:text-[#70445B] line-clamp-1">
                        {p.name}
                      </h4>
                      <p className="text-[11px] text-[#79696D] line-clamp-2 mt-1 leading-relaxed">
                        {p.description}
                      </p>
                    </div>

                    {/* Bottom Price & Add Action */}
                    <div className="pt-3 mt-2 border-t border-[#EADBD6]/60 flex items-center justify-between">
                      <div>
                        <span className="text-base font-extrabold text-[#70445B]">₹{price}</span>
                        {p.variants && p.variants.length > 0 && (
                          <span className="text-[10px] text-[#79696D] ml-1">+{p.variants.length} sizes</span>
                        )}
                      </div>
                      <button
                        disabled={isOutOfStock}
                        className={`w-7 h-7 rounded-xl flex items-center justify-center transition ${
                          isOutOfStock
                            ? 'bg-neutral-200 text-neutral-400'
                            : 'bg-[#F8E7E5] text-[#70445B] group-hover:bg-[#70445B] group-hover:text-white'
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Section: Interactive Cart & Checkout (5 Cols) */}
        <div className="lg:col-span-5 bg-[#FFFFFF] rounded-2xl border border-[#EADBD6] shadow-md overflow-hidden flex flex-col">
          {/* Cart Header */}
          <div className="bg-[#70445B] text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#D98591]" />
              <h3 className="font-bold text-base">Active Order Cart</h3>
            </div>
            {cartItems.length > 0 && (
              <button
                onClick={handleClearCart}
                className="text-xs text-white/70 hover:text-white flex items-center gap-1 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 max-h-[360px] overflow-y-auto p-4 space-y-2.5 divide-y divide-[#EADBD6]/60">
            {cartItems.length === 0 ? (
              <div className="py-12 text-center text-[#79696D]">
                <CupSoda className="w-10 h-10 text-[#D98591]/40 mx-auto mb-2" />
                <p className="text-sm font-semibold text-[#493A3E]">Your cart is empty</p>
                <p className="text-xs mt-1">Tap any falooda or shake on the left to add items</p>
              </div>
            ) : (
              cartItems.map((item, idx) => (
                <div key={idx} className="pt-2 first:pt-0 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#493A3E] truncate">{item.productName}</span>
                      <span className="font-bold text-xs text-[#70445B]">₹{item.itemSubtotal.toFixed(2)}</span>
                    </div>

                    {/* Variant & Addons sublabels */}
                    {(item.variant || (item.selectedAddOns && item.selectedAddOns.length > 0)) && (
                      <div className="text-[10px] text-[#79696D] space-x-1.5 truncate">
                        {item.variant && <span>Size: {item.variant.name}</span>}
                        {item.selectedAddOns?.map((a) => (
                          <span key={a.id} className="text-[#D98591] font-medium">
                            +{a.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="text-[10px] text-[#79696D]">₹{item.unitPrice.toFixed(2)} each</div>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-1.5 shrink-0 bg-[#F8E7E5] rounded-xl p-1 border border-[#EADBD6]">
                    <button
                      onClick={() => handleUpdateQuantity(idx, -1)}
                      className="w-5 h-5 rounded-lg bg-white text-[#70445B] flex items-center justify-center hover:bg-[#D98591] hover:text-white transition"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-bold text-xs w-5 text-center text-[#493A3E]">{item.quantity}</span>
                    <button
                      onClick={() => handleUpdateQuantity(idx, 1)}
                      className="w-5 h-5 rounded-lg bg-white text-[#70445B] flex items-center justify-center hover:bg-[#D98591] hover:text-white transition"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Customer & Discount Controls */}
          {cartItems.length > 0 && (
            <div className="px-4 py-3 bg-[#FFFCF8] border-t border-[#EADBD6] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowCustomerFields(!showCustomerFields)}
                  className="text-xs text-[#70445B] font-semibold hover:underline flex items-center gap-1"
                >
                  <User className="w-3.5 h-3.5" />
                  {showCustomerFields ? 'Hide Customer Details' : '+ Add Customer / Order Note'}
                </button>
              </div>

              {showCustomerFields && (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Customer Name"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-[#EADBD6] bg-white text-xs focus:ring-1 focus:ring-[#D98591]"
                    />
                    <input
                      type="text"
                      placeholder="Phone (optional)"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="px-2.5 py-1.5 rounded-lg border border-[#EADBD6] bg-white text-xs focus:ring-1 focus:ring-[#D98591]"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Notes (e.g. Less sugar, extra straw)"
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#EADBD6] bg-white text-xs focus:ring-1 focus:ring-[#D98591]"
                  />
                </div>
              )}

              {/* Discount Selector */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[11px] text-[#79696D] shrink-0 flex items-center gap-1">
                  <Tag className="w-3 h-3 text-[#D98591]" /> Discount:
                </span>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as 'flat' | 'percentage')}
                  className="px-2 py-1 text-[11px] rounded-lg border border-[#EADBD6] bg-white"
                >
                  <option value="flat">₹ Flat</option>
                  <option value="percentage">% Percent</option>
                </select>
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  value={discountValue || ''}
                  onChange={(e) => setDiscountValue(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-20 px-2 py-1 text-xs rounded-lg border border-[#EADBD6] bg-white"
                />
              </div>

              {/* Tax / GST Selector */}
              <div className="flex items-center justify-between pt-2 border-t border-[#EADBD6]/60">
                <span className="text-[11px] text-[#79696D] flex items-center gap-1">
                  Tax / GST ({effectiveTaxRate}%):
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCustomTaxRate(0)}
                    className={`px-2 py-0.5 text-[10px] rounded-md font-bold transition border ${
                      effectiveTaxRate === 0
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-[#493A3E] border-[#EADBD6] hover:bg-[#F8E7E5]'
                    }`}
                  >
                    0% (No Tax)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCustomTaxRate(5)}
                    className={`px-2 py-0.5 text-[10px] rounded-md font-bold transition border ${
                      effectiveTaxRate === 5
                        ? 'bg-[#70445B] text-white border-[#70445B]'
                        : 'bg-white text-[#493A3E] border-[#EADBD6] hover:bg-[#F8E7E5]'
                    }`}
                  >
                    5% GST
                  </button>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={effectiveTaxRate}
                    onChange={(e) => setCustomTaxRate(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-14 px-1.5 py-0.5 text-xs text-center rounded-md border border-[#EADBD6] bg-white font-bold"
                  />
                  <span className="text-[10px] text-[#79696D]">%</span>
                </div>
              </div>
            </div>
          )}

          {/* Totals Summary */}
          {cartItems.length > 0 && (
            <div className="p-4 bg-[#F8E7E5]/50 border-t border-[#EADBD6] space-y-1.5 text-xs">
              <div className="flex justify-between text-[#79696D]">
                <span>Subtotal ({cartItems.reduce((acc, i) => acc + i.quantity, 0)} items):</span>
                <span className="font-medium text-[#493A3E]">₹{subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount:</span>
                  <span className="font-semibold">-₹{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#79696D]">
                <span>GST/Tax ({effectiveTaxRate}%):</span>
                <span className={`font-medium ${taxAmount === 0 ? 'text-emerald-700 font-bold' : 'text-[#493A3E]'}`}>
                  {taxAmount === 0 ? '₹0.00 (No GST)' : `₹${taxAmount.toFixed(2)}`}
                </span>
              </div>
              <div className="flex justify-between text-base font-extrabold text-[#70445B] pt-2 border-t border-[#EADBD6]">
                <span>Total Amount:</span>
                <span>₹{totalAmount.toFixed(2)}</span>
              </div>

              {/* Payment Methods */}
              <div className="pt-3">
                <span className="text-[11px] font-bold text-[#493A3E] block mb-1.5">Payment Method:</span>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition border ${
                      paymentMethod === 'cash'
                        ? 'bg-[#70445B] text-white border-[#70445B]'
                        : 'bg-white text-[#493A3E] border-[#EADBD6] hover:bg-[#F8E7E5]'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('digital_wallet')}
                    className={`py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition border ${
                      paymentMethod === 'digital_wallet'
                        ? 'bg-[#70445B] text-white border-[#70445B]'
                        : 'bg-white text-[#493A3E] border-[#EADBD6] hover:bg-[#F8E7E5]'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    UPI / QR
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`py-2 rounded-xl flex items-center justify-center gap-1.5 text-xs font-semibold transition border ${
                      paymentMethod === 'card'
                        ? 'bg-[#70445B] text-white border-[#70445B]'
                        : 'bg-white text-[#493A3E] border-[#EADBD6] hover:bg-[#F8E7E5]'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Card
                  </button>
                </div>
              </div>

              {/* Cash Calculator if Cash selected */}
              {paymentMethod === 'cash' && (
                <div className="pt-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#79696D] shrink-0">Cash Tendered:</span>
                    <input
                      type="number"
                      placeholder={`₹${totalAmount}`}
                      value={amountTendered}
                      onChange={(e) => setAmountTendered(e.target.value)}
                      className="w-full px-2.5 py-1 text-xs font-bold rounded-lg border border-[#EADBD6] bg-white text-[#493A3E]"
                    />
                  </div>
                  {/* Quick Tender Buttons */}
                  <div className="flex gap-1.5 pt-0.5">
                    {[100, 200, 500, 1000, 2000]
                      .filter((val) => val >= totalAmount)
                      .slice(0, 4)
                      .map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setAmountTendered(val.toString())}
                          className="px-2 py-0.5 text-[10px] rounded-md bg-white border border-[#EADBD6] font-semibold text-[#70445B] hover:bg-[#F8E7E5]"
                        >
                          ₹{val}
                        </button>
                      ))}
                  </div>
                  {changeDue > 0 && (
                    <div className="flex justify-between items-center text-xs font-bold bg-emerald-50 text-emerald-800 p-2 rounded-lg border border-emerald-200">
                      <span>Change to Return:</span>
                      <span className="text-sm">₹{changeDue.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Checkout Submit Button */}
              <div className="pt-3">
                <button
                  type="button"
                  disabled={submittingOrder}
                  onClick={handleCheckout}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#D98591] to-[#70445B] hover:from-[#C66F7D] hover:to-[#5B3348] text-white font-extrabold text-sm shadow-md transition-all active:scale-99 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submittingOrder ? (
                    <span>Processing Sale...</span>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Complete Sale (₹{totalAmount.toFixed(2)})
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Customization Modal for Variants & Add-ons */}
      {selectedProductForCustomization && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-[#EADBD6] max-w-md w-full p-6 shadow-2xl space-y-4">
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-lg text-[#70445B]">{selectedProductForCustomization.name}</h3>
                  <p className="text-xs text-[#79696D] mt-0.5">{selectedProductForCustomization.description}</p>
                </div>
                <button
                  onClick={() => setSelectedProductForCustomization(null)}
                  className="text-neutral-400 hover:text-neutral-700 text-sm font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Variants */}
            {selectedProductForCustomization.variants && selectedProductForCustomization.variants.length > 0 && (
              <div>
                <label className="text-xs font-bold text-[#493A3E] block mb-2">Choose Size / Variant:</label>
                <div className="grid grid-cols-2 gap-2">
                  {selectedProductForCustomization.variants.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setTempVariant(v)}
                      className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between border transition ${
                        tempVariant?.id === v.id
                          ? 'bg-[#70445B] text-white border-[#70445B]'
                          : 'bg-[#FFFCF8] text-[#493A3E] border-[#EADBD6] hover:bg-[#F8E7E5]'
                      }`}
                    >
                      <span>{v.name}</span>
                      <span className={tempVariant?.id === v.id ? 'text-[#D98591]' : 'text-[#79696D]'}>
                        {v.priceOffset > 0 ? `+₹${v.priceOffset}` : 'Regular'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Add-ons */}
            {selectedProductForCustomization.addOns && selectedProductForCustomization.addOns.length > 0 && (
              <div>
                <label className="text-xs font-bold text-[#493A3E] block mb-2">Select Toppings & Add-ons:</label>
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {selectedProductForCustomization.addOns.map((addon) => {
                    const isSelected = tempAddOns.some((a) => a.id === addon.id);
                    return (
                      <div
                        key={addon.id}
                        onClick={() => {
                          if (isSelected) {
                            setTempAddOns(tempAddOns.filter((a) => a.id !== addon.id));
                          } else {
                            setTempAddOns([...tempAddOns, addon]);
                          }
                        }}
                        className={`p-2 rounded-xl text-xs flex items-center justify-between border cursor-pointer transition ${
                          isSelected
                            ? 'bg-[#F8E7E5] border-[#D98591] text-[#70445B] font-semibold'
                            : 'bg-white border-[#EADBD6] text-[#493A3E] hover:bg-[#FFFCF8]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="rounded text-[#D98591] focus:ring-[#D98591]"
                          />
                          <span>{addon.name}</span>
                        </div>
                        <span className="font-bold">+₹{addon.price}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="pt-3 border-t border-[#EADBD6] flex items-center justify-between">
              <div>
                <span className="text-xs text-[#79696D]">Item Total:</span>
                <span className="text-base font-extrabold text-[#70445B] ml-2">
                  ₹
                  {selectedProductForCustomization.globalSellingPrice +
                    (tempVariant?.priceOffset || 0) +
                    tempAddOns.reduce((s, a) => s + a.price, 0)}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedProductForCustomization(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-[#EADBD6] text-[#493A3E] hover:bg-[#F8E7E5]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addProductDirectly(selectedProductForCustomization, tempVariant, tempAddOns);
                    setSelectedProductForCustomization(null);
                  }}
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-[#70445B] hover:bg-[#D98591] text-white shadow-sm transition"
                >
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Completed Order Thermal Receipt Modal */}
      {completedOrder && (
        <ReceiptModal
          order={completedOrder}
          branch={activeBranch}
          onClose={() => setCompletedOrder(null)}
        />
      )}
    </div>
  );
};
