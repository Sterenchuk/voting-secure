"use client";

import React from "react";
import styles from "./Toggle.module.css";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  hint?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
  id,
  className,
}: ToggleProps) {
  const toggleId = id || React.useId();

  return (
    <div className={`${styles.toggleWrapper} ${className || ""}`}>
      <div className={styles.textContainer}>
        {label && (
          <label htmlFor={toggleId} className={styles.toggleLabel}>
            {label}
          </label>
        )}
        {hint && <span className={styles.toggleHint}>{hint}</span>}
      </div>
      <button
        id={toggleId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={`${styles.toggle} ${checked ? styles.toggleOn : ""} ${
          disabled ? styles.disabled : ""
        }`}
        onClick={() => !disabled && onChange(!checked)}
      >
        <span className={styles.toggleThumb} />
      </button>
    </div>
  );
}
