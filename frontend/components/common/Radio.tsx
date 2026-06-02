"use client";

import React from "react";
import styles from "./Radio.module.css";

interface RadioProps {
  checked: boolean;
  onChange: () => void;
  label?: React.ReactNode;
  hint?: string;
  disabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
}

export function Radio({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
  name,
  id,
  className,
}: RadioProps) {
  const radioId = id || React.useId();

  return (
    <div className={`${styles.radioWrapper} ${className || ""}`}>
      <label
        htmlFor={radioId}
        className={`${styles.labelContainer} ${disabled ? styles.disabled : ""}`}
      >
        <input
          type="radio"
          id={radioId}
          name={name}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className={styles.hiddenInput}
        />
        <div
          className={`${styles.radioControl} ${
            checked ? styles.radioControlChecked : ""
          }`}
        >
          {checked && <div className={styles.radioInner} />}
        </div>
        {(label || hint) && (
          <div className={styles.textContainer}>
            {label && <span className={styles.radioLabel}>{label}</span>}
            {hint && <span className={styles.radioHint}>{hint}</span>}
          </div>
        )}
      </label>
    </div>
  );
}
