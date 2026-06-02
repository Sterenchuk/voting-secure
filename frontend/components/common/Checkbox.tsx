"use client";

import React from "react";
import styles from "./Checkbox.module.css";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  hint?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function Checkbox({
  checked,
  onChange,
  label,
  hint,
  disabled = false,
  id,
  className,
}: CheckboxProps) {
  const checkboxId = id || React.useId();

  return (
    <div className={`${styles.checkboxWrapper} ${className || ""}`}>
      <label htmlFor={checkboxId} className={`${styles.labelContainer} ${disabled ? styles.disabled : ""}`}>
        <input
          type="checkbox"
          id={checkboxId}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className={styles.hiddenInput}
        />
        <div
          className={`${styles.checkboxControl} ${
            checked ? styles.checkboxControlChecked : ""
          }`}
        >
          {checked && (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              width="12"
              height="12"
              className={styles.checkmark}
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        {(label || hint) && (
          <div className={styles.textContainer}>
            {label && <span className={styles.checkboxLabel}>{label}</span>}
            {hint && <span className={styles.checkboxHint}>{hint}</span>}
          </div>
        )}
      </label>
    </div>
  );
}
