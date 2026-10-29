import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Order, Expense, Product, BranchProduct } from '../types';
import { getOrders, getExpenses, getProducts, getAllBranchProducts } from '../services/dbService';
import { canViewSales, hasPermission } from '../services/permissionService';
import {
  TrendingUp,
  DollarSign,
  Receipt,
  ShoppingBag,
  Percent,
  RotateCcw,
  CreditCard,
  Banknote,
  AlertTriangle,
  Award,
  Building2,
  Calendar,
  Lock,
  ArrowUpRight,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const { userProfile, currentBranchId, branches } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branchProducts, setBranchProducts] = useState<BranchProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | '7days' | '30days' | 'this_month'>('7days');

  // Permission Check: Deny access if unauthorized
  const isAuthorized = canViewSales(userProfile, currentBranchId);
  const canViewProfit = hasPermission(userProfile, 'reports.profit.view');
  const canViewExpenses = hasPermission(userProfile, 'reports.expenses.view') || hasPermission(userProfile, 'expenses.view');

  const fetchData = async () => {
    if (!isAuthorized) return;
    try {
      setLoading(true);
      const [orderList, expenseList, prodList, bpList] = await Promise.all([
        getOrders(currentBranchId, 300),
        getExpenses(currentBranchId),
        getProducts(),
        getAllBranchProducts(),
      ]);
      setOrders(orderList);
      setExpenses(expenseList);
      setProducts(prodList);
      setBranchProducts(bpList);
    } catch (err) {
      console.error('Failed to load dashboard metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentBranchId, isAuthorized]);

  // Product cost map for calculating COGS
  const productCostMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of products) {
      map.set(p.id, p.costPrice || 0);
    }
    return map;
  }, [products]);

  // Date Filtering Calculations
  const filteredData = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const sevenDaysAgo = todayStart - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = todayStart - 30 * 24 * 60 * 60 * 1000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let startTime = sevenDaysAgo;
    let endTime = now.getTime();

    if (dateRange === 'today') {
      startTime = todayStart;
    } else if (dateRange === 'yesterday') {
      startTime = yesterdayStart;
      endTime = todayStart;
    } else if (dateRange === '7days') {
      startTime = sevenDaysAgo;
    } else if (dateRange === '30days') {
      startTime = thirtyDaysAgo;
    } else if (dateRange === 'this_month') {
      startTime = monthStart;
    }

    const matchedOrders = orders.filter((o) => {
      const t = new Date(o.createdAt).getTime();
      return t >= startTime && t <= endTime;
    });

    const matchedExpenses = expenses.filter((e) => {
      const t = new Date(e.date || e.createdAt).getTime();
      return t >= startTime && t <= endTime;
    });

    return { matchedOrders, matchedExpenses };
  }, [orders, expenses, dateRange]);

  // Metrics computation
  const metrics = useMemo(() => {
    const { matchedOrders, matchedExpenses } = filteredData;

    let grossSales = 0;
    let totalDiscounts = 0;
    let totalTax = 0;
    let cashSales = 0;
    let digitalSales = 0;
    let cardSales = 0;
    let completedCount = 0;
    let refundedCount = 0;
    let refundAmountTotal = 0;
    let totalCOGS = 0;

    const productSalesCount = new Map<string, { name: string; qty: number; revenue: number }>();
    const branchSalesMap = new Map<string, { branchName: string; total: number; orderCount: number }>();

    for (const order of matchedOrders) {
      if (order.status === 'completed') {
        completedCount++;
        grossSales += order.subtotal;
        totalDiscounts += order.discountAmount || 0;
        totalTax += order.taxAmount || 0;

        if (order.paymentMethod === 'cash') cashSales += order.totalAmount;
        else if (order.paymentMethod === 'digital_wallet') digitalSales += order.totalAmount;
        else if (order.paymentMethod === 'card') cardSales += order.totalAmount;

        // Tally items
        for (const item of order.items) {
          const c = productSalesCount.get(item.productId) || {
            name: item.productName,
            qty: 0,
            revenue: 0,
          };
          c.qty += item.quantity;
          c.revenue += item.itemSubtotal;
          productSalesCount.set(item.productId, c);

          const unitCost = productCostMap.get(item.productId) || 0;
          totalCOGS += unitCost * item.quantity;
        }

        // Branch aggregation
        const b = branchSalesMap.get(order.branchId) || {
          branchName: order.branchName || 'Branch',
          total: 0,
          orderCount: 0,
        };
        b.total += order.totalAmount;
        b.orderCount += 1;
        branchSalesMap.set(order.branchId, b);
      } else if (order.status === 'refunded' || order.status === 'partially_refunded') {
        refundedCount++;
        refundAmountTotal += order.totalAmount;
      }
    }

    const netSales = Math.max(0, grossSales - totalDiscounts + totalTax - refundAmountTotal);
    const averageOrderValue = completedCount > 0 ? netSales / completedCount : 0;
    const totalExpensesAmount = matchedExpenses.reduce((sum, e) => sum + e.amount, 0);

    const estimatedGrossProfit = Math.max(0, netSales - totalCOGS);
    const estimatedOperatingResult = estimatedGrossProfit - totalExpensesAmount;

    // Top selling products sorted
    const topProducts = Array.from(productSalesCount.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 6);

    const branchBreakdown = Array.from(branchSalesMap.values()).sort((a, b) => b.total - a.total);

    return {
      grossSales,
      totalDiscounts,
      refundAmountTotal,
      netSales,
      completedCount,
      refundedCount,
      averageOrderValue,
      cashSales,
      digitalSales,
      cardSales,
      totalCOGS,
      estimatedGrossProfit,
      totalExpensesAmount,
      estimatedOperatingResult,
      topProducts,
      branchBreakdown,
    };
  }, [filteredData, productCostMap]);

  // Low stock alerts
  const lowStockItems = useMemo(() => {
    return branchProducts
      .filter((bp) => {
        const matchesBranch = currentBranchId === 'all' || bp.branchId === currentBranchId;
        return matchesBranch && bp.stockTrackingEnabled && bp.stockQuantity <= (bp.lowStockAlert || 10);
      })
      .map((bp) => {
        const p = products.find((prod) => prod.id === bp.productId);
        const b = branches.find((branch) => branch.id === bp.branchId);
        return {
          id: bp.id,
          productName: p?.name || 'Item',
          branchName: b?.name || 'Branch',
          stockQuantity: bp.stockQuantity,
          lowStockAlert: bp.lowStockAlert,
        };
      });
  }, [branchProducts, products, branches, currentBranchId]);

  if (!isAuthorized) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[#70445B]">Financial Access Restricted</h2>
        <p className="text-sm text-[#79696D] max-w-md mx-auto mt-2 leading-relaxed">
          You do not have permission to view sales dashboards or financial revenue figures. Please contact
          the Super Admin to request the <code className="bg-[#F8E7E5] px-1 py-0.5 rounded text-xs font-mono font-semibold">dashboard.view_sales</code> or <code className="bg-[#F8E7E5] px-1 py-0.5 rounded text-xs font-mono font-semibold">reports.sales.view</code> permission.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner & Date Filter */}
      <div className="bg-white rounded-2xl p-6 border border-[#EADBD6] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#70445B] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#D98591]" />
            Dessert Sales & Operations Dashboard
          </h2>
          <p className="text-xs text-[#79696D] mt-0.5">
            {currentBranchId === 'all'
              ? 'Consolidated live figures across all business branches'
              : `Operational metrics for ${branches.find((b) => b.id === currentBranchId)?.name || 'Branch'}`}
          </p>
        </div>

        {/* Date Selector Tabs */}
        <div className="flex items-center gap-1 bg-[#FFF9F0] p-1 rounded-xl border border-[#EADBD6] text-xs">
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: '7days', label: 'Last 7 Days' },
            { id: '30days', label: 'Last 30 Days' },
            { id: 'this_month', label: 'This Month' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setDateRange(tab.id as any)}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                dateRange === tab.id
                  ? 'bg-[#70445B] text-white shadow-xs'
                  : 'text-[#493A3E] hover:text-[#70445B]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Primary KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Net Sales */}
        <div className="bg-white rounded-2xl p-5 border border-[#EADBD6] shadow-xs hover:border-[#D98591] transition">
          <div className="flex items-center justify-between text-[#79696D] text-xs font-semibold">
            <span>Net Sales</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#70445B] mt-2">
            ₹{metrics.netSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-[#79696D] mt-1">
            Gross ₹{metrics.grossSales.toFixed(0)} - Disc ₹{metrics.totalDiscounts.toFixed(0)}
          </div>
        </div>

        {/* Orders Count */}
        <div className="bg-white rounded-2xl p-5 border border-[#EADBD6] shadow-xs hover:border-[#D98591] transition">
          <div className="flex items-center justify-between text-[#79696D] text-xs font-semibold">
            <span>Completed Orders</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#70445B] mt-2">{metrics.completedCount}</div>
          <div className="text-[11px] text-[#79696D] mt-1">
            Avg Order: ₹{metrics.averageOrderValue.toFixed(1)}
          </div>
        </div>

        {/* Estimated Gross Profit (Permission guarded) */}
        <div className="bg-white rounded-2xl p-5 border border-[#EADBD6] shadow-xs hover:border-[#D98591] transition">
          <div className="flex items-center justify-between text-[#79696D] text-xs font-semibold">
            <span>Estimated Gross Profit</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#70445B] mt-2">
            {canViewProfit
              ? `₹${metrics.estimatedGrossProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
              : '••••••'}
          </div>
          <div className="text-[11px] text-[#79696D] mt-1">
            {canViewProfit
              ? `Net Sales minus ₹${metrics.totalCOGS.toFixed(0)} COGS`
              : 'Restricted by Super Admin'}
          </div>
        </div>

        {/* Operating Expenses (Permission guarded) */}
        <div className="bg-white rounded-2xl p-5 border border-[#EADBD6] shadow-xs hover:border-[#D98591] transition">
          <div className="flex items-center justify-between text-[#79696D] text-xs font-semibold">
            <span>Logged Expenses</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-[#70445B] mt-2">
            {canViewExpenses
              ? `₹${metrics.totalExpensesAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`
              : '••••••'}
          </div>
          <div className="text-[11px] text-[#79696D] mt-1">
            {canViewExpenses && canViewProfit
              ? `Operating Result: ₹${metrics.estimatedOperatingResult.toFixed(0)}`
              : 'Permission required'}
          </div>
        </div>
      </div>

      {/* Second Row: Payment Breakdown & Best Selling Items */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Payment Channels (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-[#EADBD6] shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-[#70445B] flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-[#D98591]" />
            Payment Collections
          </h3>

          <div className="space-y-3 pt-1">
            <div>
              <div className="flex justify-between text-xs font-semibold text-[#493A3E] mb-1">
                <span className="flex items-center gap-1.5">
                  <Banknote className="w-3.5 h-3.5 text-emerald-600" /> Cash
                </span>
                <span>₹{metrics.cashSales.toFixed(2)}</span>
              </div>
              <div className="h-2 rounded-full bg-[#FFF9F0] overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{
                    width: `${metrics.netSales > 0 ? (metrics.cashSales / metrics.netSales) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-[#493A3E] mb-1">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-indigo-600" /> UPI / QR Wallets
                </span>
                <span>₹{metrics.digitalSales.toFixed(2)}</span>
              </div>
              <div className="h-2 rounded-full bg-[#FFF9F0] overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{
                    width: `${metrics.netSales > 0 ? (metrics.digitalSales / metrics.netSales) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-[#493A3E] mb-1">
                <span className="flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-blue-600" /> Cards
                </span>
                <span>₹{metrics.cardSales.toFixed(2)}</span>
              </div>
              <div className="h-2 rounded-full bg-[#FFF9F0] overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{
                    width: `${metrics.netSales > 0 ? (metrics.cardSales / metrics.netSales) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          {metrics.refundAmountTotal > 0 && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs flex justify-between items-center text-rose-800">
              <span>Refunds Issued:</span>
              <span className="font-bold">₹{metrics.refundAmountTotal.toFixed(2)}</span>
            </div>
          )}
        </div>

        {/* Best Selling Products (8 Cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-5 border border-[#EADBD6] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#70445B] flex items-center gap-1.5">
              <Award className="w-4 h-4 text-[#D98591]" />
              Top Selling Desserts & Treats
            </h3>
            <span className="text-xs text-[#79696D]">By volume sold</span>
          </div>

          {metrics.topProducts.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#79696D]">
              No product sales recorded in this date range.
            </div>
          ) : (
            <div className="space-y-2.5">
              {metrics.topProducts.map((p, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-[#FFF9F0] hover:bg-[#F8E7E5]/60 transition text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-[#70445B] text-white flex items-center justify-center font-bold text-[11px]">
                      #{idx + 1}
                    </span>
                    <div>
                      <span className="font-bold text-[#493A3E]">{p.name}</span>
                      <span className="text-[#79696D] text-[11px] block">{p.qty} portions sold</span>
                    </div>
                  </div>
                  <span className="font-extrabold text-[#70445B]">₹{p.revenue.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Third Row: Branch Comparison (if All Branches) & Low Stock Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Branch Comparisons */}
        {currentBranchId === 'all' && (
          <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-[#EADBD6] shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-[#70445B] flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#D98591]" />
              Branch Performance Comparison
            </h3>
            <div className="space-y-2">
              {metrics.branchBreakdown.map((b, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-[#EADBD6] bg-[#FFFCF8] flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-[#493A3E]">{b.branchName}</span>
                    <span className="text-[11px] text-[#79696D] block">{b.orderCount} orders completed</span>
                  </div>
                  <span className="font-extrabold text-sm text-[#70445B]">₹{b.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Low Stock Alerts */}
        <div
          className={`${
            currentBranchId === 'all' ? 'lg:col-span-6' : 'lg:col-span-12'
          } bg-white rounded-2xl p-5 border border-[#EADBD6] shadow-xs space-y-3`}
        >
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-[#70445B] flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Low Stock & Restock Alerts ({lowStockItems.length})
            </h3>
          </div>

          {lowStockItems.length === 0 ? (
            <div className="py-6 text-center text-xs text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
              ✓ All inventory items are well-stocked above alert thresholds.
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {lowStockItems.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/70 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-[#493A3E]">{item.productName}</span>
                    <span className="text-[10px] text-[#79696D] block">{item.branchName}</span>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded-md font-bold text-xs bg-amber-200 text-amber-900">
                      {item.stockQuantity} left
                    </span>
                    <span className="text-[10px] text-amber-800 block mt-0.5">
                      Alert at {item.lowStockAlert}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
