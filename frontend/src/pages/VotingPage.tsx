import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { protectedFetch } from "../utils/api";
import { connectSocket } from "../utils/socket";
import type { Socket } from "socket.io-client";
import type { VotingType, RandomizerType } from "../types/votings";
import RandomizerGames from "../components/RandomizerGames";
import "../styles/Home.css";
import "../styles/VotingPage.css";

interface Voting {
  id: string;
  title: string;
  description?: string;
  groupId: string;
  groupName?: string;
  createdBy?: string;
  type: VotingType;
  randomizerType?: RandomizerType;
  allowUserOptions?: boolean;
  optionsLockAt?: string;
  startAt?: string;
  endAt?: string;
  voteCount: number;
  allowMultiple?: boolean;
  minChoices?: number;
  maxChoices?: number;
  options?: Option[];
}

interface Option {
  id: string;
  text: string;
  voteCount: number;
  addedBy: string;
}

export default function VotingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [voting, setVoting] = useState<Voting | null>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [hasUserVoted, setHasUserVoted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [fetchedGroupName, setFetchedGroupName] = useState<string | null>(null);
  const [showAddOptionModal, setShowAddOptionModal] = useState(false);
  const [newOptionText, setNewOptionText] = useState("");
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingOptionText, setEditingOptionText] = useState("");
  const [showRandomizer, setShowRandomizer] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [, setTick] = useState(0);

  const token = localStorage.getItem("accessToken") || "";
  const currentUserId = localStorage.getItem("userId") || "";

  const minChoices = voting?.minChoices ?? 1;
  const maxChoices = voting?.maxChoices ?? options.length;

  const isMultipleChoice = useMemo(() => {
    return voting?.type === "MULTIPLE_CHOICE";
  }, [voting?.type]);

  const isVotingActive = useMemo(() => {
    if (!voting) return false;
    const now = Date.now();
    const start = voting.startAt ? new Date(voting.startAt).getTime() : 0;
    const end = voting.endAt ? new Date(voting.endAt).getTime() : Infinity;
    return now >= start && now < end;
  }, [voting]);

  const isCompleted = useMemo(() => {
    if (!voting) return false;
    const now = Date.now();
    const end = voting.endAt ? new Date(voting.endAt).getTime() : Infinity;
    return now >= end;
  }, [voting]);

  const canAddOptions = useMemo(() => {
    if (!voting?.allowUserOptions) return false;
    if (!voting.optionsLockAt) return true;
    return Date.now() < new Date(voting.optionsLockAt).getTime();
  }, [voting]);

  const showResults = isCompleted || hasUserVoted;
  const totalVotes = useMemo(
    () => options.reduce((sum, o) => sum + o.voteCount, 0),
    [options]
  );

  const isVoteValid = useMemo(() => {
    const count = selectedOptions.length;
    return count >= minChoices && count <= maxChoices;
  }, [selectedOptions.length, minChoices, maxChoices]);

  const shouldUseCoinFlip = useMemo(() => {
    return (
      voting?.type === "FRIENDLY" &&
      voting?.randomizerType &&
      voting.randomizerType !== "NONE" &&
      options.length === 2
    );
  }, [voting, options.length]);

  const fetchVotingDetails = useCallback(async () => {
    if (!id) return null;
    try {
      const votingData = await protectedFetch(`/votings/${id}`);
      if (votingData.redirectUrl) {
        navigate(votingData.redirectUrl);
        return null;
      }
      return votingData;
    } catch (error) {
      setMessage({ text: "Could not load voting details.", type: "error" });
      return null;
    }
  }, [id, navigate]);

  const fetchGroupName = useCallback(async (groupId: string) => {
    try {
      const groupData = await protectedFetch(`/groups/${groupId}`);
      setFetchedGroupName(groupData.name);
    } catch (error) {
      console.error("Failed to fetch group name", error);
    }
  }, []);

  const fetchUserVote = useCallback(async () => {
    if (!id) return;
    try {
      const data = await protectedFetch(`/votings/${id}/user-vote`);
      if (data.optionId) {
        const ids = Array.isArray(data.optionId)
          ? data.optionId
          : [data.optionId];
        setHasUserVoted(true);
        setSelectedOptions(ids);
      } else {
        setHasUserVoted(false);
        setSelectedOptions([]);
      }
    } catch (error) {
      console.error("Failed to fetch user vote", error);
    }
  }, [id]);

  useEffect(() => {
    let isMounted = true;
    let socket: Socket | null = null;

    const initialize = async () => {
      setLoading(true);
      const votingData = await fetchVotingDetails();
      if (!isMounted || !votingData) {
        setLoading(false);
        return;
      }

      setVoting({
        ...votingData,
        voteCount: votingData.options
          ? votingData.options.reduce(
              (sum: number, o: Option) => sum + o.voteCount,
              0
            )
          : 0,
      });
      if (votingData.options) setOptions(votingData.options);

      await Promise.all([
        fetchUserVote(),
        votingData.groupId && !votingData.groupName
          ? fetchGroupName(votingData.groupId)
          : Promise.resolve(),
      ]);

      setLoading(false);

      if (id && token) {
        socket = connectSocket(token);
        const subscribe = () =>
          socket?.emit("subscribe:voting", { votingId: id });
        socket.on("connect", subscribe);
        if (socket.connected) subscribe();

        socket.on(
          "voting.results",
          (payload: { votingId: string; results: Option[] }) => {
            if (payload.votingId !== id) return;
            console.log("📊 Received real-time results:", payload.results);
            setOptions(payload.results);
            setVoting((prev) =>
              prev
                ? {
                    ...prev,
                    voteCount: payload.results.reduce(
                      (sum, o) => sum + o.voteCount,
                      0
                    ),
                  }
                : null
            );
          }
        );

        socket.on(
          "option.added",
          (payload: { votingId: string; option: Option }) => {
            if (payload.votingId !== id) return;
            setOptions((prev) =>
              prev.some((o) => o.id === payload.option.id)
                ? prev
                : [...prev, payload.option]
            );
          }
        );

        socket.on(
          "option.deleted",
          (payload: { votingId: string; optionId: string }) => {
            if (payload.votingId !== id) return;
            setOptions((prev) => prev.filter((o) => o.id !== payload.optionId));
          }
        );
      }
    };

    initialize();

    const timer = setInterval(() => setTick((t) => t + 1), 1000);

    return () => {
      isMounted = false;
      clearInterval(timer);
      if (socket) {
        socket.emit("unsubscribe:voting", { votingId: id });
        socket.off("voting.results");
        socket.off("option.added");
        socket.off("option.deleted");
        socket.disconnect();
      }
    };
  }, [id, token, fetchVotingDetails, fetchUserVote, fetchGroupName]);

  const toggleOption = (optionId: string) => {
    if (hasUserVoted || !isVotingActive || isSubmitting) return;

    setSelectedOptions((prev) => {
      if (prev.includes(optionId)) {
        return prev.filter((id) => id !== optionId);
      }
      if (isMultipleChoice) {
        if (prev.length >= maxChoices) {
          setMessage({
            text: `You can select a maximum of ${maxChoices} options`,
            type: "info",
          });
          return prev;
        }
        return [...prev, optionId];
      }

      return [optionId];
    });
  };

  const submitVote = async (optionIds: string[]) => {
    if (!id || optionIds.length === 0 || isSubmitting) return;

    setMessage(null);
    setIsSubmitting(true);

    try {
      await protectedFetch(`/votings/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ votingId: id, optionId: optionIds }),
      });

      // Wait for server to confirm and fetch updated data
      await fetchUserVote();

      setMessage({ text: "Vote cast successfully!", type: "success" });
    } catch (error: any) {
      if (error.message?.includes("already voted")) {
        await fetchUserVote();
        setMessage({ text: "You have already voted.", type: "info" });
      } else {
        setMessage({
          text: error.message || "Failed to submit vote.",
          type: "error",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVoteAction = () => {
    if (!isVoteValid || hasUserVoted || !isVotingActive || isSubmitting) return;

    if (
      voting?.type === "FRIENDLY" &&
      voting.randomizerType &&
      voting.randomizerType !== "NONE"
    ) {
      setShowRandomizer(true);
    } else {
      submitVote(selectedOptions);
    }
  };

  const handleAddOptionConfirm = async () => {
    if (!newOptionText.trim() || !id) return;
    try {
      await protectedFetch(`/votings/${id}/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newOptionText.trim() }),
      });
      setShowAddOptionModal(false);
      setNewOptionText("");
    } catch (error: any) {
      setMessage({
        text: error.message || "Failed to add option.",
        type: "error",
      });
    }
  };

  const handleSaveEdit = async (optionId: string) => {
    if (!editingOptionText.trim() || !id) return;
    try {
      await protectedFetch(`/votings/${id}/options/${optionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editingOptionText.trim() }),
      });
      setEditingOptionId(null);
    } catch (error: any) {
      setMessage({
        text: error.message || "Failed to update option.",
        type: "error",
      });
    }
  };

  const handleRemoveUserOption = async (option: Option) => {
    if (!id || option.addedBy !== currentUserId) return;
    try {
      await protectedFetch(`/votings/${id}/options/${option.id}`, {
        method: "DELETE",
      });
    } catch (error: any) {
      setMessage({
        text: error.message || "Failed to remove option.",
        type: "error",
      });
    }
  };

  const handleDeleteVoting = async () => {
    if (!id || isDeleting) return;

    setIsDeleting(true);
    setMessage(null);

    try {
      await protectedFetch(`/votings/${id}`, {
        method: "DELETE",
      });

      setMessage({ text: "Voting deleted successfully!", type: "success" });

      // Navigate back after a short delay
      setTimeout(() => {
        navigate(-1);
      }, 1500);
    } catch (error: any) {
      setMessage({
        text: error.message || "Failed to delete voting.",
        type: "error",
      });
      setIsDeleting(false);
    }
  };

  if (loading)
    return (
      <div className="voting-loading-screen">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );

  if (!voting)
    return (
      <div className="voting-error-container">
        <h2>Not Found</h2>
        <button onClick={() => navigate(-1)}>Back</button>
      </div>
    );

  return (
    <div className="voting-page-wrapper">
      <header className="voting-nav">
        <button onClick={() => navigate(-1)} className="glass-back-button">
          ← Back
        </button>
        {voting.createdBy === currentUserId && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="glass-delete-button"
            style={{
              marginLeft: "auto",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              color: "#ef4444",
              border: "1px solid rgba(239, 68, 68, 0.2)",
            }}
          >
            🗑️ Delete
          </button>
        )}
      </header>

      <main className="voting-container">
        <div className="voting-card-hero">
          <div className="hero-content">
            <div className="group-tag">
              {fetchedGroupName || voting.groupName}
            </div>
            <h1 className="hero-title">{voting.title}</h1>
            {voting.description && (
              <p className="hero-desc">{voting.description}</p>
            )}
          </div>
          <div className="hero-meta">
            <div
              className={`status-pill ${
                isVotingActive
                  ? "pulse-active"
                  : isCompleted
                  ? "pill-completed"
                  : "pill-pending"
              }`}
            >
              {isVotingActive
                ? "• Active"
                : isCompleted
                ? "Completed"
                : "Scheduled"}
            </div>
            <div className="vote-stat">
              <span className="stat-value">{totalVotes}</span>
              <span className="stat-label">Total Votes</span>
            </div>
          </div>
        </div>

        {voting.type === "FRIENDLY" &&
          voting.randomizerType &&
          voting.randomizerType !== "NONE" && (
            <div className="method-banner">
              <span>
                {shouldUseCoinFlip ? "🪙" : "🎲"} Randomizer:{" "}
                <strong>
                  {shouldUseCoinFlip ? "COIN_FLIP" : voting.randomizerType}
                </strong>
              </span>
            </div>
          )}

        <section className="voting-section">
          {message && (
            <div className={`alert-box alert-${message.type}`}>
              {message.text}
            </div>
          )}
          <div className="section-header">
            <h2>{showResults ? "Live Results" : "Choices"}</h2>
            {canAddOptions && !showResults && (
              <button
                onClick={() => setShowAddOptionModal(true)}
                className="add-option-trigger"
              >
                + Add
              </button>
            )}
          </div>

          {isMultipleChoice && !showResults && (
            <div
              style={{
                marginBottom: "16px",
                color: "#94a3b8",
                fontSize: "14px",
                textAlign: "center",
              }}
            >
              Select{" "}
              {minChoices === maxChoices
                ? minChoices
                : `${minChoices}–${maxChoices}`}{" "}
              option
              {minChoices !== 1 || maxChoices !== 1 ? "s" : ""}
            </div>
          )}

          <div className="options-grid">
            {options.map((option) => {
              const isSelected = selectedOptions.includes(option.id);
              const percentage = totalVotes
                ? (option.voteCount / totalVotes) * 100
                : 0;
              const isEditing = editingOptionId === option.id;
              const canModify =
                option.addedBy === currentUserId &&
                !isVotingActive &&
                isCompleted;

              return (
                <div
                  key={option.id}
                  className={`option-card ${isSelected ? "selected" : ""} ${
                    showResults ? "result-mode" : "vote-mode"
                  } ${isSubmitting ? "disabled" : ""}`}
                  onClick={() =>
                    !showResults &&
                    isVotingActive &&
                    !isEditing &&
                    !isSubmitting &&
                    toggleOption(option.id)
                  }
                >
                  {showResults && (
                    <div
                      className="progress-bg"
                      style={{ width: `${percentage}%` }}
                    />
                  )}

                  <div className="option-main">
                    {!showResults && !isEditing && (
                      <div
                        className={
                          isMultipleChoice ? "custom-checkbox" : "custom-radio"
                        }
                      >
                        {isSelected && (
                          <span className="inner-check">
                            {isMultipleChoice ? "✓" : "●"}
                          </span>
                        )}
                      </div>
                    )}

                    {isEditing ? (
                      <input
                        className="edit-option-input"
                        value={editingOptionText}
                        onChange={(e) => setEditingOptionText(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    ) : (
                      <span className="option-text">{option.text}</span>
                    )}
                  </div>

                  {showResults && !isEditing && (
                    <div className="option-meta-results">
                      <span>{percentage.toFixed(1)}%</span>
                      <span>{option.voteCount} votes</span>
                    </div>
                  )}

                  {canModify && !isEditing && (
                    <div className="option-actions">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingOptionId(option.id);
                          setEditingOptionText(option.text);
                        }}
                      >
                        ✎
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveUserOption(option);
                        }}
                      >
                        👊
                      </button>
                    </div>
                  )}

                  {isEditing && (
                    <div className="option-edit-actions">
                      <button onClick={() => handleSaveEdit(option.id)}>
                        ✓
                      </button>
                      <button onClick={() => setEditingOptionId(null)}>
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {isVotingActive && !showResults && (
            <div className="action-footer">
              {isMultipleChoice && (
                <div
                  style={{
                    marginBottom: "10px",
                    color: "#cbd5e1",
                    fontSize: "15px",
                  }}
                >
                  Selected: <strong>{selectedOptions.length}</strong> /{" "}
                  {maxChoices}
                </div>
              )}
              <button
                onClick={handleVoteAction}
                className="primary-vote-button"
                disabled={
                  !isVoteValid || selectedOptions.length === 0 || isSubmitting
                }
              >
                {isSubmitting
                  ? "Submitting..."
                  : voting.randomizerType && voting.randomizerType !== "NONE"
                  ? "Play Randomizer"
                  : "Vote"}
              </button>
            </div>
          )}
        </section>
      </main>

      {showAddOptionModal && (
        <div className="modal-backdrop">
          <div className="modal-sheet">
            <h3>New Option</h3>
            <input
              value={newOptionText}
              onChange={(e) => setNewOptionText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddOptionConfirm()}
              autoFocus
            />
            <div className="modal-actions">
              <button onClick={() => setShowAddOptionModal(false)}>
                Cancel
              </button>
              <button
                onClick={handleAddOptionConfirm}
                disabled={!newOptionText.trim()}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {showRandomizer && voting?.randomizerType && (
        <RandomizerGames
          type={
            shouldUseCoinFlip
              ? "COIN_FLIP"
              : (voting.randomizerType as Exclude<RandomizerType, "NONE">)
          }
          options={options}
          onResult={(winnerId) => {
            submitVote([winnerId]);
            setShowRandomizer(false);
          }}
          onClose={() => setShowRandomizer(false)}
        />
      )}

      {showDeleteConfirm && (
        <div className="modal-backdrop">
          <div className="modal-sheet">
            <h3 style={{ color: "#ef4444" }}>⚠️ Delete Voting</h3>
            <p style={{ marginBottom: "20px", color: "#94a3b8" }}>
              Are you sure you want to delete <strong>"{voting.title}"</strong>?
              <br />
              <span style={{ fontSize: "14px" }}>
                This action cannot be undone. All votes and data will be
                permanently deleted.
              </span>
            </p>
            <div className="modal-actions">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteVoting}
                disabled={isDeleting}
                style={{
                  backgroundColor: "#ef4444",
                  color: "white",
                }}
              >
                {isDeleting ? "Deleting..." : "Delete Voting"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
