"use client";

import { io, Socket } from "socket.io-client";

// Types for socket events
export interface VoteUpdate {
  votingId: string;
  results: {
    options: Array<{
      id: string;
      text: string;
      voteCount: number;
    }>;
    totalBallots: number;
  };
}

export interface SurveyUpdate {
  surveyId: string;
  // Survey results structure from backend
  [key: string]: any;
}

export interface AuditUpdate {
  recordId: string;
  action: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  transactionHash: string;
}

export interface UserPresence {
  votingId?: string;
  surveyId?: string;
  usersOnline: number;
}

type SocketEventCallback<T> = (data: T) => void;

class SocketService {
  private sockets: Map<string, Socket> = new Map();
  private listeners: Map<string, Set<SocketEventCallback<unknown>>> = new Map();
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;

  // Connect to a specific namespace
  private getSocket(namespace: string, token?: string): Socket {
    if (this.sockets.has(namespace)) {
      const socket = this.sockets.get(namespace)!;
      // If we provided a new token, update it
      if (token) {
        socket.auth = { token };
        if (!socket.connected) socket.connect();
      }
      return socket;
    }

    const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "";
    const socketUrl = `${baseUrl}${namespace}`;

    const socket = io(socketUrl, {
      auth: token ? { token } : undefined,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay,
      withCredentials: true,
    });

    this.setupHandlers(socket, namespace);
    this.sockets.set(namespace, socket);
    return socket;
  }

  // Connect all necessary sockets
  async connect(token?: string): Promise<void> {
    let activeToken = token;
    
    // If no token provided, try to fetch one from the backend
    if (!activeToken) {
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/token`, {
          headers: { "X-Requested-With": "XMLHttpRequest" },
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          activeToken = data.token;
        }
      } catch (err) {
        console.error("Failed to fetch socket token:", err);
      }
    }

    this.getSocket("/votings", activeToken);
    this.getSocket("/surveys", activeToken);
  }

  // Disconnect all sockets
  disconnect(): void {
    this.sockets.forEach((socket) => socket.disconnect());
    this.sockets.clear();
    this.listeners.clear();
  }

  // Check if connected (to any)
  isConnected(): boolean {
    return Array.from(this.sockets.values()).some((s) => s.connected);
  }

  // Setup event handlers for a socket
  private setupHandlers(socket: Socket, namespace: string): void {
    if (namespace === "/votings") {
      socket.on("voting:results", (data: VoteUpdate) => {
        this.emit("vote:update", data);
      });
    } else if (namespace === "/surveys") {
      socket.on("survey:results", (data: SurveyUpdate) => {
        this.emit("survey:update", data);
      });
    }

    socket.on("presence:update", (data: UserPresence) => {
      this.emit("presence:update", data);
    });

    socket.on("error", (error: any) => {
      console.error(`[SVS Socket ${namespace}] Error:`, error);
      this.emit("error", error);
    });

    socket.on("connect_error", async (error: any) => {
      console.error(`[SVS Socket ${namespace}] Connection Error:`, error);
      
      if (error.message === "Unauthorized") {
        console.log(`[SVS Socket ${namespace}] Attempting to refresh token...`);
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/token`, {
            headers: { "X-Requested-With": "XMLHttpRequest" },
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            if (data.token) {
              socket.auth = { token: data.token };
              socket.connect();
            }
          }
        } catch (err) {
          console.error("Failed to refresh socket token:", err);
        }
      }
    });
  }

  // Emit event internally to listeners
  private emit<T>(event: string, data: T): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }

  // Subscribe to voting updates
  subscribeToVoting(votingId: string): void {
    const socket = this.getSocket("/votings");
    socket.emit("voting:join", { votingId });
  }

  // Unsubscribe from voting updates
  unsubscribeFromVoting(votingId: string): void {
    const socket = this.sockets.get("/votings");
    socket?.emit("voting:leave", { votingId });
  }

  // Subscribe to survey updates
  subscribeToSurvey(surveyId: string): void {
    const socket = this.getSocket("/surveys");
    socket.emit("survey:join", { surveyId });
  }

  // Cast a vote via socket
  async castVote(payload: {
    votingId: string;
    token: string;
    optionIds: string[];
    otherText?: string;
  }): Promise<any> {
    const namespace = "/votings";
    let socket = this.getSocket(namespace);

    // If disconnected, try to connect first
    if (!socket.connected) {
      await new Promise<void>((resolve, reject) => {
        const onConnect = () => {
          socket.off("connect_error", onConnectError);
          resolve();
        };
        const onConnectError = (err: any) => {
          socket.off("connect", onConnect);
          reject(err);
        };
        socket.once("connect", onConnect);
        socket.once("connect_error", onConnectError);
        socket.connect();
      });
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Vote submission timed out"));
      }, 10000);

      const onSuccess = (data: any) => {
        if (data.votingId === payload.votingId) {
          cleanup();
          resolve(data);
        }
      };

      const onError = (data: any) => {
        if (data.votingId === payload.votingId) {
          cleanup();
          reject(new Error(data.message || "Failed to cast vote"));
        }
      };

      const cleanup = () => {
        clearTimeout(timeout);
        socket.off("voting:vote_success", onSuccess);
        socket.off("voting:error", onError);
      };

      socket.on("voting:vote_success", onSuccess);
      socket.on("voting:error", onError);

      // Backend expects token: string (raw secret) 
      // and ballots: { optionId: string }[]
      socket.emit("voting:cast", {
        votingId: payload.votingId,
        token: payload.token,
        ballots: payload.optionIds.map(id => ({ optionId: id })),
        otherText: payload.otherText
      }, (response: any) => {
        if (response?.error) {
          cleanup();
          reject(new Error(response.message || "Failed to cast vote"));
        } else if (response) {
          cleanup();
          resolve(response);
        }
      });
    });
  }

  // Unsubscribe from survey updates
  unsubscribeFromSurvey(surveyId: string): void {
    const socket = this.sockets.get("/surveys");
    socket?.emit("survey:leave", { surveyId });
  }

  // Subscribe to audit updates
  subscribeToAudit(entityType?: string, entityId?: string): void {
    // Audit doesn't have a specific namespace/gateway yet in backend
    console.warn("Audit real-time updates not yet implemented in backend");
  }

  // Unsubscribe from audit updates
  unsubscribeFromAudit(): void {
    // No-op
  }

  // Add event listener
  on<T>(event: string, callback: SocketEventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as SocketEventCallback<unknown>);

    return () => {
      this.listeners
        .get(event)
        ?.delete(callback as SocketEventCallback<unknown>);
    };
  }

  // Remove event listener
  off<T>(event: string, callback: SocketEventCallback<T>): void {
    this.listeners.get(event)?.delete(callback as SocketEventCallback<unknown>);
  }

  // Remove all listeners for an event
  offAll(event: string): void {
    this.listeners.delete(event);
  }
}

// Singleton instance
export const socketService = new SocketService();

export default socketService;
