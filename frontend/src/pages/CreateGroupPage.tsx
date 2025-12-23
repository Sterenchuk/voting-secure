import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { protectedFetch } from "../utils/api";
import type { GroupCreateDto, GroupResponseDto } from "../types/group"; // Import DTO types

// Assuming you have styles for the page container, not just home styles
import "../styles/Global.css";
import "../styles/CreateGroup.css";

// Helper component for rendering user emails (using the new CSS class)
const EmailChip = ({
  email,
  onRemove,
}: {
  email: string;
  onRemove: () => void;
}) => (
  <span className="email-chip">
    {email}
    <button onClick={onRemove}>&times;</button>
  </span>
);

// 🔥 FIX 1: Renamed export function to match the standard page component name
export default function CreateGroupPage() {
  const [groupName, setGroupName] = useState("");
  const [userEmails, setUserEmails] = useState<string[]>([]);
  const [currentEmailInput, setCurrentEmailInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔥 FIX 2: Added navigation hook
  const navigate = useNavigate();

  const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleAddEmail = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const email = currentEmailInput.trim().toLowerCase();

      if (email) {
        if (!isValidEmail(email)) {
          setError("Please enter a valid email address.");
        } else if (userEmails.includes(email)) {
          setError("This email has already been added.");
        } else {
          setUserEmails([...userEmails, email]);
          setCurrentEmailInput("");
          setError(null);
        }
      }
    }
  };

  const handleRemoveEmail = (emailToRemove: string) => {
    setUserEmails(userEmails.filter((email) => email !== emailToRemove));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation based on GroupCreateDto
    if (groupName.length < 3) {
      setError("Group name must be at least 3 characters long.");
      return;
    }
    if (userEmails.length === 0) {
      setError("Please add at least one user email to the group.");
      return;
    }

    const payload: GroupCreateDto = {
      name: groupName,
      userEmails: userEmails,
      // votingIds is optional/omitted here
    };

    setIsSubmitting(true);

    // 🔥 FIX 3: Replace simulation with real API call
    try {
      const newGroup: GroupResponseDto = await protectedFetch("/groups", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json",
        },
      });

      console.log("Group Created:", newGroup);

      // 🔥 FIX 4: Navigate to the new group's detail page on success
      navigate(`/groups/${newGroup.id}`);
    } catch (apiError: any) {
      // Assuming protectedFetch throws an error with a message property
      setError(
        apiError.message ||
          "Failed to create group. Please check provided emails and try again."
      );
      console.error("API Error:", apiError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    // 🔥 FIX 5: Use create-group-container for specific page styling
    <div className="create-group-container">
      <div className="page-header">
        <h1 className="page-title">Create New Group</h1>
        <p className="page-subtitle">
          Define the name and initial members of your new group.
        </p>
      </div>

      <section className="create-group-form-section">
        {/* Error Display */}
        {error && <div className="form-error">{error}</div>}

        <form onSubmit={handleSubmit} className="create-group-form">
          {/* Group Name Field */}
          <div className="form-field">
            <label htmlFor="groupName" className="form-label">
              Group Name
            </label>
            <input
              id="groupName"
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g., Project Phoenix Team"
              disabled={isSubmitting}
            />
          </div>

          {/* User Emails Field */}
          <div className="form-field">
            <label htmlFor="userEmails" className="form-label">
              Initial Members (Emails)
            </label>

            {/* Display Email Chips */}
            <div className="email-chip-list">
              {userEmails.map((email) => (
                <EmailChip
                  key={email}
                  email={email}
                  onRemove={() => handleRemoveEmail(email)}
                />
              ))}
            </div>

            <input
              id="userEmails"
              type="email"
              value={currentEmailInput}
              onChange={(e) => {
                setCurrentEmailInput(e.target.value);
                if (error) setError(null);
              }}
              onKeyDown={handleAddEmail}
              placeholder="Enter email and press Enter or Tab"
              disabled={isSubmitting}
            />
            <small className="form-helper-text">
              The group creator will be added automatically as OWNER.
            </small>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="create-group-submit-button"
            disabled={
              isSubmitting || groupName.length < 3 || userEmails.length === 0
            }
          >
            {isSubmitting ? "Creating Group..." : "Create Group"}
          </button>
        </form>
      </section>
    </div>
  );
}
