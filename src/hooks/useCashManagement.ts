import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { supabase } from '../lib/firebaseClient';
import { usePOSStore } from '../store/posStore';

export interface CashLog {
  id: string;
  amount: number;
  type: string;
  transaction_type: string;
  notes: string;
  created_at: string;
}

export interface RegisterSession {
  id: string;
  business_id: string;
  branch_id?: string;
  user_id: string;
  opening_balance: number;
  closing_balance?: number;
  expected_balance?: number;
  variance?: number;
  status: 'OPEN' | 'CLOSED';
  opened_at: string;
  closed_at?: string;
  sales_count?: number;
  sales_total?: number;
  refunds_total?: number;
  payouts_total?: number;
  cogs_total?: number;
  cogs?: number;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  role: string;
}

export function useCashManagement(activeBranch: any) {
  const [activeSession, setActiveSession] = useState<RegisterSession | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Accounting metrics
  const [startingFloatAmount, setStartingFloatAmount] = useState(0);
  const [sessionCashSales, setSessionCashSales] = useState(0);
  const [sessionGrossSales, setSessionGrossSales] = useState(0);
  const [sessionCogs, setSessionCogs] = useState(0);
  const [sessionSalesCount, setSessionSalesCount] = useState(0);
  const [sessionOutflows, setSessionOutflows] = useState(0);
  const [expectedCash, setExpectedCash] = useState(0);

  // Lists & metadata
  const [cashLogs, setCashLogs] = useState<CashLog[]>([]);
  const [pastSessions, setPastSessions] = useState<RegisterSession[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({});

  // Context identifiers
  const [businessId, setBusinessId] = useState('');
  const [branchId, setBranchId] = useState('');
  const [userId, setUserId] = useState('');

  // Currency rates & denominations
  const [rates, setRates] = useState<Record<string, number>>({ USD: 1.0, ZWG: 26.9181, ZAR: 16.2229 });

  const fetchProfiles = async () => {
    try {
      const { data } = await supabase.from('profiles').select('id, full_name, role');
      if (data) {
        const pm = data.reduce((acc: Record<string, Profile>, p: any) => {
          acc[p.id] = p;
          return acc;
        }, {});
        setProfilesMap(pm);
      }
    } catch (e) {
      console.error('Error fetching profile names', e);
    }
  };

  const fetchActiveShiftAndAccounting = async () => {
    setIsLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id || '';
      setUserId(currentUserId);

      let busId = '';
      let brId = '';
      if (currentUserId) {
        const { data: businessData } = await supabase
          .from('business_users')
          .select('business_id, branch_id')
          .eq('user_id', currentUserId)
          .limit(1)
          .maybeSingle();
        if (businessData?.business_id) {
          busId = businessData.business_id;
          brId = activeBranch && activeBranch.id !== 'all' ? activeBranch.id : (businessData.branch_id || '');
        }
      }

      if (!busId) {
        const { data: fallbackB } = await supabase.from('businesses').select('id').limit(1).maybeSingle();
        if (fallbackB?.id) {
          busId = fallbackB.id;
          const { data: fallbackBr } = await supabase.from('branches').select('id').eq('business_id', fallbackB.id).limit(1).maybeSingle();
          if (fallbackBr?.id) {
            brId = fallbackBr.id;
          }
        }
      }

      if (!busId) busId = '00000000-0000-0000-0000-000000000000';
      if (!brId) brId = '00000000-0000-0000-0000-000000000000';

      setBusinessId(busId);
      setBranchId(brId);

      try {
        const { data: dbRates } = await supabase
          .from('currencies')
          .select('code, exchange_rate')
          .eq('business_id', busId);
        if (dbRates && dbRates.length > 0) {
          const ratesMap: Record<string, number> = { USD: 1.0, ZWG: 26.9181, ZAR: 16.2229 };
          dbRates.forEach((r: any) => {
            ratesMap[r.code] = Number(r.exchange_rate) || 1.0;
          });
          setRates(ratesMap);
        }
      } catch (rateErr) {
        console.error("Could not fetch database currency exchange rates", rateErr);
      }

      const { data: activeSess } = await supabase
        .from('register_sessions')
        .eq('business_id', busId)
        .eq('status', 'OPEN')
        .order('opened_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const startBoundary = activeSess 
        ? new Date(activeSess.opened_at).toISOString() 
        : (() => {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            return startOfDay.toISOString();
          })();

      setIsDrawerOpen(!!activeSess);
      setActiveSession(activeSess || null);
      setStartingFloatAmount(activeSess ? Number(activeSess.opening_balance || 0) : 0);

      let salesQuery = supabase.from('sales')
        .select('*')
        .gte('created_at', startBoundary);
      
      if (busId && busId !== '00000000-0000-0000-0000-000000000000') {
        salesQuery = salesQuery.eq('business_id', busId);
      }
      
      const { data: salesDocs } = await salesQuery;
      const salesData = [...(salesDocs || [])];

      const localSales = usePOSStore.getState().localSales || [];
      localSales.forEach((localSale: any) => {
        const localTime = new Date(localSale.timestamp || localSale.created_at || new Date()).toISOString();
        if (localTime >= startBoundary) {
          const exists = salesData.some(s => s.receiptNumber === localSale.receiptNumber || s.id === localSale.id || s.receipt_number === localSale.receiptNumber);
          if (!exists) {
            salesData.push({
              ...localSale,
              created_at: localSale.timestamp || localSale.created_at,
              status: localSale.status || 'COMPLETED'
            });
          }
        }
      });
      
      let totalCashSales = 0;
      let totalGrossSales = 0;
      let totalShiftCogs = 0;
      let validSalesCount = 0;

      // Fetch products cost map to ensure all items calculate exact COGS
      let productCostsMap = new Map<string, any>();
      try {
        let pQuery = supabase.from('products').select('id, cost_price, costPrice, price, retail_price, sku, pack_size');
        if (busId && busId !== '00000000-0000-0000-0000-000000000000') {
          pQuery = pQuery.eq('business_id', busId);
        }
        const { data: pList } = await pQuery;
        if (pList) {
          pList.forEach((p: any) => productCostsMap.set(p.id, p));
        }
      } catch (pErr) {
        console.warn('Could not load product catalog costs in cash management:', pErr);
      }

      if (salesData && salesData.length > 0) {
        salesData.forEach((s: any) => {
          const stat = String(s.status || '').toUpperCase();
          const disallowed = ['REFUNDED', 'VOIDED', 'CANCELLED'];
          if (disallowed.includes(stat)) return;

          validSalesCount++;
          const saleTotal = Number(s.total || s.total_amount || 0);
          totalGrossSales += saleTotal;

          let paymentsArray: any[] = [];
          if (Array.isArray(s.payments)) {
            paymentsArray = s.payments;
          } else if (typeof s.payments === 'string') {
            try {
              paymentsArray = JSON.parse(s.payments);
            } catch (e) {
              paymentsArray = [];
            }
          }

          if (paymentsArray && paymentsArray.length > 0) {
            let cashAmt = 0;
            paymentsArray.forEach((p: any) => {
              const m = String(p.method || p.payment_method || '').toLowerCase();
              if (m === 'cash' || m === 'usd_cash' || m === 'zig_cash' || m === 'zwg_cash') {
                cashAmt += Number(p.amount || 0);
              }
            });
            totalCashSales += cashAmt;
          } else {
            const pm = String(s.payment_method || '').toLowerCase();
            if (pm === 'cash' || pm === 'usd_cash' || pm === 'zig_cash' || pm === 'zwg_cash') {
              totalCashSales += saleTotal;
            }
          }

          // Extract COGS per sale item using perpetual inventory matching
          let itemsArray: any[] = [];
          if (Array.isArray(s.items)) {
            itemsArray = s.items;
          } else if (typeof s.items === 'string') {
            try {
              itemsArray = JSON.parse(s.items);
            } catch (e) {
              itemsArray = [];
            }
          }

          itemsArray.forEach((it: any) => {
            const qty = Number(it.quantity || 1);
            let cost = 0;
            const embeddedCost = it.product?.cost_price ?? it.product?.costPrice ?? it.costPrice ?? it.cost_price;
            if (embeddedCost !== undefined && embeddedCost !== null && Number(embeddedCost) > 0) {
              cost = Number(embeddedCost);
            } else {
              const pId = it.product?.id || it.product_id || it.productId;
              if (pId && productCostsMap.has(pId)) {
                cost = Number(productCostsMap.get(pId).cost_price ?? productCostsMap.get(pId).costPrice ?? 0);
              }
            }

            let multiplier = 1;
            const sku = it.product?.sku || it.sku || '';
            const match = sku.match(/\|PK:(\d+)/i);
            if (match) {
              multiplier = parseInt(match[1], 10);
            } else if (it.tier === 'wholesale' || String(it.tier || '').toLowerCase().includes('wholesale')) {
              const pObj = it.product || (it.product_id ? productCostsMap.get(it.product_id) : null);
              if (pObj?.pack_size) {
                multiplier = Number(pObj.pack_size) || 1;
              }
            }

            totalShiftCogs += (qty * multiplier * cost);
          });
        });
      }
      setSessionCashSales(totalCashSales);
      setSessionGrossSales(totalGrossSales);
      setSessionCogs(totalShiftCogs);
      setSessionSalesCount(validSalesCount);

      if (activeSess) {
        setActiveSession({
          ...activeSess,
          sales_total: totalGrossSales || totalCashSales,
          sales_count: validSalesCount,
          cogs_total: totalShiftCogs,
          cogs: totalShiftCogs
        });
      }
      
      let logsQuery = supabase.from('cash_drawer_logs')
        .select('*')
        .gte('created_at', startBoundary)
        .order('created_at', { ascending: false });

      if (busId && busId !== '00000000-0000-0000-0000-000000000000') {
        logsQuery = logsQuery.eq('business_id', busId);
      }
      
      const { data: logsDocs } = await logsQuery;
      const logsData = logsDocs || [];
        
      setCashLogs(logsData);
      
      let float = activeSess ? Number(activeSess.opening_balance || 0) : 0;
      let expenses = 0;
      let restocks = 0;
      let ownerCollections = 0;
      let cashIns = 0;
      let reversalsInflow = 0;
      let reversalsOutflow = 0;
      
      logsData.forEach(log => {
        const amt = Number(log.amount);
        switch(log.transaction_type) {
            case 'opening_float': 
              if (!activeSess) float += amt; 
              break;
            case 'expense': 
              expenses += amt; 
              break;
            case 'restock': 
              restocks += amt; 
              break;
            case 'owner_collection': 
              ownerCollections += amt; 
              break;
            case 'cash_in':
              cashIns += amt;
              break;
            case 'reversal_outflow':
              reversalsInflow += amt;
              break;
            case 'reversal_inflow':
              reversalsOutflow += amt;
              break;
        }
      });
      
      const calculatedOutflows = Math.max(0, (expenses + restocks + ownerCollections) - reversalsInflow);
      setSessionOutflows(calculatedOutflows);

      const calculatedExpected = float + totalCashSales + cashIns - reversalsOutflow - calculatedOutflows;
      setExpectedCash(calculatedExpected);

    } catch (error) {
      console.error('Error fetching cash statistics:', error);
      toast.error('Failed to reload cash data');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchShiftHistory = async () => {
    setHistoryLoading(true);
    try {
      let query = supabase
        .from('register_sessions')
        .select('*')
        .order('opened_at', { ascending: false })
        .limit(40);

      if (businessId && businessId !== '00000000-0000-0000-0000-000000000000') {
        query = query.eq('business_id', businessId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPastSessions(data || []);
    } catch (e) {
      console.error('Failed to load past register sessions log:', e);
      toast.error('Could not load session audit history');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
    fetchActiveShiftAndAccounting();
  }, [activeBranch]);

  return {
    activeSession,
    isDrawerOpen,
    isLoading,
    historyLoading,
    startingFloatAmount,
    sessionCashSales,
    sessionGrossSales,
    sessionCogs,
    sessionSalesCount,
    sessionOutflows,
    expectedCash,
    cashLogs,
    pastSessions,
    profilesMap,
    businessId,
    branchId,
    userId,
    rates,
    fetchActiveShiftAndAccounting,
    fetchShiftHistory
  };
}
