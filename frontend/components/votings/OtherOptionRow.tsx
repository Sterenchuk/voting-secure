"use client";

import { useState } from "react";
import { VotingOption } from "@/hooks/api/useVotings";
import styles from "./OtherOptionRow.module.css";

interface Props {
  otherTotal: number;
  totalVotes: number;
  dynamicOptions: VotingOption[];
  showResults: boolean;
}

export function OtherOptionRow({ otherTotal, totalVotes, dynamicOptions, showResults }: Props) {
  const [expanded, setExpanded] = useState(false);

  const pct = totalVotes > 0 ? Math.round((otherTotal / totalVotes) * 100) : 0;

  const sorted = [...dynamicOptions].sort((a, b) => b.voteCount - a.voteCount);

  return (
    <li className={styles.otherRow}>
      <div className={styles.optionRow}>
        <span className={styles.optionText}>Other</span>
        {showResults && <span className={styles.optionPct}>{pct}%</span>}
      </div>

      {showResults && (
        <div className={styles.progressBar}>
          <div className={styles.progressFill} style={{ width: `${pct}%` }} />
        </div>
      )}

      {showResults && dynamicOptions.length > 0 && (
        <button className={styles.toggleBtn} onClick={() => setExpanded(e => !e)}>
          {expanded ? '▲' : '▼'} {expanded ? 'Hide' : 'Show'} responses ({dynamicOptions.length})
        </button>
      )}

      {expanded && (
        <ul className={styles.dynamicList}>
          {sorted.map(opt => {
            const subPct = totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0;

            return (
              <li key={opt.id} className={styles.dynamicItem}>
                <div className={styles.dynamicRow}>
                  <span className={styles.dynamicText}>"{opt.text}"</span>
                  <span className={styles.dynamicMeta}>
                    {opt.voteCount} {opt.voteCount === 1 ? 'vote' : 'votes'} · {subPct}%
                  </span>
                </div>
                <div className={styles.subProgressBar}>
                  <div className={styles.subProgressFill} style={{ width: `${subPct}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
}
