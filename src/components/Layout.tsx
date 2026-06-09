import React from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Users, 
  Settings, 
  LogOut, 
  Store,
  Menu,
  Bell,
  Search,
  Receipt,
  Truck,
  AlertTriangle,
  DollarSign,
  FileText,
  Lock,
  BookOpen,
  MessageSquare,
  Trash2,
  Check
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { Input } from './ui/input';
import { toast } from 'sonner';

import { ThemeToggle } from './ThemeToggle';
import { SyncManager } from './pos/SyncManager';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { OfflineStatusBadge } from './OfflineStatusBadge';
import { TarezaLogo } from './ui/Logo';
import { AIAssistant } from './AIAssistant';
import { supabase } from '../lib/firebaseClient';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'POS Terminal', href: '/pos', icon: ShoppingCart },
  { name: 'Cash Management', href: '/cash', icon: DollarSign },
  { name: 'Accounting Ledger', href: '/accounting', icon: BookOpen },
  { name: 'Sales History', href: '/receipts', icon: Receipt },
  { name: 'Inventory Control', href: '/inventory', icon: Package },
  { name: 'Customer CRM', href: '/customers', icon: Users },
  { name: 'Suppliers', href: '/suppliers', icon: Truck },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Staff Messenger', href: '/messenger', icon: MessageSquare },
  { name: 'Settings', href: '/settings', icon: Settings },
];

