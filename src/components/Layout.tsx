import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
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
  BookOpen
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { Input } from './ui/input';

import { ThemeToggle } from './ThemeToggle';
import { SyncManager } from './pos/SyncManager';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { TarezaLogo } from './ui/Logo';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Tareza POS', href: '/pos', icon: ShoppingCart },
  { name: 'Cash Management', href: '/cash', icon: DollarSign },
  { name: 'Accounting Ledger', href: '/accounting', icon: BookOpen },
  { name: 'Sales History', href: '/receipts', icon: Receipt },
  { name: 'Tareza Inventory', href: '/inventory', icon: Package },
  { name: 'Tareza CRM', href: '/customers', icon: Users },
  { name: 'Tareza Suppliers', href: '/suppliers', icon: Truck },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Tareza Settings', href: '/settings', icon: Settings },
];

function SubscriptionBanner() {
  const { user } = useAuth();
  
  // Superadmin account has no expiration and unlimited functions
  const isSuperadmin = user?.email === 'demo@tareza.co.zw';
  const subscriptionStatus: string = isSuperadmin ? 'ACTIVE' : 'GRACE_PERIOD';
  
  const expiresAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // Expired 2 days ago
  const gracePeriodEnd = new Date(expiresAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days grace
  const daysLeftInGrace = Math.floor((gracePeriodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  if (subscriptionStatus === 'ACTIVE') return null;

  if (subscriptionStatus === 'EXPIRED') {
     return (
      <div className="bg-red-500 text-white border-b border-red-600 px-4 py-2 flex items-center justify-center text-sm z-50 relative shrink-0">
        <AlertTriangle className="w-4 h-4 mr-2 shrink-0" />
        <span className="truncate font-medium">Your subscription has expired. Please upgrade or renew your plan to restore access.</span>
        <Link to="/settings" className="ml-3 font-bold underline hover:text-red-100 shrink-0">Renew Plan</Link>
      </div>
    );
  }

  return (
    <div className="bg-amber-100 border-b border-amber-200 px-4 py-2 flex items-center justify-center text-sm text-amber-800 z-50 relative shrink-0">
      <AlertTriangle className="w-4 h-4 mr-2 shrink-0" />
      <span className="truncate">
        {subscriptionStatus === 'TRIAL' 
          ? `Your 7-day free trial is active.` 
          : `Subscription Overdue: You are in a 7-day grace period (${daysLeftInGrace} days left).`}
      </span>
      <Link to="/settings" className="ml-3 font-semibold underline hover:text-amber-900 shrink-0">Upgrade Plan</Link>
    </div>
  );
}

export default function Layout() {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const [isLocked, setIsLocked] = React.useState(false);
  const [unlockPin, setUnlockPin] = React.useState('');
  const [pinError, setPinError] = React.useState(false);

  React.useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      if (!isLocked) {
        // Auto lock after 5 minutes of inactivity
        timeoutId = setTimeout(() => setIsLocked(true), 5 * 60 * 1000);
      }
    };

    const handleActivity = () => resetTimer();

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity);
    window.addEventListener('click', handleActivity);

    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, [isLocked]);

  const handleSignOut = () => {
    localStorage.removeItem('isPreviewMode');
    signOut();
    window.location.href = '/login';
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (unlockPin === '1234' || unlockPin === '0000') {
      setIsLocked(false);
      setUnlockPin('');
      setPinError(false);
    } else {
      setPinError(true);
      setTimeout(() => setPinError(false), 2000);
    }
  };

  if (isLocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <div className="w-full max-w-sm p-8 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200 text-center">
           <div className="bg-primary/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
              <Lock className="w-8 h-8 text-primary" />
           </div>
           <h2 className="text-2xl font-bold tracking-tight text-white mb-2">App Locked</h2>
           <p className="text-zinc-400 text-sm mb-8">{user?.email || 'Admin User'}</p>
           
           <form onSubmit={handleUnlock} className="space-y-4">
             <input 
               type="password" 
               autoFocus
               placeholder="Enter PIN (e.g. 1234)" 
               className={`w-full bg-zinc-950 border ${pinError ? 'border-red-500' : 'border-zinc-800'} text-white text-center text-2xl tracking-widest p-4 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary`}
               value={unlockPin}
               onChange={(e) => setUnlockPin(e.target.value)}
             />
             {pinError && <p className="text-red-500 text-sm animate-pulse">Incorrect PIN. Try again.</p>}
             <Button type="submit" className="w-full h-12 text-lg font-bold bg-primary hover:bg-primary/90 text-primary-foreground">
               Unlock
             </Button>
           </form>
           
           <div className="mt-8">
             <Button variant="ghost" className="text-zinc-500 hover:text-white" onClick={handleSignOut}>
               <LogOut className="w-4 h-4 mr-2"/> Switch User
             </Button>
           </div>
        </div>
      </div>
    );
  }

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
      <SubscriptionBanner />
      <div className="flex flex-1 overflow-hidden">
        
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-[260px] flex-col bg-zinc-50 dark:bg-[#18181b] border-r border-zinc-200 dark:border-zinc-800/80 overflow-hidden shrink-0">
          <div className="h-16 px-5 flex items-center">
            <TarezaLogo size="sm" showSubtitle={false} />
          </div>
          <div className="flex-1 overflow-auto py-4">
            <NavLinks />
          </div>
          <div className="p-4 flex flex-col gap-2">
            {user?.email === 'tapiwagahadza54@gmail.com' && (
              <div className="px-3 py-1.5 bg-blue-500/10 rounded-full text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase text-center tracking-widest mx-2 mb-2">
                Superadmin
              </div>
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
                    <TarezaLogo size="sm" showSubtitle={false} />
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
              <SyncStatusIndicator />
              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block mx-1" />
              <ThemeToggle />
              <Button variant="ghost" size="icon" className="relative rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <Bell className="h-[18px] w-[18px] text-zinc-600 dark:text-zinc-400" />
                <span className="absolute top-2 right-2.5 h-1.5 w-1.5 rounded-full bg-red-500" />
              </Button>
              
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
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsLocked(true)} className="py-2 font-medium text-amber-600 dark:text-amber-500 cursor-pointer">
                    <Lock className="w-4 h-4 mr-2" /> Lock Terminal
                  </DropdownMenuItem>
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
    </div>
  );
}
