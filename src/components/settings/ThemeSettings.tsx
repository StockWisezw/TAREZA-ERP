import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { CheckCircle2, Moon, Sun, Monitor } from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from 'next-themes';
import { applyWorkspaceThemeColor } from '../ThemeProvider';

const themes = [
  { id: 'tareza-gold', name: 'Tareza Gold', primary: '#d97706', base: 'light' },
  { id: 'midnight-blue', name: 'Midnight Blue', primary: '#1e3a8a', base: 'dark' },
  { id: 'emerald-pro', name: 'Emerald Pro', primary: '#059669', base: 'light' },
  { id: 'carbon-dark', name: 'Carbon Dark', primary: '#171717', base: 'dark' },
  { id: 'royal-purple', name: 'Royal Purple', primary: '#7c3aed', base: 'dark' },
  { id: 'light-minimal', name: 'Light Minimal', primary: '#4b5563', base: 'light' },
  { id: 'oceanic', name: 'Oceanic', primary: '#0891b2', base: 'light' },
  { id: 'modern-gray', name: 'Modern Gray', primary: '#4b5563', base: 'dark' },
];

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  const [activeTheme, setActiveTheme] = useState('royal-purple');
  const [mode, setMode] = useState<'light'|'dark'|'system'>('system');

  useEffect(() => {
    const savedTheme = localStorage.getItem('tareza_workspace_theme') || 'royal-purple';
    setActiveTheme(savedTheme);
    setMode((theme as 'light'|'dark'|'system') || 'system');
  }, [theme]);

  const handleModeChange = (newMode: 'light'|'dark'|'system') => {
    setMode(newMode);
    setTheme(newMode);
    localStorage.setItem('theme', newMode);
    toast.success(`Color mode updated to ${newMode}`);
  };

  const handleThemeChange = (id: string) => {
    setActiveTheme(id);
    localStorage.setItem('tareza_workspace_theme', id);
    applyWorkspaceThemeColor(id);
    const themeName = themes.find(t => t.id === id)?.name || id;
    toast.success(`Workspace theme updated to ${themeName}`);
  };

  const handleSavePreferences = () => {
    localStorage.setItem('theme', mode);
    localStorage.setItem('tareza_workspace_theme', activeTheme);
    setTheme(mode);
    applyWorkspaceThemeColor(activeTheme);
    toast.success('Theme preferences saved and applied globally!');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h3 className="text-xl font-bold text-zinc-900 tracking-tight">Themes & Branding</h3>
        <p className="text-sm text-zinc-500 mt-1">Customize the look and feel of your enterprise workspace.</p>
      </div>

      <Card className="border-zinc-200/60 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Color Mode</CardTitle>
          <CardDescription>Select whether the UI should be light, dark, or automatically match your system.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <button
              onClick={() => handleModeChange('light')}
              className={`flex-1 flex flex-col items-center justify-center py-6 border-2 rounded-xl transition-all ${
                mode === 'light' ? 'border-primary bg-primary/5 text-primary' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'
              }`}
            >
              <Sun className="h-8 w-8 mb-3" />
              <span className="font-medium text-sm">Light Mode</span>
            </button>
            <button
               onClick={() => handleModeChange('dark')}
              className={`flex-1 flex flex-col items-center justify-center py-6 border-2 rounded-xl transition-all ${
                mode === 'dark' ? 'border-primary bg-zinc-900 text-white' : 'border-zinc-200 text-zinc-500 bg-zinc-50 hover:border-zinc-300'
              }`}
            >
              <Moon className="h-8 w-8 mb-3" />
              <span className="font-medium text-sm">Dark Mode</span>
            </button>
            <button
              onClick={() => handleModeChange('system')}
              className={`flex-1 flex flex-col items-center justify-center py-6 border-2 rounded-xl transition-all ${
                mode === 'system' ? 'border-primary bg-primary/5 text-primary' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300'
              }`}
            >
              <Monitor className="h-8 w-8 mb-3" />
              <span className="font-medium text-sm">System Default</span>
            </button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-200/60 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Workspace Theme</CardTitle>
          <CardDescription>Choose an accent color and visual language for your buttons, active states, and charts.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => handleThemeChange(theme.id)}
                className={`group relative text-left rounded-xl transition-all overflow-hidden border-2 flex flex-col items-center justify-center p-6 ${
                  activeTheme === theme.id 
                    ? 'border-primary bg-primary/5 shadow-sm' 
                    : 'border-zinc-200 hover:border-zinc-300 bg-white'
                }`}
              >
                {activeTheme === theme.id && (
                  <div className="absolute top-3 right-3 text-primary">
                    <CheckCircle2 className="w-5 h-5 fill-primary text-white" />
                  </div>
                )}
                <div 
                   className="w-12 h-12 rounded-full shadow-sm mb-4 border border-black/10 group-hover:scale-110 transition-transform"
                  style={{ backgroundColor: theme.primary }} 
                />
                <span className={`font-semibold text-sm ${activeTheme === theme.id ? 'text-primary' : 'text-zinc-700'}`}>
                  {theme.name}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      
      <div className="flex justify-end">
        <Button onClick={handleSavePreferences} size="lg" className="px-8 shadow-sm font-semibold">Save Theme Preferences</Button>
      </div>
    </div>
  );
}
