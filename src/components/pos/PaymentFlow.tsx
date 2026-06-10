import React from 'react';
import { Check, Receipt } from 'lucide-react';
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
  const changeDue = lastSale 
    ? lastSale.payments.reduce((acc, p) => acc + p.amount, 0) - lastSale.total 
    : 0;

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
        <DialogContent className="sm:max-w-[400px] bg-white text-zinc-900 dark:bg-zinc-90 w dark:text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold text-zinc-900">Sale Completed</DialogTitle>
          </DialogHeader>
          <div className="py-6 flex flex-col items-center justify-center space-y-4 text-center">
            <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="h-8 w-8 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-zinc-90 w">Success</h3>
              <p className="text-zinc-500 font-mono text-xs mt-1">Receipt: {lastSale?.receiptNumber}</p>
            </div>
            
            {lastSale && changeDue > 0 && (
              <div className="w-full mt-4 p-4 bg-emerald-50 border border-emerald-100 rounded-xl shadow-sm text-center">
                <p className="text-emerald-700 font-bold text-xs mb-1">Change Due</p>
                <p className="text-3xl font-extrabold font-mono text-emerald-700">
                  ${changeDue.toFixed(2)}
                </p>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              className="w-full sm:w-auto flex-1 cursor-pointer" 
              onClick={() => {
                setShowPostSale(false);
                setLastSale(null);
                refreshActiveSession();
              }}
            >
              Next Customer
            </Button>
            <Button 
              className="w-full sm:w-auto flex-1 min-h-[44px] cursor-pointer" 
              onClick={() => {
                handlePrint();
                setShowPostSale(false);
                refreshActiveSession();
              }}
            >
              <Receipt className="mr-2 h-4 w-4" /> Print Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReceiptPrint ref={receiptRef} sale={lastSale} />
    </>
  );
};
