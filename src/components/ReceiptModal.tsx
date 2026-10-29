import React, { useState } from 'react';
import { Order, Branch } from '../types';
import { Printer, X, Check, CupSoda } from 'lucide-react';

interface ReceiptModalProps {
  order: Order;
  branch?: Branch | null;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ order, branch, onClose }) => {
  const [paperWidth, setPaperWidth] = useState<'58' | '80'>('80');

  const handlePrint = () => {
    window.print();
  };

  const branchAddress = branch?.address || 'Gulshan Food Square, Main Avenue';
  const branchPhone = branch?.phone || '+91 98765 43210';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs no-print">
      <div className="bg-[#FFF9F0] rounded-2xl shadow-2xl border border-[#EADBD6] w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Bar */}
        <div className="bg-[#70445B] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-[#D98591]" />
            <h3 className="font-semibold text-lg">Thermal Receipt Preview</h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-black/20 rounded-lg p-0.5 text-xs">
              <button
                onClick={() => setPaperWidth('58')}
                className={`px-2.5 py-1 rounded-md transition ${
                  paperWidth === '58' ? 'bg-[#D98591] text-white font-medium' : 'text-white/80 hover:text-white'
                }`}
              >
                58 mm
              </button>
              <button
                onClick={() => setPaperWidth('80')}
                className={`px-2.5 py-1 rounded-md transition ${
                  paperWidth === '80' ? 'bg-[#D98591] text-white font-medium' : 'text-white/80 hover:text-white'
                }`}
              >
                80 mm
              </button>
            </div>
            <button onClick={onClose} className="text-white/70 hover:text-white transition p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Canvas */}
        <div className="flex-1 overflow-y-auto p-6 flex justify-center bg-[#F8E7E5]/40">
          <div
            id="printable-receipt"
            style={{ width: paperWidth === '58' ? '240px' : '320px' }}
            className="bg-white text-black p-4 shadow-md border border-neutral-300 font-mono text-xs leading-tight transition-all duration-200"
          >
            {/* Header */}
            <div className="text-center pb-2 border-b border-dashed border-neutral-400">
              <div className="flex items-center justify-center gap-1 mb-1 font-bold text-sm tracking-wider">
                <CupSoda className="w-4 h-4 text-black inline" />
                FALOODA POINT
              </div>
              <p className="font-bold text-[11px]">{order.branchName || branch?.name || 'Central Branch'}</p>
              <p className="text-[10px] text-neutral-600">{branchAddress}</p>
              <p className="text-[10px] text-neutral-600">Tel: {branchPhone}</p>
            </div>

            {/* Meta */}
            <div className="py-2 border-b border-dashed border-neutral-400 text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span>Receipt:</span>
                <span className="font-bold">#{order.receiptNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{new Date(order.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Cashier:</span>
                <span>{order.cashierName || 'Cashier'}</span>
              </div>
              {order.customerName && (
                <div className="flex justify-between">
                  <span>Customer:</span>
                  <span>{order.customerName}</span>
                </div>
              )}
            </div>

            {/* Line Items */}
            <div className="py-2 border-b border-dashed border-neutral-400">
              <div className="flex justify-between font-bold pb-1 text-[10px] uppercase">
                <span>Item</span>
                <span className="text-right">Qty x Price = Total</span>
              </div>
              <div className="space-y-1.5 pt-1">
                {order.items.map((item, idx) => (
                  <div key={idx} className="text-[11px]">
                    <div className="flex justify-between font-medium">
                      <span>{item.productName}</span>
                      <span>₹{(item.itemSubtotal || item.unitPrice * item.quantity).toFixed(2)}</span>
                    </div>
                    {item.variant && (
                      <div className="text-[10px] text-neutral-600 pl-2">
                        Size: {item.variant.name} (+₹{item.variant.priceOffset})
                      </div>
                    )}
                    {item.selectedAddOns && item.selectedAddOns.length > 0 && (
                      <div className="text-[10px] text-neutral-600 pl-2">
                        Add-ons: {item.selectedAddOns.map((a) => `${a.name} (₹${a.price})`).join(', ')}
                      </div>
                    )}
                    <div className="text-[10px] text-neutral-500 pl-2">
                      {item.quantity} × ₹{item.unitPrice.toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Totals */}
            <div className="py-2 border-b border-dashed border-neutral-400 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>₹{order.subtotal.toFixed(2)}</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-neutral-600">
                  <span>Discount:</span>
                  <span>-₹{order.discountAmount.toFixed(2)}</span>
                </div>
              )}
              {order.taxAmount > 0 && (
                <div className="flex justify-between text-neutral-600">
                  <span>GST/Tax ({order.taxRate}%):</span>
                  <span>₹{order.taxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm pt-1 border-t border-neutral-300">
                <span>TOTAL:</span>
                <span>₹{order.totalAmount.toFixed(2)}</span>
              </div>
            </div>

            {/* Payment Info */}
            <div className="py-2 border-b border-dashed border-neutral-400 text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span>Payment Mode:</span>
                <span className="font-semibold uppercase">{order.paymentMethod.replace('_', ' ')}</span>
              </div>
              {order.amountTendered !== undefined && order.amountTendered > 0 && (
                <>
                  <div className="flex justify-between">
                    <span>Cash Tendered:</span>
                    <span>₹{order.amountTendered.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Change Returned:</span>
                    <span>₹{(order.changeDue || 0).toFixed(2)}</span>
                  </div>
                </>
              )}
              {order.status !== 'completed' && (
                <div className="flex justify-between font-bold text-rose-700">
                  <span>Status:</span>
                  <span className="uppercase">{order.status}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="text-center pt-3 text-[10px] text-neutral-600 space-y-1">
              <p className="font-semibold text-neutral-800">Thank you for visiting Falooda Point!</p>
              <p>Handcrafted Desserts & Sweet Memories</p>
              <p className="text-[9px]">FSSAI Lic. 10022011000843</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-[#FFF9F0] border-t border-[#EADBD6] px-6 py-4 flex items-center justify-between">
          <p className="text-xs text-[#79696D]">Ready for 58mm & 80mm thermal receipt printers</p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-[#EADBD6] rounded-xl text-[#493A3E] hover:bg-[#F8E7E5] transition text-sm font-medium"
            >
              Close
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2 bg-[#70445B] hover:bg-[#D98591] text-white rounded-xl transition text-sm font-semibold shadow-sm"
            >
              <Printer className="w-4 h-4" />
              Print Receipt
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
