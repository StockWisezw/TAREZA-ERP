import { logger } from './logger';

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private marks = new Map<string, number>();

  private constructor() {}

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startMeasure(name: string) {
    if (typeof performance !== 'undefined') {
      this.marks.set(name, performance.now());
    }
  }

  endMeasure(name: string): number {
    if (typeof performance === 'undefined') return 0;
    
    const start = this.marks.get(name);
    if (start === undefined) {
      console.warn(`[PERF] No start mark registered for: ${name}`);
      return 0;
    }

    const duration = performance.now() - start;
    this.marks.delete(name);

    if (duration > 1000) {
      logger.warn(`[SLOW OPERATION] ${name} execution took too long: ${duration.toFixed(2)}ms`, { duration });
    } else {
      logger.debug(`[PERF] ${name} executed in ${duration.toFixed(2)}ms`, { duration });
    }

    return duration;
  }
}

export const perfMonitor = PerformanceMonitor.getInstance();

// Web Vitals telemetry logging setup
export function reportWebVitals() {
  if (typeof window === 'undefined' || typeof PerformanceObserver === 'undefined') return;

  try {
    // 1. Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as any;
      const lcp = lastEntry.renderTime || lastEntry.loadTime || 0;
      logger.info(`[METRIC] LCP (Largest Contentful Paint) stable: ${lcp.toFixed(2)}ms`, { lcp });
    });
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

    // 2. Cumulative Layout Shift (CLS)
    let clsValue = 0;
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
          logger.info(`[METRIC] CLS (Cumulative Layout Shift) update: ${clsValue.toFixed(4)}`, { cls: clsValue });
        }
      }
    });
    clsObserver.observe({ entryTypes: ['layout-shift'] });
  } catch (err) {
    // Graceful catch for legacy browsers/iframes missing observers
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', reportWebVitals);
}
