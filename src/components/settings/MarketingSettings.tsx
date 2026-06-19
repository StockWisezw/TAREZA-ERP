import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Copy, Facebook, Youtube, Image as ImageIcon, Sparkles, Check, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import FBAdImage from '../../assets/images/facebook_ad_square_1781428595702.jpg';
import YTAdImage from '../../assets/images/youtube_ad_banner_1781428614297.jpg';

export function MarketingSettings() {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const fbAdCopy = `🌟 STOP struggling with cash, swipe, and dual-currency balancing! 🌟

Meet Tareza ERP & POS - Zimbabwean retail's ultimate business multiplier.

✅ Multi-Currency Perfected: Real-time USD, ZWG, and South African Rand (ZAR) conversion.
✅ Off-Grid Resilience: Ring up sales offline at your cashier counter. Your data syncs automatically the second electricity or network connection returns.
✅ Instant Multi-Branch Control from your smartphone or tablet.

Empower your cashiers with Zimbabwe's fastest-growing Cloud POS. Try Tareza ERP today!
👉 Sign up at www.tarezaerp.co.zw / WhatsApp Support: +263 781 428 595`;

  const fbHeadline = "Tareza POS - No Internet? No Problem. Zimbabwe's #1 Multi-Currency Cloud ERP";

  const youtubeTitle = "How Zimbabwe's Top Retailers are Scaling with Tareza Cloud POS & ERP";

  const youtubeDesc = `Scale your business, branches, and cash offices effortlessly with Tareza ERP. 
In this overview, we demonstrate:
1. Real-time Zimbabwe multi-currency exchange rate adjustments.
2. Direct cashier register session check-ins & check-outs.
3. Offline queue resilience for Zimbabwe's typical power or internet outages.
4. Smart double-entry ledger bookkeepings, supplier tracking, and customer automated balances.

Learn more at https://www.tarezaerp.co.zw
Zimbabwe Sales Hotline: sales@tarezaerp.co.zw`;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Marketing copywriting copied to clipboard!");
    setTimeout(() => setCopiedId(null), 3000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Marketing Kit & Brand Assets</h3>
        <p className="text-sm text-zinc-500 mt-1">
          Clean, professional marketing materials tailored for Facebook and YouTube promotion to broadcast Tareza ERP.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Facebook Ad Card */}
        <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
          <CardHeader className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="p-1 px-2 rounded bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 font-bold text-xs flex items-center gap-1">
                <Facebook className="w-3.5 h-3.5" />
                Facebook Ad
              </div>
              <span className="text-xs text-zinc-400">1:1 Square Feed Asset</span>
            </div>
            <CardTitle className="text-base font-bold mt-2 text-zinc-800 dark:text-zinc-100">
              Cashier & Cloud POS Promo
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500">
              Clean visual optimized for Facebook and Instagram Sponsored feeds.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative group overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900">
              <img
                src={FBAdImage}
                alt="Facebook Ad Preview"
                referrerPolicy="no-referrer"
                className="w-full object-cover aspect-square transition-transform duration-500 group-hover:scale-[1.02]"
              />
              <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded font-mono">
                1080 x 1080
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">
                  Suggested Ad Headline
                </label>
                <div className="flex items-center justify-between p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-800/60 font-medium">
                  <span className="line-clamp-1">{fbHeadline}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 ml-2 text-zinc-400 hover:text-zinc-100 shrink-0"
                    onClick={() => copyToClipboard(fbHeadline, 'fb-hl')}
                  >
                    {copiedId === 'fb-hl' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">
                  Facebook Post Copy (High Conversion)
                </label>
                <div className="relative rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60">
                  <pre className="p-3 text-[11px] font-sans leading-relaxed text-zinc-650 dark:text-zinc-300 max-h-[160px] overflow-y-auto whitespace-pre-wrap custom-scrollbar">
                    {fbAdCopy}
                  </pre>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute right-2 bottom-2 text-xs py-1 h-7 flex items-center gap-1.5"
                    onClick={() => copyToClipboard(fbAdCopy, 'fb-copy')}
                  >
                    {copiedId === 'fb-copy' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy Text
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* YouTube Ad Card */}
        <Card className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
          <CardHeader className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="p-1 px-2 rounded bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 font-bold text-xs flex items-center gap-1">
                <Youtube className="w-3.5 h-3.5" />
                YouTube Banner
              </div>
              <span className="text-xs text-zinc-400">16:9 Landscape Asset</span>
            </div>
            <CardTitle className="text-base font-bold mt-2 text-zinc-800 dark:text-zinc-100">
              Harare Skyline ERP Presentation
            </CardTitle>
            <CardDescription className="text-xs text-zinc-500">
              Sleek landscape cover ideal for YouTube thumbnails, banners, or video headers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative group overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900">
              <img
                src={YTAdImage}
                alt="YouTube Banner Preview"
                referrerPolicy="no-referrer"
                className="w-full object-cover aspect-video transition-transform duration-500 group-hover:scale-[1.02]"
              />
              <div className="absolute top-2 right-2 bg-black/75 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded font-mono">
                1920 x 1080
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">
                  High-Click YouTube Video Title
                </label>
                <div className="flex items-center justify-between p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-800/60 font-medium">
                  <span className="line-clamp-1">{youtubeTitle}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 ml-2 text-zinc-400 hover:text-zinc-100 shrink-0"
                    onClick={() => copyToClipboard(youtubeTitle, 'yt-title')}
                  >
                    {copiedId === 'yt-title' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 block mb-1">
                  YouTube Video Description Template
                </label>
                <div className="relative rounded-md bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60">
                  <pre className="p-3 text-[11px] font-sans leading-relaxed text-zinc-650 dark:text-zinc-300 max-h-[160px] overflow-y-auto whitespace-pre-wrap custom-scrollbar">
                    {youtubeDesc}
                  </pre>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="absolute right-2 bottom-2 text-xs py-1 h-7 flex items-center gap-1.5"
                    onClick={() => copyToClipboard(youtubeDesc, 'yt-desc')}
                  >
                    {copiedId === 'yt-desc' ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500" /> Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copy Text
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
        <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 mt-0.5">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Local Advertising Compliance Checklist</h4>
              <p className="text-xs text-zinc-500 mt-1 max-w-2xl leading-relaxed">
                Before uploading these creatives to Meta Ads, verify your targeted currencies (USD / ZWG) match the ones operating on your active registers. Always include standard contact information on Harare retail campaigns for maximum confidence.
              </p>
            </div>
          </div>
          <div className="text-xs text-zinc-400 font-mono select-none">
            Assets Build v1.206
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
