// src/pages/SurveyDetail.tsx

import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { protectedFetch } from "../utils/api";
import "../styles/VotingPage.css"; // Your provided beautiful CSS

interface Option {
  id: string;
  text: string;
}

interface Question {
  id: string;
  text: string;
  description?: string | null;
  allowMultiple: boolean;
  options: Option[];
}

interface Survey {
  id: string;
  title: string;
  description?: string | null;
  groupName?: string;
  startAt?: string | null;
  endAt?: string | null;
  isOpen: boolean;
  showAggregateResults: boolean;
  allowAnonymous: boolean;
  type: string; // "SURVEY" | others
  questions: Question[];
}

interface SurveyResults {
  votingId: string;
  title: string;
  totalResponses: number;
  questions: {
    questionId: string;
    text: string;
    options: {
      optionId: string;
      text: string;
      responseCount: number;
      percentage: number;
      respondents?: { userId: string; name: string }[];
    }[];
  }[];
}

export default function SurveyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [results, setResults] = useState<SurveyResults | null>(null);
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<string, string[]>
  >({});
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alert, setAlert] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  // Robust survey detection
  const isActuallyASurvey = (data: any): boolean => {
    return (
      data.type === "SURVEY" ||
      (Array.isArray(data.questions) && data.questions.length > 0)
    );
  };

  useEffect(() => {
    const fetchSurvey = async () => {
      try {
        setLoading(true);
        setError(null);

        const data = await protectedFetch(`/votings/${id}`);

        // Critical fix: Detect survey properly even if backend sends isSurvey: false
        if (!isActuallyASurvey(data)) {
          // This is a regular voting/poll, redirect to normal voting page
          navigate(`/votings/${id}`);
          return;
        }

        // Enrich with groupName if missing (fallback)
        const enrichedSurvey: Survey = {
          ...data,
          groupName: data.groupName || "Unknown Group",
        };

        setSurvey(enrichedSurvey);

        // Fetch results to show aggregates and detect prior submission
        try {
          const resData = await protectedFetch(`/votings/${id}/results`);
          setResults(resData);
          // If totalResponses > 0, likely someone answered; but we rely on backend duplicate prevention
        } catch (resErr) {
          console.warn("Could not load results yet:", resErr);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load survey.");
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchSurvey();
  }, [id, navigate]);

  const handleOptionToggle = (
    questionId: string,
    optionId: string,
    allowMultiple: boolean
  ) => {
    if (hasSubmitted || isSurveyEnded || !isActive) return;

    setSelectedAnswers((prev) => {
      const current = prev[questionId] || [];

      if (allowMultiple) {
        if (current.includes(optionId)) {
          return {
            ...prev,
            [questionId]: current.filter((id) => id !== optionId),
          };
        } else {
          return { ...prev, [questionId]: [...current, optionId] };
        }
      } else {
        // Single select: toggle off if already selected
        return {
          ...prev,
          [questionId]: current[0] === optionId ? [] : [optionId],
        };
      }
    });
  };

  const handleSubmit = async () => {
    if (!survey || submitting || hasSubmitted) return;

    // Check for unanswered questions
    const unanswered = survey.questions.filter(
      (q) => !selectedAnswers[q.id] || selectedAnswers[q.id].length === 0
    );

    if (unanswered.length > 0) {
      setAlert({
        type: "error",
        message: "Please answer all questions before submitting.",
      });
      setTimeout(() => setAlert(null), 5000);
      return;
    }

    try {
      setSubmitting(true);
      setAlert(null);

      const answers = Object.entries(selectedAnswers).map(
        ([questionId, optionIds]) => ({
          questionId,
          optionIds,
        })
      );

      await protectedFetch(`/votings/${id}/survey`, {
        method: "POST",
        body: JSON.stringify(answers),
      });

      setHasSubmitted(true);
      setAlert({
        type: "success",
        message: "Thank you! Your responses have been recorded.",
      });

      // Refresh results
      const resData = await protectedFetch(`/votings/${id}/results`);
      setResults(resData);
    } catch (err: any) {
      const msg =
        err.message ||
        "Failed to submit. You may have already answered this survey.";
      setAlert({ type: "error", message: msg });
    } finally {
      setSubmitting(false);
      setTimeout(() => setAlert(null), 6000);
    }
  };

  if (!survey) {
    if (loading) {
      return (
        <div className="voting-loading-screen">
          <div className="spinner"></div>
          <p>Loading survey...</p>
        </div>
      );
    }

    return (
      <div className="voting-error-container">
        <h2>Survey Not Found</h2>
        <p>{error || "This survey doesn't exist or has been removed."}</p>
        <Link to="/votings" className="primary-vote-button">
          Back to List
        </Link>
      </div>
    );
  }

  const now = new Date();
  const startDate = survey.startAt ? new Date(survey.startAt) : null;
  const endDate = survey.endAt ? new Date(survey.endAt) : null;

  const isPending = startDate ? now < startDate : false;
  const isActive = !isPending && (!endDate || now < endDate);
  const isSurveyEnded = endDate ? now >= endDate : false;

  const getStatusClass = () => {
    if (isPending) return "pill-pending";
    if (isSurveyEnded) return "pill-completed";
    return "pulse-active";
  };

  const getStatusText = () => {
    if (isPending) return "Pending";
    if (isSurveyEnded) return "Completed";
    return "Active";
  };

  return (
    <div className="voting-page-wrapper">
      <div className="voting-nav">
        <Link to="/votings" className="glass-back-button">
          ← Back to Surveys
        </Link>
      </div>

      <div className="voting-container">
        {/* Alert Banner */}
        {alert && (
          <div className={`alert-box alert-${alert.type}`}>{alert.message}</div>
        )}

        {/* Hero Card */}
        <div className="voting-card-hero">
          <div className="hero-content">
            <div className="group-tag">Survey • {survey.groupName}</div>
            <h1 className="hero-title">{survey.title}</h1>
            {survey.description && (
              <p className="hero-desc">{survey.description}</p>
            )}
          </div>

          <div className="hero-meta">
            <div className={`status-pill ${getStatusClass()}`}>
              {getStatusText()}
            </div>

            <div className="vote-stat">
              <span className="stat-value">{results?.totalResponses || 0}</span>
              <span className="stat-label">Responses</span>
            </div>
          </div>
        </div>

        {/* Pending Message */}
        {isPending && (
          <div className="pending-state-card">
            <span className="clock-icon">⏰</span>
            <p>This survey will start on:</p>
            <p>{startDate?.toLocaleString()}</p>
          </div>
        )}

        {/* Survey Questions */}
        {!isPending && (
          <>
            {survey.questions.map((question, qIdx) => (
              <div key={question.id} className="voting-section">
                <div className="section-header">
                  <h2>
                    Question {qIdx + 1}: {question.text}
                  </h2>
                  {question.allowMultiple && (
                    <span
                      style={{ color: "var(--accent)", fontSize: "0.9rem" }}
                    >
                      (Multiple selection allowed)
                    </span>
                  )}
                </div>

                {question.description && (
                  <p
                    style={{ color: "var(--text-muted)", marginBottom: "1rem" }}
                  >
                    {question.description}
                  </p>
                )}

                <div className="options-grid">
                  {question.options.map((option) => {
                    const isSelected =
                      selectedAnswers[question.id]?.includes(option.id) ||
                      false;

                    const resultOption = results?.questions
                      .find((q) => q.questionId === question.id)
                      ?.options.find((o) => o.optionId === option.id);

                    const percentage = resultOption?.percentage || 0;
                    const responseCount = resultOption?.responseCount || 0;

                    return (
                      <div
                        key={option.id}
                        className={`option-card ${
                          hasSubmitted || isSurveyEnded ? "" : "vote-mode"
                        } ${isSelected ? "selected" : ""}`}
                        onClick={() =>
                          !hasSubmitted &&
                          !isSurveyEnded &&
                          isActive &&
                          handleOptionToggle(
                            question.id,
                            option.id,
                            question.allowMultiple
                          )
                        }
                      >
                        {/* Progress Bar Background */}
                        {(hasSubmitted || isSurveyEnded) && percentage > 0 && (
                          <div
                            className="progress-bg"
                            style={{ width: `${percentage}%` }}
                          />
                        )}

                        <div className="option-main">
                          {question.allowMultiple ? (
                            <div
                              className={`custom-checkbox ${
                                isSelected ? "checked" : ""
                              }`}
                            >
                              {isSelected && (
                                <span className="checkmark">✓</span>
                              )}
                            </div>
                          ) : (
                            <div
                              className={`custom-radio ${
                                isSelected ? "checked" : ""
                              }`}
                            />
                          )}

                          <div className="option-text-content">
                            {option.text}
                          </div>
                        </div>

                        {/* Results View */}
                        {(hasSubmitted || isSurveyEnded) && (
                          <div className="option-meta-results">
                            <div className="percentage-text">{percentage}%</div>
                            <div className="vote-small-count">
                              {responseCount} responses
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Submit Button */}
            {!hasSubmitted && isActive && !isSurveyEnded && (
              <div className="action-footer">
                <button
                  className="primary-vote-button"
                  onClick={handleSubmit}
                  disabled={submitting}
                >
                  {submitting ? "Submitting..." : "Submit Answers"}
                </button>
              </div>
            )}

            {/* Final Message */}
            {(hasSubmitted || isSurveyEnded) && (
              <div
                className="alert-box alert-info"
                style={{ textAlign: "center", marginTop: "2rem" }}
              >
                <strong>
                  {hasSubmitted
                    ? "Thank you for completing the survey!"
                    : "This survey has now ended."}
                </strong>
                <br />
                Total responses: {results?.totalResponses || 0}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
