"use client";
import { useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth/context";
import { useTheme } from "next-themes";
import { useI18n } from "@/lib/i18n/context";

export function PreferenceSync() {
  const { user, isAuthenticated } = useAuth();
  const { setTheme } = useTheme();
  const { setLanguage } = useI18n();
  const hasSynced = useRef(false);

  useEffect(() => {
    // One-time cleanup of legacy keys
    const legacyKeys = ["theme", "voting-secure-theme", "language"];
    legacyKeys.forEach((key) => {
      if (localStorage.getItem(key)) {
        localStorage.removeItem(key);
      }
    });

    // One-time sync from backend to local state
    if (isAuthenticated && user && !hasSynced.current) {
      if (user.theme) {
        setTheme(user.theme);
        localStorage.setItem("svs-theme", user.theme);
      }
      if (user.language) {
        const currentLang = localStorage.getItem("svs-language");
        if (currentLang !== user.language) {
          setLanguage(user.language as any);
          localStorage.setItem("svs-language", user.language);
        }
      }
      hasSynced.current = true;
    }
  }, [isAuthenticated, user, setTheme, setLanguage]);

  return null;
}
