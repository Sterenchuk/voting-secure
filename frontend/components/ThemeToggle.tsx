"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/common/Button";
import { useAuth } from "@/lib/auth/context";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { isAuthenticated, updateProfile } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    if (isAuthenticated) {
      updateProfile({ theme: newTheme });
    }
  };

  if (!mounted) return <div style={{ width: 40, height: 40 }} />;

  return (
    <Button variant="ghost" size="sm" onClick={toggleTheme}>
      {theme === "dark" ? "🌙" : "☀️"}
    </Button>
  );
}
