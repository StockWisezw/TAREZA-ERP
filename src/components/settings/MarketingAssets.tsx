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
  RefreshCw
} from 'lucide-react';
import { db } from '../../lib/supabaseClient';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { useAuth } from '../../hooks/useAuth';

interface MarketingAsset {
  id: string;
  name: string;
  type: 'Facebook & Instagram' | 'YouTube & Video' | 'General Flyer' | 'Banner';
  format: string;
  imageUrl: string;
  caption: string;
  tags: string[];
  isCustom?: boolean;
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

  // For adding a custom asset
  const [newAssetName, setNewAssetName] = useState('');
  const [newAssetType, setNewAssetType] = useState<'Facebook & Instagram' | 'YouTube & Video' | 'General Flyer' | 'Banner'>('Facebook & Instagram');
  const [newAssetFormat, setNewAssetFormat] = useState('1:1 Square');
  const [newAssetUrl, setNewAssetUrl] = useState('');
  const [newAssetCaption, setNewAssetCaption] = useState('');
  const [newAssetTags, setNewAssetTags] = useState('');
  const [isCreating, setIsCreating] = useState(false);

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
              isCustom: true
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

  const handleSaveEdit = async () => {
    if (!editingAsset) return;
    setIsSaving(true);
    try {
      const { id, name, type, format, imageUrl, caption, tags, isCustom } = editingAsset;

      if (isCustom) {
        // Save back to db
        if (db && user) {
          try {
            const docRef = doc(db, 'marketing_assets', id);
            await updateDoc(docRef, { name, type, format, imageUrl, caption, tags });
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
            list[idx] = { ...list[idx], name, type, format, imageUrl, caption, tags };
            localStorage.setItem('custom_marketing_assets', JSON.stringify(list));
          }
        }
      } else {
        // If they edited a template asset, save it as their customized version
        const customizedTemplate: MarketingAsset = {
          ...editingAsset,
          id: `custom-${id}`,
          isCustom: true
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

      toast.success('Marketing asset updated successfully!');
      setEditingAsset(null);
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
              <div className="relative aspect-[16/10] bg-zinc-950 border-b border-zinc-100 dark:border-zinc-850 flex items-center justify-center overflow-hidden">
                <img 
                  src={asset.imageUrl} 
                  alt={asset.name} 
                  className="object-contain w-full h-full max-h-full transition-transform group-hover:scale-[1.01] duration-300"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-3 left-3 flex gap-2">
                  <Badge className="bg-zinc-900/90 text-white dark:bg-zinc-100 dark:text-zinc-950 border-none font-semibold text-[10px] tracking-wide uppercase px-2 py-1">
                    {asset.type}
                  </Badge>
                  <Badge variant="outline" className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border-zinc-200/50 text-zinc-700 dark:text-zinc-200 text-[10px] py-1">
                    {asset.format}
                  </Badge>
                </div>

                {asset.isCustom && (
                  <div className="absolute top-3 right-3 flex items-center gap-1">
                    <Badge className="bg-indigo-500 text-white text-[10px] border-none font-bold uppercase tracking-widest px-2.5 py-1">Custom</Badge>
                    <Button 
                      variant="destructive" 
                      size="icon-sm"
                      onClick={() => setDeleteId(asset.id)}
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
                Update the promotional copy texts, tags, or links. This will save locally to your branch assets.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4 font-sans">
              <div className="grid gap-1">
                <label className="text-xs font-semibold text-zinc-500">Asset Display Name</label>
                <Input 
                  value={editingAsset.name} 
                  onChange={e => setEditingAsset({ ...editingAsset, name: e.target.value })}
                  className="bg-zinc-50/50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 h-10 rounded-lg text-sm"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-xs font-semibold text-zinc-500">Promotion Message Content</label>
                <Textarea 
                  rows={8} 
                  value={editingAsset.caption} 
                  onChange={e => setEditingAsset({ ...editingAsset, caption: e.target.value })}
                  className="bg-zinc-50/50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800 rounded-lg text-sm leading-relaxed"
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
    </div>
  );
}
