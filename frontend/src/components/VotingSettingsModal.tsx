// src/components/VotingSettingsModal.tsx

import React, { useState } from "react";
import { protectedFetch } from "../utils/api";

interface VotingSettingsModalProps {
  voting: {
    id: string;
    title: string;
    startAt?: string;
    endAt?: string;
  };
  onClose: () => void;
  onUpdate: () => void; // Function to refresh the list after a change
}

// Helper to convert ISO date string (UTC) to local datetime format for input
const toLocalDatetime = (isoString: string | undefined): string => {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    // Format to YYYY-MM-DDTHH:mm (required for datetime-local input)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
  } catch (e) {
    return "";
  }
};

const VotingSettingsModal: React.FC<VotingSettingsModalProps> = ({
  voting,
  onClose,
  onUpdate,
}) => {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Initialize states with existing values converted to local format
  const [startDateTime, setStartDateTime] = useState(
    toLocalDatetime(voting.startAt)
  );
  const [endDateTime, setEndDateTime] = useState(toLocalDatetime(voting.endAt));

  const isCurrentlyActive = (): boolean => {
    const now = new Date().getTime();
    const startTime = voting.startAt ? new Date(voting.startAt).getTime() : 0;
    const endTime = voting.endAt ? new Date(voting.endAt).getTime() : Infinity;
    return now >= startTime && now < endTime;
  };

  const active = isCurrentlyActive();
  const ended =
    !active &&
    voting.endAt &&
    new Date(voting.endAt).getTime() <= new Date().getTime();
  const pending =
    !active &&
    !ended &&
    voting.startAt &&
    new Date(voting.startAt).getTime() > new Date().getTime();

  const handleUpdateDates = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      // 1. Convert local date strings back to ISO strings (send null if input is empty)
      const newStartAtISO = startDateTime
        ? new Date(startDateTime).toISOString()
        : null;
      const newEndAtISO = endDateTime
        ? new Date(endDateTime).toISOString()
        : null;

      // 2. Simple validation
      if (
        newStartAtISO &&
        newEndAtISO &&
        new Date(newStartAtISO) >= new Date(newEndAtISO)
      ) {
        throw new Error("Start time must be before end time.");
      }

      // 3. Prepare the update DTO (The backend's VotingUpdateDto needs to accept these)
      const updatePayload = {
        title: voting.title, // Include existing mandatory fields if required by your PUT API
        // ... include other mandatory fields if needed
        startAt: newStartAtISO,
        endAt: newEndAtISO,
      };

      // 4. API Call: PUT /votings/:id
      await protectedFetch(`/votings/${voting.id}`, {
        method: "PUT",
        body: JSON.stringify(updatePayload),
        headers: { "Content-Type": "application/json" },
      });

      setMessage(`Voting dates for '${voting.title}' successfully updated.`);
      onUpdate(); // Trigger refresh on the parent list
      setTimeout(onClose, 1500);
    } catch (err: any) {
      setMessage(err.message || `Failed to update voting dates.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h3>Manage Dates: {voting.title}</h3>

        <p>
          Current Status:{" "}
          <strong
            className={
              active
                ? "status-active"
                : ended
                ? "status-completed"
                : "status-pending"
            }
          >
            {active ? "ACTIVE" : ended ? "COMPLETED" : "PENDING"}
          </strong>
        </p>

        <form onSubmit={handleUpdateDates}>
          <label htmlFor="start-date-time" className="modal-label">
            Start Time (Local):
          </label>
          <input
            id="start-date-time"
            type="datetime-local"
            value={startDateTime}
            onChange={(e) => setStartDateTime(e.target.value)}
            className="modal-input"
            disabled={loading}
          />

          <label htmlFor="end-date-time" className="modal-label">
            End Time (Local):
          </label>
          <input
            id="end-date-time"
            type="datetime-local"
            value={endDateTime}
            onChange={(e) => setEndDateTime(e.target.value)}
            className="modal-input"
            disabled={loading}
          />

          {message && (
            <p
              className={`form-message ${
                message?.includes("successfully") ? "success" : "error"
              }`}
            >
              {message}
            </p>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="action-button secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="action-button primary"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Dates"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VotingSettingsModal;
