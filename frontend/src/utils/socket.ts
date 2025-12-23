import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;
let currentToken: string | null = null;

const SOCKET_URL = import.meta.env.VITE_API_URL || "http://localhost";
console.log("WebSocket URL:", SOCKET_URL);

export function connectSocket(token: string): Socket {
  if (socket && socket.connected && currentToken === token) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentToken = token;

  socket = io(`${SOCKET_URL}/voting`, {
    transports: ["websocket"],
    auth: {
      token: `Bearer ${token}`,
    },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
  });

  socket.on("connect", () => {
    console.log("✅ WebSocket Connected to Load Balancer");
  });

  socket.on("disconnect", (reason) => {
    console.log("❌ WebSocket Disconnected:", reason);
  });

  socket.on("connect_error", (err) => {
    console.error("❌ WebSocket Connection Error:", err.message);
  });

  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentToken = null;
  }
}