function SubscriptionBanner({ status, endDate }: { status: string; endDate: string | null }) {
  const { user } = useAuth();
  
  // Superadmin account has no expiration and unlimited functions
  const isSuperadmin = user?.email?.endsWith('@tarezaerp.co.zw') || user?.email === 'admin@tarezaerp.co.zw';
  const subscriptionStatus = isSuperadmin ? 'ACTIVE' : status;
  
  if (subscriptionStatus === 'ACTIVE') return null;

  const expiresAt = endDate ? new Date(endDate) : new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // Fallback to 2 days ago if undefined/not loaded
  const gracePeriodEnd = new Date(expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days grace from expiration
  let daysLeftInGrace = Math.ceil((gracePeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  
  // Ensure we don't display negative days if it's already expired but status hasn't moved
  if (daysLeftInGrace < 0) {
    daysLeftInGrace = 0;
  }

  // If status is EXPIRED, or daysLeftInGrace <= 0, we show EXPIRED banner
  if (subscriptionStatus === 'EXPIRED' || daysLeftInGrace <= 0) {
     return (
      <div className="bg-red-500 text-white border-b border-red-600 px-4 py-2 flex items-center justify-center text-sm z-50 relative shrink-0" id="expired-subscription-banner">
        <AlertTriangle className="w-4 h-4 mr-2 shrink-0 animate-pulse" />
        <span className="truncate font-medium">Your subscription has expired. Please upgrade or renew your plan to restore access.</span>
        <Link to="/settings?tab=billing" className="ml-3 font-bold underline hover:text-red-100 shrink-0">Renew Plan</Link>
      </div>
    );
  }

  return (
    <div className="bg-amber-100 border-b border-amber-200 px-4 py-2 flex items-center justify-center text-sm text-amber-800 z-50 relative shrink-0 font-sans" id="grace-period-subscription-banner">
      <AlertTriangle className="w-4 h-4 mr-2 shrink-0 text-amber-600 animate-bounce" />
      <span className="truncate font-medium">
        {subscriptionStatus === 'TRIAL' 
          ? `Your free trial is active.` 
          : `Subscription Overdue: You are in a 7-day grace period (${daysLeftInGrace} day${daysLeftInGrace === 1 ? '' : 's'} left).`}
      </span>
      <Link to="/settings?tab=billing" className="ml-3 font-semibold underline hover:text-amber-900 shrink-0 select-none">Upgrade Plan</Link>
    </div>
  );
}

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  type: 'sale' | 'message' | 'stock' | 'billing';
  link?: string;
}

export default function Layout() {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isDeveloper = user?.email?.endsWith('@tarezaerp.co.zw') || user?.email === 'admin@tarezaerp.co.zw' || user?.email === 'developer@tarezaerp.co.zw' || user?.email === 'dev@tarezaerp.co.zw';
  // Screen lock removed per user request
  const isLocked = false;
  const [businessName, setBusinessName] = React.useState<string>('');
  const [subStatus, setSubStatus] = React.useState<string>('ACTIVE');
  const [subEndDate, setSubEndDate] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchBusinessName() {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id;
        if (!userId) return;

        const { data: businessData } = await supabase
          .from('business_users')
          .select('business_id')
          .eq('user_id', userId)
          .limit(1)
          .maybeSingle();

        if (businessData?.business_id) {
          const { data: bData } = await supabase
            .from('businesses')
            .select('name, subscription_status, subscription_end_date')
            .eq('id', businessData.business_id)
            .limit(1)
            .maybeSingle();
          if (bData) {
            if (bData.name) {
              setBusinessName(bData.name);
            }
            if (bData.subscription_status) {
              setSubStatus(bData.subscription_status);
            }
            if (bData.subscription_end_date) {
              setSubEndDate(bData.subscription_end_date);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching business name in layout:', err);
      }
    }
    fetchBusinessName();
  }, [user]);
  
  const [notifications, setNotifications] = React.useState<NotificationItem[]>(() => {
    const cached = localStorage.getItem('erp_notifications');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // ignore
      }
    }
    return [
      {
        id: 'notif-1',
        title: 'Check Daily POS Sales',
        description: 'Reconcile today\'s cash drawer & review sales performance. Synced: $1,420.00 USD.',
        time: '5 mins ago',
        read: false,
        type: 'sale',
        link: '/reports'
      },
      {
        id: 'notif-2',
        title: 'New Messenger Chat',
        description: 'Tapiwa: "Please verify the Harare Branch cash re-deposit before 5 PM."',
        time: '32 mins ago',
        read: false,
        type: 'message',
        link: '/messenger'
      },
      {
        id: 'notif-3',
        title: 'Low Stock Warning',
        description: '3 products under safety stock threshold in main warehouse. Click to restock.',
        time: '2 hours ago',
        read: false,
        type: 'stock',
        link: '/inventory'
      },
      {
        id: 'notif-4',
        title: 'Paynow Subscription Reminder',
        description: 'Complete your license payment soon using EcoCash or credit card to avoid lock.',
        time: '1 day ago',
        read: false,
        type: 'billing',
        link: '/settings'
      }
    ];
  });

  React.useEffect(() => {
    localStorage.setItem('erp_notifications', JSON.stringify(notifications));
  }, [notifications]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast.success('All notifications marked as read');
  };

  const deleteNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
    toast.success('Notification cleared');
  };

  const handleNotificationClick = (item: NotificationItem) => {
    markAsRead(item.id);
    if (item.link) {
      navigate(item.link);
    }
  };
  const handleSignOut = () => {
    localStorage.removeItem('isPreviewMode');
    signOut();
    window.location.href = '/login';
  };

  const NavLinks = ({ mobile }: { mobile?: boolean }) => (
    <div className="flex flex-col px-2">
      {navigation.map((item) => {
        const isActive = location.pathname === item.href;
        
        return (
          <Link
            key={item.name}
            to={item.href}
            className={`flex items-center space-x-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors mb-1 ${
              isActive 
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' 
                : 'text-zinc-600 hover:bg-zinc-100/80 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-50'
            }`}
          >
            <item.icon className={`h-[18px] w-[18px] ${isActive ? 'text-blue-700 dark:text-blue-400' : 'text-zinc-500 dark:text-zinc-400'}`} />
            <span>{item.name}</span>
          </Link>
        )
      })}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-zinc-950 max-h-screen overflow-hidden font-sans text-zinc-900 dark:text-zinc-100">
      <SyncManager />
      <SubscriptionBanner status={subStatus} endDate={subEndDate} />
      <div className="flex flex-1 overflow-hidden">
        
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-[260px] flex-col bg-zinc-50 dark:bg-[#18181b] border-r border-zinc-200 dark:border-zinc-800/80 overflow-hidden shrink-0">
          <div className="h-16 px-5 flex items-center border-b border-zinc-150 dark:border-zinc-800/80 bg-zinc-100/20 dark:bg-zinc-900/10">
            {businessName ? (
              <div className="flex items-center gap-2 select-none overflow-hidden pr-2">
                <Store className="h-4.5 w-4.5 text-zinc-700 dark:text-zinc-300 shrink-0" />
                <span className="font-extrabold text-[15px] tracking-tight bg-gradient-to-r from-zinc-800 to-zinc-600 dark:from-white dark:to-zinc-300 bg-clip-text text-transparent truncate">
                  {businessName}
                </span>
              </div>
            ) : (
              <TarezaLogo size="sm" showSubtitle={false} />
            )}
          </div>
          <div className="flex-1 overflow-auto py-4">
            <NavLinks />
          </div>
          <div className="p-4 flex flex-col gap-2">
            {(user?.email?.endsWith('@tarezaerp.co.zw') || user?.email === 'admin@tarezaerp.co.zw' || user?.email === 'developer@tarezaerp.co.zw') && (
              <div className="px-3 py-1.5 bg-blue-500/10 rounded-full text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase text-center tracking-widest mx-2 mb-2">
                Superadmin
              </div>
            )}
            {isDeveloper && (
              <Button 
                variant="ghost" 
                className="w-full justify-start text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/20 rounded-full px-4 mb-1"
                onClick={() => navigate('/dev-portal')}
              >
                <Lock className="mr-3 h-[18px] w-[18px]" />
                Developer Portal
              </Button>
            )}
            <Button variant="ghost" className="w-full justify-start text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50 rounded-full px-4" onClick={handleSignOut}>
              <LogOut className="mr-3 h-[18px] w-[18px]" />
              Logout
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-white dark:bg-zinc-950">
          
          {/* Topbar */}
          <header className="flex h-16 items-center justify-between border-b border-zinc-200 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm px-4 sm:px-6">
            <div className="flex items-center">
              <Sheet>
                <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden mr-2 rounded-full" />}>
                  <Menu className="h-5 w-5" />
                </SheetTrigger>
                <SheetContent side="left" className="w-[260px] p-0 bg-zinc-50 dark:bg-[#18181b]">
                  <div className="h-16 px-5 flex items-center border-b border-zinc-200 dark:border-zinc-800/80">
                    {businessName ? (
                      <div className="flex items-center gap-2 select-none overflow-hidden pr-2">
                        <Store className="h-4.5 w-4.5 text-zinc-700 dark:text-zinc-300 shrink-0" />
                        <span className="font-extrabold text-[15px] tracking-tight bg-gradient-to-r from-zinc-800 to-zinc-600 dark:from-white dark:to-zinc-300 bg-clip-text text-transparent truncate">
                          {businessName}
                        </span>
                      </div>
                    ) : (
                      <TarezaLogo size="sm" showSubtitle={false} />
                    )}
                  </div>
                  <div className="py-4">
                    <NavLinks mobile />
                  </div>
                </SheetContent>
              </Sheet>
              
              <div className="hidden sm:flex relative w-64 max-w-md ml-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input 
                  type="search" 
                  placeholder="Search products, customers, reports..." 
                  className="pl-9 bg-zinc-100/50 dark:bg-zinc-900/50 border-transparent focus-visible:bg-white dark:focus-visible:bg-zinc-900 focus-visible:border-blue-500/50 shadow-none h-10 rounded-full text-sm" 
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-3">
              <OfflineStatusBadge />
              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block mx-1" />
              <SyncStatusIndicator />
              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block mx-1" />
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="ghost" size="icon" className="relative rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
                    <Bell className="h-[18px] w-[18px] text-zinc-600 dark:text-zinc-400" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-sm ring-2 ring-white dark:ring-zinc-950">
                        {unreadCount}
                      </span>
                    )}
                  </Button>
                } />
                <DropdownMenuContent className="w-80 sm:w-96 p-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl rounded-2xl overflow-hidden mt-2 z-50 origin-top-right" align="end" forceMount>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-805 bg-zinc-50/50 dark:bg-zinc-900/50">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Notifications</span>
                      {unreadCount > 0 && (
                        <span className="bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllAsRead} 
                        className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1 transition-all"
                      >
                        <Check className="w-3.5 h-3.5" /> Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-96 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                    {notifications.length === 0 ? (
                      <div className="py-10 px-4 text-center space-y-2">
                        <div className="bg-zinc-100 dark:bg-zinc-800/50 w-10 h-10 rounded-full flex items-center justify-center mx-auto text-zinc-400">
                          <Bell className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-zinc-850 dark:text-zinc-200">All caught up!</p>
                          <p className="text-[11px] text-zinc-400 mt-0.5">There are no pending alerts or notifications at this moment.</p>
                        </div>
                      </div>
                    ) : (
                      notifications.map((item) => {
                        let IconComponent = Bell;
                        let iconBg = 'bg-zinc-100 text-zinc-650 dark:bg-zinc-800 dark:text-zinc-300';
                        if (item.type === 'sale') {
                          IconComponent = Receipt;
                          iconBg = 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400';
                        } else if (item.type === 'message') {
                          IconComponent = MessageSquare;
                          iconBg = 'bg-blue-50 text-blue-600 dark:bg-blue-950/20 dark:text-blue-400';
                        } else if (item.type === 'stock') {
                          IconComponent = Package;
                          iconBg = 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400';
                        } else if (item.type === 'billing') {
                          IconComponent = AlertTriangle;
                          iconBg = 'bg-rose-50 text-rose-650 dark:bg-rose-950/20 dark:text-rose-400';
                        }

                        return (
                          <div 
                            key={item.id}
                            onClick={() => handleNotificationClick(item)}
                            className={`group relative flex items-start gap-3 p-4 cursor-pointer hover:bg-zinc-50/70 dark:hover:bg-zinc-850 transition-all ${
                              !item.read ? 'bg-zinc-50/50 dark:bg-zinc-800/20' : ''
                            }`}
                          >
                            <div className={`p-2 rounded-xl shrink-0 ${iconBg}`}>
                              <IconComponent className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0 pr-4">
                              <div className="flex items-center justify-between mb-0.5">
                                <h4 className={`text-xs font-bold truncate leading-snug ${
                                  !item.read ? 'text-zinc-900 dark:text-zinc-50' : 'text-zinc-700 dark:text-zinc-350'
                                }`}>
                                  {item.title}
                                </h4>
                                {!item.read && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0 ml-1.5" />
                                )}
                              </div>
                              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal font-sans line-clamp-2">
                                {item.description}
                              </p>
                              <span className="text-[10px] text-zinc-400 dark:text-zinc-400 mt-1.5 block font-medium">
                                {item.time}
                              </span>
                            </div>
                            <button 
                              onClick={(e) => deleteNotification(item.id, e)}
                              className="absolute top-4 right-4 text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                  
                  {notifications.length > 0 && (
                    <div className="px-4 py-2 bg-zinc-50/50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800/80 text-center">
                      <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">
                        Tip: Click a notification to view its page or take actions immediately.
                      </p>
                    </div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" className="relative h-8 w-8 rounded-full ml-1" />}>
                  <Avatar className="h-8 w-8 hover:brightness-95 transition-all">
                    <AvatarImage src="" alt="User" />
                    <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 text-xs font-semibold">
                      {user?.email?.charAt(0).toUpperCase() || 'A'}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal p-3">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-semibold leading-none">{user?.email || 'admin@tareza.co.zw'}</p>
                      <p className="text-xs leading-none text-zinc-500">Administrator</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="py-2 cursor-pointer">Profile Settings</DropdownMenuItem>
                  <DropdownMenuItem className="py-2 cursor-pointer">Branch Setup</DropdownMenuItem>
                  {isDeveloper && (
                    <DropdownMenuItem onClick={() => navigate('/dev-portal')} className="py-2 font-semibold text-blue-600 dark:text-blue-400 cursor-pointer">
                      <Lock className="w-4 h-4 mr-2" /> Developer Portal
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="py-2 text-red-600 dark:text-red-400 cursor-pointer">
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-[1400px]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <AIAssistant />
    </div>
  );
}
