import { supabase, db, auth, collection, doc, writeBatch, query, where, getDocs, getDoc } from '../lib/firebaseClient';

export interface JournalLineInput {
  accountCode: string;
  debit: number;
  credit: number;
  description?: string;
}

export interface RegisterSession {
  id: string;
  business_id: string;
  branch_id: string;
  user_id: string;
  opening_balance: number;
  closing_balance: number;
  expected_balance: number;
  variance: number;
  status: 'OPEN' | 'CLOSED';
  opened_at: string;
  closed_at: string;
  sales_count: number;
  sales_total: number;
  refunds_total: number;
  payouts_total: number;
  created_at: string;
}

/**
 * 1. Initialize standard Chart Of Accounts for a company
 */
export async function initializeChartOfAccounts(businessId: string): Promise<void> {
  try {
    const existing = await supabase.from('accounts').eq('business_id', businessId).select();
    if (existing.data && existing.data.length > 0) {
      return; // Already initialized
    }

    const defaultAccounts = [
      { code: '1000', name: 'Main POS Cash Till', type: 'Asset', balance: 0, is_system: true },
      { code: '1100', name: 'Accounts Receivable', type: 'Asset', balance: 0, is_system: true },
      { code: '1200', name: 'Merchandise Inventory Account', type: 'Asset', balance: 0, is_system: true },
      { code: '2000', name: 'Accounts Payable', type: 'Liability', balance: 0, is_system: true },
      { code: '3000', name: 'Shareholders Retained Equity', type: 'Equity', balance: 0, is_system: true },
      { code: '4000', name: 'Sales Revenue Account', type: 'Revenue', balance: 0, is_system: true },
      { code: '5000', name: 'Cost of Goods Sold (COGS)', type: 'Expense', balance: 0, is_system: true },
      { code: '6000', name: 'Operating and Cash Expenses', type: 'Expense', balance: 0, is_system: true }
    ];

    const accountsToInsert = defaultAccounts.map((acct) => ({
      business_id: businessId,
      code: acct.code,
      name: acct.name,
      type: acct.type,
      balance: acct.balance,
      is_system: acct.is_system,
      created_at: new Date().toISOString()
    }));

    const { error: insertError } = await supabase.from('accounts').insert(accountsToInsert);
    if (insertError) {
      throw insertError;
    }

    await logAuditEvent(businessId, 'system', 'INITIALIZE', 'ACCOUNTING', null, { message: 'Initialized Standard Chart of Accounts' });
  } catch (error) {
    console.error('Failed to initialize chart of accounts:', error);
  }
}

/**
 * 2. Logging audit trail activities securely
 */
export async function logAuditEvent(
  businessId: string,
  userId: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'VOID' | 'CLOSE_SHIFT' | 'OPEN_SHIFT' | 'ADJUST' | 'INITIALIZE',
  module: 'POS' | 'INVENTORY' | 'ACCOUNTING' | 'CUSTOMERS' | 'SUPPLIERS' | 'SYSTEM',
  oldValue: any,
  newValue: any
): Promise<void> {
  try {
    const email = auth.currentUser?.email || 'unknown@tareza.co.zw';
    const cleanId = doc(collection(db, 'audit_logs')).id;
    await supabase.from('audit_logs').insert({
      id: cleanId,
      business_id: businessId,
      user_id: userId,
      user_email: email,
      action,
      module,
      old_value: oldValue ? JSON.stringify(oldValue) : '',
      new_value: newValue ? JSON.stringify(newValue) : '',
      created_at: new Date().toISOString()
    });
  } catch (err) {
    console.error('Audit log failure:', err);
  }
}

/**
 * 3. Double-entry Balancing Posting engine with real-time General Ledger integration
 */
