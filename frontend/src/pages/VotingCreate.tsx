import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { protectedFetch } from "../utils/api";
import "../styles/VotingCreate.css";

/* ======================
   TYPES
====================== */

type VotingType = "STANDARD" | "FRIENDLY" | "MULTIPLE_CHOICE" | "SURVEY";

type RandomizerType =
  | "NONE"
  | "COIN_FLIP"
  | "ROULETTE"
  | "PLINKO"
  | "SPINNER"
  | "DICE_ROLL";

const VOTING_TYPES: VotingType[] = [
  "STANDARD",
  "FRIENDLY",
  "MULTIPLE_CHOICE",
  "SURVEY",
];

const VOTING_TYPE_LABELS: Record<VotingType, string> = {
  STANDARD: "Standard",
  FRIENDLY: "Friendly",
  MULTIPLE_CHOICE: "Multiple Choice",
  SURVEY: "Survey",
};

interface Group {
  id: string;
  name: string;
}

interface OptionInput {
  id: number;
  text: string;
}

interface SurveyOption {
  text: string;
}

interface SurveyQuestion {
  id: number;
  text: string;
  allowMultiple: boolean;
  options: SurveyOption[];
}

/* ======================
   COMPONENT
====================== */

export default function VotingCreate() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  /* ---------- Groups ---------- */
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState("");

  /* ---------- Core ---------- */
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  /* ---------- Voting ---------- */
  const [votingType, setVotingType] = useState<VotingType>("STANDARD");
  const [randomizerType, setRandomizerType] = useState<RandomizerType>("NONE");

  /* ---------- Friendly ---------- */
  const [allowUserOptions, setAllowUserOptions] = useState(false);
  const [optionsLockAt, setOptionsLockAt] = useState("");

  /* ---------- Multiple Choice ---------- */
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [minChoices, setMinChoices] = useState(1);
  const [maxChoices, setMaxChoices] = useState<number | undefined>();

  /* ---------- Options ---------- */
  const [options, setOptions] = useState<OptionInput[]>([
    { id: Date.now(), text: "" },
    { id: Date.now() + 1, text: "" },
  ]);

  /* ---------- Survey ---------- */
  const [questions, setQuestions] = useState<SurveyQuestion[]>([
    {
      id: Date.now(),
      text: "",
      allowMultiple: false,
      options: [{ text: "" }, { text: "" }],
    },
  ]);

  /* ======================
     LOAD GROUPS
====================== */

  const fetchGroups = useCallback(async () => {
    try {
      const data: Group[] = await protectedFetch("/groups");
      setGroups(data);
      if (data.length) setGroupId(data[0].id);
    } catch {
      setMessage("Failed to load groups");
    }
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  /* ======================
     TYPE DEFAULTS
====================== */

  useEffect(() => {
    if (votingType === "FRIENDLY") {
      setAllowUserOptions(true);
      setRandomizerType("ROULETTE");
    }

    if (votingType === "MULTIPLE_CHOICE") {
      setAllowMultiple(true);
      setMinChoices(1);
    }

    if (votingType === "SURVEY") {
      setAllowUserOptions(false);
      setAllowMultiple(false);
      setRandomizerType("NONE");
    }
  }, [votingType]);

  /* ======================
     SUBMIT
====================== */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const payload: any = {
        title: title.trim(),
        description: description.trim(),
        groupId,
        type: votingType,
        isOpen,
        randomizerType,
        startAt: startAt ? new Date(startAt).toISOString() : null,
        endAt: endAt ? new Date(endAt).toISOString() : null,
      };

      if (votingType === "SURVEY") {
        payload.isSurvey = true;
        payload.questions = questions.map((q, i) => ({
          text: q.text.trim(),
          order: i,
          allowMultiple: q.allowMultiple,
          options: q.options.map((o) => ({ text: o.text.trim() })),
        }));
      } else {
        payload.options = options.map((o) => o.text.trim()).filter(Boolean);

        if (votingType === "FRIENDLY") {
          payload.allowUserOptions = allowUserOptions;
          payload.optionsLockAt = optionsLockAt
            ? new Date(optionsLockAt).toISOString()
            : null;
        }

        if (votingType === "MULTIPLE_CHOICE") {
          payload.allowMultiple = allowMultiple;
          payload.minChoices = minChoices;
          payload.maxChoices = maxChoices;
        }
      }

      const created = await protectedFetch("/votings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (votingType === "SURVEY") {
        navigate(`/votings/${created.id}/survey`);
        return;
      }
      navigate(`/votings/${created.id}`);
    } catch (err: any) {
      setMessage(err.message || "Failed to create voting");
      setLoading(false);
    }
  };

  /* ======================
     RENDER
====================== */

  return (
    <div className="home-container">
      <button onClick={() => navigate(-1)}>← Back</button>
      <h1>Create Voting</h1>

      <form onSubmit={handleSubmit} className="voting-create-form">
        {/* ================= Voting Type ================= */}
        <div className="form-section">
          <h3>Voting Type</h3>
          <div className="radio-group">
            {VOTING_TYPES.map((t) => (
              <label key={t} className="radio-option">
                <input
                  type="radio"
                  name="votingType"
                  checked={votingType === t}
                  onChange={() => setVotingType(t)}
                />
                <div className="radio-card-label">{VOTING_TYPE_LABELS[t]}</div>
              </label>
            ))}
          </div>
        </div>

        {/* ================= Core ================= */}
        <div className="form-section">
          <label>Group</label>
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          <label>Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <label>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <div className="form-row">
            <div className="form-field">
              <label>Start at</label>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
              />
            </div>

            <div className="form-field">
              <label>End at</label>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
              />
            </div>
          </div>

          <div className="checkbox-container">
            <input
              type="checkbox"
              checked={isOpen}
              onChange={(e) => setIsOpen(e.target.checked)}
            />
            <label>Public voting</label>
          </div>
        </div>

        {/* ================= Options for STANDARD / FRIENDLY / MULTIPLE ================= */}
        {votingType !== "SURVEY" && (
          <div className="form-section">
            <h3>Options</h3>

            {options.map((o, index) => (
              <div key={o.id} className="option-input-row">
                <input
                  className="option-text-input"
                  placeholder={`Option ${index + 1}`}
                  value={o.text}
                  onChange={(e) =>
                    setOptions((prev) =>
                      prev.map((x) =>
                        x.id === o.id ? { ...x, text: e.target.value } : x
                      )
                    )
                  }
                  required
                />

                {options.length > 2 && (
                  <button
                    type="button"
                    className="remove-option-button"
                    onClick={() =>
                      setOptions((prev) => prev.filter((x) => x.id !== o.id))
                    }
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              className="add-option-button"
              onClick={() =>
                setOptions((prev) => [...prev, { id: Date.now(), text: "" }])
              }
            >
              + Add option
            </button>
          </div>
        )}

        {/* ================= Friendly Settings ================= */}
        {votingType === "FRIENDLY" && (
          <div className="form-section">
            <h3>Friendly Settings</h3>

            <div className="checkbox-container">
              <input
                type="checkbox"
                checked={allowUserOptions}
                onChange={(e) => setAllowUserOptions(e.target.checked)}
              />
              <label>Allow users to add options</label>
            </div>

            {allowUserOptions && (
              <div>
                <label>Options lock at</label>
                <input
                  type="datetime-local"
                  value={optionsLockAt}
                  onChange={(e) => setOptionsLockAt(e.target.value)}
                />
              </div>
            )}

            <label>Randomization Type</label>
            <select
              value={randomizerType}
              onChange={(e) =>
                setRandomizerType(e.target.value as RandomizerType)
              }
            >
              <option value="NONE">None</option>
              <option value="COIN_FLIP" disabled={options.length !== 2}>
                Coin Flip (2 options only)
              </option>
              <option value="PLINKO" disabled={options.length !== 2}>
                Plinko (2 options only)
              </option>
              <option
                value="DICE_ROLL"
                disabled={options.length < 2 || options.length > 6}
              >
                Dice Roll (2–6 options)
              </option>
              <option value="ROULETTE" disabled={options.length < 3}>
                Roulette (3+ options)
              </option>
              <option value="SPINNER" disabled={options.length < 2}>
                Spinner (2+ options)
              </option>
            </select>

            {(() => {
              const valid =
                randomizerType === "NONE" ||
                (randomizerType === "COIN_FLIP" && options.length === 2) ||
                (randomizerType === "PLINKO" && options.length === 2) ||
                (randomizerType === "DICE_ROLL" &&
                  options.length >= 2 &&
                  options.length <= 6) ||
                (randomizerType === "ROULETTE" && options.length >= 3) ||
                (randomizerType === "SPINNER" && options.length >= 2);

              if (!valid)
                return (
                  <p style={{ color: "red", marginTop: "0.5em" }}>
                    Selected randomizer is invalid for current option count.
                  </p>
                );
            })()}
          </div>
        )}

        {/* ================= Multiple Choice Settings ================= */}
        {votingType === "MULTIPLE_CHOICE" && (
          <div className="form-section">
            <h3>Multiple Choice Settings</h3>

            <div className="checkbox-container">
              <input
                type="checkbox"
                checked={allowMultiple}
                onChange={(e) => setAllowMultiple(e.target.checked)}
              />
              <label>Allow multiple selections</label>
            </div>

            {allowMultiple && (
              <div className="form-row">
                <div className="form-field">
                  <label>Min choices</label>
                  <input
                    type="number"
                    min={1}
                    className="default-number-styled"
                    value={minChoices}
                    onChange={(e) => setMinChoices(Number(e.target.value))}
                  />
                </div>

                <div className="form-field">
                  <label>Max choices</label>
                  <input
                    type="number"
                    min={minChoices}
                    className="default-number-styled"
                    value={maxChoices ?? ""}
                    onChange={(e) =>
                      setMaxChoices(
                        e.target.value ? Number(e.target.value) : undefined
                      )
                    }
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= Survey Questions ================= */}
        {votingType === "SURVEY" && (
          <div className="form-section">
            <h3>Survey Questions</h3>

            {questions.map((q, qi) => (
              <div key={q.id} className="form-section">
                <label>Question {qi + 1}</label>
                <input
                  value={q.text}
                  onChange={(e) =>
                    setQuestions((prev) =>
                      prev.map((x) =>
                        x.id === q.id ? { ...x, text: e.target.value } : x
                      )
                    )
                  }
                  required
                />

                <div className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={q.allowMultiple}
                    onChange={(e) =>
                      setQuestions((prev) =>
                        prev.map((x) =>
                          x.id === q.id
                            ? { ...x, allowMultiple: e.target.checked }
                            : x
                        )
                      )
                    }
                  />
                  <label>Allow multiple answers</label>
                </div>

                {q.options.map((o, oi) => (
                  <div key={oi} className="option-input-row">
                    <input
                      placeholder={`Option ${oi + 1}`}
                      value={o.text}
                      onChange={(e) =>
                        setQuestions((prev) =>
                          prev.map((x) =>
                            x.id === q.id
                              ? {
                                  ...x,
                                  options: x.options.map((op, i) =>
                                    i === oi ? { text: e.target.value } : op
                                  ),
                                }
                              : x
                          )
                        )
                      }
                      required
                    />
                  </div>
                ))}

                <button
                  type="button"
                  className="add-option-button"
                  onClick={() =>
                    setQuestions((prev) =>
                      prev.map((x) =>
                        x.id === q.id
                          ? { ...x, options: [...x.options, { text: "" }] }
                          : x
                      )
                    )
                  }
                >
                  + Add Option
                </button>
              </div>
            ))}

            <button
              type="button"
              className="add-option-button"
              onClick={() =>
                setQuestions((prev) => [
                  ...prev,
                  {
                    id: Date.now(),
                    text: "",
                    allowMultiple: false,
                    options: [{ text: "" }, { text: "" }],
                  },
                ])
              }
            >
              + Add Question
            </button>
          </div>
        )}

        {/* ================= Submit ================= */}
        <div className="form-footer">
          <button
            type="submit"
            className="submit-create-button"
            disabled={loading}
          >
            {loading ? "Creating..." : "Create Voting"}
          </button>

          {message && <p>{message}</p>}
        </div>
      </form>
    </div>
  );
}
