"use client";

import React from "react";
import { useI18n } from "@/lib/i18n/context";
import { Voting } from "@/hooks/api/useVotings";
import { OtherOptionRow } from "@/components/votings/OtherOptionRow";
import { TrendingUp } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import styles from "./VotingResults.module.css";

interface VotingResultsProps {
  voting: Voting;
  participationStats: Array<{ time: string; votes: number }>;
}

export function VotingResults({
  voting,
  participationStats,
}: VotingResultsProps) {
  const { t } = useI18n();

  const options = voting.options;
  const totalVotes = voting.totalVotes;
  const showResults = voting.isFinalized || voting.hasVoted || !voting.isOpen;

  const trendData = participationStats
    .map((s) => {
      const d = s.time ? new Date(s.time) : new Date(NaN);
      return {
        time: !isNaN(d.getTime())
          ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "Invalid",
        votes: s.votes,
      };
    })
    .filter((d) => d.time !== "Invalid");

  if (!showResults) return null;

  return (
    <div className={styles.resultsSection}>
      <h2 className={styles.sectionTitle}>{t.votings.viewResults}</h2>

      {trendData.length > 0 && (
        <div className={styles.trendChart}>
          <div className={styles.trendHeader}>
            <TrendingUp className={styles.trendIcon} />
            <h3 className={styles.trendTitle}>
              {t.votings.votingTendencies}
            </h3>
          </div>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trendData}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    border: "none",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="votes"
                  stroke="var(--color-accent-primary)"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "var(--color-accent-primary)" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <ul className={styles.optionList}>
        {options.map((option) => {
          const pct =
            totalVotes > 0
              ? Math.round((option.voteCount / totalVotes) * 100)
              : 0;
          return (
            <li key={option.id} className={styles.optionItem}>
              <div className={styles.optionRow}>
                <span className={styles.optionText}>{option.text}</span>
                <span className={styles.optionPct}>{pct}%</span>
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}

        {voting.allowOther && voting.otherTotal !== undefined && (
          <OtherOptionRow
            otherTotal={voting.otherTotal}
            totalVotes={totalVotes}
            dynamicOptions={voting.dynamicOptions ?? []}
            showResults={true}
          />
        )}

        <li className={styles.optionItem}>
          <div className={styles.optionRow}>
            <span className={styles.optionText}>{t.common.abstentions}</span>
            <span className={styles.optionPct}>{voting.abstentionsCount}</span>
          </div>
        </li>
      </ul>
    </div>
  );
}
