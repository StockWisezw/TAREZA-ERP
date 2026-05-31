"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

export function applyWorkspaceThemeColor(themeId: string) {
  const themes = [
    { id: 'tareza-gold', primary: '#d97706' },
    { id: 'midnight-blue', primary: '#1e3a8a' },
    { id: 'emerald-pro', primary: '#059669' },
    { id: 'carbon-dark', primary: '#171717' },
    { id: 'royal-purple', primary: '#7c3aed' },
    { id: 'light-minimal', primary: '#4b5563' },
    { id: 'oceanic', primary: '#0891b2' },
    { id: 'modern-gray', primary: '#4b5563' },
  ];
  const theme = themes.find(t => t.id === themeId);
  if (theme) {
    document.documentElement.style.setProperty('--primary', theme.primary);
    document.documentElement.style.setProperty('--ring', theme.primary);
    document.documentElement.style.setProperty('--chart-1', theme.primary);
  }
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  React.useEffect(() => {
    const savedTheme = localStorage.getItem('tareza_workspace_theme') || 'royal-purple';
    applyWorkspaceThemeColor(savedTheme);
  }, []);

  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
