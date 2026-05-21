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
  Lock
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from './ui/button';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { Input } from './ui/input';

import { ThemeToggle } from './ThemeToggle';
import { AIAssistant } from './AIAssistant';
import { SyncManager } from './pos/SyncManager';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Tareza POS', href: '/pos', icon: ShoppingCart },
  { name: 'Cash Management', href: '/cash', icon: DollarSign },
  { name: 'Tareza Fiscal', href: '/receipts', icon: Receipt },
  { name: 'Tareza Inventory', href: '/inventory', icon: Package },
  { name: 'Tareza CRM', href: '/customers', icon: Users },
  { name: 'Tareza Suppliers', href: '/suppliers', icon: Truck },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Tareza Settings', href: '/settings', icon: Settings },
];

function SubscriptionBanner() {
  // In a real implementation this would come from the database
  const subscriptionStatus: string = 'GRACE_PERIOD'; // Active, Trial, Grace_Period, Expired
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
    <div className="flex flex-col space-y-0.5">
      {navigation.map((item) => {
        const isActive = location.pathname === item.href;
        
        if (mobile) {
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive 
                  ? 'bg-zinc-100 text-zinc-900 border-l-4 border-primary dark:bg-zinc-800 dark:text-zinc-50' 
                  : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-50'
              }`}
            >
              <item.icon className={`h-4 w-4 ${isActive ? 'text-primary' : ''}`} />
              <span>{item.name}</span>
            </Link>
          )
        }

        return (
          <Link
            key={item.name}
            to={item.href}
            className={`flex items-center space-x-3 rounded-lg px-3 py-1 text-sm font-medium transition-colors mt-0.5 ${
              isActive 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <item.icon className={`h-4 w-4 ${isActive ? 'text-primary-foreground' : 'text-zinc-400'}`} />
            <span>{item.name}</span>
          </Link>
        )
      })}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 max-h-screen overflow-hidden">
      <SyncManager />
      <SubscriptionBanner />
      <div className="flex flex-1 overflow-hidden">
        
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex w-64 flex-col bg-secondary text-secondary-foreground border-r border-secondary shadow-xl overflow-hidden shrink-0">
          <div className="p-5 flex items-center space-x-3 border-b border-white/10 bg-secondary">
            <div className="bg-primary p-2 rounded-lg shadow-sm">
              <Store className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-white leading-none">TAREZA</span>
              <span className="text-[10px] tracking-[0.2em] text-primary font-medium mt-1 uppercase">ERP</span>
            </div>
          </div>
          <div className="flex-1 overflow-auto py-5 px-3 bg-secondary">
            <NavLinks />
          </div>
          <div className="p-4 border-t border-white/10 bg-secondary/90 flex flex-col gap-2">
            {user?.email === 'tapiwagahadza54@gmail.com' && (
              <div className="px-3 py-1.5 bg-primary/20 rounded-md text-xs font-semibold text-primary uppercase text-center tracking-widest border border-primary/30">
                Superadmin
              </div>
            )}
            <Button variant="ghost" className="w-full justify-start text-zinc-400 hover:text-white hover:bg-white/10" onClick={handleSignOut}>
              <LogOut className="mr-3 h-4 w-4" />
              Logout
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
          
          {/* Topbar */}
          <header className="flex h-16 items-center justify-between border-b bg-white dark:bg-zinc-950 px-4 sm:px-6">
            <div className="flex items-center">
              <Sheet>
                <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden mr-2" />}>
                  <Menu className="h-5 w-5" />
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                  <div className="p-4 flex items-center space-x-2 border-b">
                    <Store className="h-5 w-5 text-primary" />
                    <span className="text-lg font-bold tracking-tight">Tareza ERP</span>
                  </div>
                  <div className="p-3">
                    <NavLinks mobile />
                  </div>
                </SheetContent>
              </Sheet>
              
              <div className="hidden sm:flex relative w-64 max-w-md">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
                <Input 
                  type="search" 
                  placeholder="Search inventory, sales..." 
                  className="pl-9 bg-zinc-50 border-transparent focus-visible:bg-white focus-visible:border-zinc-300 shadow-none h-9" 
                />
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5 text-zinc-500" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="ghost" className="relative h-8 w-8 rounded-full" />}>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src="" alt="User" />
                    <AvatarFallback className="bg-zinc-100 text-zinc-900 border text-xs">
                      {user?.email?.charAt(0).toUpperCase() || 'A'}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">Admin User</p>
                      <p className="text-xs leading-none text-muted-foreground">{user?.email || 'admin@tareza.co.zw'}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Profile Settings</DropdownMenuItem>
                  <DropdownMenuItem>Branch Setup</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setIsLocked(true)} className="font-medium text-amber-600">
                    <Lock className="w-4 h-4 mr-2" /> Lock Terminal
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
            <div className="mx-auto max-w-6xl">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <AIAssistant />
    </div>
  );
}
