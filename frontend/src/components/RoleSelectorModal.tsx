import React from "react";
import type { GroupResponseDto } from "../types/group";
import "../styles/GroupDetailPage.css";
interface RoleSelectorModalProps {
  group: GroupResponseDto;
  currentUserId: string;
  onClose: () => void;
  onMemberSelect: (user: any, currentRole: string) => void;
}

const RoleSelectorModal: React.FC<RoleSelectorModalProps> = ({
  group,
  currentUserId,
  onClose,
  onMemberSelect,
}) => {
  const members = group.users || [];

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h3>Select Member to Manage Role</h3>
        <div className="members-selector-list">
          {members.map((membership) => (
            <div key={membership.user.id} className="member-selector-card">
              <div className="member-info-selector">
                <span className="member-name-selector">
                  {membership.user.name || membership.user.email}
                  {membership.user.id === group.creatorId && (
                    <span className="member-tag">(Creator)</span>
                  )}
                  {membership.user.id === currentUserId && (
                    <span className="member-tag">(You)</span>
                  )}
                </span>
                <span
                  className={`member-role role-${membership.role.toLowerCase()}`}
                >
                  {membership.role}
                </span>
              </div>

              {/* Disable selecting self and the group creator (Owner) */}
              <button
                className="action-button secondary select-member-button"
                onClick={() => onMemberSelect(membership.user, membership.role)}
                disabled={membership.user.id === currentUserId}
              >
                {membership.user.id === currentUserId
                  ? "Current User"
                  : "Change Role"}
              </button>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button className="action-button secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleSelectorModal;
