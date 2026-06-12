/**
 * Custom performance metrics and telemetry reporter
 */
export const reportWebVital = (name: string, value: number, rating?: string) => {
  console.log(`[Web Vital] Metric: ${name} | Value: ${Math.round(value)}ms | Rating: ${rating || 'N/A'}`);
  
  // Connect with Google Analytics event reporter if available in window context
  if ((window as any).gtag) {
    (window as any).gtag('event', name, {
      value: Math.round(value),
      rating: rating,
      event_category: 'web_vitals'
    });
  }
};

/**
 * Measures the loading duration of the POS catalogue list or search routines
 */
export const measurePOSLoad = async (fetchAction: () => Promise<any>): Promise<any> => {
  const start = performance.now();
  try {
    const data = await fetchAction();
    const duration = performance.now() - start;
    const rating = duration < 1200 ? 'good' : duration < 2500 ? 'needs-improvement' : 'poor';
    
    reportWebVital('pos_catalog_load_time', duration, rating);
    return data;
  } catch (err) {
    const duration = performance.now() - start;
    reportWebVital('pos_catalog_load_failed', duration, 'error');
    throw err;
  }
};

/**
 * Measures database sync operation latency
 */
export const measureSyncLatency = async <T,>(syncLabel: string, syncAction: () => Promise<T>): Promise<T> => {
  const start = performance.now();
  try {
    const result = await syncAction();
    const duration = performance.now() - start;
    reportWebVital(`sync_latency_${syncLabel}`, duration, duration < 3000 ? 'good' : 'slow');
    return result;
  } catch (err) {
    const duration = performance.now() - start;
    reportWebVital(`sync_failed_${syncLabel}`, duration, 'error');
    throw err;
  }
};
