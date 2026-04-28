"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import socketService, {
  VoteUpdate,
  SurveyUpdate,
  AuditUpdate,
  UserPresence,
} from "@/lib/socket/socketService";

interface UseSocketOptions {
  autoConnect?: boolean;
  token?: string;
}

export function useSocket(options: UseSocketOptions = {}) {
  const { autoConnect = true, token } = options;
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    if (autoConnect) {
      socketService
        .connect(token)
        .then(() => {
          if (mountedRef.current) {
            setConnected(true);
            setError(null);
          }
        })
        .catch((err) => {
          if (mountedRef.current) {
            setError(err);
            setConnected(false);
          }
        });
    }

    // Listen for connection state changes
    const unsubscribeError = socketService.on<Error>("error", (err) => {
      if (mountedRef.current) {
        setError(err);
      }
    });

    return () => {
      mountedRef.current = false;
      unsubscribeError();
    };
  }, [autoConnect, token]);

  const connect = useCallback(async () => {
    try {
      await socketService.connect(token);
      setConnected(true);
      setError(null);
    } catch (err) {
      setError(err as Error);
      setConnected(false);
    }
  }, [token]);

  const disconnect = useCallback(() => {
    socketService.disconnect();
    setConnected(false);
  }, []);

  return {
    connected,
    error,
    connect,
    disconnect,
    isConnected: socketService.isConnected,
  };
}

// Hook for real-time voting updates
export function useVotingUpdates(
  votingId: string | null,
  onUpdate: (data: VoteUpdate) => void,
) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    if (!votingId) return;

    socketService.subscribeToVoting(votingId);

    const unsubscribe = socketService.on<VoteUpdate>("vote:update", (data) => {
      if (data.votingId === votingId) {
        callbackRef.current(data);
      }
    });

    return () => {
      socketService.unsubscribeFromVoting(votingId);
      unsubscribe();
    };
  }, [votingId]);
}

// Hook for real-time survey updates
export function useSurveyUpdates(
  surveyId: string | null,
  onUpdate: (data: SurveyUpdate) => void,
) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    if (!surveyId) return;

    socketService.subscribeToSurvey(surveyId);

    const unsubscribe = socketService.on<SurveyUpdate>(
      "survey:update",
      (data) => {
        if (data.surveyId === surveyId) {
          callbackRef.current(data);
        }
      },
    );

    return () => {
      socketService.unsubscribeFromSurvey(surveyId);
      unsubscribe();
    };
  }, [surveyId]);
}

// Hook for real-time audit updates
export function useAuditUpdates(
  onUpdate: (data: AuditUpdate) => void,
  filters?: { entityType?: string; entityId?: string },
) {
  const callbackRef = useRef(onUpdate);
  callbackRef.current = onUpdate;

  useEffect(() => {
    socketService.subscribeToAudit(filters?.entityType, filters?.entityId);

    const unsubscribe = socketService.on<AuditUpdate>(
      "audit:update",
      (data) => {
        const matchesFilter =
          (!filters?.entityType || data.entityType === filters.entityType) &&
          (!filters?.entityId || data.entityId === filters.entityId);

        if (matchesFilter) {
          callbackRef.current(data);
        }
      },
    );

    return () => {
      socketService.unsubscribeFromAudit();
      unsubscribe();
    };
  }, [filters?.entityType, filters?.entityId]);
}

// Hook for presence/online users
export function usePresence(
  entityType: "voting" | "survey",
  entityId: string | null,
) {
  const [usersOnline, setUsersOnline] = useState(0);

  useEffect(() => {
    if (!entityId) return;

    const unsubscribe = socketService.on<UserPresence>(
      "presence:update",
      (data) => {
        const matches =
          (entityType === "voting" && data.votingId === entityId) ||
          (entityType === "survey" && data.surveyId === entityId);

        if (matches) {
          setUsersOnline(data.usersOnline);
        }
      },
    );

    return () => {
      unsubscribe();
    };
  }, [entityType, entityId]);

  return { usersOnline };
}

export default useSocket;
