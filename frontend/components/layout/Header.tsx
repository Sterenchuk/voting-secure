"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n/context";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth/context";
import styles from "./Header.module.css";

interface HeaderProps {
  isAuthenticated?: boolean;
  userName?: string;
}

export function Header({ isAuthenticated = false, userName }: HeaderProps) {
  const { t, language, setLanguage } = useI18n();
  const { theme, setTheme } = useTheme();
  const { updateProfile } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    if (isAuthenticated) {
      updateProfile({ theme: newTheme });
    }
  };

  const handleLanguageChange = (lang: "en" | "uk") => {
    setLanguage(lang);
    if (isAuthenticated) {
      updateProfile({ language: lang });
    }
  };

  const isActive = (path: string) => pathname === path;

  const navLinks = isAuthenticated
    ? [
        { href: "/dashboard", label: t.nav.dashboard },
        { href: "/votings", label: t.nav.votings },
        { href: "/surveys", label: t.nav.surveys },
        { href: "/groups", label: t.nav.groups },
        { href: "/audit", label: t.nav.audit },
      ]
    : [
        { href: "/", label: t.nav.home },
        { href: "/audit", label: t.nav.auditMode },
      ];

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>
          <svg
            className={styles.logoIcon}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M16 2L4 8v8c0 7.732 5.268 14.864 12 16 6.732-1.136 12-8.268 12-16V8L16 2z"
              fill="currentColor"
              opacity="0.2"
            />
            <path
              d="M16 2L4 8v8c0 7.732 5.268 14.864 12 16 6.732-1.136 12-8.268 12-16V8L16 2z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M12 16l3 3 5-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className={styles.logoText}>{t.common.appName}</span>
        </Link>

        <nav
          className={`${styles.nav} ${mobileMenuOpen ? styles.navOpen : ""}`}
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`${styles.navLink} ${isActive(link.href) ? styles.navLinkActive : ""}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          {/* Language Switcher */}
          <button
            className={styles.iconButton}
            onClick={() => handleLanguageChange(language === "en" ? "uk" : "en")}
            aria-label="Change language"
          >
            <span className={styles.langText}>{language.toUpperCase()}</span>
          </button>

          {/* Theme Toggle */}
          <button
            className={styles.iconButton}
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            {theme === "dark" ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              </svg>
            )}
          </button>

          {isAuthenticated ? (
            <div className={styles.userMenu}>
              <button
                className={styles.userButton}
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-expanded={userMenuOpen}
              >
                <span className={styles.avatar}>
                  {userName?.charAt(0).toUpperCase() || "U"}
                </span>
                <span className={styles.userName}>{userName}</span>
                <svg
                  className={`${styles.chevron} ${userMenuOpen ? styles.chevronOpen : ""}`}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>

              {userMenuOpen && (
                <div className={styles.dropdown}>
                  <Link href="/profile" className={styles.dropdownItem}>
                    {t.nav.profile}
                  </Link>
                  <Link href="/settings" className={styles.dropdownItem}>
                    {t.nav.settings}
                  </Link>
                  <hr className={styles.dropdownDivider} />
                  <button className={styles.dropdownItem}>
                    {t.nav.signOut}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className={styles.authButtons}>
              <Link href="/signin" className={styles.signInButton}>
                {t.nav.signIn}
              </Link>
              <Link href="/signup" className={styles.signUpButton}>
                {t.nav.signUp}
              </Link>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <button
            className={styles.mobileMenuButton}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
