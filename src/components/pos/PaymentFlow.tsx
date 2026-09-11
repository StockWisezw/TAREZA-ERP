import React from 'react';
import { Check, Receipt, Download, Printer } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '../ui/dialog';
import { Button } from '../ui/button';
import { PaymentDialog } from './PaymentDialog';
import { ReceiptPrint } from './ReceiptPrint';
import { SaleRecord } from '../../store/posStore';
import { exportReceiptPDF } from '../../utils/exportReceiptPDF';
import { printReceiptDirect } from '../../utils/printManager';
import { useBusinessStore } from '../../store';

interface PaymentFlowProps {
  showPayment: boolean;
  setShowPayment: (show: boolean) => void;
  showPostSale: boolean;
  setShowPostSale: (show: boolean) => void;
  lastSale: SaleRecord | null;
  setLastSale: (sale: SaleRecord | null) => void;
  handlePaymentComplete: () => void;
  handlePrint: () => void;
  refreshActiveSession: () => void;
  receiptRef: React.RefObject<any>;
}

export const PaymentFlow: React.FC<PaymentFlowProps> = ({
  showPayment,
  setShowPayment,
  showPostSale,
  setShowPostSale,
  lastSale,
  setLastSale,
  handlePaymentComplete,
  handlePrint,
  refreshActiveSession,
  receiptRef
}) => {
  const { currentBusiness, activeBranch } = useBusinessStore();

  const changeDue = lastSale 
    ? lastSale.payments.reduce((acc, p) => acc + p.amount, 0) - lastSale.total 
    : 0;

  const handleExportPDF = (format: '80mm' | 'a4' = '80mm') => {
    if (!lastSale) return;
    exportReceiptPDF({
      sale: lastSale,
      businessName: currentBusiness?.name || 'TAREZA ENTERPRISE',
      branchName: activeBranch?.name || 'Main Store Branch',
      taxNumber: currentBusiness?.tax_number || 'VAT-10029384-ZW',
      cashierName: 'POS Operator',
      format
    });
  };

  const onPrintClick = () => {
    if (!lastSale) return;
    printReceiptDirect(lastSale, {
      businessName: currentBusiness?.name || 'TAREZA ENTERPRISE',
      branchName: activeBranch?.name || 'Main Store Branch',
      taxNumber: currentBusiness?.tax_number || 'VAT-10029384-ZW',
      cashierName: 'POS Operator'
    });
  };

  return (
    <>
      <PaymentDialog 
        open={showPayment} 
        onOpenChange={setShowPayment}
        onComplete={handlePaymentComplete}
      />
      
      {/* Post Sale Options Dialog */}
      <Dialog 
        open={showPostSale} 
        onOpenChange={(open) => {
          setShowPostSale(open);
          if (!open) {
            setLastSale(null);
            refreshActiveSession();
          }
        }}
      >
        <DialogContent className="sm:max-w-[440px] bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 p-6 rounded-2xl shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-zinc-900 dark:text-zinc-100">Sale Completed Successfully</DialogTitle>
          </DialogHeader>
          <div className="py-4 flex flex-col items-center justify-center space-y-3 text-center">
            <div className="h-14 w-14 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
              <Check className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Transaction Confirmed</h3>
              <p className="text-zinc-500 dark:text-zinc-400 font-mono text-xs mt-0.5">Receipt Ref: {lastSale?.receiptNumber}</p>
            </div>
            
            {lastSale && changeDue > 0 && (
              <div className="w-full p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl shadow-sm text-center">
                <p className="text-emerald-700 dark:text-emerald-400 font-bold text-xs mb-0.5">Change Due</p>
                <p className="text-2xl font-extrabold font-mono text-emerald-700 dark:text-emerald-400">
                  ${changeDue.toFixed(2)}
                </p>
              </div>
            )}

            <div className="w-full flex items-center justify-center gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-bold gap-1.5 h-9 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer"
                onClick={() => handleExportPDF('80mm')}
              >
                <Download className="h-3.5 w-3.5" />
                Export Receipt PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs font-bold gap-1.5 h-9 border-zinc-250 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                onClick={() => handleExportPDF('a4')}
              >
                <Download className="h-3.5 w-3.5" />
                A4 Tax Invoice PDF
              </Button>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <Button 
              variant="outline" 
              className="w-full sm:w-auto flex-1 cursor-pointer h-10 font-semibold" 
              onClick={() => {
                setShowPostSale(false);
                setLastSale(null);
                refreshActiveSession();
              }}
            >
              Next Customer
            </Button>
            <Button 
              className="w-full sm:w-auto flex-1 h-10 cursor-pointer bg-zinc-900 text-white hover:bg-zinc-800 font-bold" 
              onClick={() => {
                onPrintClick();
              }}
            >
              <Printer className="mr-2 h-4 w-4" /> Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReceiptPrint ref={receiptRef} sale={lastSale} />
    </>
  );
};
