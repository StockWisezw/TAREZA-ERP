import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  ComposedChart,
  Area
} from 'recharts';
import { 
  TrendingUp, 
  Sparkles, 
  Loader2, 
  AlertCircle, 
  HelpCircle, 
  ArrowUpRight, 
  Database, 
  CheckCircle2, 
  Info,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';

interface SaleRecord {
  id: string;
  created_at: string;
  total?: number;
  total_amount?: number;
  status: string;
  branch_id?: string;
}

interface AIForecastingProps {
  salesList: SaleRecord[];
  businessName?: string;
}

interface ForecastPoint {
  period: string;
  forecastedRevenue: number;
  confidenceIntervalLower: number;
  confidenceIntervalUpper: number;
  keyDriver: string;
}

interface ForecastResponse {
  success: boolean;
  isOfflineMode?: boolean;
  forecastPoints: ForecastPoint[];
  summary: string;
  recommendations: string[];
}

export function AIForecasting({ salesList, businessName = "Tareza Workspace" }: AIForecastingProps) {
  const [forecastPeriod, setForecastPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);

  // 1. Client-Side Aggregation (SaaS Optimization Choice)
  // Consolidates hundreds of raw line sales records into a clean historical aggregate array
  // to avoid sending high-token payloads to the LLM and reduce standard processing latency.
  const aggregatedHistory = useMemo(() => {
    if (!salesList || salesList.length === 0) return [];

    const now = new Date();
    
    if (forecastPeriod === 'weekly') {
      // Group past 8 weeks
      const weeks = [];
      for (let i = 7; i >= 0; i--) {
        const start = new Date(now.getTime());
        start.setDate(now.getDate() - ((i + 1) * 7) + 1);
        start.setHours(0,0,0,0);

        const end = new Date(now.getTime());
        end.setDate(now.getDate() - (i * 7));
        end.setHours(23,59,59,999);

        const inPeriodSales = salesList.filter(s => {
          const sDate = new Date(s.created_at);
          return sDate >= start && sDate <= end;
        });

        const revenue = inPeriodSales.reduce((sum, s) => sum + Number(s.total || s.total_amount || 0), 0);
        
        weeks.push({
          name: `Week -${i}`,
          date: `${start.toLocaleDateString([], {month:'short', day:'numeric'})} - ${end.toLocaleDateString([], {month:'short', day:'numeric'})}`,
          revenue: Math.round(revenue * 100) / 100,
          transactionCount: inPeriodSales.length
        });
      }
      return weeks;
    } else {
      // Group past 6 months
      const months = [];
      for (let i = 5; i >= 0; i--) {
        const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
        start.setHours(0,0,0,0);
        
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        end.setHours(23,59,59,999);

        const inPeriodSales = salesList.filter(s => {
          const sDate = new Date(s.created_at);
          return sDate >= start && sDate <= end;
        });

        const revenue = inPeriodSales.reduce((sum, s) => sum + Number(s.total || s.total_amount || 0), 0);
        
        months.push({
          name: start.toLocaleDateString([], { month: 'short', year: '2-digit' }),
          date: start.toLocaleDateString([], { month: 'long' }),
          revenue: Math.round(revenue * 100) / 100,
          transactionCount: inPeriodSales.length
        });
      }
      return months;
    }
  }, [salesList, forecastPeriod]);

  // Handle forecast generation API Call
  const generateForecast = async () => {
    if (aggregatedHistory.length === 0) {
      toast.error("Insufficient historical sales records to trigger prediction modeling.");
      return;
    }

    setLoading(true);
    setError(null);
    
    // Detailed reassuring multi-phase progress loading screen for premium user feedback
    const steps = [
      "Securing connection to business workspace databases...",
      "Analyzing temporal purchase cycles and seasonal factors...",
      "Structuring prompt metrics for the server-side Gemini gateway...",
      "Refining upper and lower confidence intervals using quantitative regression...",
      "Finalizing strategic retail growth counsel..."
    ];

    let currentStepIdx = 0;
    setLoadingStep(steps[0]);
    const stepInterval = setInterval(() => {
      if (currentStepIdx < steps.length - 1) {
        currentStepIdx++;
        setLoadingStep(steps[currentStepIdx]);
      }
    }, 1800);

    try {
      const response = await fetch('/api/ai/forecast', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          historicalData: aggregatedHistory,
          forecastPeriod,
          businessName
        })
      });

      clearInterval(stepInterval);

      if (!response.ok) {
        throw new Error(`Server returned error status ${response.status}`);
      }

      const data: ForecastResponse = await response.json();
      setForecastData(data);
      if (data.isOfflineMode) {
        toast.warning("Offline projection active. API key is missing.");
      } else {
        toast.success("AI sales forecast generated instantly by Gemini!");
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      console.error(err);
      setError(err.message || "An expected error occurred while calculating forecasting schemas.");
      toast.error("Forecasting failed. Please check backend environment configurations.");
    } finally {
      setLoading(false);
    }
  };

  // Generate combined visualization array of historical + forecasted segments
  const visualizationData = useMemo(() => {
    if (!forecastData) return [];

    const result = aggregatedHistory.map(item => ({
      name: item.name,
      historicalRevenue: item.revenue,
      forecastedRevenue: null as number | null,
      confidenceLower: null as number | null,
      confidenceUpper: null as number | null,
      type: 'Historical'
    }));

    forecastData.forecastPoints.forEach(pt => {
      result.push({
        name: pt.period,
        historicalRevenue: null,
        forecastedRevenue: pt.forecastedRevenue,
        confidenceLower: pt.confidenceIntervalLower,
        confidenceUpper: pt.confidenceIntervalUpper,
        type: 'Forecasted'
      });
    });

    return result;
  }, [aggregatedHistory, forecastData]);

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600 animate-pulse" />
            AI-Powered Sales Forecasting
          </h2>
          <p className="text-xs text-zinc-500 max-w-xl">
            Leverage Google Gemini 3.5 AI modeling to forecast future performance, formulate contingency bounds, and generate strategic growth counsel.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-zinc-100 p-1 border rounded-lg flex items-center gap-1">
            <Button
              variant={forecastPeriod === 'weekly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => { setForecastPeriod('weekly'); setForecastData(null); }}
              className={`h-8 text-xs font-medium rounded-md px-3 ${forecastPeriod === 'weekly' ? 'bg-zinc-900 text-white hover:bg-zinc-800' : 'text-zinc-650 hover:bg-zinc-200'}`}
              disabled={loading}
              id="forecast-weekly-btn"
            >
              Weekly projection
            </Button>
            <Button
              variant={forecastPeriod === 'monthly' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => { setForecastPeriod('monthly'); setForecastData(null); }}
              className={`h-8 text-xs font-medium rounded-md px-3 ${forecastPeriod === 'monthly' ? 'bg-zinc-900 text-white hover:bg-zinc-800' : 'text-zinc-650 hover:bg-zinc-200'}`}
              disabled={loading}
              id="forecast-monthly-btn"
            >
              Monthly projection
            </Button>
          </div>

          <Button
            onClick={generateForecast}
            disabled={loading || aggregatedHistory.length === 0}
            className="h-9 px-4 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2 rounded-lg cursor-pointer"
            id="forecast-generate-btn"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TrendingUp className="w-3.5 h-3.5" />}
            Generate Forecast
          </Button>
        </div>
      </div>

      {/* OFFLINE MODAL WARNER / API KEY STATUS INSIGHT */}
      {forecastData?.isOfflineMode && (
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-4 flex gap-3.5 shadow-sm text-amber-900 leading-relaxed text-xs">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-amber-950 block">Offline Sandbox Mode Active</span>
            <p className="text-amber-800/90 leading-relaxed">
              Tareza was unable to locate an active <code>GEMINI_API_KEY</code> on the server environment. This forecast was calculated using our local statistical slope heuristic models. To acquire fully automated behavioral trends, weather correlations, and cyclical retail recommendations, please provide your secret Gemini key in the <strong>Settings &gt; Secrets</strong> panel.
            </p>
          </div>
        </div>
      )}

      {loading && (
        <Card className="border border-zinc-200 shadow-sm p-8 flex flex-col items-center justify-center min-h-[350px] bg-white rounded-2xl">
          <div className="relative flex items-center justify-center mb-5">
            <div className="absolute w-12 h-12 rounded-full border-4 border-indigo-100 animate-ping" />
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin relative" />
          </div>
          <span className="font-bold text-zinc-900 text-sm">Drafting AI Projection Model</span>
          <p className="text-xs text-zinc-500 font-mono mt-2 bg-zinc-50 border px-3 py-1.5 rounded-lg max-w-sm text-center">
            {loadingStep}
          </p>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 border-2 shadow-sm p-6 flex flex-col items-center justify-center min-h-[250px] bg-red-50 text-red-900 rounded-2xl">
          <AlertCircle className="w-8 h-8 text-red-600 mb-3" />
          <span className="font-bold text-sm">AI Calculation Failed</span>
          <p className="text-xs text-red-700 font-mono mt-1 mb-4 text-center max-w-md">
            {error}
          </p>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={generateForecast} 
            className="border-red-300 bg-white hover:bg-red-100 text-red-900 h-8"
            id="forecast-retry-btn"
          >
            Retry Generation
          </Button>
        </Card>
      )}

      {!loading && !error && !forecastData && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          <div className="md:col-span-8">
            <Card className="border border-zinc-200 bg-white shadow-sm rounded-2xl p-6 flex flex-col items-center justify-center min-h-[400px]">
              <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl mb-4">
                <Database className="w-6 h-6 text-zinc-400" />
              </div>
              <h3 className="font-bold text-sm text-zinc-800">Historical Sales Pool Evaluated</h3>
              <p className="text-xs text-zinc-400 max-w-md text-center mt-1.5 mb-5 leading-relaxed">
                Found <strong>{salesList.length} completed transactions</strong> across the system. We have compiled them into <strong>{aggregatedHistory.length} chronological periods</strong>. Ready to process forecasting vectors.
              </p>
              <Button 
                onClick={generateForecast} 
                className="bg-zinc-950 hover:bg-zinc-900 h-9 text-xs px-4 rounded-lg text-white"
                id="forecast-initial-btn"
              >
                Model Performance Forecast
              </Button>
            </Card>
          </div>

          <div className="md:col-span-4 flex flex-col gap-4">
            <Card className="border border-zinc-250 bg-gradient-to-br from-indigo-50/30 to-slate-50/50 shadow-sm rounded-2xl p-5">
              <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-widest flex items-center gap-1.5 mb-3">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                SaaS Architectural Design
              </h4>
              <div className="space-y-3.5 text-[11px] leading-relaxed text-zinc-650">
                <div className="flex items-start gap-2.5">
                  <div className="p-1 px-1.5 bg-indigo-100 text-indigo-700 font-bold border rounded mt-0.5 font-mono">01</div>
                  <div>
                    <span className="font-bold text-zinc-900 block">Edge-Aggregation Pipeline</span>
                    <p>Compresses high-density sales logs into temporal buckets on the client. Only sends processed arrays to minimize packet bytes and LLM tokens.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="p-1 px-1.5 bg-indigo-100 text-indigo-700 font-bold border rounded mt-0.5 font-mono">02</div>
                  <div>
                    <span className="font-bold text-zinc-900 block">Stochastic Boundary Models</span>
                    <p>Fuses historical averages with linear regression vectors. Yields pessimistic (Upper) vs optimistic (Lower) retail horizons dynamically.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="p-1 px-1.5 bg-indigo-100 text-indigo-700 font-bold border rounded mt-0.5 font-mono">03</div>
                  <div>
                    <span className="font-bold text-zinc-900 block">Zim dollar/Multi-Currency Hedging</span>
                    <p>System prompts configure strategic growth outputs optimized for cash reserve allocations and high inflation supply-chain contexts.</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="border border-zinc-200 bg-white shadow-sm rounded-2xl p-5 space-y-3">
              <h4 className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                Baseline Historical Aggregates
              </h4>
              <div className="max-h-[140px] overflow-y-auto divide-y text-xs">
                {aggregatedHistory.length === 0 ? (
                  <p className="text-zinc-450 p-2 text-center">No sales registered yet.</p>
                ) : (
                  aggregatedHistory.slice(-5).map((h, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2 text-zinc-600">
                      <div>
                        <span className="font-bold text-zinc-900 block">{h.name}</span>
                        <span className="text-[10px] text-zinc-400 font-mono">{h.date}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-indigo-650 font-mono">${h.revenue.toLocaleString()}</span>
                        <span className="text-[9px] text-zinc-400 block font-semibold">{h.transactionCount} transactions</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* COMPLETED ACTIVE FORECAST RESULTS PREVIEW */}
      {!loading && !error && forecastData && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Forecasting Visualization Block (Chart) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <Card className="border border-zinc-200 bg-white shadow-sm rounded-2xl p-6 flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center justify-between font-sans border-b pb-3 mb-4">
                  <div>
                    <span className="text-xs font-bold text-zinc-450 uppercase tracking-widest block">Projections Horizon</span>
                    <CardTitle className="text-sm font-bold text-zinc-900">
                      {forecastPeriod === 'weekly' ? 'Weekly Sales Revenue Projection (Next 4 Weeks)' : 'Monthly Sales Revenue Projection (Next 4 Months)'}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-mono">
                    <span className="flex items-center gap-1.5 font-bold"><span className="w-2.5 h-2.5 rounded-full bg-zinc-400" /> Historical</span>
                    <span className="flex items-center gap-1.5 font-bold"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> AI Expected</span>
                    <span className="flex items-center gap-1.5 font-bold text-indigo-400 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full"><span className="w-2 px-1 h-1.5 bg-indigo-200" /> Confidence Bands</span>
                  </div>
                </div>

                <div className="w-full h-[320px] pr-4 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={visualizationData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                      <XAxis 
                        dataKey="name" 
                        stroke="#71717A" 
                        fontSize={11} 
                        tickLine={false}
                        axisLine={false} 
                      />
                      <YAxis 
                        stroke="#71717A" 
                        fontSize={11} 
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `$${v.toLocaleString()}`}
                      />
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-zinc-900 text-white p-3 border border-zinc-750 rounded-xl shadow-xl space-y-1.5 text-xs font-sans">
                                <span className="font-bold text-[11px] block text-zinc-350">{data.name}</span>
                                {data.historicalRevenue !== null && (
                                  <div className="flex justify-between items-center gap-4">
                                    <span className="text-zinc-400 font-medium">Historical Revenue:</span>
                                    <span className="font-bold font-mono text-white">${data.historicalRevenue.toLocaleString()}</span>
                                  </div>
                                )}
                                {data.forecastedRevenue !== null && (
                                  <div className="space-y-1 border-t border-zinc-800 pt-1.5">
                                    <div className="flex justify-between items-center gap-4">
                                      <span className="text-indigo-300 font-bold">AI Expected:</span>
                                      <span className="font-bold font-mono text-indigo-450">${data.forecastedRevenue.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center gap-4 text-[10px] text-zinc-400">
                                      <span>Conservative Bound:</span>
                                      <span className="font-mono">${data.confidenceLower?.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center gap-4 text-[10px] text-zinc-400">
                                      <span>Optimistic Bound:</span>
                                      <span className="font-mono">${data.confidenceUpper?.toLocaleString()}</span>
                                    </div>
                                    {data.keyDriver && (
                                      <p className="text-[10px] text-indigo-300/85 leading-relaxed bg-indigo-950/40 border border-indigo-900/35 p-1 px-1.5 mt-1 text-center font-mono rounded">
                                        💡 {data.keyDriver}
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      
                      {/* Confidence Shading Ring */}
                      <Area 
                        type="monotone" 
                        dataKey="confidenceUpper" 
                        stroke="none" 
                        fill="#EEF2FF" 
                        strokeWidth={0}
                        activeDot={false}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="confidenceLower" 
                        stroke="none" 
                        fill="#FFFFFF" 
                        strokeWidth={0}
                        activeDot={false}
                      />
                      
                      {/* Confidence band shaded visual range connector */}
                      <Area
                        type="monotone"
                        dataKey="confidenceUpper"
                        stroke="none"
                        fill="#818CF8"
                        fillOpacity={0.12}
                        connectNulls
                      />

                      <Line 
                        type="monotone" 
                        dataKey="historicalRevenue" 
                        stroke="#18181B" 
                        strokeWidth={2.5} 
                        dot={{ r: 4, strokeWidth: 1.5, fill: "#FFF" }} 
                        activeDot={{ r: 6 }}
                        connectNulls
                      />
                      <Line 
                        type="monotone" 
                        dataKey="forecastedRevenue" 
                        stroke="#4F46E5" 
                        strokeWidth={2.5} 
                        strokeDasharray="5 5" 
                        dot={{ r: 4, fill: "#4F46E5" }} 
                        activeDot={{ r: 6 }}
                        connectNulls
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Individual Prediction Period Blocks */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-50 border rounded-2xl p-4 mt-2">
                {forecastData.forecastPoints.map((pt, idx) => (
                  <div key={idx} className="space-y-1 bg-white border border-zinc-200 p-3 rounded-xl shadow-xs">
                    <span className="text-[10px] font-bold text-zinc-400 block uppercase tracking-widest">{pt.period}</span>
                    <span className="font-bold text-sm text-indigo-650 font-mono block">${pt.forecastedRevenue.toLocaleString()}</span>
                    <div className="text-[9px] text-zinc-500 font-medium font-mono leading-relaxed">
                      Range: ${pt.confidenceIntervalLower.toLocaleString()} - ${pt.confidenceIntervalUpper.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* AI Executive Summary & Recommendations List */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <Card className="border border-zinc-200 bg-white shadow-sm rounded-2xl p-5 flex flex-col justify-between h-full">
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b pb-3.5">
                  <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 border border-indigo-100">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Executive Analysis</span>
                    <h3 className="font-bold text-sm text-zinc-950">Gemini Strategic Forecast</h3>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs text-zinc-650 leading-relaxed font-sans">
                    {forecastData.summary}
                  </p>
                </div>

                <div className="border-t border-zinc-200 pt-3.5 space-y-3">
                  <h4 className="text-xs font-bold text-zinc-900 uppercase">Strategic Action Directives</h4>
                  
                  <div className="space-y-3">
                    {forecastData.recommendations.map((rec, i) => (
                      <div key={i} className="flex gap-2.5 items-start text-xs text-zinc-600">
                        <ArrowUpRight className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                        <p className="leading-relaxed font-sans">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-zinc-150 pt-3.5 mt-4 flex items-center justify-between text-[11px] text-zinc-450 font-mono">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-zinc-400" />
                  Model: gemini-3.5-flash
                </span>
                <span className="bg-zinc-100 border px-1.5 py-0.5 rounded font-bold">
                  {forecastPeriod.toUpperCase()}
                </span>
              </div>
            </Card>
          </div>

        </div>
      )}

    </div>
  );
}