export async function postJournalEntry(
  businessId: string,
  branchId: string,
  userId: string,
  reference: string,
  description: string,
  lines: JournalLineInput[]
): Promise<{ success: boolean; error?: string }> {
  try {
    // Audit double entry balance check
    const totalDebit = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);

    // Permit small floating point tolerance
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return {
        success: false,
        error: `Double-entry transaction unbalance violation! Total debits ($${totalDebit.toFixed(2)}) must exactly match total credits ($${totalCredit.toFixed(2)})`
      };
    }

    // Pre-seed accounts if empty
    await initializeChartOfAccounts(businessId);

    // Fetch accounts database IDs matching the codes
    const q = query(collection(db, 'accounts'), where('business_id', '==', businessId));
    const snap = await getDocs(q);
    const accountsMap = new Map<string, { id: string; type: string; balance: number }>();
    snap.forEach((doc) => {
      const d = doc.data();
      accountsMap.set(d.code, { id: doc.id, type: d.type, balance: Number(d.balance || 0) });
    });

    const batch = writeBatch(db);
    const jeId = doc(collection(db, 'journal_entries')).id;

    // Create entry header
    batch.set(doc(db, 'journal_entries', jeId), {
      business_id: businessId,
      branch_id: branchId,
      date: new Date().toISOString().split('T')[0],
      reference,
      description,
      created_at: new Date().toISOString(),
      user_id: userId
    });

    // Write posting lines and update general ledger account balances
    for (const line of lines) {
      const targetAcct = accountsMap.get(line.accountCode);
      if (!targetAcct) {
        return {
          success: false,
          error: `Chart of Accounts violation: Missing account code '${line.accountCode}' inside enterprise database.`
        };
      }

      // Record Journal Line detail
      const lineId = doc(collection(db, 'journal_lines')).id;
      batch.set(doc(db, 'journal_lines', lineId), {
        journal_entry_id: jeId,
        account_id: targetAcct.id,
        debit: line.debit,
        credit: line.credit,
        description: line.description || description
      });

      // Recalculate account balance based on Accounting Type
      let change = 0;
      if (targetAcct.type === 'Asset' || targetAcct.type === 'Expense') {
        change = (line.debit || 0) - (line.credit || 0);
      } else {
        // Liability, Equity, Revenue
        change = (line.credit || 0) - (line.debit || 0);
      }

      const updatedBalance = Number(targetAcct.balance) + change;
      batch.update(doc(db, 'accounts', targetAcct.id), {
        balance: updatedBalance,
        updated_at: new Date().toISOString()
      });
    }

    await batch.commit();
    return { success: true };
  } catch (error: any) {
    console.error('Failed to post journal entry:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 4. Register shift session management with cash integrity
 */
export async function getOpenRegisterSession(businessId: string, userId: string): Promise<any | null> {
  const rs = await supabase.from('register_sessions')
    .eq('business_id', businessId)
    .eq('user_id', userId)
    .eq('status', 'OPEN')
    .select();
  
  if (rs.data && rs.data.length > 0) {
    return rs.data[0];
  }
  return null;
}

export async function openRegisterSession(
  businessId: string,
  branchId: string,
  userId: string,
  openingFloat: number
): Promise<{ success: boolean; session?: any; error?: string }> {
  try {
    const existing = await getOpenRegisterSession(businessId, userId);
    if (existing) {
      return { success: false, error: 'A till session is already active for this cashier. Close it first before starting a new shift.' };
    }

    const sessionId = doc(collection(db, 'register_sessions')).id;
    const item = {
      id: sessionId,
      business_id: businessId,
      branch_id: branchId,
      user_id: userId,
      opening_balance: openingFloat,
      closing_balance: 0,
      expected_balance: openingFloat,
      variance: 0,
      status: 'OPEN' as const,
      opened_at: new Date().toISOString(),
      closed_at: null,
      sales_count: 0,
      sales_total: 0,
      refunds_total: 0,
      payouts_total: 0,
      created_at: new Date().toISOString()
    };

    const { error: insertErr } = await supabase.from('register_sessions').insert(item);
    if (insertErr) {
      console.error('[openRegisterSession] Failed to start register session:', insertErr);
      return { success: false, error: insertErr.message || 'Database error occurred while starting register session.' };
    }
    await logAuditEvent(businessId, userId, 'OPEN_SHIFT', 'POS', null, item);

    return { success: true, session: item };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function closeRegisterSession(
  sessionId: string,
  actualFloat: number
): Promise<{ success: boolean; session?: any; error?: string }> {
  try {
    const snap = await getDoc(doc(db, 'register_sessions', sessionId));
    if (!snap.exists()) {
      return { success: false, error: 'Shift records not found in ERP.' };
    }

    const s = snap.data() as RegisterSession;
    if (s.status === 'CLOSED') {
      return { success: false, error: 'Shift register session has already been finalized.' };
    }

    // Expected float formula: Opening Balance + Cash Sales - Refunds - Payouts
    const expected = Number(s.opening_balance) + Number(s.sales_total) - Number(s.refunds_total) - Number(s.payouts_total);
    const variance = actualFloat - expected;

    const patches = {
      closing_balance: actualFloat,
      expected_balance: expected,
      variance: variance,
      status: 'CLOSED' as const,
      closed_at: new Date().toISOString()
    };

    const { error: updateErr } = await supabase.from('register_sessions').eq('id', sessionId).update(patches);
    if (updateErr) {
      console.error('[closeRegisterSession] Failed to update session:', updateErr);
      return { success: false, error: updateErr.message || 'Database error occurred while closing register session.' };
    }
    await logAuditEvent(s.business_id, s.user_id, 'CLOSE_SHIFT', 'POS', s, { ...s, ...patches });

    return { success: true, session: { ...s, ...patches } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * 5. Real-time Inventory movements connected to ledger
 */
export async function recordStockMovement(
  businessId: string,
  branchId: string,
  productId: string,
  quantityChange: number, // positive for addition, negative for deduction
  type: 'POS_SALE' | 'POS_RETURN' | 'GOODS_RECEIVED' | 'ADJUSTMENT' | 'DAMAGE',
  userId: string,
  associatedTxRef: string,
  customCostPrice?: number
): Promise<{ success: boolean; quantityAfter: number; error?: string }> {
  try {
    // 1. Fetch current inventory stock for product at branch using direct Supabase select
    const invRes = await supabase.from('inventory')
      .eq('business_id', businessId)
      .eq('branch_id', branchId)
      .eq('product_id', productId)
      .select();

    let invDoc: any = null;
    let currentQty = 0;

    if (invRes.data && invRes.data.length > 0) {
      invDoc = invRes.data[0];
      currentQty = Number(invDoc.quantity || 0);
    }

    const calculatedQtyAfter = currentQty + quantityChange;

    // Reject negative inventory checkout unless explicitly tolerated (or fallback)
    if (calculatedQtyAfter < 0 && type === 'DAMAGE') {
      // Find product details
      const { data: product } = await supabase.from('products').eq('id', productId).maybeSingle();
      const pName = product ? product.name : 'Product';
      return {
        success: false,
        quantityAfter: currentQty,
        error: `Insufficient warehouse stock for item: '${pName}'! POS attempted to checkout with ${Math.abs(quantityChange)} units, but warehouse has only ${currentQty} units.`
      };
    }

    // 2. Fetch product specs directly from Supabase
    const { data: product, error: prodErr } = await supabase.from('products')
      .eq('id', productId)
      .maybeSingle();

    if (prodErr || !product) {
      return { success: false, quantityAfter: currentQty, error: `Catalog error: Product referenced does not exist.` };
    }

    const costPrice = customCostPrice !== undefined ? customCostPrice : Number(product.cost_price || product.wholesale_price || 0);
    const valueImpact = Math.abs(quantityChange) * costPrice;

    // 3. Create unique stock movement record in Supabase directly
    const { error: moveInsertErr } = await supabase.from('stock_movements').insert({
      branch_id: branchId,
      product_id: productId,
      quantity: quantityChange,
      type: type,
      created_at: new Date().toISOString()
    });

    if (moveInsertErr) {
      console.error('[recordStockMovement] Failed to insert stock movement:', moveInsertErr);
      throw new Error(moveInsertErr.message);
    }

    // 4. Update or insert inventory stock count directly in Supabase
    if (invDoc) {
      const { error: invUpdateErr } = await supabase.from('inventory')
        .update({
          quantity: calculatedQtyAfter,
          updated_at: new Date().toISOString()
        })
        .eq('id', invDoc.id);

      if (invUpdateErr) {
        console.error('[recordStockMovement] Failed to update inventory level:', invUpdateErr);
        throw new Error(invUpdateErr.message);
      }
    } else {
      const { error: invInsertErr } = await supabase.from('inventory')
        .insert({
          business_id: businessId,
          branch_id: branchId,
          product_id: productId,
          quantity: calculatedQtyAfter,
          reorder_level: 5,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (invInsertErr) {
        console.error('[recordStockMovement] Failed to insert inventory level:', invInsertErr);
        throw new Error(invInsertErr.message);
      }
    }

    // 5. Automated Journal Posting based on inventory action type
    if (valueImpact > 0) {
      if (type === 'POS_SALE') {
        // Debit: COGS (5000)
        // Credit: Merchandise Inventory (1200)
        await postJournalEntry(
          businessId,
          branchId,
          userId,
          associatedTxRef,
          `COGS Adjustment for receipt ${associatedTxRef}`,
          [
            { accountCode: '5000', debit: valueImpact, credit: 0, description: `COGS for Sale ${product.name}` },
            { accountCode: '1200', debit: 0, credit: valueImpact, description: `Inventory Deducted for Sale ${product.name}` }
          ]
        );
      } else if (type === 'POS_RETURN') {
        // Reverse COGS
        // Debit: Merchandise Inventory (1200)
        // Credit: COGS (5000)
        await postJournalEntry(
          businessId,
          branchId,
          userId,
          associatedTxRef,
          `POS Returns Inventory stock reverse: ${associatedTxRef}`,
          [
            { accountCode: '1200', debit: valueImpact, credit: 0, description: `Inventory Returned: ${product.name}` },
            { accountCode: '5000', debit: 0, credit: valueImpact, description: `COGS Reverted: ${product.name}` }
          ]
        );
      } else if (type === 'GOODS_RECEIVED') {
        // Debit: Merchandise Inventory (1200)
        // Credit: Accounts Payable (2000) (or Operating cache if paid immediately)
        await postJournalEntry(
          businessId,
          branchId,
          userId,
          associatedTxRef,
          `Goods Received Note (GRN): Sourcing stock for ${product.name}`,
          [
            { accountCode: '1200', debit: valueImpact, credit: 0, description: `Stock Restocked: ${product.name}` },
            { accountCode: '2000', debit: 0, credit: valueImpact, description: `Accounts Payable Stock Source` }
          ]
        );
      } else if (type === 'ADJUSTMENT' || type === 'DAMAGE') {
        // Adjust Asset Account (1200) and post to General Expense (6000)
        const isUp = quantityChange > 0;
        await postJournalEntry(
          businessId,
          branchId,
          userId,
          associatedTxRef,
          `Stock Audit Reconciliation adjust (${type})`,
          isUp
            ? [
                { accountCode: '1200', debit: valueImpact, credit: 0, description: `Audit Stock Increment: ${product.name}` },
                { accountCode: '3000', debit: 0, credit: valueImpact, description: `Retained Equity adjustment` }
              ]
            : [
                { accountCode: '6000', debit: valueImpact, credit: 0, description: `Stock shrinkage/damage: ${product.name}` },
                { accountCode: '1200', debit: 0, credit: valueImpact, description: `Inventory written off: ${product.name}` }
              ]
        );
      }
    }

    return { success: true, quantityAfter: calculatedQtyAfter };
  } catch (err: any) {
    console.error('Failed to update stock:', err);
    return { success: false, quantityAfter: 0, error: err.message };
  }
}
