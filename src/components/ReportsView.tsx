import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Order, Expense, Product } from '../types';
import { getOrders, getExpenses, getProducts } from '../services/dbService';
import { hasPermission } from '../services/permissionService';
import {
  BarChart3,
  Download,
  Calendar,
  Lock,
  FileSpreadsheet,
  Layers,
  ShoppingBag,
  User,
  CreditCard,
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const { userProfile, currentBranchId, branches } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const canViewReports = hasPermission(userProfile, 'reports.sales.view');
  const canExport = hasPermission(userProfile, 'reports.export');
  const canViewProfit = hasPermission(userProfile, 'reports.profit.view');

  useEffect(() => {
    if (!canViewReports) return;
    (async () => {
      try {
        setLoading(true);
        const [ord, exp, prods] = await Promise.all([
          getOrders(currentBranchId, 400),
          getExpenses(currentBranchId),
          getProducts(),
        ]);
        setOrders(ord);
        setExpenses(exp);
        setProducts(prods);
      } catch (e) {
        console.error('Error fetching reports data:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentBranchId, canViewReports]);

  // Aggregations
  const reportData = useMemo(() => {
    const productStats = new Map<string, { name: string; category: string; qty: number; revenue: number }>();
    const cashierStats = new Map<string, { name: string; orderCount: number; totalSales: number }>();
    const categoryStats = new Map<string, { qty: number; revenue: number }>();

    let totalGross = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalNet = 0;

    for (const order of orders) {
      if (order.status !== 'completed') continue;

      totalGross += order.subtotal;
      totalDiscount += order.discountAmount || 0;
      totalTax += order.taxAmount || 0;
      totalNet += order.totalAmount;

      // Cashier
      const c = cashierStats.get(order.cashierId) || {
        name: order.cashierName || 'Cashier',
        orderCount: 0,
        totalSales: 0,
      };
      c.orderCount += 1;
      c.totalSales += order.totalAmount;
      cashierStats.set(order.cashierId, c);

      // Line items
      for (const item of order.items) {
        // Product
        const p = productStats.get(item.productId) || {
          name: item.productName,
          category: item.categoryName || 'Other',
          qty: 0,
          revenue: 0,
        };
        p.qty += item.quantity;
        p.revenue += item.itemSubtotal;
        productStats.set(item.productId, p);

        // Category
        const catKey = item.categoryName || 'Other';
        const cat = categoryStats.get(catKey) || { qty: 0, revenue: 0 };
        cat.qty += item.quantity;
        cat.revenue += item.itemSubtotal;
        categoryStats.set(catKey, cat);
      }
    }

    return {
      totalGross,
      totalDiscount,
      totalTax,
      totalNet,
      productsList: Array.from(productStats.values()).sort((a, b) => b.revenue - a.revenue),
      cashiersList: Array.from(cashierStats.values()).sort((a, b) => b.totalSales - a.totalSales),
      categoriesList: Array.from(categoryStats.entries())
        .map(([name, stat]) => ({ name, ...stat }))
        .sort((a, b) => b.revenue - a.revenue),
    };
  }, [orders]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!canExport) return;

    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Product Name,Category,Quantity Sold,Total Revenue (INR)\n';

    reportData.productsList.forEach((row) => {
      csvContent += `"${row.name}","${row.category}",${row.qty},${row.revenue.toFixed(2)}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Falooda_Point_SalesReport_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!canViewReports) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-3xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[#70445B]">Reports Access Restricted</h2>
        <p className="text-sm text-[#79696D] max-w-md mx-auto mt-2 leading-relaxed">
          Access to sales reports and financial summaries requires authorization from the Super Admin.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Bar */}
      <div className="bg-white rounded-2xl p-6 border border-[#EADBD6] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#70445B] flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#D98591]" />
            Sales & Operational Reports
          </h2>
          <p className="text-xs text-[#79696D] mt-0.5">
            Detailed itemized breakdown, cashier efficiency, and category analytics
          </p>
        </div>

        {/* CSV Export Button */}
        {canExport && (
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-[#70445B] hover:bg-[#D98591] text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <Download className="w-4 h-4" />
            Export Product Sales (CSV)
          </button>
        )}
      </div>

      {/* Top Totals Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-[#EADBD6]">
          <span className="text-[11px] font-semibold text-[#79696D]">Gross Sales</span>
          <div className="text-xl font-bold text-[#70445B] mt-1">₹{reportData.totalGross.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#EADBD6]">
          <span className="text-[11px] font-semibold text-[#79696D]">Total Discounts</span>
          <div className="text-xl font-bold text-rose-700 mt-1">₹{reportData.totalDiscount.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#EADBD6]">
          <span className="text-[11px] font-semibold text-[#79696D]">Tax / GST Collected</span>
          <div className="text-xl font-bold text-[#493A3E] mt-1">₹{reportData.totalTax.toFixed(2)}</div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#EADBD6]">
          <span className="text-[11px] font-semibold text-[#79696D]">Net Revenue</span>
          <div className="text-xl font-black text-emerald-700 mt-1">₹{reportData.totalNet.toFixed(2)}</div>
        </div>
      </div>

      {/* Grid: Category Breakdown & Cashier Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Category Breakdown (6 Cols) */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-[#EADBD6] shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-[#70445B] flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-[#D98591]" />
            Category-wise Sales Contribution
          </h3>

          <div className="space-y-3">
            {reportData.categoriesList.map((cat, idx) => (
              <div key={idx} className="space-y-1 text-xs">
                <div className="flex justify-between font-semibold text-[#493A3E]">
                  <span>{cat.name} ({cat.qty} sold)</span>
                  <span className="font-extrabold text-[#70445B]">₹{cat.revenue.toFixed(2)}</span>
                </div>
                <div className="h-2 rounded-full bg-[#FFF9F0] overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#D98591] to-[#70445B] rounded-full"
                    style={{
                      width: `${
                        reportData.totalNet > 0 ? (cat.revenue / reportData.totalNet) * 100 : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cashier Roster Performance (6 Cols) */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-[#EADBD6] shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-[#70445B] flex items-center gap-1.5">
            <User className="w-4 h-4 text-[#D98591]" />
            Cashier & Staff Sales Volume
          </h3>

          <div className="space-y-2">
            {reportData.cashiersList.map((cashier, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 rounded-xl bg-[#FFF9F0] text-xs"
              >
                <div>
                  <span className="font-bold text-[#493A3E]">{cashier.name}</span>
                  <span className="text-[11px] text-[#79696D] block">{cashier.orderCount} orders billed</span>
                </div>
                <span className="font-extrabold text-sm text-[#70445B]">₹{cashier.totalSales.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Itemized Product Sales Table */}
      <div className="bg-white rounded-2xl border border-[#EADBD6] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#FFF9F0] border-b border-[#EADBD6] font-bold text-sm text-[#70445B]">
          Product-wise Sales Performance
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#EADBD6] text-[#79696D] font-bold">
                <th className="py-3 px-4">Item Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Portions Sold</th>
                <th className="py-3 px-4 text-right">Revenue (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EADBD6]/60">
              {reportData.productsList.map((p, idx) => (
                <tr key={idx} className="hover:bg-[#FFFCF8] transition">
                  <td className="py-3 px-4 font-bold text-[#493A3E]">{p.name}</td>
                  <td className="py-3 px-4 text-[#79696D]">{p.category}</td>
                  <td className="py-3 px-4 text-center font-semibold">{p.qty}</td>
                  <td className="py-3 px-4 text-right font-extrabold text-[#70445B]">
                    ₹{p.revenue.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
