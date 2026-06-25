import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { 
  Download, 
  Copy, 
  Check, 
  Plus, 
  Share2, 
  Image as ImageIcon, 
  Video, 
  FileText, 
  Tag, 
  Trash2, 
  ExternalLink,
  Edit,
  Sparkles,
  RefreshCw,
  Maximize2,
  Eye,
  History,
  RotateCcw,
  Printer,
  BookOpen,
  Palette,
  Layers,
  Type,
  TrendingUp,
  Smartphone,
  Shield,
  Clock,
  CreditCard,
  Activity,
  ArrowRight,
  UserCheck,
  Percent,
  ShoppingBag,
  Store,
  Users,
  CheckCircle2,
  Calculator,
  Settings,
  Play,
  Pause,
  Volume2,
  Laptop,
  Wifi,
  WifiOff
} from 'lucide-react';
import { TarezaLogo } from '../ui/Logo';
import { db, collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where } from '../../lib/firebaseClient';
import { useAuth } from '../../hooks/useAuth';

interface AssetVersion {
  id: string;
  versionNumber: number;
  imageUrl: string;
  caption: string;
  createdAt: string;
  changelog: string;
}

interface MarketingAsset {
  id: string;
  name: string;
  type: 'Facebook & Instagram' | 'YouTube & Video' | 'General Flyer' | 'Banner';
  format: string;
  imageUrl: string;
  caption: string;
  tags: string[];
  isCustom?: boolean;
  versions?: AssetVersion[];
}

export interface PlayableVideoScript {
  id: string;
  title: string;
  duration: string;
  tagline: string;
  platform: 'YouTube Walkthrough' | 'Facebook Video Ad' | 'YouTube & Facebook Reels';
  steps: {
    subtitle: string;
    animationState: string;
    focusElement?: string;
  }[];
  caption: string;
  tags: string[];
}

export const PLAYABLE_VIDEOS: PlayableVideoScript[] = [
  {
    id: 'cashier-onboarding',
    title: 'The 60-Second Cashier Speed Onboarding',
    duration: '0:12',
    tagline: 'Streamline checkout workforce & prevent leakage with compliance-ready setup',
    platform: 'Facebook Video Ad',
    steps: [
      {
        subtitle: "Auntie shops and wholesale centers lose up to 15% to manual cashier leakage.",
        animationState: "leakage_warning"
      },
      {
        subtitle: "With Tareza ERP, onboarding a cashier takes less than 60 seconds. Set up names and private passcodes.",
        animationState: "add_employee_form"
      },
      {
        subtitle: "Assign safe registers (e.g. Register Alpha) and assign specific branches, safeguarding your drawer float levels.",
        animationState: "register_assigned"
      },
      {
        subtitle: "Track live session audit logs, prevent fraudulent voids, and enjoy 100% accountable retail operations!",
        animationState: "completed_dashboard_audit"
      }
    ],
    caption: `🎥 Video Tour Masterclass: Watch how Tareza ERP eliminates human errors in under 60 seconds! 

Ensure total transparency in your shop today. Onboard employees, manage register floats, and control sales channels. Check out here:
👉 Website: tareza-pos.co.zw
👉 WhatsApp setup: +263 77 123 4567

#TarezaERP #CashierOnboarding #PosSecurity #RetailZimbabwe #AccountingEngine`,
    tags: ['social-video', 'cashier-setup', 'transparency-audit']
  },
  {
    id: 'offline-defense',
    title: 'The Offline Sales Defense Suite',
    duration: '0:12',
    tagline: 'Survive power cuts & grid dropouts with real-time caching & sync storage',
    platform: 'YouTube Walkthrough',
    steps: [
      {
        subtitle: "Frequent power cuts and internet drops in Harare can halt retail operations.",
        animationState: "online_stable"
      },
      {
        subtitle: "Oh no! Your internet connection has dropped entirely. But wait—the terminal doesn't crash!",
        animationState: "offline_blackout"
      },
      {
        subtitle: "Your cashier keeps checking out Mazoe Peach Syrup 2L. Sales securely log to local device storage.",
        animationState: "offline_selling_saved"
      },
      {
        subtitle: "Internet restored! With 1-second auto-sync, client data flushes safely back to Firestore. No sales lost!",
        animationState: "synced_success"
      }
    ],
    caption: `🔌 HARARE ELECTRICITY DROP SADDLES YOUR RETAIL SHOP? NOT ANYMORE!

Say hello to uninterrupted offline POS checkout by Tareza ERP. Learn how our client-state caching saves transactions locally and uploads them dynamically when connection is back!

Watch full session details:
📺 Channel: YouTube.com/TarezaPOS

#OfflinePointOfSale #ZESAOutages #BusinessContinuity #ZimbabweERP #FastCheckout`,
    tags: ['offline-first', 'automatic-autosync', 'zero-leakage']
  },
  {
    id: 'dual-pricing-rate',
    title: 'Dual-Pricing & Exchange Rate Alignment',
    duration: '0:12',
    tagline: 'Auto-convert EcoCash, InnBucks, USD & ZiG base rates automatically',
    platform: 'YouTube & Facebook Reels',
    steps: [
      {
        subtitle: "Running multi-currency pricing in Zimbabwe is an absolute bookkeeping nightmare.",
        animationState: "pricing_nightmare"
      },
      {
        subtitle: "With Tareza ERP, set one unified USD price on your product (e.g., $3.50 base rate).",
        animationState: "usd_base_set"
      },
      {
        subtitle: "Adjust our real-time exchange rate slider down to 1:13.50. The terminal instantly recalculates in ZiG!",
        animationState: "zig_rate_calculated"
      },
      {
        subtitle: "Inbuilt EcoCash Biller and InnBucks Merchant calculations handle rest of the invoice. 100% accurate cashier totals!",
        animationState: "currency_grand_total"
      }
    ],
    caption: `💵 AUTOMATE YOUR USD TO ZiG SALES CALCULATIONS INSTANTLY!

No more manual conversion charts on shop counters. Watch how Tareza ERP auto-calculates multi-currency totals based on fluctuating rates instantly.

Get started with our dual-pricing engine:
👉 Link: tareza-pos.co.zw/pos

#MultiCurrencyPOS #ZiGExchangeRates #EcoCashBiller #ZimbabweMerchants #TarezaPOS`,
    tags: ['multicurrency-audit', 'zig-recalculator', 'dual-pricing']
  }
];

const DEFAULT_ASSETS: MarketingAsset[] = [
  {
    id: 'facebook-ad',
    name: 'Tareza ERP Facebook & Instagram Flyer',
    type: 'Facebook & Instagram',
    format: '1:1 Square (Ad Flyer)',
    imageUrl: '/facebook_ad.png',
    caption: `🚀 Upgrade your shop with Tareza ERP! Say goodbye to calculator errors, manual receipt books, and stock leakage. 

Our lightning-fast, offline-enabled Cloud POS helps you track every sale, monitor inventory levels in real-time, and manage cashiers securely from anywhere.

✅ Easy Cashier Onboarding
✅ Offline Selling Mode
✅ Inbuilt EcoCash & InnBucks Integration
✅ Detailed Daily Sales Reporting

Get started today and streamline your retail business. #TarezaERP #POS #ZimbabweRetail #SmallBusiness #CloudPOS`,
    tags: ['social-ad', 'square', 'promotional'],
  },
  {
    id: 'facebook-cover',
    name: 'Tareza ERP Facebook Page Cover Banner',
    type: 'Facebook & Instagram',
    format: 'Facebook Cover (820x312 aspect landscape)',
    imageUrl: '/facebook_cover.png',
    caption: `✨ Welcome to the official page of Tareza ERP. We are Zimbabwe's #1 offline-first cloud POS & retail ecosystem. Streamline your retail operations, monitor in-stock quantity with high-contrast precision, set wholesale/retail prices, configure multiple bundle sizes, handle multiple cashier drawers risk-free, and track daily sales from any device. Streamlined, simple, secure! Get started with Tareza today at tareza-pos.co.zw`,
    tags: ['cover', 'landscape', 'branding'],
  },
  {
    id: 'first-advert-retail',
    name: 'Tareza ERP Grand Launch Advert (Wholesale & Retail Bundle)',
    type: 'Facebook & Instagram',
    format: '1:1 Square (Ad Flyer)',
    imageUrl: '/facebook_ad.png',
    caption: `💥 REVOLUTIONIZE YOUR SHOP WITH TAREZA ERP! 💥

Are you struggling with daily cash drawer shortages, slow lines, or wholesale/retail price mismatches? Tareza ERP is finally here to lift the weight off Zimbabwe retail merchant and wholesaler shoulders!

💡 Manage single items AND custom packs (six-packs, bulk cartons, individual bottles) seamlessly with Tareza's built-in Multi-Bundle Pricing engine!

🌟 Features designed for our merchants:
🔹 Dual Pricing: Set Retail & Wholesale tier rates automatically!
🔹 Cashier Control: Monitor cashier sign-ins and separate float levels.
🔹 Local Backup: Seamlessly continues selling even without electricity or network connectivity!
🔹 Automatic Exchange Rates: Keep pricing aligned with EcoCash, InnBucks, USD, and ZiG instantly!

👇 Download the applet or log in today to claim your free 14-day trial!
#TarezaERP #ZimbabweMerchants #POSSystem #RetailTech #WholesaleMakers #EcoCash`,
    tags: ['social-ad', 'square', 'grand-launch', 'first-advert'],
  },
  {
    id: 'youtube-ad',
    name: 'Tareza ERP Cashier Onboarding Masterclass Thumbnail',
    type: 'YouTube & Video',
    format: '16:9 Landscape (Video Banner / Thumbnail)',
    imageUrl: '/youtube_ad.png',
    caption: `🎓 Watch our step-by-step masterclass on cashier onboarding and system setup with Tareza ERP. 

In this comprehensive video walk-through, we explain how to set up exchange rates, log into your point-of-sale terminal, configure branches/warehouses, process cash and mobile drawer payments, and access clean end-of-day reports.

Subscribe to our channel to make sure your workforce operates on maximum accuracy and efficiency! 

📺 Watch: https://www.youtube.com/@tarezaerp
#TarezaERP #CashierTraining #OnboardingMasterclass #ZimbabwePOS #InventoryManagement`,
    tags: ['thumbnail', 'landscape', 'tutorial'],
  },
  {
    id: 'youtube-cover',
    name: 'Tareza ERP YouTube Channel Art Banner',
    type: 'YouTube & Video',
    format: 'YouTube Channel Header (2560x1440 ratio)',
    imageUrl: '/youtube_cover.png',
    caption: `🎥 Welcome to the Tareza ERP training and resource hub. Here you will find extensive cashier onboarding video playlists, POS configurations, custom bundle guidelines, and live merchant webinars. Watch or subscribe for a series of masterclasses about hardware printers, multi-branch reporting, and secure offline drawer workflows. Tareza ERP: Zimbabwe's Smart POS made simple.`,
    tags: ['cover', 'landscape', 'branding'],
  },
  {
    id: 'first-advert-whatsapp',
    name: 'Cashier Speed Promo WhatsApp Banner',
    type: 'Banner',
    format: 'Standard Landscape Banner',
    imageUrl: '/youtube_ad.png',
    caption: `⚡ SPEED UP THE CHECKOUT LINE BY 300% ⚡

Tired of manually computing pack sizes and calculating change? Streamline cashier flow with Tareza ERP POS!

No more guessing. No more pen-and-paper. Scan or type SKU, select bundle, check out cash and mobile drawer payments, and print high-contrast receipts instantly.

Keep your cashier workspace 100% transparent and leak-proof. Set up Tareza ERP on any smartphone, tablet, or web browser in under 5 minutes!

Get Tareza POS: https://tareza-pos.co.zw
#TarezaPOS #ZimbabweRetail #PointOfSale #EasyPOS #OfflinePOS`,
    tags: ['whatsapp', 'banner', 'cashier-promo', 'first-advert'],
  }
];

