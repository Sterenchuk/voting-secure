"use client";

import React, { useState, useEffect, useRef } from "react";
import { useI18n } from "@/lib/i18n/context";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/common/Card";
import styles from "./RealtimeChart.module.css";

interface DataPoint {
  time: string;
  votes: number;
}

const generateInitialData = (): DataPoint[] => {
  const data: DataPoint[] = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const time = new Date(now.getTime() - i * 5000);
    data.push({
      time: time.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      votes: Math.floor(Math.random() * 30) + 10,
    });
  }

  return data;
};

export function RealtimeChart() {
  const { t } = useI18n();
  const [data, setData] = useState<DataPoint[]>([]);
  const [isLive, setIsLive] = useState(true);
  const maxValue = useRef(50);

  useEffect(() => {
    setData(generateInitialData());
  }, []);

  useEffect(() => {
    if (!isLive) return;

    const interval = setInterval(() => {
      setData((prevData) => {
        const newVotes = Math.floor(Math.random() * 30) + 10;
        const newTime = new Date().toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        const newData = [
          ...prevData.slice(1),
          { time: newTime, votes: newVotes },
        ];
        maxValue.current = Math.max(...newData.map((d) => d.votes), 50);

        return newData;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [isLive]);

  const getBarHeight = (votes: number) => {
    return (votes / maxValue.current) * 100;
  };

  return (
    <Card padding="lg">
      <CardHeader>
        <div className={styles.headerRow}>
          <CardTitle>Real-Time Voting Activity</CardTitle>
          <button
            className={`${styles.liveButton} ${isLive ? styles.liveActive : ""}`}
            onClick={() => setIsLive(!isLive)}
          >
            <span className={styles.liveDot} />
            {isLive ? "Live" : "Paused"}
          </button>
        </div>
      </CardHeader>
      <CardContent>
        <div className={styles.chart}>
          <div className={styles.yAxis}>
            <span>{maxValue.current}</span>
            <span>{Math.floor(maxValue.current / 2)}</span>
            <span>0</span>
          </div>
          <div className={styles.bars}>
            {data.map((point, index) => (
              <div key={index} className={styles.barContainer}>
                <div
                  className={styles.bar}
                  style={{ height: `${getBarHeight(point.votes)}%` }}
                >
                  <span className={styles.barTooltip}>{point.votes} votes</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.xAxis}>
          {data.map(
            (point, index) =>
              index % 3 === 0 && (
                <span key={index} className={styles.xLabel}>
                  {point.time.split(":").slice(1).join(":")}
                </span>
              ),
          )}
        </div>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={styles.legendDot} />
            Votes per interval
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default RealtimeChart;
