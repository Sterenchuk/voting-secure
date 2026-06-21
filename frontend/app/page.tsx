"use client";

import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { StatsSection } from "@/components/landing/StatsSection";
import { CTASection } from "@/components/landing/CTASection";
import { useAuth } from "@/hooks/api/useAuth";
import styles from "./page.module.css";

export default function LandingPage() {
  const { isAuthenticated, user, loading } = useAuth();

  return (
    <div className={styles.page}>
      <Header isAuthenticated={isAuthenticated} userName={user?.name} />
      <main className={styles.main}>
        <HeroSection />
        <FeaturesSection />
        <StatsSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