export function MarketingAssets() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
  
  // Real-Time CSS Poster Customizer States
  const [viewMode, setViewMode] = useState<'live' | 'static'>('live');
  const [customBusiness, setCustomBusiness] = useState('Tareza Labs Harare');
  const [customRate, setCustomRate] = useState('13.50');
  const [customCashier, setCustomCashier] = useState('Tinashe Moyo');
  const [customProduct, setCustomProduct] = useState('Mazoe Peach Syrup 2L');
  const [customPrice, setCustomPrice] = useState('3.50');

  // 🎥 Interactive Walkthrough Video Simulator States
  const [activeVideoIndex, setActiveVideoIndex] = useState<number>(0);
  const [videoPlayProgress, setVideoPlayProgress] = useState<number>(0);
  const [videoPlaying, setVideoPlaying] = useState<boolean>(false);
  const [videoStep, setVideoStep] = useState<number>(0);

  useEffect(() => {
    let interval: any = null;
    if (videoPlaying) {
      interval = setInterval(() => {
        setVideoPlayProgress((prev) => {
          const next = prev + 4;
          if (next >= 100) {
            setVideoPlaying(false);
            return 100;
          }
          return next;
        });
      }, 500); // Ticks every 0.5s. Hits 100% in 12.5 seconds (perfect walk-through timing)
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [videoPlaying]);

  useEffect(() => {
    const step = Math.min(3, Math.floor(videoPlayProgress / 25));
    setVideoStep(step);
  }, [videoPlayProgress]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedCaptionId, setCopiedCaptionId] = useState<string | null>(null);
  const [editingAsset, setEditingAsset] = useState<MarketingAsset | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [previewAsset, setPreviewAsset] = useState<MarketingAsset | null>(null);
  const [changelog, setChangelog] = useState('');

  // For adding a custom asset
  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetType, setNewAssetType] = useState<'Facebook & Instagram' | 'YouTube & Video' | 'General Flyer' | 'Banner'>('Facebook & Instagram');
  const [newAssetFormat, setNewAssetFormat] = useState('1:1 Square');
  const [newAssetUrl, setNewAssetUrl] = useState('');
  const [newAssetCaption, setNewAssetCaption] = useState('');
  const [newAssetTags, setNewAssetTags] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Beautiful dynamic HTML/CSS advertisement rendering engine
  const renderLivePoster = (asset: MarketingAsset, isLightbox: boolean = false) => {
    const rateVal = parseFloat(customRate) || 13.50;
    const priceVal = parseFloat(customPrice) || 3.50;
    
    const wrapperClass = isLightbox 
      ? "w-full h-full min-h-[460px] max-h-[70vh] flex flex-col items-center justify-center relative select-none animate-fade-in text-zinc-900 border border-zinc-200/80 overflow-hidden p-6 bg-zinc-50 rounded-2xl"
      : "w-full h-full absolute inset-0 flex flex-col items-center justify-center select-none text-zinc-900 overflow-hidden p-4 bg-zinc-50 border border-zinc-200 animate-fade-in rounded-xl";

    const isFacebookAd = asset.id === 'facebook-ad' || asset.id === 'first-advert-retail';
    const isFacebookCover = asset.id === 'facebook-cover';
    const isYoutubeAd = asset.id === 'youtube-ad';
    const isYoutubeCover = asset.id === 'youtube-cover';
    const isWhatsappAd = asset.id === 'first-advert-whatsapp';

    if (isFacebookAd) {
      return (
        <div className={`${wrapperClass} bg-gradient-to-tr from-slate-50 via-indigo-50/50 to-cyan-50/45`}>
          {/* Top Branding Bar */}
          <div className="absolute top-3 left-4 right-4 flex justify-between items-center z-10">
            <TarezaLogo size="sm" showSubtitle={false} variant="light" />
            <span className="text-[9px] font-bold py-1 px-2 rounded-full flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-550/20 text-emerald-700 font-mono tracking-wide uppercase">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              100% Offline Active
            </span>
          </div>

          {/* Headline copy */}
          <div className="text-center space-y-1.5 my-3 mt-10 max-w-sm px-2">
            <h4 className="text-xl md:text-2xl font-black font-sans leading-tight tracking-tight uppercase text-zinc-900">
              No Network? Keep Selling.
            </h4>
            <p className="text-[10px] md:text-xs text-zinc-650 tracking-wide font-sans font-medium">
              Track multi-currency cash flows, prevent cashier leakages & sync instantly.
            </p>
          </div>

          {/* POS Terminal Screen Simulation */}
          <div className="flex-1 w-full max-w-md bg-white border border-zinc-250 shadow-lg p-4 flex flex-col justify-between overflow-hidden relative rounded-2xl">
            <div className="absolute inset-0 bg-gradient-to-b from-zinc-500/5 to-transparent pointer-events-none" />
            
            {/* App Mock Header */}
            <div className="flex justify-between items-center border-b border-zinc-150 pb-2 mb-2 font-mono text-[9px] text-zinc-500">
              <span className="font-bold text-zinc-700 flex items-center gap-1">
                <Store className="w-3 h-3 text-indigo-600" />
                {customBusiness || "Primary Outlet"}
              </span>
              <span>Register 01 • Cashier: {customCashier}</span>
            </div>

            {/* Cart Table list */}
            <div className="flex-1 space-y-2 py-1 max-h-[120px] overflow-y-auto pr-1">
              <div className="flex justify-between items-center text-xs font-sans">
                <div className="flex items-center gap-1.5">
                  <span className="p-1 bg-indigo-500/10 text-indigo-700 rounded-md font-mono font-bold text-[9px]">x6</span>
                  <span className="font-bold text-zinc-800">{customProduct}</span>
                </div>
                <span className="font-mono text-zinc-900 font-black">${(priceVal * 6).toFixed(2)} USD</span>
              </div>

              <div className="flex justify-between items-center text-xs font-sans border-t border-zinc-150 pt-2">
                <div className="flex items-center gap-1.5">
                  <span className="p-1 bg-indigo-500/10 text-indigo-700 rounded-md font-mono font-bold text-[9px]">x2</span>
                  <span className="font-bold text-zinc-800">Red Seal Roller Meal 10kg</span>
                </div>
                <span className="font-mono text-zinc-900 font-bold">$13.00 USD</span>
              </div>

              <div className="flex justify-between items-center text-xs font-sans border-t border-zinc-150 pt-2 border-dashed">
                <div className="flex items-center gap-1.5">
                  <span className="p-1 bg-emerald-500/10 text-emerald-700 rounded-md font-mono font-bold text-[9px]">biller</span>
                  <span className="font-bold text-zinc-700">InnBucks Business Payment</span>
                </div>
                <span className="font-mono text-emerald-600 font-bold">-$1.50 Promo Fee</span>
              </div>
            </div>

            {/* Inbuilt Receipts Checker Summary */}
            <div className="mt-3 border-t-2 border-dashed border-zinc-200 pt-3 flex flex-col gap-2">
              <div className="flex justify-between items-end bg-zinc-50 border border-zinc-150 p-3 rounded-xl">
                <div>
                  <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Invoice Due Total</span>
                  <p className="text-xl font-mono font-black text-emerald-700 leading-none mt-1">
                    ${((priceVal * 6) + 13.00 - 1.50).toFixed(2)} <span className="text-xs font-bold text-zinc-500 font-sans">USD</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest font-mono">Convert Rate @ {customRate}</span>
                  <p className="text-sm font-mono font-bold text-indigo-600 mt-1">
                    {(((priceVal * 6) + 13.00 - 1.50) * rateVal).toFixed(2)} <span className="text-[9px] text-zinc-500 uppercase">ZiG</span>
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center text-[9px] font-mono text-zinc-500 mt-1">
                <span className="flex items-center gap-1 text-emerald-600 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0" />
                  No Cash shortages
                </span>
                <span className="text-zinc-400">Receipt: TZ-6051 • Auto-Logged</span>
              </div>
            </div>
          </div>

          <div className="absolute bottom-3 left-4 right-4 flex justify-between items-center pointer-events-none font-sans">
            <span className="text-[9px] text-zinc-505 tracking-wide font-medium">Zimbabwe&apos;s Premium POS Ecosystem</span>
            <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-widest flex items-center gap-1">
              tareza-pos.co.zw
              <ArrowRight className="w-3 h-3 text-indigo-600" />
            </span>
          </div>
        </div>
      );
    }

    if (isFacebookCover) {
      return (
        <div className={`${wrapperClass} bg-gradient-to-r from-zinc-50 via-white to-indigo-50/30 p-6 flex flex-row items-center gap-6`}>
          <div className="w-1/2 flex flex-col justify-center space-y-4 text-left z-10 pr-4">
            <TarezaLogo size="sm" showSubtitle={true} variant="light" />
            <div className="space-y-1.5">
              <h4 className="text-xl md:text-2xl font-black tracking-tight leading-none text-zinc-900 uppercase font-sans">
                Unified Retail OS & Metric Suite
              </h4>
              <p className="text-[10px] md:text-xs text-zinc-600 font-semibold leading-tight animate-fade-in">
                Complete corporate oversight from cashier shifts to central warehouse depots.
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[9px] text-zinc-700 font-sans font-bold">
                <Check className="w-3 h-3 text-indigo-650 shrink-0" />
                <span>Zero Sales Shortages or Stock Leakage</span>
              </div>
              <div className="flex items-center gap-2 text-[9px] text-zinc-700 font-sans font-bold">
                <Check className="w-3 h-3 text-indigo-650 shrink-0" />
                <span>Multi-Warehouse Transfers & Audits</span>
              </div>
            </div>
          </div>

          <div className="w-1/2 grid grid-cols-2 gap-3 z-10">
            <div className="bg-white border border-zinc-200 p-3 rounded-xl space-y-2 col-span-2 shadow-sm">
              <span className="text-[8px] font-mono font-bold text-zinc-500 uppercase tracking-widest flex items-center justify-between">
                <span>Branch Profit Comparison</span>
                <span className="text-emerald-650 font-bold flex items-center gap-0.5">
                  <TrendingUp className="w-2.5 h-2.5" />
                  +18.4%
                </span>
              </span>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-zinc-600 font-sans font-medium truncate max-w-[124px]">{customBusiness}</span>
                  <span className="font-mono font-bold text-zinc-850">$4,320.00 USD</span>
                </div>
                <div className="w-full bg-zinc-100 h-1 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full" style={{ width: '85%' }} />
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-zinc-650 font-sans font-medium">Bulawayo Store Depot</span>
                  <span className="font-mono font-bold text-zinc-850">$2,410.50 USD</span>
                </div>
                <div className="w-full bg-zinc-100 h-1 rounded-full overflow-hidden">
                  <div className="bg-cyan-500 h-full rounded-full" style={{ width: '55%' }} />
                </div>
              </div>
            </div>

            <div className="bg-white border border-zinc-200 p-2.5 rounded-xl flex flex-col justify-between shadow-xs">
              <span className="text-[7.5px] font-mono font-bold text-zinc-550 uppercase tracking-widest">Active Cashier</span>
              <div className="mt-1">
                <p className="text-[10px] font-bold text-zinc-800 truncate">{customCashier}</p>
                <p className="text-[9px] font-mono text-emerald-600 font-black">$1,540.80</p>
              </div>
            </div>

            <div className="bg-white border border-zinc-200 p-2.5 rounded-xl flex flex-col justify-between shadow-xs">
              <span className="text-[7.5px] font-mono font-bold text-zinc-550 uppercase tracking-widest">Depot Alert</span>
              <div className="mt-1">
                <p className="text-[9px] font-bold text-amber-600 truncate leading-tight">{customProduct}</p>
                <p className="text-[8px] font-mono text-zinc-500">14 bags left</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (isYoutubeAd) {
      return (
        <div className={`${wrapperClass} bg-gradient-to-br from-indigo-50/40 via-zinc-50 to-white p-6 flex flex-row items-center gap-6`}>
          <div className="w-3/5 text-left space-y-4 z-10 pr-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-650 text-white font-bold font-mono text-[9px] uppercase tracking-wider animate-pulse font-bold">
              <Video className="w-3 h-3 shrink-0" />
              On-demand masterclass
            </span>
            <div className="space-y-1">
              <h4 className="text-xl md:text-2xl font-black tracking-tight leading-tight uppercase font-sans text-zinc-900">
                Onboard Cashiers in 60 seconds
              </h4>
              <p className="text-[10px] md:text-xs text-zinc-650 font-semibold animate-fade-in">
                Configure registers, set security groups & lock drawer access PINs.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="bg-zinc-100 border border-zinc-200 text-zinc-700 font-mono font-bold text-[8px] px-2 py-0.5 rounded">
                No Void Access Limit
              </span>
              <span className="bg-zinc-100 border border-zinc-200 text-zinc-700 font-mono font-bold text-[8px] px-2 py-0.5 rounded">
                Strict Drawer Float checks
              </span>
            </div>
          </div>

          <div className="w-2/5 aspect-[4/3] bg-white border border-zinc-205 rounded-xl p-3 shadow-xl flex flex-col justify-between z-10 text-[10px] font-sans">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-1.5 font-mono text-[7.5px] text-zinc-405">
              <span>👤 System Add Employee</span>
              <span className="text-emerald-700 font-extrabold ring-1 ring-emerald-500/20 px-1 py-0.2 rounded bg-emerald-50">Verified</span>
            </div>
            
            <div className="space-y-1.5 py-1">
              <div className="space-y-0.5">
                <span className="text-[7.5px] text-zinc-450 font-bold font-mono uppercase">Operator Name</span>
                <p className="bg-zinc-50 px-2 py-0.5 rounded border border-zinc-150 font-bold truncate text-[10.5px] text-zinc-800">{customCashier}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[7.5px] text-zinc-450 font-bold font-mono uppercase">Assigned pincode</span>
                <p className="bg-zinc-50 px-2 py-0.5 rounded border border-zinc-150 font-mono tracking-widest text-indigo-600">•••• (secured)</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[7.5px] text-zinc-450 font-bold font-mono uppercase">Register assigned</span>
                <p className="bg-zinc-50 px-2 py-0.5 rounded border border-zinc-150 font-mono text-[8.5px] text-cyan-600 truncate">Register Alpha - {customBusiness}</p>
              </div>
            </div>

            <div className="pt-1 border-t border-zinc-150 flex justify-between items-center font-mono text-[8px] text-zinc-400">
              <span className="flex items-center gap-1 font-bold text-emerald-600 uppercase">
                <UserCheck className="w-3 h-3 text-emerald-500 shrink-0" />
                Active profile
              </span>
              <span>v1.2 compliant</span>
            </div>
          </div>
        </div>
      );
    }

    if (isYoutubeCover) {
      return (
        <div className={`${wrapperClass} bg-gradient-to-tr from-cyan-50/20 via-white to-indigo-50/20 p-6 flex flex-col justify-between`}>
          <div className="flex justify-between items-start w-full">
            <TarezaLogo size="sm" showSubtitle={true} variant="light" />
            <span className="text-[9px] font-mono tracking-widest uppercase font-bold text-indigo-700 border border-indigo-200 bg-indigo-50 px-2.5 py-1 rounded-full">
              Academy Channel Art
            </span>
          </div>

          <div className="my-auto text-center space-y-2 px-2">
            <h4 className="text-xl md:text-3xl font-black font-sans leading-none tracking-tight uppercase text-zinc-900">
              The Smart POS Masterclass
            </h4>
            <p className="text-xs text-zinc-650 max-w-lg mx-auto leading-relaxed font-semibold">
              Master cash desk security, daily sales reconciliation reports, multi-depot inventory valuation, and physical audit stocktakes.
            </p>
          </div>

          <div className="w-full flex justify-between items-center border-t border-zinc-200 pt-3 text-[9px] font-mono text-zinc-400">
            <span>🎥 New Video Training Weekly</span>
            <span>Security & Fraud Prevention Systems</span>
          </div>
        </div>
      );
    }

    if (isWhatsappAd) {
      return (
        <div className={`${wrapperClass} bg-indigo-50/20 p-6 flex flex-row items-center gap-6 border border-zinc-205`}>
          <div className="w-1/2 text-left space-y-3 z-10">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 font-bold font-mono text-[9px] uppercase tracking-wider">
              <Smartphone className="w-3.5 h-3.5" />
              Easy Mobile POS
            </span>
            <div className="space-y-1">
              <h4 className="text-lg md:text-xl font-black tracking-tight uppercase leading-tight font-sans text-zinc-900">
                300% Checkout Speed
              </h4>
              <p className="text-[10px] md:text-xs text-zinc-650 font-semibold leading-snug">
                No receipt books, no wait-lines. Tap items on any phone or check out bulk six-packs instantly.
              </p>
            </div>
          </div>

          <div className="w-1/2 p-3 border border-zinc-200 rounded-xl bg-white flex flex-col justify-between shadow-lg min-h-[120px] font-mono text-[10px] space-y-2">
            <div className="flex justify-between items-center border-b border-zinc-100 pb-1.5 text-zinc-400">
              <span className="text-[8px] uppercase tracking-widest text-zinc-500 font-bold">Checkout success</span>
              <span className="font-bold text-teal-600">ZiG {Math.ceil(priceVal * rateVal)}</span>
            </div>

            <div className="flex-1 flex flex-col gap-0.5 justify-center">
              <div className="flex justify-between text-[11px] font-sans font-extrabold text-zinc-800">
                <span className="truncate max-w-[100px]">{customProduct}</span>
                <span className="font-mono font-black text-zinc-900">${priceVal} USD</span>
              </div>
              <div className="flex justify-between text-[10px] font-sans font-semibold text-zinc-500 border-t border-zinc-100 pt-1">
                <span>Rate Auto-Sync:</span>
                <span className="font-mono font-bold text-indigo-650">1: {customRate} ZiG</span>
              </div>
            </div>

            <div className="pt-1.5 border-t border-zinc-100 text-[7.5px] text-zinc-400 text-right font-medium">
              Outlet: {customBusiness}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={wrapperClass}>
        <TarezaLogo size="md" variant="light" />
        <p className="text-xs text-zinc-500 mt-2">Custom Flyer Ready</p>
      </div>
    );
  };

  // Brand Manual States
  const [showBrandManual, setShowBrandManual] = useState(false);
  const [activeManualTab, setActiveManualTab] = useState<'overview' | 'colors' | 'typography' | 'copywriting' | 'guidelines'>('overview');

  // Fetch from Firestore
  const loadAssets = async () => {
    setLoading(true);
    try {
      const fetchedCustom: MarketingAsset[] = [];
      const cachedCustomStr = localStorage.getItem('custom_marketing_assets');
      if (cachedCustomStr) {
        fetchedCustom.push(...JSON.parse(cachedCustomStr));
      }

      if (db && user) {
        try {
          const colRef = collection(db, 'marketing_assets');
          const q = query(colRef, where('userId', '==', user.$id));
          const snap = await getDocs(q);
          snap.forEach((docSnapshot) => {
            const data = docSnapshot.data();
            fetchedCustom.push({
              id: docSnapshot.id,
              name: data.name || 'Untitled Asset',
              type: data.type || 'General Flyer',
              format: data.format || 'Standard',
              imageUrl: data.imageUrl || '/facebook_ad.png',
              caption: data.caption || '',
              tags: data.tags || [],
              isCustom: true,
              versions: data.versions || []
            });
          });
        } catch (dbErr) {
          console.warn('Firestore fetch failed, relying on local storage fallback:', dbErr);
        }
      }

      // Deduplicate by ID
      const uniqueStyles = [...DEFAULT_ASSETS];
      fetchedCustom.forEach(cust => {
        const idx = uniqueStyles.findIndex(x => x.id === cust.id);
        if (idx !== -1) {
          uniqueStyles[idx] = cust; // update default if customized or duplicate
        } else {
          uniqueStyles.push(cust);
        }
      });

      setAssets(uniqueStyles);
    } catch (err) {
      console.error('Error loading marketing assets:', err);
      setAssets(DEFAULT_ASSETS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssets();
  }, [user]);

  const handleCopyLink = (asset: MarketingAsset) => {
    const fullUrl = asset.imageUrl.startsWith('http') 
                        ? asset.imageUrl 
                        : `${window.location.origin}${asset.imageUrl}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(asset.id);
    toast.success('Asset URL copied to clipboard!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyCaption = (asset: MarketingAsset) => {
    navigator.clipboard.writeText(asset.caption);
    setCopiedCaptionId(asset.id);
    toast.success('Social post caption template copied to clipboard!');
    setTimeout(() => setCopiedCaptionId(null), 2000);
  };

  const handleDownload = (asset: MarketingAsset) => {
    // Try downloading via link element
    const link = document.createElement('a');
    link.href = asset.imageUrl;
    link.download = `${asset.name.toLowerCase().replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.info(`Preparing download for: ${asset.name}`);
  };

  const getAssetVersions = (asset: MarketingAsset): AssetVersion[] => {
    if (asset.versions && asset.versions.length > 0) {
      return asset.versions;
    }
    // Fallback release version
    return [
      {
        id: `${asset.id}-v1`,
        versionNumber: 1,
        imageUrl: asset.imageUrl,
        caption: asset.caption,
        createdAt: '2026-06-06T08:00:00Z',
        changelog: 'Initial Release (Template)'
      }
    ];
  };

  const handleRestoreVersion = async (asset: MarketingAsset, version: AssetVersion) => {
    try {
      const updatedAsset = {
        ...asset,
        imageUrl: version.imageUrl,
        caption: version.caption
      };

      if (asset.isCustom) {
        if (db && user) {
          try {
            const docRef = doc(db, 'marketing_assets', asset.id);
            await updateDoc(docRef, { imageUrl: version.imageUrl, caption: version.caption });
          } catch (dbErr) {
            console.warn('Firestore restore failed, updating locally:', dbErr);
          }
        }

        const cached = localStorage.getItem('custom_marketing_assets');
        if (cached) {
          const list = JSON.parse(cached) as MarketingAsset[];
          const idx = list.findIndex(x => x.id === asset.id);
          if (idx !== -1) {
            list[idx] = { ...list[idx], imageUrl: version.imageUrl, caption: version.caption };
            localStorage.setItem('custom_marketing_assets', JSON.stringify(list));
          }
        }
      } else {
        // If they revert a template version, we treat it as customizing that template
        const customizedTemplate: MarketingAsset = {
          ...updatedAsset,
          id: `custom-${asset.id}`,
          isCustom: true,
          versions: getAssetVersions(asset)
        };

        if (db && user) {
          try {
            await addDoc(collection(db, 'marketing_assets'), {
              userId: user.$id,
              templateId: asset.id,
              name: customizedTemplate.name,
              type: customizedTemplate.type,
              format: customizedTemplate.format,
              imageUrl: customizedTemplate.imageUrl,
              caption: customizedTemplate.caption,
              tags: customizedTemplate.tags,
              versions: customizedTemplate.versions,
              created_at: new Date().toISOString()
            });
          } catch (dbErr) {
            console.warn('Could not save customized version:', dbErr);
          }
        }

        const cached = localStorage.getItem('custom_marketing_assets') || '[]';
        const list = JSON.parse(cached) as MarketingAsset[];
        list.push(customizedTemplate);
        localStorage.setItem('custom_marketing_assets', JSON.stringify(list));
      }

      toast.success(`Successfully reverted active fields to Version ${version.versionNumber}!`);
      
      // Update preview state if active
      if (previewAsset && previewAsset.id === asset.id) {
        setPreviewAsset({ ...previewAsset, imageUrl: version.imageUrl, caption: version.caption });
      }
      loadAssets();
    } catch (err) {
      console.error('Error restoring version:', err);
      toast.error('Failed to restore version.');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingAsset) return;
    setIsSaving(true);
    try {
      const { id, name, type, format, imageUrl, caption, tags, isCustom } = editingAsset;
      const cleanChangelog = changelog.trim() || 'Updated content and variations';

      const existingVersions = getAssetVersions(editingAsset);
      const nextVersionNum = existingVersions.length + 1;
      const newVersion: AssetVersion = {
        id: `${id}-v${nextVersionNum}`,
        versionNumber: nextVersionNum,
        imageUrl,
        caption,
        createdAt: new Date().toISOString(),
        changelog: cleanChangelog
      };

      const updatedVersions = [newVersion, ...existingVersions];

      if (isCustom) {
        // Save back to db
        if (db && user) {
          try {
            const docRef = doc(db, 'marketing_assets', id);
            await updateDoc(docRef, { name, type, format, imageUrl, caption, tags, versions: updatedVersions });
          } catch (dbErr) {
            console.warn('Firestore update failed, editing locally:', dbErr);
          }
        }
        
        // Save to localStorage as redundancy
        const cached = localStorage.getItem('custom_marketing_assets');
        if (cached) {
          const list = JSON.parse(cached) as MarketingAsset[];
          const idx = list.findIndex(x => x.id === id);
          if (idx !== -1) {
            list[idx] = { ...list[idx], name, type, format, imageUrl, caption, tags, versions: updatedVersions };
            localStorage.setItem('custom_marketing_assets', JSON.stringify(list));
          }
        }
      } else {
        // If they edited a template asset, save it as their customized version
        const customizedTemplate: MarketingAsset = {
          ...editingAsset,
          id: `custom-${id}`,
          isCustom: true,
          versions: updatedVersions
        };

        if (db && user) {
          try {
            await addDoc(collection(db, 'marketing_assets'), {
              userId: user.$id,
              templateId: id,
              name: customizedTemplate.name,
              type: customizedTemplate.type,
              format: customizedTemplate.format,
              imageUrl: customizedTemplate.imageUrl,
              caption: customizedTemplate.caption,
              tags: customizedTemplate.tags,
              versions: updatedVersions,
              created_at: new Date().toISOString()
            });
          } catch (dbErr) {
            console.warn('Could not save customized template to firestore:', dbErr);
          }
        }

        // Save customized template to localStorage
        const cached = localStorage.getItem('custom_marketing_assets') || '[]';
        const list = JSON.parse(cached) as MarketingAsset[];
        list.push(customizedTemplate);
        localStorage.setItem('custom_marketing_assets', JSON.stringify(list));
      }

      toast.success(`Marketing asset updated. New Version v${nextVersionNum} published!`);
      setEditingAsset(null);
      setChangelog('');
      loadAssets();
    } catch (err) {
      console.error('Error saving asset details:', err);
      toast.error('Failed to update asset.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAssetName || !newAssetUrl) {
      toast.error('Please fill in the name and Image URL / path.');
      return;
    }

    setIsCreating(true);
    try {
      const cleanTags = newAssetTags
        .split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0);

      const generatedId = `custom-asset-${Date.now()}`;
      const newAsset: MarketingAsset = {
        id: generatedId,
        name: newAssetName,
        type: newAssetType,
        format: newAssetFormat,
        imageUrl: newAssetUrl,
        caption: newAssetCaption,
        tags: cleanTags.length > 0 ? cleanTags : ['user-upload'],
        isCustom: true
      };

      // Persist to firestore
      if (db && user) {
        try {
          await addDoc(collection(db, 'marketing_assets'), {
            userId: user.$id,
            name: newAsset.name,
            type: newAsset.type,
            format: newAsset.format,
            imageUrl: newAsset.imageUrl,
            caption: newAsset.caption,
            tags: newAsset.tags,
            created_at: new Date().toISOString()
          });
        } catch (dbErr) {
          console.warn('Firestore custom asset creation failed, using localStorage fallback:', dbErr);
        }
      }

      // Persist to localStorage
      const cached = localStorage.getItem('custom_marketing_assets') || '[]';
      const list = JSON.parse(cached) as MarketingAsset[];
      list.push(newAsset);
      localStorage.setItem('custom_marketing_assets', JSON.stringify(list));

      toast.success('New marketing asset successfully added to inventory!');
      
      // Clear fields
      setNewAssetName('');
      setNewAssetUrl('');
      setNewAssetCaption('');
      setNewAssetTags('');
      loadAssets();
    } catch (err) {
      console.error('Error creating custom asset:', err);
      toast.error('Could not save custom marketing asset.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      if (db && user) {
        try {
          // If Firestore Doc, delete it
          const docRef = doc(db, 'marketing_assets', id);
          await deleteDoc(docRef);
        } catch (err) {
          console.warn('Local/template cleanup only', err);
        }
      }

      // Update localStorage custom list
      const cached = localStorage.getItem('custom_marketing_assets');
      if (cached) {
        const list = JSON.parse(cached) as MarketingAsset[];
        const filtered = list.filter(item => item.id !== id);
        localStorage.setItem('custom_marketing_assets', JSON.stringify(filtered));
      }

      toast.success('Custom asset removed.');
      setDeleteId(null);
      loadAssets();
    } catch (err) {
      console.error('Error deleting asset:', err);
      toast.error('Failed to delete asset.');
    }
  };

  const handlePrintManual = () => {
    const printStyle = document.createElement('style');
    printStyle.id = 'brand-manual-print-layout-style';
    printStyle.innerHTML = `
      @media print {
        body * {
          visibility: hidden !important;
        }
        #brand-manual-print-container, #brand-manual-print-container * {
          visibility: visible !important;
        }
        #brand-manual-print-container {
          position: absolute !important;
          left: 0 !important;
          top: 0 !important;
          width: 100% !important;
          background: white !important;
          color: #000000 !important;
          padding: 1.5cm !important;
          box-shadow: none !important;
          border: none !important;
          display: block !important;
        }
        @page {
          size: A4 portrait;
          margin: 1.5cm;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .page-break {
          page-break-before: always !important;
        }
        .no-print {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(printStyle);
    toast.info('Opening the print settings dialog. Choose "Save as PDF" to download your Brand Manual.');
    
    setTimeout(() => {
      window.print();
      const el = document.getElementById('brand-manual-print-layout-style');
      if (el) el.remove();
    }, 150);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">Marketing Assets</h3>
          <p className="text-sm text-zinc-500 mt-1">
            Access, customize, and share promotional flyers, brand advertisements, and training graphics.
          </p>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadAssets} 
            className="border-zinc-200 text-zinc-700 dark:border-zinc-800 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>

          <Dialog>
            <DialogTrigger render={
              <Button size="sm" className="bg-zinc-900 text-white hover:bg-zinc-800 shadow-sm dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-100 font-medium">
                <Plus className="w-4 h-4 mr-2" />
                Add Custom Asset
              </Button>
            } />
            <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
              <form onSubmit={handleCreateAsset}>
                <DialogHeader>
                  <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-500" />
                    Add Custom Marketing Asset
                  </DialogTitle>
                  <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Store external marketing URLs, flyers, or custom ad mockups with post copies to distribute to your social channels.
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                  <div className="grid gap-1">
                    <label className="text-xs font-semibold text-zinc-650 dark:text-zinc-300">Asset Title</label>
                    <Input 
                      placeholder="e.g. Christmas Promo Banner" 
                      value={newAssetName} 
                      onChange={e => setNewAssetName(e.target.value)}
                      required
                      className="bg-zinc-50/50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 focus:ring-primary h-10 rounded-lg text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-1">
                      <label className="text-xs font-semibold text-zinc-650 dark:text-zinc-300">Format</label>
                      <Input 
                        placeholder="e.g. 1:1 Square, 16:9 Landscape" 
                        value={newAssetFormat} 
                        onChange={e => setNewAssetFormat(e.target.value)}
                        className="bg-zinc-50/50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 focus:ring-primary h-10 rounded-lg text-sm"
                      />
                    </div>

                    <div className="grid gap-1">
                      <label className="text-xs font-semibold text-zinc-650 dark:text-zinc-300">Campaign Channel</label>
                      <select 
                        className="bg-zinc-50/50 dark:bg-zinc-955 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 text-sm h-10 px-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-zinc-900 dark:text-zinc-100"
                        value={newAssetType}
                        onChange={e => setNewAssetType(e.target.value as any)}
                      >
                        <option value="Facebook & Instagram">Facebook / Instagram Flyer</option>
                        <option value="YouTube & Video">YouTube Channel Thumbnail</option>
                        <option value="General Flyer">General Business Flyer</option>
                        <option value="Banner">Website Banner</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-1">
                    <label className="text-xs font-semibold text-zinc-650 dark:text-zinc-300">Image Asset URL / Path</label>
                    <Input 
                      placeholder="e.g. /facebook_ad.png or https://example.com/asset.jpg" 
                      value={newAssetUrl} 
                      onChange={e => setNewAssetUrl(e.target.value)}
                      required
                      className="bg-zinc-50/50 dark:bg-zinc-955 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 focus:ring-primary h-10 rounded-lg text-sm font-mono"
                    />
                  </div>

                  <div className="grid gap-1 font-sans">
                    <label className="text-xs font-semibold text-zinc-650 dark:text-zinc-300">Social Media Caption / Post Template</label>
                    <Textarea 
                      rows={5} 
                      placeholder="Write your promo text here. Ready for fast copying into posts..." 
                      value={newAssetCaption} 
                      onChange={e => setNewAssetCaption(e.target.value)}
                      className="bg-zinc-50/50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 focus:ring-primary rounded-lg text-sm font-sans"
                    />
                  </div>

                  <div className="grid gap-1">
                    <label className="text-xs font-semibold text-zinc-650 dark:text-zinc-300">Tags (comma separated)</label>
                    <Input 
                      placeholder="e.g. promo, seasonal, zim-market" 
                      value={newAssetTags} 
                      onChange={e => setNewAssetTags(e.target.value)}
                      className="bg-zinc-50/50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 focus:ring-primary h-10 rounded-lg text-sm"
                    />
                  </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                  <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
                  <Button type="submit" disabled={isCreating} className="bg-zinc-900 text-white hover:bg-zinc-800">
                    {isCreating ? 'Saving Asset...' : 'Save Marketing Asset'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 📘 Dynamic Brand Manual Hub */}
      <Card className="border-indigo-100/80 dark:border-zinc-800 shadow-md bg-gradient-to-tr from-white to-zinc-50/50 dark:from-zinc-900 dark:to-zinc-900/50 overflow-hidden rounded-2xl no-print">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-5">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-lg">
                  <BookOpen className="w-4 h-4" />
                </span>
                <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center gap-2">
                  Official Brand Manual & Advert Planner
                  <Badge variant="outline" className="text-[10px] uppercase font-bold text-indigo-500 border-indigo-200/50 dark:border-indigo-900/50 bg-indigo-500/10 py-0.5">
                    Kit v1.2
                  </Badge>
                </h4>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-sans">
                A single source of truth for your multi-platform advertising campaigns. View, copy ad hooks, and export as PDF to hand over to external designers.
              </p>
            </div>
            
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button 
                onClick={() => setShowBrandManual(!showBrandManual)} 
                variant="outline" 
                size="sm"
                className="border-zinc-200 dark:border-zinc-800 font-semibold"
              >
                {showBrandManual ? 'Collapse Manual' : 'Expand Brand Guidelines'}
              </Button>
              <Button 
                onClick={handlePrintManual}
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                Export PDF Manual
              </Button>
            </div>
          </div>

          {showBrandManual && (
            <div className="mt-6 flex flex-col md:flex-row gap-6">
              {/* Internal Tabs list */}
              <div className="w-full md:w-48 flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0 shrink-0 border-b md:border-b-0 md:border-r border-zinc-100 dark:border-zinc-800 pr-0 md:pr-4">
                {[
                  { id: 'overview', label: '1. What We Do', icon: BookOpen },
                  { id: 'colors', label: '2. Colors & Identity', icon: Palette },
                  { id: 'typography', label: '3. Typography', icon: Type },
                  { id: 'copywriting', label: '4. Ad Copy Snippets', icon: FileText },
                  { id: 'guidelines', label: '5. Brand Voice Guidelines', icon: Sparkles }
                ].map((tab) => {
                  const TabIcon = tab.icon;
                  const isActive = activeManualTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveManualTab(tab.id as any)}
                      className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                        isActive
                          ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-950 font-black shadow-sm'
                          : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50'
                      }`}
                    >
                      <TabIcon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* Sub-tab view container */}
              <div className="flex-1 min-w-0 bg-white/40 dark:bg-zinc-950/20 p-5 rounded-2xl border border-zinc-100/60 dark:border-zinc-800">
                {activeManualTab === 'overview' && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-50/60 dark:bg-indigo-950/20 rounded-xl">
                        <TarezaLogo size="sm" showSubtitle={false} />
                      </div>
                      <div>
                        <h5 className="text-sm font-bold text-zinc-900 dark:text-white">Product Pitch & Definition</h5>
                        <p className="text-[10px] text-zinc-400 font-mono">CORE CAPABILITIES FOR ADVERTS</p>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-sans">
                      <strong>Tareza ERP</strong> is Zimbabwe&apos;s leading offline-first Enterprise Resource Planning and dynamic Point-of-Sale solution. Built as a fully localized terminal for retail, wholesale, and multi-branch management, it operates on a robust, sandboxed client state database that ensures zero transaction failures even during network drops, and logs instant real-time synchronization once connection resumes.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                      <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block font-sans">Offline-First POS Terminal</span>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal font-sans">
                          Provides stable checkout during power/network downtime. Automatic state synchronization prevents sales loss.
                        </p>
                      </div>
                      <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block font-sans">Local Financial Integration</span>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal font-sans">
                          Inbuilt dual-currency cash tracking (USD & ZiG), plus native EcoCash Biller and InnBucks Business pay handles.
                        </p>
                      </div>
                      <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-widest block font-sans">Leakage & Cashier Control</span>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal font-sans">
                          Individual cashier onboarding, drawer reconciliation, and comprehensive digital logs limit leakage and stock fraud.
                        </p>
                      </div>
                      <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest block font-sans">ZIMRA & Multi-Branch Auditing</span>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal font-sans">
                          Supports multi-warehouse stocktakes, instant branch comparison, tax configurations, and system auditing tools.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeManualTab === 'colors' && (
                  <div className="space-y-4">
                    <h5 className="text-sm font-bold text-zinc-900 dark:text-white">Corporate Color System</h5>
                    <p className="text-xs text-zinc-500 leading-normal font-sans">
                      Our brand colors convey neon high-tech agility paired with rock-solid corporate security. Use these primary hex keys when configuring brand assets on social builders:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                      <div className="flex items-center gap-3 p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#8b00ff] to-[#a855f7] shadow-inner shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-zinc-900 dark:text-white block">Royal Violet (Left Segment)</span>
                          <span className="text-[10px] font-mono text-zinc-400">#8B00FF to #A855F7</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#06b6d4] to-[#2563eb] shadow-inner shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-zinc-900 dark:text-white block">Neon Cyan (Right Segment)</span>
                          <span className="text-[10px] font-mono text-zinc-400">#06B6D4 to #2563EB</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl">
                        <div className="w-12 h-12 rounded-lg bg-[#5c10eb] shadow-inner shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-zinc-900 dark:text-white block">Deep Violet (Sync Stem)</span>
                          <span className="text-[10px] font-mono text-zinc-400">#5C10EB to #4F46E5</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl">
                        <div className="w-12 h-12 rounded-lg bg-zinc-950 dark:bg-black border border-zinc-800 shadow-inner shrink-0" />
                        <div>
                          <span className="text-xs font-bold text-zinc-900 dark:text-white block">Slate Canvas (Theme)</span>
                          <span className="text-[10px] font-mono text-zinc-400">#09090B to #18181B</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeManualTab === 'typography' && (
                  <div className="space-y-4">
                    <h5 className="text-sm font-bold text-zinc-900 dark:text-white">Typography Rules</h5>
                    <p className="text-xs text-zinc-500 leading-normal font-sans">
                      Combining premium readability and raw system performance. In ad visuals, always format headlines and values with these font settings:
                    </p>
                    <div className="space-y-3 mt-2">
                      <div className="p-3.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1.5 font-mono">1. Primary Body & Headlines (Inter Sans)</span>
                        <p className="text-sm font-medium font-sans tracking-tight text-zinc-900 dark:text-white">
                          "Inter" — Legible, geometric, and balanced.
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-sans mt-1">
                          Use for social marketing captions, business emails, website paragraphs, and general buttons. Add tight tracking (`tracking-tight`) for major display headings.
                        </p>
                      </div>
                      <div className="p-3.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl">
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-1.5 font-mono">2. System Data, Stats & Invoices (JetBrains Mono)</span>
                        <p className="text-xs font-semibold font-mono text-zinc-650 dark:text-zinc-300">
                          "JetBrains Mono" — Technical, precise, and numerical.
                        </p>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed font-sans mt-1">
                          Use for transaction amounts (e.g. `$1,420.00 USD`), currency indicators, branch codes, device metadata, and terminal messages.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeManualTab === 'copywriting' && (
                  <div className="space-y-4 font-sans">
                    <h5 className="text-sm font-bold text-zinc-900 dark:text-white">Instantly Copyable Advert Posts</h5>
                    <p className="text-xs text-zinc-500 leading-normal font-sans">
                      Ready-to-use marketing texts designed to convert store owners, retailers, and wholesalers on Facebook, WhatsApp lists, and search networks:
                    </p>
                    <div className="space-y-4 max-h-[220px] overflow-y-auto pr-2 mt-2">
                      {[
                        {
                          title: "Ad Template A: The Offline Retail Solution",
                          text: `Are Zimbabwe's frequent power cuts or network drops locking you out of your shop's critical sales system?

Upgrade to Tareza ERP! Our premium Point of Sale operates completely offline, storing sales securely in your local cash terminal and syncing automatically to the cloud.

✅ Zero sales loss during outages
✅ Integrated USD and ZiG multi-currency logs
✅ Instant end-of-day cash drawer reconciliation

Stop relying on manual receipt logbooks. Get started today! #TarezaERP #ZimbabweBusiness #RetailPOS`
                        },
                        {
                          title: "Ad Template B: For Wholesalers & Multi-Branch Owners",
                          text: `Tired of cashier leakage, stock shrinkage, and inventory mess? 

Manage all your branches, outlets, and central warehouses from a single dashboard. Tareza ERP provides deep multi-branch control:

✅ Real-time stock shortage valuations
✅ In-built physical stocktake audit registers
✅ Automated cashier onboarding in under 60 seconds
✅ High-contrast dashboard charts & reports

Secure your store profits now. Schedule your custom onboarding audit: https://www.tarezaerp.co.zw`
                        },
                        {
                          title: "Ad Template C: Payment Gateways & Mobile POS Ad",
                          text: `Speed up checkouts and simplify cashflow in Zimbabwe! 

Tareza ERP premium POS features built-in payment handles for EcoCash and InnBucks. Avoid manual reference calculations and checkout queues!

✅ Fast EcoCash Biller integration
✅ InnBucks Merchant cash-out processes
✅ Instant cashier-level receipts and audits

Equip your cashiers for success. Visit: https://www.tarezaerp.co.zw #EcoCash #InnBucks #LocalPOS`
                        }
                      ].map((ad, idx) => (
                        <div key={idx} className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 rounded-xl space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-zinc-850 dark:text-zinc-200">{ad.title}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                navigator.clipboard.writeText(ad.text);
                                toast.success("Ad template copied to clipboard!");
                              }}
                              className="text-indigo-500 hover:text-indigo-600 font-bold flex items-center gap-1 h-6 px-2 border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-lg text-[10px]"
                            >
                              <Copy className="w-3 h-3" /> Copy Text
                            </Button>
                          </div>
                          <pre className="text-[10px] text-zinc-500 dark:text-zinc-400 font-sans whitespace-pre-wrap leading-relaxed bg-white dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-850 p-2.5 rounded-lg select-all">
                            {ad.text}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeManualTab === 'guidelines' && (
                  <div className="space-y-4">
                    <h5 className="text-sm font-bold text-zinc-900 dark:text-white">Corporate Voice & Style Guidelines</h5>
                    <p className="text-xs text-zinc-500 leading-normal font-sans">
                      Our communications are structured to maintain high trust with retail entrepreneurs. When writing ads or managing agencies:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                      <div className="p-3 bg-emerald-50/10 dark:bg-emerald-950/10 border border-emerald-500/15 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block font-sans">DO: Talk About Safety & Security Auditing</span>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-normal font-sans">
                          Emphasize total protection from cashier leakage, visual sales performance, simple reconciliation steps, and offline continuity.
                        </p>
                      </div>
                      <div className="p-3 bg-rose-50/10 dark:bg-rose-950/10 border border-rose-500/15 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest block font-sans">DON&apos;T: Use Excessive Technical Jargon</span>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-normal font-sans">
                          Avoid listing internal database tables, network protocols, or hosting setups. Focus purely on easy, non-technical onboarding for retail workers.
                        </p>
                      </div>
                      <div className="p-3 bg-blue-50/10 dark:bg-blue-950/10 border border-blue-500/15 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block font-sans">DO: Target Local Pain Points</span>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-normal font-sans">
                          Auntie shops and multi-warehouse managers require localized payments, offline continuity due to power dropouts, and multi-currency tracking.
                        </p>
                      </div>
                      <div className="p-3 bg-amber-50/10 dark:bg-amber-950/10 border border-amber-500/15 rounded-xl space-y-1">
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest block font-sans">DON&apos;T: Brand Hyperbolically</span>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-normal font-sans">
                          Never promise unrealistic returns or claim to be "100% immune to tax audits." Be a secure, compliant partner helping drive visual efficiency.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 📄 Elegant, Print-Only Brand Manual (Becomes visible ONLY during printing) */}
      <div id="brand-manual-print-container" className="hidden font-sans">
        {/* Cover Page */}
        <div className="space-y-6 flex flex-col justify-center min-h-[96vh] justify-between border-b border-zinc-200 pb-12">
          <div className="pb-10 border-b-2 border-zinc-200">
            <TarezaLogo size="xl" showSubtitle={true} variant="light" />
          </div>
          
          <div className="space-y-4 pt-12 flex-1">
            <h1 className="text-5xl font-black text-zinc-900 tracking-tight leading-none uppercase">Brand Manual</h1>
            <h2 className="text-xl font-mono font-bold text-zinc-500 tracking-wider uppercase">Official Corporate Identity & Advert Planning Guide</h2>
            <p className="text-sm text-zinc-600 max-w-2xl font-sans pt-6 leading-relaxed">
              This document serves as the absolute visual and strategic blueprint for Tareza ERP. It contains core product value pitches, copywriting templates, social guidelines, color assets, and typography definitions for executing third-party platform marketing campaigns.
            </p>
          </div>

          <div className="pt-8 font-mono text-[11px] text-zinc-400 flex justify-between">
            <span>© 2026 Tareza ERP Zimbabwe</span>
            <span>Version 1.2 • Published: June 2026</span>
          </div>
        </div>

        {/* Page 2: What We Do & Color Philosophy */}
        <div className="page-break space-y-8 pt-8">
          <div className="flex justify-between items-center border-b border-zinc-200 pb-4">
            <TarezaLogo size="sm" showSubtitle={false} variant="light" />
            <span className="text-zinc-400 text-xs font-mono font-bold uppercase tracking-widest">01. Corporate Pitch & Colors</span>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">1. Pitch: What We Do</h3>
              <p className="text-sm text-zinc-600 leading-relaxed font-sans">
                <strong>Tareza ERP</strong> is Zimbabwe&apos;s leading offline-first Point of Sale (POS) and Enterprise Resource Planning tool. Built carefully to survive frequent grid outages, it protects retailers, wholesalers, and multi-branch companies by sandboxing transaction logs locally and synchronizing them once internet resumes. Inbuilt mobile handles like EcoCash Biller and InnBucks Merchant are fully supported alongside USD & ZiG currency auditing.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4">
              <div className="border border-zinc-200 p-4 rounded-xl space-y-1 bg-zinc-50">
                <span className="text-[10px] font-bold text-zinc-900 uppercase tracking-widest font-mono">Value Prop 1: Offline Continuity</span>
                <p className="text-[11px] text-zinc-650 leading-relaxed font-sans">
                  Stable checkout terminals remain functional when the network is down. Total client-state sandboxing stops sales leakage.
                </p>
              </div>
              <div className="border border-zinc-200 p-4 rounded-xl space-y-1 bg-zinc-50">
                <span className="text-[10px] font-bold text-zinc-900 uppercase tracking-widest font-mono">Value Prop 2: Zimbabwe Payments Handles</span>
                <p className="text-[11px] text-zinc-650 leading-relaxed font-sans">
                  Allows cashiers to record USD and ZiG cash values easily and interact natively with EcoCash and InnBucks terminals.
                </p>
              </div>
              <div className="border border-zinc-200 p-4 rounded-xl space-y-1 bg-zinc-50">
                <span className="text-[10px] font-bold text-zinc-900 uppercase tracking-widest font-mono">Value Prop 3: Team & Cashier Control</span>
                <p className="text-[11px] text-zinc-650 leading-relaxed font-sans">
                  Individual cashier-by-cashier logins, drawer levels audit logs, physical stocktaking auditing, and multi-outlet comparisons.
                </p>
              </div>
              <div className="border border-zinc-200 p-4 rounded-xl space-y-1 bg-zinc-50">
                <span className="text-[10px] font-bold text-zinc-900 uppercase tracking-widest font-mono">Value Prop 4: Visual Dashboards</span>
                <p className="text-[11px] text-zinc-650 leading-relaxed font-sans">
                  Real-time branch telemetry, profit & loss tables, inventory thresholds control, and audit logs.
                </p>
              </div>
            </div>

            <div className="pt-6">
              <h3 className="text-xl font-bold text-zinc-900 mb-2">2. Corporate Color Palette</h3>
              <p className="text-sm text-zinc-600 leading-relaxed font-sans mb-4">
                These primary colors have been digitally selected to inspire technical excellence, security, and real-time synchronization. Use these HEX and RGB profiles during design work:
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 border border-zinc-200 rounded-xl bg-zinc-50">
                  <div className="w-10 h-10 rounded-lg bg-indigo-600 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-zinc-950 block font-sans">Royal Violet</span>
                    <span className="text-[10px] font-mono text-zinc-500">HEX #8B00FF / #A855F7</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 border border-zinc-200 rounded-xl bg-zinc-50">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500 shrink-0" />
                  <div>
                    <span className="text-xs font-bold text-zinc-950 block font-sans">Neon Cyan</span>
                    <span className="text-[10px] font-mono text-zinc-500">HEX #06B6D4 / #2563EB</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Page 3: Typography & Copywriting Snippets */}
        <div className="page-break space-y-8 pt-8">
          <div className="flex justify-between items-center border-b border-zinc-200 pb-4">
            <TarezaLogo size="sm" showSubtitle={false} variant="light" />
            <span className="text-zinc-400 text-xs font-mono font-bold uppercase tracking-widest">02. Copy & Typography</span>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-bold text-zinc-900 mb-2">3. Typography Guidelines</h3>
              <p className="text-xs text-zinc-650 leading-relaxed mb-3">
                Maintaining solid typography ensures high trustworthiness and clean readability for business operators:
              </p>
              <ul className="list-disc pl-5 text-xs text-zinc-600 space-y-1 font-sans">
                <li><strong>Headline Formats (Inter Sans):</strong> Configure visual copy with thick display tracking (`tracking-tight`) and bold formats to express strength and efficiency.</li>
                <li><strong>Numerical Formats (JetBrains Mono):</strong> Format invoice values, prices, exchange values, and transactional logs using monospaced fonts to project technical security.</li>
              </ul>
            </div>

            <div className="pt-4 border-t border-zinc-200 font-sans">
              <h3 className="text-xl font-bold text-zinc-900 mb-3">4. Advertising Post Templates</h3>
              <p className="text-xs text-zinc-650 leading-relaxed mb-4">
                These ready-to-publish copywriting snippets can be directly copy-pasted across Facebook, WhatsApp campaigns, and LinkedIn circles:
              </p>
              <div className="space-y-4">
                <div className="p-4 border border-zinc-200 rounded-xl bg-zinc-50">
                  <span className="text-[10px] font-bold text-zinc-900 uppercase tracking-widest font-mono block mb-1">Copy Hook A: The Offline Retail POS Solution</span>
                  <p className="text-[10.5px] text-zinc-600 leading-normal font-sans italic whitespace-pre-wrap">
                    Are Zimbabwe&apos;s frequent power cuts or network drops locking you out of your shop&apos;s critical sales system? Upgrade to Tareza ERP! Our premium Point of Sale operates completely offline, storing sales securely in your local cash terminal and syncing automatically to the cloud.
                  </p>
                </div>
                
                <div className="p-4 border border-zinc-200 rounded-xl bg-zinc-50">
                  <span className="text-[10px] font-bold text-zinc-900 uppercase tracking-widest font-mono block mb-1">Copy Hook B: Wholesalers & Multi-Outlet Managers</span>
                  <p className="text-[10.5px] text-zinc-600 leading-normal font-sans italic whitespace-pre-wrap">
                    Manage all your branches, outlets, and central warehouses from a single dashboard. Tareza ERP provides deep multi-branch control: Real-time stock shortage valuations, inbuilt physical stocktake audit registers, and automated cashier onboarding.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 📽️ Branded Video Walkthrough Simulator & Marketing Deck */}
      <div className="bg-zinc-950 text-white border border-zinc-850 rounded-3xl p-6 shadow-2xl no-print space-y-6 relative overflow-hidden">
        {/* Subtle decorative glowing backdrops */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-zinc-900">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1 px-2 bg-indigo-500/20 text-indigo-400 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                <Video className="w-3.5 h-3.5" />
                Live Walkthrough Studio
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">YouTube & Facebook Creator</span>
            </div>
            <h3 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
              Branded Walkthrough Video Simulators
            </h3>
            <p className="text-xs text-zinc-400 max-w-xl">
              Use these interactive walkthrough decks with our official logo and copy parameters to capture high-converting promo video frames for YouTube masterclasses or Facebook ad reels.
            </p>
          </div>

          {/* Video Selector list */}
          <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
            {PLAYABLE_VIDEOS.map((video, idx) => {
              const isActive = activeVideoIndex === idx;
              return (
                <button
                  key={video.id}
                  onClick={() => {
                    setActiveVideoIndex(idx);
                    setVideoPlayProgress(0);
                    setVideoPlaying(false);
                    setVideoStep(0);
                  }}
                  className={`px-4 py-2 rounded-xl text-left text-xs font-bold transition-all border ${
                    isActive
                      ? 'bg-zinc-800 text-white border-zinc-700 shadow-md ring-2 ring-indigo-500/50 font-black'
                      : 'bg-zinc-900/60 text-zinc-400 border-zinc-900 hover:text-white hover:bg-zinc-900'
                  }`}
                >
                  <div className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono mb-0.5">{video.platform}</div>
                  <div className="flex items-center gap-1.5 justify-between">
                    <span>{video.title}</span>
                    <span className="text-[10px] font-mono font-semibold bg-zinc-950 px-1 py-0.2 rounded text-zinc-500">{video.duration}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Video Companion Area */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          
          {/* Main Cinematic 16:9 Video Player Simulation (7 cols) */}
          <div className="xl:col-span-7 flex flex-col space-y-4">
            <div className="relative aspect-[16/9] w-full bg-zinc-950 rounded-2xl border border-zinc-800/80 overflow-hidden flex flex-col justify-between shadow-inner group">
              
              {/* Top Bar Watermark / Status */}
              <div className="p-3 bg-zinc-950/80 border-b border-zinc-900/50 backdrop-blur-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TarezaLogo size="sm" showSubtitle={false} />
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
                    • BRAND VIDEO SIMULATOR
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[9px] font-bold text-zinc-400 font-mono">REC STREAM</span>
                  </div>
                  <Badge variant="outline" className="border-zinc-800 text-[9px] font-mono py-0 text-zinc-400 bg-zinc-900">
                    {PLAYABLE_VIDEOS[activeVideoIndex].platform}
                  </Badge>
                </div>
              </div>

              {/* Dynamic Widescreen Visual Sandbox Display */}
              <div className="flex-1 flex flex-col items-center justify-center p-6 relative">
                
                {/* 1. Cashier Speed Onboarding Graphics */}
                {PLAYABLE_VIDEOS[activeVideoIndex].id === 'cashier-onboarding' && (
                  <div className="w-full max-w-sm bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 shadow-2xl animate-fade-in space-y-3 font-sans text-xs">
                    {videoStep === 0 && (
                      <div className="space-y-2 text-center py-4 animate-pulse">
                        <div className="mx-auto w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                          <Trash2 className="w-5 h-5 text-red-500" />
                        </div>
                        <h4 className="font-bold text-red-400">Drawer Sales Leakage Warning</h4>
                        <p className="text-[10px] text-zinc-400 leading-normal max-w-xs mx-auto">
                          Pretest audits reveal traditional counters lose up to 15% due to untracked manual calculations, missing receipts, and cashier pins sharing.
                        </p>
                      </div>
                    )}
                    {videoStep === 1 && (
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-center border-b border-zinc-800 pb-1.5">
                          <span className="font-bold text-[10px] text-indigo-400 uppercase tracking-wider">Fast Employee Record Entry</span>
                          <span className="text-[9px] font-mono text-zinc-500">Auto PIN generation</span>
                        </div>
                        <div className="space-y-1.5 font-mono">
                          <div className="flex justify-between text-[11px] py-1 border-b border-zinc-850">
                            <span className="text-zinc-500">Employee Name:</span>
                            <span className="text-white font-bold animate-pulse">Tinashe Moyo</span>
                          </div>
                          <div className="flex justify-between text-[11px] py-1 border-b border-zinc-850">
                            <span className="text-zinc-500">Private Terminal PIN:</span>
                            <span className="text-emerald-400 font-bold">● ● ● ● (6139)</span>
                          </div>
                          <div className="flex justify-between text-[11px]">
                            <span className="text-zinc-500">Access Tier:</span>
                            <span className="text-indigo-400 font-semibold uppercase text-[10px]">Active Drawer Cashier</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {videoStep === 2 && (
                      <div className="space-y-2 text-center py-3">
                        <div className="mx-auto w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center">
                          <Laptop className="w-5 h-5 text-cyan-400" />
                        </div>
                        <h4 className="font-bold text-cyan-300">Register Authorization Complete</h4>
                        <div className="flex items-center justify-center gap-1.5 py-1 text-[10px] text-zinc-300 font-mono">
                          <span className="bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-indigo-400">Terminal: Register Alpha</span>
                          <span className="bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800 text-emerald-400">Harare HQ</span>
                        </div>
                        <p className="text-[9px] text-zinc-400">Floating limits locked to this work station successfully.</p>
                      </div>
                    )}
                    {videoStep === 3 && (
                      <div className="space-y-2 text-center py-2">
                        <div className="mx-auto w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center animate-bounce">
                          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                        </div>
                        <h4 className="font-bold text-emerald-400">Workforce Onboarding Activated!</h4>
                        <p className="text-[10px] text-zinc-300 max-w-xs mx-auto leading-normal">
                          Full transparency registered: Compliant, secure, and ready to go in Harare Branch. Leakage risk lowered to 0.00%.
                        </p>
                        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] py-1 rounded max-w-[180px] mx-auto font-mono uppercase tracking-wider">
                          Ready for Counter 1
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Offline Sales Defense Suite Graphics */}
                {PLAYABLE_VIDEOS[activeVideoIndex].id === 'offline-defense' && (
                  <div className="w-full max-w-sm bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 shadow-2xl animate-fade-in space-y-3 font-sans text-xs">
                    {videoStep === 0 && (
                      <div className="space-y-3 text-center py-4">
                        <div className="flex justify-center items-center gap-3">
                          <div className="text-emerald-500 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg text-[10px] font-mono">
                            <Wifi className="w-3.5 h-3.5 animate-pulse" /> CLOUD SYNC: ON
                          </div>
                          <span className="text-[10px] text-zinc-400 font-mono">Ping: 14ms</span>
                        </div>
                        <h4 className="font-bold text-zinc-100">Standard Cloud Operations</h4>
                        <p className="text-[10px] text-zinc-400 max-w-xs mx-auto leading-normal">
                          Tareza constantly monitors connection health to Firestore databases, loading products and cashier logs globally.
                        </p>
                      </div>
                    )}
                    {videoStep === 1 && (
                      <div className="space-y-2 text-center py-4 animate-pulse">
                        <div className="mx-auto w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                          <WifiOff className="w-5 h-5 text-red-500 animate-bounce" />
                        </div>
                        <h4 className="font-bold text-red-400">ZESA / Internet Grid Failure!</h4>
                        <p className="text-[10px] text-zinc-400 leading-normal max-w-xs mx-auto">
                          CRITICAL: Connection lost! Traditional checkout systems freeze immediately. But look—Tareza stays fully operational!
                        </p>
                      </div>
                    )}
                    {videoStep === 2 && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center border-b border-zinc-850 pb-1.5">
                          <span className="bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 text-[9px] font-semibold font-mono flex items-center gap-1">
                            <WifiOff className="w-3 h-3" /> OFFLINE TERMINAL
                          </span>
                          <span className="text-[9px] font-mono text-zinc-500">Local Sandbox Driver</span>
                        </div>
                        <div className="p-2 border border-zinc-800 bg-zinc-950 rounded-lg space-y-1">
                          <div className="flex justify-between font-mono text-[10px] text-zinc-300">
                            <span>Item: Mazoe Peach Syrup 2L</span>
                            <span className="text-white">$3.50</span>
                          </div>
                          <div className="flex justify-between font-mono text-[9px] text-emerald-400 border-t border-zinc-900 pt-1">
                            <span>Local Cache Status:</span>
                            <span className="font-bold">SECURED AT LOCALSTORAGE</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {videoStep === 3 && (
                      <div className="space-y-3 text-center py-2 animate-fade-in">
                        <div className="flex justify-center items-center gap-1.5 text-emerald-400 text-xs font-bold bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-bounce" /> Connection Restored! Auto-Sync Successful
                        </div>
                        <p className="text-[10px] text-zinc-300 max-w-xs mx-auto">
                          The client container instantly flashed 1 safe offline transaction back to our cloud. Zero sales lost, zero cashier discrepancies found.
                        </p>
                        <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] py-1 rounded max-w-[150px] mx-auto font-mono uppercase tracking-wider">
                          Db Fully Synced
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 3. ZiG Dual-Pricing & Exchange Rate Auto-Sync Graphics */}
                {PLAYABLE_VIDEOS[activeVideoIndex].id === 'dual-pricing-rate' && (
                  <div className="w-full max-w-sm bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 shadow-2xl animate-fade-in space-y-3 font-sans text-xs">
                    {videoStep === 0 && (
                      <div className="space-y-2 text-center py-4">
                        <div className="mx-auto w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center">
                          <Calculator className="w-5 h-5 text-rose-500" />
                        </div>
                        <h4 className="font-bold text-rose-400">Multi-Currency Friction</h4>
                        <p className="text-[10px] text-zinc-400 leading-normal max-w-xs mx-auto">
                          Fluctuating pricing values on Harare shelves drive clients away and make bookkeeping validation and cashier reconciliation a living nightmare.
                        </p>
                      </div>
                    )}
                    {videoStep === 1 && (
                      <div className="space-y-2.5">
                        <div className="flex justify-between items-center border-b border-zinc-800 pb-1.5">
                          <span className="font-bold text-[10px] text-indigo-400 uppercase tracking-widest">Base Value Setting</span>
                          <span className="text-[9px] font-mono text-indigo-400 bg-indigo-500/10 px-1.5 py-0.2 rounded">USD Base</span>
                        </div>
                        <div className="p-2 border border-zinc-850 bg-zinc-950/80 rounded-lg space-y-1 font-mono text-zinc-300">
                          <div className="flex justify-between text-[11px]">
                            <span>Product Item Selection:</span>
                            <span className="text-white font-bold">Mazoe Peach Syrup 2L</span>
                          </div>
                          <div className="flex justify-between text-[11px] pt-1">
                            <span>Configured Base USD:</span>
                            <span className="text-yellow-400 font-black">$3.50</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {videoStep === 2 && (
                      <div className="space-y-2 text-center py-2">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest block">Harare Exchange Rate Multiplier Shift</span>
                        <div className="p-3 bg-zinc-950 border border-zinc-850 rounded-xl space-y-1">
                          <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                            <span>Adjusted Multiplier:</span>
                            <span className="font-bold text-indigo-400">1 USD = 13.50 ZiG</span>
                          </div>
                          <div className="h-1.5 bg-zinc-900 rounded-full overflow-hidden mt-1 relative">
                            <div className="absolute top-0 left-0 bottom-0 bg-gradient-to-r from-indigo-505 to-indigo-500 w-[60%] rounded-full" />
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-zinc-900 mt-2 font-mono">
                            <span className="text-zinc-500 text-[10px]">Auto ZiG Total:</span>
                            <span className="text-white text-sm font-black bg-indigo-500/15 p-1 rounded border border-indigo-500/30">
                              47.25 ZiG
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                    {videoStep === 3 && (
                      <div className="space-y-2">
                        <div className="flex justify-between items-center border-b border-zinc-800 pb-1.5 font-mono text-[9px] text-zinc-500">
                          <span>ZiG Compliance Mode</span>
                          <span className="text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Compliant
                          </span>
                        </div>
                        <div className="p-2 border border-zinc-800 bg-zinc-950 rounded-lg space-y-1 font-mono">
                          <div className="flex justify-between text-[10px] text-zinc-400">
                            <span>Total Due EcoCash:</span>
                            <span className="text-white font-bold">47.25 ZiG</span>
                          </div>
                          <div className="flex justify-between text-[10px] text-zinc-400">
                            <span>Total Due USD Cash:</span>
                            <span className="text-white font-bold">$3.50</span>
                          </div>
                          <div className="border-t border-zinc-900 pt-1 flex justify-between text-[10px] text-emerald-400 font-black">
                            <span>Cashier Drawer Compliant:</span>
                            <span>YES</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>

              {/* Subtitle / Narrative Voice Bubble (Always visible at player bottom) */}
              <div className="p-4 bg-zinc-900/90 border-t border-zinc-900/80 backdrop-blur-md flex flex-col space-y-1 font-sans">
                <span className="text-[10px] font-bold text-indigo-400 tracking-wider uppercase flex items-center gap-1">
                  <Volume2 className="w-3.5 h-3.5 animate-bounce" /> Subtitles / Narrator voice
                </span>
                <p className="text-sm font-semibold text-zinc-100 leading-normal">
                  "{PLAYABLE_VIDEOS[activeVideoIndex].steps[videoStep].subtitle}"
                </p>
              </div>

              {/* Video Timeline Progress Meter */}
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-900 z-20">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-300"
                  style={{ width: `${videoPlayProgress}%` }}
                />
              </div>

            </div>

            {/* Playback Controls & Utility Belt */}
            <div className="bg-zinc-900/40 border border-zinc-850 p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                {videoPlaying ? (
                  <Button
                    onClick={() => setVideoPlaying(false)}
                    variant="outline"
                    className="h-9 px-4 bg-white/5 border-zinc-800 text-white font-bold text-xs hover:bg-white/10"
                  >
                    <Pause className="w-4 h-4 mr-1.5" /> Pause
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      if (videoPlayProgress >= 100) setVideoPlayProgress(0);
                      setVideoPlaying(true);
                    }}
                    className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs shadow-md"
                  >
                    <Play className="w-4 h-4 mr-1.5" /> Play Walkthrough
                  </Button>
                )}

                <Button
                  onClick={() => {
                    setVideoPlayProgress(0);
                    setVideoStep(0);
                    setVideoPlaying(false);
                  }}
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 bg-white/5 border-zinc-800 text-zinc-400 hover:text-white"
                  title="Replay Video"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>

              {/* Timestamps */}
              <div className="flex items-center gap-1.5 font-mono text-zinc-500 text-xs font-semibold">
                <span>0:{videoPlayProgress < 10 ? `0${Math.floor(videoPlayProgress * 0.12)}` : Math.floor(videoPlayProgress * 0.12)}</span>
                <span>/</span>
                <span>{PLAYABLE_VIDEOS[activeVideoIndex].duration}</span>
              </div>
            </div>
          </div>

          {/* Marketing Copy and Ad Script (5 cols) */}
          <div className="xl:col-span-5 flex flex-col justify-between space-y-4">
            
            {/* Ad Script Panel */}
            <div className="bg-zinc-900/70 border border-zinc-850 rounded-2xl p-4 flex-1 space-y-4">
              <div className="flex justify-between items-start border-b border-zinc-850 pb-3">
                <div>
                  <h4 className="text-xs font-mono font-bold text-indigo-400 uppercase tracking-widest">
                    Voiceover & Marketing Script
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-1 font-sans">
                    Give this script to your video editors, voice actresses, or speak directly during recording.
                  </p>
                </div>
              </div>

              {/* Subtitle milestones */}
              <div className="space-y-2">
                {PLAYABLE_VIDEOS[activeVideoIndex].steps.map((step, idx) => {
                  const isCurrent = videoStep === idx;
                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setVideoStep(idx);
                        setVideoPlayProgress(idx * 25 + 5);
                        setVideoPlaying(false);
                      }}
                      className={`p-2.5 rounded-xl border text-xs leading-normal font-sans cursor-pointer transition-all ${
                        isCurrent
                          ? 'bg-zinc-800/80 border-indigo-500/55 text-white font-bold ring-1 ring-indigo-500/25'
                          : 'bg-zinc-950/40 border-zinc-900 text-zinc-500 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] font-mono font-bold text-indigo-400 uppercase tracking-wider">
                          Scene {idx + 1}
                        </span>
                        {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-ping" />}
                      </div>
                      <p>"{step.subtitle}"</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Ready-to-Publish Caption */}
            <div className="bg-zinc-900/50 border border-zinc-850 p-4 rounded-xl space-y-3 font-sans">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest">
                  YouTube & Facebook Post Copy
                </span>
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(PLAYABLE_VIDEOS[activeVideoIndex].caption);
                    toast.success('Capywriting copy block successfully copied!');
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px] px-2 text-zinc-400 hover:text-white flex items-center gap-1 border border-zinc-800 hover:bg-zinc-800"
                >
                  <Copy className="w-3 h-3" /> Copy Caption
                </Button>
              </div>
              <div className="p-3 bg-zinc-950/80 rounded-lg border border-zinc-900 max-h-32 overflow-y-auto">
                <p className="text-[11px] text-zinc-400 leading-normal whitespace-pre-wrap font-sans">
                  {PLAYABLE_VIDEOS[activeVideoIndex].caption}
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 🚀 Dynamic High-Fidelity Ad Customizer Panel */}
      <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800 rounded-2xl p-6 shadow-sm no-print space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50 tracking-tight flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-indigo-500 animate-pulse" />
              Dynamic Real-Time Ad Customizer
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Toggle between static mockup graphic links and real-time CSS adverts featuring the inside of our system.
            </p>
          </div>

          <div className="bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200/60 dark:border-zinc-850 flex items-center gap-1 shrink-0 self-stretch sm:self-auto justify-between sm:justify-start">
            <button
              onClick={() => setViewMode('live')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'live'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm font-black'
                  : 'text-zinc-500 dark:text-zinc-450 hover:text-zinc-850'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              🎨 Live Vector Ad Posters
            </button>
            <button
              onClick={() => setViewMode('static')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'static'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm font-black'
                  : 'text-zinc-500 dark:text-zinc-450 hover:text-zinc-855'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5 text-zinc-500" />
              🖼️ Static Image Files
            </button>
          </div>
        </div>

        {viewMode === 'live' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-3 border-t border-zinc-200/60 dark:border-zinc-800/80">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                <Store className="w-3.5 h-3.5 text-indigo-400" />
                Active Branch Name
              </label>
              <Input
                value={customBusiness}
                onChange={(e) => setCustomBusiness(e.target.value)}
                className="bg-white dark:bg-zinc-950 h-9 text-xs rounded-lg font-medium border-zinc-200 dark:border-zinc-805"
                placeholder="branch name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                Featured Store Item
              </label>
              <Input
                value={customProduct}
                onChange={(e) => setCustomProduct(e.target.value)}
                className="bg-white dark:bg-zinc-950 h-9 text-xs rounded-lg font-medium border-zinc-200 dark:border-zinc-805"
                placeholder="featured product"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-cyan-400" />
                USD Value ($)
              </label>
              <Input
                type="number"
                step="0.01"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className="bg-white dark:bg-zinc-950 h-9 text-xs rounded-lg font-mono border-zinc-200 dark:border-zinc-805"
                placeholder="price in usd"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
                USD : ZiG Multiplier
              </label>
              <Input
                type="number"
                step="0.1"
                value={customRate}
                onChange={(e) => setCustomRate(e.target.value)}
                className="bg-white dark:bg-zinc-950 h-9 text-xs rounded-lg font-mono border-zinc-200 dark:border-zinc-805"
                placeholder="exchange rate multiplier"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-pink-400" />
                Assigned Cashier
              </label>
              <Input
                value={customCashier}
                onChange={(e) => setCustomCashier(e.target.value)}
                className="bg-white dark:bg-zinc-950 h-9 text-xs rounded-lg font-medium border-zinc-200 dark:border-zinc-805"
                placeholder="cashier operator"
              />
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center space-y-2">
          <div className="w-8 h-8 rounded-full border-2 border-t-zinc-800 border-zinc-200 animate-spin" />
          <p className="text-xs text-zinc-500 font-mono">Synchronizing promotional catalog...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {assets.map((asset) => (
            <Card key={asset.id} className="border-zinc-200/60 dark:border-zinc-800 shadow-sm overflow-hidden flex flex-col group hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
              {/* Media Container */}
              <div 
                className="relative aspect-[16/10] bg-zinc-950 border-b border-zinc-100 dark:border-zinc-850 flex items-center justify-center overflow-hidden cursor-zoom-in group/media"
                onClick={() => setPreviewAsset(asset)}
                title="Click to preview full-resolution"
              >
                {viewMode === 'live' ? (
                  renderLivePoster(asset)
                ) : (
                  <img 
                    src={asset.imageUrl} 
                    alt={asset.name} 
                    className="object-contain w-full h-full max-h-full transition-transform group-hover/media:scale-[1.03] duration-300"
                    referrerPolicy="no-referrer"
                  />
                )}
                
                {/* Hover zoom/eye overlay */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/media:opacity-100 flex items-center justify-center transition-opacity duration-200">
                  <div className="bg-white/10 dark:bg-black/40 backdrop-blur-md rounded-full p-3 border border-white/20 shadow-lg text-white transform scale-90 group-hover/media:scale-100 transition-all duration-200">
                    <Eye className="w-5 h-5 text-zinc-100" />
                  </div>
                  <span className="absolute bottom-3 text-[10px] font-bold text-zinc-100 uppercase tracking-widest bg-zinc-900/80 backdrop-blur px-2.5 py-1 rounded-full border border-zinc-800">
                    View Fullscreen Preview
                  </span>
                </div>

                <div className="absolute top-3 left-3 flex gap-2 z-10">
                  <Badge className="bg-zinc-900/90 text-white dark:bg-zinc-100 dark:text-zinc-950 border-none font-semibold text-[10px] tracking-wide uppercase px-2 py-1">
                    {asset.type}
                  </Badge>
                  <Badge variant="outline" className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border-zinc-200/50 text-zinc-700 dark:text-zinc-200 text-[10px] py-1 font-mono">
                    {asset.format}
                  </Badge>
                </div>

                {asset.isCustom && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 z-10">
                    <Badge className="bg-indigo-500 text-white text-[10px] border-none font-bold uppercase tracking-widest px-2.5 py-1">Custom</Badge>
                    <Button 
                      variant="destructive" 
                      size="icon-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(asset.id);
                      }}
                      className="h-7 w-7 rounded-full bg-red-650 opacity-90 hover:opacity-100 shadow-md text-white border-none"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Asset Info */}
              <CardHeader className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-base font-bold text-zinc-900 dark:text-zinc-100 tracking-tight leading-snug">
                      {asset.name}
                    </CardTitle>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {asset.tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center text-[10px] font-semibold text-zinc-500 uppercase tracking-widest border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-full px-2 py-0.5">
                          <Tag className="w-2.5 h-2.5 mr-1" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardHeader>

              {/* Post Caption Preview */}
              <div className="p-5 flex-1 bg-zinc-50/50 dark:bg-zinc-950/20 text-xs text-zinc-650 dark:text-zinc-400 font-sans leading-relaxed border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex justify-between items-center mb-2.5">
                  <span className="font-semibold text-zinc-500 text-[10px] uppercase tracking-wider flex items-center">
                    <FileText className="w-3.5 h-3.5 mr-1.5 text-zinc-400" />
                    Promotional Copy Text
                  </span>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="icon-sm" 
                      onClick={() => setEditingAsset(asset)}
                      title="Edit Caption Copy"
                      className="h-7 w-7 rounded-lg border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <Edit className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-300" />
                    </Button>

                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleCopyCaption(asset)}
                      className="text-primary hover:text-primary-foreground text-[11px] font-semibold flex items-center gap-1.5 h-7 px-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-lg"
                    >
                      {copiedCaptionId === asset.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copy Caption
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <div className="bg-white dark:bg-zinc-950 border border-zinc-200/55 dark:border-zinc-800/80 p-3.5 rounded-xl max-h-[140px] overflow-y-auto whitespace-pre-wrap select-text scrollbar-thin scrollbar-thumb-zinc-200 dark:scrollbar-thumb-zinc-800">
                  {asset.caption || 'No copy written yet. Click edit to draft a personalized copy.'}
                </div>
              </div>

              {/* Actions Footer */}
              <CardContent className="p-4 grid grid-cols-2 gap-3 bg-zinc-50/20 dark:bg-zinc-950/40">
                <Button 
                  onClick={() => handleCopyLink(asset)}
                  variant="outline" 
                  className="font-semibold text-xs py-2 rounded-xl border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100/80"
                >
                  {copiedId === asset.id ? (
                    <>
                      <Check className="w-4 h-4 mr-2 text-emerald-500" />
                      Copied Link
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4 mr-2" />
                      Copy Asset Link
                    </>
                  )}
                </Button>

                <Button 
                  onClick={() => handleDownload(asset)}
                  className="font-semibold text-xs py-2 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-150"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PNG
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dynamic Edit Dialog */}
      {editingAsset && (
        <Dialog open={true} onOpenChange={(open) => !open && setEditingAsset(null)}>
          <DialogContent className="sm:max-w-[500px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Edit Caption & Copy</DialogTitle>
              <DialogDescription className="text-xs text-zinc-500">
                Update the promotional copy texts, tags, or links. This will save locally to your branch assets and create a new version tracking log.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4 font-sans">
              <div className="grid gap-1">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Asset Display Name</label>
                <Input 
                  value={editingAsset.name} 
                  onChange={e => setEditingAsset({ ...editingAsset, name: e.target.value })}
                  className="bg-zinc-50/50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 h-10 rounded-lg text-sm"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Image Asset URL / Local Path</label>
                <Input 
                  value={editingAsset.imageUrl} 
                  onChange={e => setEditingAsset({ ...editingAsset, imageUrl: e.target.value })}
                  className="bg-zinc-50/50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 h-10 rounded-lg text-sm font-mono"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">Promotion Message Content</label>
                <Textarea 
                  rows={6} 
                  value={editingAsset.caption} 
                  onChange={e => setEditingAsset({ ...editingAsset, caption: e.target.value })}
                  className="bg-zinc-50/50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 rounded-lg text-sm leading-relaxed"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Changelog / Release Note (e.g., "Updated discounts and hashtags")
                </label>
                <Input 
                  placeholder="What did you alter in this variation?"
                  value={changelog}
                  onChange={e => setChangelog(e.target.value)}
                  className="bg-indigo-50/20 dark:bg-zinc-950/50 border-indigo-200/50 dark:border-zinc-800 focus:ring-indigo-500 h-10 rounded-lg text-sm"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setEditingAsset(null)}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={isSaving} className="bg-zinc-900 text-white hover:bg-zinc-800">
                {isSaving ? 'Saving Changes...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteId && (
        <Dialog open={true} onOpenChange={(open) => !open && setDeleteId(null)}>
          <DialogContent className="sm:max-w-[400px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-zinc-900 dark:text-zinc-50">Delete Custom Asset?</DialogTitle>
              <DialogDescription className="text-xs text-zinc-500 mt-2">
                This action is permanent and cannot be undone. This asset will be permanently removed from your catalog.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-6 flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button variant="destructive" className="flex-1 text-white" onClick={() => handleDelete(deleteId)}>
                Delete Asset
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Lightbox / Preview Modal for Full Resolution Ads */}
      {previewAsset && (
        <Dialog open={true} onOpenChange={(open) => !open && setPreviewAsset(null)}>
          <DialogContent className="max-w-4xl w-[94vw] bg-zinc-950 dark:bg-zinc-950 border border-zinc-800/80 p-0 overflow-hidden shadow-2xl rounded-2xl flex flex-col md:flex-row">
            {/* Left: Beautiful Preview Screen */}
            <div className="flex-1 relative bg-black flex items-center justify-center p-4 min-h-[300px] md:min-h-[460px] max-h-[70vh] overflow-hidden">
              {viewMode === 'live' ? (
                renderLivePoster(previewAsset, true)
              ) : (
                <img 
                  src={previewAsset.imageUrl} 
                  alt={previewAsset.name} 
                  className="object-contain w-full h-full max-h-[60vh] select-none rounded-lg"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="absolute top-4 left-4 flex gap-2 z-20">
                <Badge className="bg-white/95 text-black border-none font-bold text-[10px] tracking-wide uppercase px-2.5 py-1">
                  {previewAsset.type}
                </Badge>
                <Badge variant="outline" className="bg-black/60 dark:bg-black/60 border-zinc-800 text-zinc-300 text-[10px] py-1">
                  {previewAsset.format}
                </Badge>
              </div>
            </div>

            {/* Right: Promotional Metadata and Quick Actions */}
            <div className="w-full md:w-[340px] border-t md:border-t-0 md:border-l border-zinc-900 bg-zinc-900/40 p-6 flex flex-col justify-between max-h-[70vh] overflow-y-auto">
              <div className="space-y-5">
                <div>
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-1">Asset Highlight</span>
                  <DialogTitle className="text-lg font-bold text-white tracking-tight leading-snug">
                    {previewAsset.name}
                  </DialogTitle>
                  
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {previewAsset.tags.map((tag) => (
                      <span key={tag} className="inline-flex items-center text-[9px] font-bold text-zinc-400 uppercase tracking-wider bg-zinc-800 px-2 py-0.5 rounded-full">
                        <Tag className="w-2 h-2 mr-1 text-zinc-500" />
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center">
                    <FileText className="w-3 h-3 mr-1.5 text-zinc-500" />
                    Copywritten Caption Post
                  </span>
                  <div className="bg-zinc-950 border border-zinc-850 p-3.5 rounded-xl max-h-[140px] overflow-y-auto whitespace-pre-wrap select-text text-xs text-zinc-300 leading-relaxed font-sans placeholder-zinc-700">
                    {previewAsset.caption || 'No captions written.'}
                  </div>
                </div>

                <div className="space-y-2 border-t border-zinc-800/60 pt-4">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5 mb-2.5">
                    <History className="w-3.5 h-3.5" />
                    Version Timeline ({getAssetVersions(previewAsset).length})
                  </span>
                  <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                    {getAssetVersions(previewAsset).map((v, i) => {
                      const isActive = previewAsset.caption === v.caption && previewAsset.imageUrl === v.imageUrl;
                      return (
                        <div 
                          key={v.id || i}
                          className={`p-3 rounded-xl border text-[11px] transition-all flex flex-col gap-1.5 ${
                            isActive 
                              ? 'bg-indigo-950/45 border-indigo-500/50 text-white' 
                              : 'bg-zinc-950/50 border-zinc-900 text-zinc-400 hover:border-zinc-800'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                              v{v.versionNumber}
                              {isActive && (
                                <Badge className="text-[8px] bg-indigo-500 text-white border-none py-0 px-1 font-bold h-4">
                                  Active
                                </Badge>
                              )}
                            </span>
                            <span className="text-[9px] text-zinc-500 font-mono">
                              {v.createdAt && v.createdAt !== '2026-06-06T08:00:00Z' 
                                ? new Date(v.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) 
                                : 'Default'}
                            </span>
                          </div>
                          
                          <p className="text-[10px] text-zinc-400 font-sans italic leading-tight">
                            &ldquo;{v.changelog || 'Initial release details'}&rdquo;
                          </p>

                          <div className="flex gap-2 justify-end mt-1">
                            {!isActive && (
                              <Button 
                                variant="ghost" 
                                onClick={() => handleRestoreVersion(previewAsset, v)}
                                className="h-6 text-[10px] text-zinc-300 hover:text-white hover:bg-zinc-800 font-semibold flex items-center gap-1 px-2 border border-zinc-850 bg-zinc-900 hover:border-zinc-700 rounded-md"
                              >
                                <RotateCcw className="w-2.5 h-2.5" />
                                Revert
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              onClick={() => {
                                navigator.clipboard.writeText(v.caption);
                                toast.success(`Copied Caption from Version ${v.versionNumber}!`);
                              }}
                              className="h-6 text-[10px] text-zinc-300 hover:text-white hover:bg-zinc-800 font-semibold flex items-center gap-1 px-2 border border-zinc-850 bg-zinc-900 hover:border-zinc-700 rounded-md"
                            >
                              <Copy className="w-2.5 h-2.5" />
                              Copy Caption
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-zinc-900 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    onClick={() => handleCopyCaption(previewAsset)}
                    variant="outline"
                    className="border-zinc-800 hover:bg-zinc-900/60 text-zinc-300 font-semibold text-xs py-2 h-9 rounded-xl"
                  >
                    {copiedCaptionId === previewAsset.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1.5" />
                        Caption
                      </>
                    )}
                  </Button>

                  <Button 
                    onClick={() => handleCopyLink(previewAsset)}
                    variant="outline"
                    className="border-zinc-800 hover:bg-zinc-900/60 text-zinc-300 font-semibold text-xs py-2 h-9 rounded-xl"
                  >
                    {copiedId === previewAsset.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                        Link Copied
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5 mr-1.5" />
                        Asset Link
                      </>
                    )}
                  </Button>
                </div>

                <Button 
                  onClick={() => handleDownload(previewAsset)}
                  className="w-full bg-white text-zinc-950 hover:bg-zinc-100 font-bold text-xs py-2.5 h-10 rounded-xl flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download High-Res (PNG)
                </Button>

                <DialogClose render={
                  <Button 
                    variant="ghost" 
                    className="w-full text-zinc-500 hover:text-zinc-300 text-xs py-1 h-8 bg-transparent hover:bg-zinc-900/20 font-medium"
                  >
                    Close Preview
                  </Button>
                } />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
