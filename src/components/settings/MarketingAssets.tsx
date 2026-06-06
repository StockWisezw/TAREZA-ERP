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
  Type
} from 'lucide-react';
import { TarezaLogo } from '../ui/Logo';
import { db } from '../../lib/supabaseClient';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
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
  }
];

export function MarketingAssets() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<MarketingAsset[]>([]);
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
                <img 
                  src={asset.imageUrl} 
                  alt={asset.name} 
                  className="object-contain w-full h-full max-h-full transition-transform group-hover/media:scale-[1.03] duration-300"
                  referrerPolicy="no-referrer"
                />
                
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
            <div className="flex-1 relative bg-black flex items-center justify-center p-4 min-h-[300px] md:min-h-[460px] max-h-[70vh]">
              <img 
                src={previewAsset.imageUrl} 
                alt={previewAsset.name} 
                className="object-contain w-full h-full max-h-[60vh] select-none rounded-lg"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-4 left-4 flex gap-2">
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
