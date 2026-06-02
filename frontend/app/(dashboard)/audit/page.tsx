"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useVotings } from "@/hooks/api/useVotings";
import { useSurveys } from "@/hooks/api/useSurveys";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/context";
import { FileText, BarChart3, ChevronRight, ShieldCheck } from "lucide-react";
import styles from "./page.module.css";

export default function AuditExplorerPage() {
  const router = useRouter();
  const { t } = useI18n();

  const { votings, fetchVotings, loading: votingsLoading } = useVotings();
  const { surveys, fetchSurveys, loading: surveysLoading } = useSurveys();

  // Filters
  const [showVotings, setShowVotings] = useState(true);
  const [showSurveys, setShowSurveys] = useState(true);
  const [groupFilter, setGroupFilter] = useState("");

  useEffect(() => {
    fetchVotings();
    fetchSurveys();
  }, [fetchVotings, fetchSurveys]);

  const filteredChains = useMemo(() => {
    const list = [
      ...(showVotings
        ? votings.map((v) => ({
            id: v.id,
            title: v.title,
            type: "Voting",
            groupId: v.groupId,
            isPublic: v.isPublic,
            icon: <FileText className={styles.chainItemIcon} />,
          }))
        : []),
      ...(showSurveys
        ? surveys.map((s) => ({
            id: s.id,
            title: s.title,
            type: "Survey",
            groupId: s.groupId,
            isPublic: s.isPublic,
            icon: <BarChart3 className={styles.chainItemIcon} />,
          }))
        : []),
    ];
    return groupFilter
      ? list.filter(
          (item) =>
            item.groupId.includes(groupFilter) ||
            item.title.toLowerCase().includes(groupFilter.toLowerCase()),
        )
      : list;
  }, [votings, surveys, showVotings, showSurveys, groupFilter]);

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          {t.audit.title}
        </h1>
        <p className={styles.pageSubtitle}>
          {t.audit.subtitle}
        </p>
      </div>

      <div className={styles.contentWrapper}>
        <Card className={styles.explorerCard}>
          <CardHeader>
            <CardTitle className={styles.cardTitleWrapper}>
              <ShieldCheck className={styles.explorerIcon} />
              Audit Explorer
            </CardTitle>
            <CardDescription>
              Select a voting or survey to verify its cryptographic integrity.
            </CardDescription>
          </CardHeader>
          <CardContent className={styles.filterSection}>
            <div className={styles.filterRow}>
              <div className={styles.searchInputWrapper}>
                <Label htmlFor="search">Quick Filter</Label>
                <Input
                  id="search"
                  placeholder="Search by title or group ID..."
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                />
              </div>
              <div className={styles.checkboxGroup}>
                <div className={styles.checkboxWrapper}>
                  <Checkbox
                    id="showVotings"
                    checked={showVotings}
                    onCheckedChange={(checked) => setShowVotings(!!checked)}
                  />
                  <Label htmlFor="showVotings" className={styles.checkboxLabel}>
                    Votings
                  </Label>
                </div>
                <div className={styles.checkboxWrapper}>
                  <Checkbox
                    id="showSurveys"
                    checked={showSurveys}
                    onCheckedChange={(checked) => setShowSurveys(!!checked)}
                  />
                  <Label htmlFor="showSurveys" className={styles.checkboxLabel}>
                    Surveys
                  </Label>
                </div>
              </div>
            </div>

            <div className={styles.chainList}>
              {votingsLoading || surveysLoading ? (
                <div className={styles.loadingState}>
                  {t.common.loading}
                </div>
              ) : filteredChains.length > 0 ? (
                filteredChains.map((item) => (
                  <div
                    key={item.id}
                    className={styles.chainItem}
                    onClick={() =>
                      router.push(
                        `/audit/${item.type.toLowerCase()}s/audit-chain/${item.id}`,
                      )
                    }
                  >
                    <div className={styles.chainItemInfo}>
                      <div className={styles.chainIconWrapper}>
                        {item.icon}
                      </div>
                      <div className={styles.chainDetails}>
                        <div className={styles.chainTitleRow}>
                          <span className={styles.chainTitle}>
                            {item.title}
                          </span>
                          <Badge
                            variant={item.isPublic ? "default" : "outline"}
                            className={`${styles.statusBadge} ${item.isPublic ? styles.statusBadgeLive : styles.statusBadgeClosed}`}
                          >
                            {item.isPublic ? "Live" : "Closed"}
                          </Badge>
                        </div>
                        <div className={styles.chainMetaRow}>
                          <Badge
                            variant="secondary"
                            className={styles.typeBadge}
                          >
                            {item.type}
                          </Badge>
                          <span className={styles.groupIdText}>
                            Group: {item.groupId}
                          </span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className={styles.chevronIcon} />
                  </div>
                ))
              ) : (
                <div className={styles.emptyState}>
                  <p>
                    No active chains found matching your criteria.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

}
