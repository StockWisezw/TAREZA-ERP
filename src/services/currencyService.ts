import { supabase, auth } from '../lib/firebaseClient';
import { logAuditEvent } from './ledgerService';

export interface Currency {
  id: string;
  business_id: string;
  code: string;
  name: string;
  symbol: string;
  exchange_rate: number;
  is_base: boolean;
  is_active: boolean;
  created_at: string;
}

const DEFAULT_CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$', exchange_rate: 1.0, is_base: true, is_active: true },
  { code: 'ZWG', name: 'Zimbabwe Gold', symbol: 'ZiG', exchange_rate: 26.9181, is_base: false, is_active: true },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', exchange_rate: 16.2229, is_base: false, is_active: true },
];

/**
 * Fetches the latest exchange rates from open public API
 * updates currencies table and inserts history records
 */
export async function syncRBZExchangeRates(force = false): Promise<{ success: boolean; data?: Currency[]; error?: string }> {
  try {
    // 1. Resolve User and Business context
    const { data: userData } = await auth.currentUser ? { data: { user: auth.currentUser } } : await supabase.auth.getUser();
    const userId = userData?.user?.id || '00000000-0000-0000-0000-000000000000';
    
    let businessId: string | null = null;
    if (userData?.user) {
      const { data: busUser } = await supabase
        .from('business_users')
        .select('business_id')
        .eq('user_id', userData.user.id)
        .limit(1)
        .maybeSingle();
      businessId = busUser?.business_id || null;
    }

    if (!businessId) {
      const { data: fallbackB } = await supabase.from('businesses').select('id').limit(1).maybeSingle();
      businessId = fallbackB?.id || null;
    }

    if (!businessId) {
      return { success: false, error: 'No active business ID resolved for currency exchange sync.' };
    }

    // 2. Prevent excessive daily API hits if not forced
    const todayStr = new Date().toISOString().split('T')[0];
    const lastSyncDate = localStorage.getItem('last_rbz_sync_date');
    if (!force && lastSyncDate === todayStr) {
      // Already ran sync today! Just fetch current list from DB
      const { data: existingCurrencies } = await supabase
        .from('currencies')
        .select('*')
        .eq('business_id', businessId);
      
      if (existingCurrencies && existingCurrencies.length > 0) {
        return { success: true, data: existingCurrencies as Currency[] };
      }
    }

    // Checking if automated integration is enabled
    const rbzSyncSetting = localStorage.getItem('rbz_daily_sync') ?? 'true';
    if (!force && rbzSyncSetting !== 'true') {
      return { success: false, error: 'RBZ Daily Sync is disabled in settings.' };
    }

    // 3. Query the latest rates from the public open exchange API
    console.log('Initiating currency exchange rates fetch from public API...');
    const response = await fetch('https://open.er-api.com/v6/latest/USD');
    if (!response.ok) {
      throw new Error(`Failed to fetch from open.er-api.com, status: ${response.status}`);
    }
    const apiData = await response.json();
    if (apiData.result !== 'success' || !apiData.rates) {
      throw new Error('Invalid format returned from public exchange rate API');
    }

    // Extract rates
    const zwgRate = Number(apiData.rates.ZWG || apiData.rates.ZWL || 26.9181);
    const zarRate = Number(apiData.rates.ZAR || 16.2229);

    console.log('Successfully fetched exchange rates:', { ZWG: zwgRate, ZAR: zarRate });

    // 4. Fetch or Seed currencies in the DB
    const { data: dbCurrencies } = await supabase
      .from('currencies')
      .select('*')
      .eq('business_id', businessId);

    const oldRatesMap: Record<string, number> = {};
    const newRatesMap: Record<string, number> = { USD: 1.0, ZWG: zwgRate, ZAR: zarRate };
    
    let currenciesList: Currency[] = [];

    if (!dbCurrencies || dbCurrencies.length === 0) {
      // Seed initial currencies with latest rates
      console.log('Seeding initial currencies database table...');
      const seedPayload = DEFAULT_CURRENCIES.map(item => {
        let rate = item.exchange_rate;
        if (item.code === 'ZWG') rate = zwgRate;
        if (item.code === 'ZAR') rate = zarRate;
        return {
          business_id: businessId,
          code: item.code,
          name: item.name,
          symbol: item.symbol,
          exchange_rate: rate,
          is_base: item.is_base,
          is_active: item.is_active
        };
      });

      const { data: insertedData, error: insertError } = await supabase
        .from('currencies')
        .insert(seedPayload);

      if (insertError) throw insertError;
      currenciesList = (insertedData || []) as Currency[];

      // Log initial seed
      await logAuditEvent(
        businessId,
        userId,
        'INITIALIZE',
        'SYSTEM',
        { description: 'Seeded system base default currencies' },
        { status: 'success', seeded: seedPayload }
      );
    } else {
      // We have existing currencies, let's update exchange rates for non-base currencies
      currenciesList = [...(dbCurrencies as Currency[])];
      const updatedCurrencies: Currency[] = [];

      for (const cur of currenciesList) {
        oldRatesMap[cur.code] = Number(cur.exchange_rate);

        if (cur.is_base) {
          continue;
        }

        const targetNewRate = newRatesMap[cur.code];
        if (targetNewRate !== undefined && targetNewRate !== Number(cur.exchange_rate)) {
          console.log(`Updating exchange rate for ${cur.code} from ${cur.exchange_rate} to ${targetNewRate}`);
          
          const { error: updateError } = await supabase
            .from('currencies')
            .update({ exchange_rate: targetNewRate })
            .eq('id', cur.id);

          if (updateError) {
            console.error(`Failed to update DB currency ${cur.code}:`, updateError);
          } else {
            cur.exchange_rate = targetNewRate;
            updatedCurrencies.push(cur);

            // Add history entry
            await supabase.from('exchange_rate_history').insert({
              currency_id: cur.id,
              rate: targetNewRate,
              effective_date: new Date().toISOString()
            });
          }
        }
      }

      // 5. Log change in audit trail
      if (updatedCurrencies.length > 0) {
        await logAuditEvent(
          businessId,
          userId,
          'ADJUST',
          'SYSTEM',
          { description: 'Pre-sync currency rates', rates: oldRatesMap },
          { description: 'Post-sync dynamic currencies via RBZ automatic daily job', rates: newRatesMap }
        );
      }
    }

    // Save sync checkpoint
    localStorage.setItem('last_rbz_sync_date', todayStr);

    return { success: true, data: currenciesList };

  } catch (err: any) {
    console.error('Error executing automated daily exchange rate sync:', err);
    return { success: false, error: err?.message || String(err) };
  }
}
