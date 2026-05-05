"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useI18n } from "@/lib/i18n/context";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/common/Card";
import { useVotings } from "@/hooks/api/useVotings";
import { useVotingUpdates } from "@/hooks/useSocket";
import styles from "./RealtimeChart.module.css";

interface DataPoint {
  time: string;
  votes: number;
}

export function RealtimeChart() {
  const { t } = useI18n();
  const { votings, fetchVotings, fetchParticipationStats, fetchGlobalTrends } = useVotings();
  const [selectedVotingId, setSelectedVotingId] = useState<string | "global">("global");
  const [view, setView] = useState<"distribution" | "participation">("participation");
  const [participationData, setParticipationData] = useState<DataPoint[]>([]);
  const [distributionData, setDistributionData] = useState<Array<{ label: string; votes: number }>>([]);
  
  const activeVotings = useMemo(() => 
    votings.filter(v => v.status === "active"), 
    [votings]
  );

  useEffect(() => {
    fetchVotings();
  }, [fetchVotings]);

  useEffect(() => {
    if (selectedVotingId === "global") {
      setView("participation");
      fetchGlobalTrends().then(res => {
        if (res.data) {
          setParticipationData(res.data.map(d => ({
            time: d.timestamp.split('T')[1].substring(0, 5), // Format HH:mm
            votes: d.count
          })));
        }
      });
    } else {
      // Load initial stats for specific voting
      fetchParticipationStats(selectedVotingId).then(res => {
        if (res.data) {
          setParticipationData(res.data.map(d => ({
            time: new Date(d.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            votes: d.votes
          })));
        }
      });

      // Load initial distribution from current votings state
      const voting = votings.find(v => v.id === selectedVotingId);
      if (voting) {
        setDistributionData([
          ...voting.options.map(o => ({ label: o.text, votes: o.voteCount })),
          { label: "Abstentions", votes: voting.abstentionsCount }
        ]);
      }
    }
  }, [selectedVotingId, fetchParticipationStats, fetchGlobalTrends, votings]);

  useVotingUpdates(selectedVotingId !== "global" ? selectedVotingId : null, (data) => {
    if (selectedVotingId === "global") return;

    // Update distribution data
    setDistributionData([
      ...data.results.options.map((o: any) => ({ label: o.text, votes: o.voteCount })),
      { label: "Abstentions", votes: (data.results as any).abstentionsCount || 0 }
    ]);

    // Update participation data (add current pulse)
    const now = new Date();
    const timeLabel = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    setParticipationData(prev => {
      const last = prev[prev.length - 1];
      if (last && last.time === timeLabel) {
        return [...prev.slice(0, -1), { ...last, votes: last.votes + 1 }];
      }
      return [...prev, { time: timeLabel, votes: 1 }].slice(-15);
    });
  });

  const maxValue = useMemo(() => {
    const data = view === "distribution" ? distributionData : participationData;
    return Math.max(...data.map(d => d.votes), 5);
  }, [view, distributionData, participationData]);

  const getBarHeight = (votes: number) => {
    return (votes / maxValue) * 100;
  };

  return (
    <Card padding="lg">
      <CardHeader>
        <div className={styles.headerRow}>
          <div className={styles.titleGroup}>
            <CardTitle>{selectedVotingId === "global" ? "System-wide Trends" : "Voting Activity"}</CardTitle>
            <select 
              className={styles.votingSelect}
              value={selectedVotingId} 
              onChange={(e) => setSelectedVotingId(e.target.value)}
            >
              <option value="global">All Activity (Global)</option>
              {activeVotings.map(v => (
                <option key={v.id} value={v.id}>{v.title}</option>
              ))}
            </select>
          </div>
          {selectedVotingId !== "global" && (
            <div className={styles.toggleGroup}>
              <button 
                className={`${styles.toggleButton} ${view === "participation" ? styles.active : ""}`}
                onClick={() => setView("participation")}
              >
                Timeline
              </button>
              <button 
                className={`${styles.toggleButton} ${view === "distribution" ? styles.active : ""}`}
                onClick={() => setView("distribution")}
              >
                Results
              </button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className={styles.chart}>
          <div className={styles.yAxis}>
            <span>{maxValue}</span>
            <span>{Math.floor(maxValue / 2)}</span>
            <span>0</span>
          </div>
          <div className={styles.bars}>
            {(view === "distribution" ? distributionData : participationData).map((point, index) => (
              <div key={index} className={styles.barContainer}>
                <div
                  className={styles.bar}
                  style={{ height: `${getBarHeight(point.votes)}%` }}
                >
                  <span className={styles.barTooltip}>
                    {point.votes} {selectedVotingId === "global" ? "ballots" : "votes"} {view === "distribution" && `for ${(point as any).label}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.xAxis}>
          {(view === "distribution" ? distributionData : participationData).map(
            (point, index) => (
              <span key={index} className={styles.xLabel}>
                {view === "distribution" ? (point as any).label.slice(0, 6) : (index % 3 === 0 ? point.time : "")}
              </span>
            ),
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default RealtimeChart;
