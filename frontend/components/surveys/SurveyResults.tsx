"use client";

import React, { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import {
  Survey,
  SurveyResults as ISurveyResults,
} from "@/hooks/api/useSurveys";
import { SurveyQuestionType } from "@/types/survey";
import {
  TrendingUp,
  BarChart2,
  ShieldCheck,
  List,
  BarChart,
} from "lucide-react";
import { Card } from "@/components/common/Card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import styles from "./SurveyResults.module.css";

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = [
  "var(--color-accent-primary)",
  "var(--color-accent-secondary)",
  "var(--color-accent-tertiary)",
  "#FF8042",
  "#00C49F",
  "#FFBB28",
  "#a855f7",
  "#06b6d4",
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface SurveyResultsProps {
  survey: Survey;
  results: ISurveyResults;
  participationStats: Array<{ time: string; votes: number }>;
}

// ─── Scale question renderer ──────────────────────────────────────────────────

function ScaleResults({
  options,
  scaleMin,
  scaleMax,
}: {
  options: { id: string; text: string; count: number }[];
  scaleMin: number;
  scaleMax: number;
}) {
  // Build a full range even for values with 0 responses
  const range: number[] = [];
  for (let i = scaleMin; i <= scaleMax; i++) range.push(i);

  const countMap = new Map(options.map((o) => [Number(o.text), o.count]));
  const total = options.reduce((s, o) => s + o.count, 0);

  const bars = range.map((v) => ({ value: v, count: countMap.get(v) ?? 0 }));
  const maxCount = Math.max(...bars.map((b) => b.count), 1);

  // Stats
  const allValues: number[] = [];
  options.forEach((o) => {
    for (let i = 0; i < o.count; i++) allValues.push(Number(o.text));
  });
  allValues.sort((a, b) => a - b);

  const mean =
    total > 0 ? (allValues.reduce((s, v) => s + v, 0) / total).toFixed(2) : "—";

  const median =
    total > 0
      ? allValues.length % 2 === 0
        ? (
            (allValues[allValues.length / 2 - 1] +
              allValues[allValues.length / 2]) /
            2
          ).toFixed(1)
        : String(allValues[Math.floor(allValues.length / 2)])
      : "—";

  const modeEntry = [...countMap.entries()].sort((a, b) => b[1] - a[1])[0];
  const mode = modeEntry ? String(modeEntry[0]) : "—";

  return (
    <div className={styles.scaleWrapper}>
      <div className={styles.scaleStats}>
        <div className={styles.scaleStat}>
          <span className={styles.scaleStatLabel}>Mean</span>
          <span className={styles.scaleStatValue}>{mean}</span>
        </div>
        <div className={styles.scaleStat}>
          <span className={styles.scaleStatLabel}>Median</span>
          <span className={styles.scaleStatValue}>{median}</span>
        </div>
        <div className={styles.scaleStat}>
          <span className={styles.scaleStatLabel}>Mode</span>
          <span className={styles.scaleStatValue}>{mode}</span>
        </div>
        <div className={styles.scaleStat}>
          <span className={styles.scaleStatLabel}>Responses</span>
          <span className={styles.scaleStatValue}>{total}</span>
        </div>
      </div>

      <div className={styles.scaleBars}>
        {bars.map((bar) => {
          const pct = total > 0 ? ((bar.count / total) * 100).toFixed(1) : "0";
          const widthPct = (bar.count / maxCount) * 100;
          return (
            <div key={bar.value} className={styles.scaleBarRow}>
              <span className={styles.scaleBarLabel}>{bar.value}</span>
              <div className={styles.scaleBarTrack}>
                <div
                  className={styles.scaleBarFill}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <span className={styles.scaleBarCount}>
                {bar.count}
                <span className={styles.scaleBarPct}> ({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Freeform question renderer ───────────────────────────────────────────────

type FreeformView = "list" | "table";

function FreeformResults({
  options,
  freeformAnswers,
  total,
}: {
  options: { id: string; text: string; count: number }[];
  freeformAnswers?: string[];
  total: number;
}) {
  const [view, setView] = useState<FreeformView>("list");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const aggregated = [...options]
    .filter((o) => o.text.trim() !== "")
    .sort((a, b) =>
      sortDir === "desc" ? b.count - a.count : a.count - b.count,
    );

  // Raw: individual answers (may include duplicates)
  const rawAnswers = freeformAnswers ?? [];

  return (
    <div className={styles.freeformWrapper}>
      <div className={styles.freeformToolbar}>
        <button
          className={`${styles.viewToggleBtn} ${view === "list" ? styles.viewToggleActive : ""}`}
          onClick={() => setView("list")}
        >
          <List size={14} />
          Raw answers
          {rawAnswers.length > 0 && (
            <span className={styles.viewBadge}>{rawAnswers.length}</span>
          )}
        </button>
        <button
          className={`${styles.viewToggleBtn} ${view === "table" ? styles.viewToggleActive : ""}`}
          onClick={() => setView("table")}
        >
          <BarChart size={14} />
          Aggregate
          <span className={styles.viewBadge}>{aggregated.length}</span>
        </button>
      </div>

      {view === "list" && (
        <>
          {rawAnswers.length === 0 ? (
            <p className={styles.freeformEmpty}>
              Raw answers not loaded.{" "}
              <span className={styles.freeformHint}>
                no one has submitted a freeform response yet,
              </span>
            </p>
          ) : (
            <ul className={styles.freeformList}>
              {rawAnswers.map((ans, i) => (
                <li key={i} className={styles.freeformItem}>
                  <span className={styles.freeformIndex}>#{i + 1}</span>
                  <span className={styles.freeformText}>{ans}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {view === "table" && (
        <table className={styles.freeformTable}>
          <thead>
            <tr>
              <th className={styles.freeformTh}>Answer</th>
              <th
                className={`${styles.freeformTh} ${styles.freeformThSortable}`}
                onClick={() =>
                  setSortDir((d) => (d === "desc" ? "asc" : "desc"))
                }
              >
                Count {sortDir === "desc" ? "↓" : "↑"}
              </th>
              <th className={styles.freeformTh}>Share</th>
            </tr>
          </thead>
          <tbody>
            {aggregated.map((row) => {
              const pct =
                total > 0 ? ((row.count / total) * 100).toFixed(1) : "0";
              return (
                <tr key={row.id} className={styles.freeformRow}>
                  <td className={styles.freeformTd}>{row.text}</td>
                  <td
                    className={`${styles.freeformTd} ${styles.freeformTdNum}`}
                  >
                    {row.count}
                  </td>
                  <td className={styles.freeformTd}>
                    <div className={styles.freeformShareCell}>
                      <div className={styles.freeformShareBar}>
                        <div
                          className={styles.freeformShareFill}
                          style={{
                            width: `${pct}%`,
                          }}
                        />
                      </div>
                      <span className={styles.freeformSharePct}>{pct}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Choice question renderer (pie + legend) ──────────────────────────────────

function ChoiceResults({
  data,
  total,
  dynamicOptions,
}: {
  data: { name: string; value: number }[];
  total: number;
  /** Individual user-submitted "other" entries with their counts */
  dynamicOptions: { id: string; text: string; count: number }[];
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [otherExpanded, setOtherExpanded] = useState(false);

  // Sort descending by value
  const sortedData = [...data].sort((a, b) => b.value - a.value);

  // Index of the "Other / dynamic" slice — always look for it by name if present
  const otherIndex = sortedData.findIndex(d => d.name === "Other / dynamic");

  return (
    <div className={styles.choiceWrapper}>
      <div className={styles.choicePie}>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={sortedData}
              cx="50%"
              cy="50%"
              outerRadius={75}
              innerRadius={32}
              dataKey="value"
              strokeWidth={2}
              stroke="var(--color-bg-card)"
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {sortedData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  opacity={
                    activeIndex === null || activeIndex === index ? 1 : 0.45
                  }
                  style={{ cursor: "default", transition: "opacity 0.15s" }}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-bg-card)",
                borderColor: "var(--color-border)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: number) => [
                `${value} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`,
                "Votes",
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className={styles.choiceLegend}>
        {sortedData.map((entry, index) => {
          const pct =
            total > 0 ? ((entry.value / total) * 100).toFixed(1) : "0";
          const isOther = index === otherIndex;

          return (
            <React.Fragment key={index}>
              <li
                className={`${styles.legendItem} ${activeIndex === index ? styles.legendItemActive : ""} ${isOther ? styles.legendItemOther : ""}`}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <span
                  className={styles.legendSwatch}
                  style={{ background: COLORS[index % COLORS.length] }}
                />
                <span className={styles.legendName}>{entry.name}</span>
                <span className={styles.legendCount}>{entry.value}</span>
                <span className={styles.legendPct}>{pct}%</span>
                {isOther && (
                  <button
                    className={`${styles.otherExpandBtn} ${otherExpanded ? styles.otherExpandBtnOpen : ""}`}
                    onClick={() => setOtherExpanded((v) => !v)}
                    title={
                      otherExpanded ? "Collapse" : "Show submitted answers"
                    }
                  >
                    ▾
                  </button>
                )}
              </li>

              {/* Expandable breakdown of individual "other" submissions */}
              {isOther && otherExpanded && dynamicOptions.length > 0 && (
                <li className={styles.otherBreakdown}>
                  <ul className={styles.otherBreakdownList}>
                    {[...dynamicOptions]
                      .sort((a, b) => b.count - a.count)
                      .map((opt) => {
                        const optPct =
                          total > 0
                            ? ((opt.count / total) * 100).toFixed(1)
                            : "0";
                        return (
                          <li
                            key={opt.id}
                            className={styles.otherBreakdownItem}
                          >
                            <span className={styles.otherBreakdownDot} />
                            <span className={styles.otherBreakdownText}>
                              {opt.text}
                            </span>
                            <span className={styles.otherBreakdownCount}>
                              {opt.count}
                            </span>
                            <span className={styles.otherBreakdownPct}>
                              {optPct}%
                            </span>
                          </li>
                        );
                      })}
                  </ul>
                </li>
              )}
            </React.Fragment>
          );
        })}
        {total > 0 && (
          <li className={styles.legendTotal}>
            <span />
            <span className={styles.legendTotalLabel}>Total</span>
            <span className={styles.legendCount}>{total}</span>
            <span className={styles.legendPct}>100%</span>
          </li>
        )}
      </ul>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SurveyResults({
  survey,
  results,
  participationStats,
}: SurveyResultsProps) {
  const { t } = useI18n();

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

  return (
    <div className={styles.resultsSection}>
      <h2 className={styles.sectionTitle}>
        <ShieldCheck className="w-5 h-5 text-primary" />
        Current Survey Results
      </h2>

      {trendData.length > 0 && (
        <div className={styles.trendChart}>
          <div className={styles.trendHeader}>
            <TrendingUp className={styles.trendIcon} />
            <h3 className={styles.trendTitle}>Participation Tendencies</h3>
          </div>
          <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height={200}>
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

      <div className={styles.resultsGrid}>
        {results.results.map((r) => {
          const q = survey.questions.find((q) => q.id === r.questionId);
          if (!q) return null;

          const isScale = q.type === SurveyQuestionType.SCALE;
          const isFreeform = q.type === SurveyQuestionType.FREEFORM;
          const isChoice =
            q.type === SurveyQuestionType.SINGLE_CHOICE ||
            q.type === SurveyQuestionType.MULTIPLE_CHOICE;

          return (
            <Card
              key={r.questionId}
              className={`${styles.resultCard} ${isFreeform ? styles.resultCardWide : ""}`}
            >
              <div className={styles.resultHeader}>
                <BarChart2 className={styles.resultIcon} />
                <h3 className={styles.resultQuestionTitle}>{q.text}</h3>
                <span className={styles.questionTypeBadge}>
                  {q.type.replace(/_/g, " ").toLowerCase()}
                </span>
              </div>

              {/* ── Scale ── */}
              {isScale && (
                <ScaleResults
                  options={r.options}
                  scaleMin={q.scaleConfig?.scaleMin ?? 1}
                  scaleMax={q.scaleConfig?.scaleMax ?? 5}
                />
              )}

              {/* ── Freeform ── */}
              {isFreeform && (
                <FreeformResults
                  options={r.options}
                  freeformAnswers={r.freeformAnswers}
                  total={results.totalResponses}
                />
              )}

              {isChoice &&
                (() => {
                  const staticOptionIds = new Set(
                    q.options.filter((o) => !o.isDynamic).map((o) => o.id),
                  );

                  const staticData = r.options
                    .filter((opt) => staticOptionIds.has(opt.id))
                    .map((opt) => ({ name: opt.text, value: opt.count }));

                  const dynamicOptions = r.options.filter(
                    (opt) => !staticOptionIds.has(opt.id),
                  );

                  const dynamicCount =
                    dynamicOptions.reduce((sum, opt) => sum + opt.count, 0) +
                    (r.otherCount ?? 0);

                  const data = [...staticData];
                  if (dynamicCount > 0) {
                    data.push({ name: "Other / dynamic", value: dynamicCount });
                  }

                  const total = data.reduce((s, d) => s + d.value, 0);

                  return (
                    <ChoiceResults
                      data={data}
                      total={total}
                      dynamicOptions={dynamicOptions}
                    />
                  );
                })()}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
