"use client";

import React from "react";
import { I18nProvider } from "@/lib/i18n/context";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/lib/auth/context";
import { PreferenceSync } from "./PreferenceSync";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <I18nProvider>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="svs-theme">
          <PreferenceSync />
          {children}
        </ThemeProvider>
      </I18nProvider>
    </AuthProvider>
  );
}
