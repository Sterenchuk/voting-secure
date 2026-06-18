"use client";

import React, { useMemo } from "react";
import { useI18n } from "@/lib/i18n/context";
import { Voting } from "@/hooks/api/useVotings";
import { OtherOptionRow } from "@/components/votings/OtherOptionRow";
import { TrendingUp, BarChart2 } from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
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
  const showResults = voting.isFinalized || voting.hasVoted;

  const trendData = useMemo(() => participationStats
    .map((s) => {
      const d = s.time ? new Date(s.time) : new Date(NaN);
      return {
        time: !isNaN(d.getTime())
          ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
          : "Invalid",
        votes: s.votes,
      };
    })
    .filter((d) => d.time !== "Invalid"), [participationStats]);

  const chartData = useMemo(() => {
    const data = options.map((opt) => ({
      name: opt.text,
      votes: opt.voteCount,
    }));

    if (
      voting.allowOther &&
      voting.otherTotal !== undefined &&
      voting.otherTotal > 0
    ) {
      data.push({
        name: t.common.other,
        votes: voting.otherTotal,
      });
    }

    if (voting.abstentionsCount > 0) {
      data.push({
        name: t.common.abstain,
        votes: voting.abstentionsCount,
      });
    }

    // Sort descending by votes
    return data.sort((a, b) => b.votes - a.votes);
  }, [options, voting.allowOther, voting.otherTotal, voting.abstentionsCount, t.common.other, t.common.abstain]);

  if (!showResults) return null;

  return (
    <div className={styles.resultsSection}>
      <h2 className={styles.sectionTitle}>{t.votings.viewResults}</h2>

      <div className={styles.chartsGrid}>
        {chartData.length > 0 && (
          <div className={styles.trendChart}>
            <div className={styles.trendHeader}>
              <BarChart2 className={styles.trendIcon} />
              <h3 className={styles.trendTitle}>Vote Distribution</h3>
            </div>
            <div className={styles.chartContainer}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ left: 40, right: 40 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 10 }}
                    width={80}
                  />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    contentStyle={{
                      borderRadius: "8px",
                      border: "none",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                  />
                  <Bar dataKey="votes" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill="var(--color-primary)" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

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
      </div>

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

        {voting.abstentionsCount > 0 && (
          <li className={styles.optionItem}>
            <div className={styles.optionRow}>
              <span className={styles.optionText}>{t.common.abstentions}</span>
              <span className={styles.optionPct}>
                {totalVotes > 0
                  ? Math.round((voting.abstentionsCount / totalVotes) * 100)
                  : 0}
                %
              </span>
            </div>
            <div className={styles.progressBar}>
              <div
                className={styles.progressFill}
                style={{
                  width: `${totalVotes > 0 ? Math.round((voting.abstentionsCount / totalVotes) * 100) : 0}%`,
                  opacity: 0.7,
                }}
              />
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}
