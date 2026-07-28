import { WS_URL, getAccessToken } from "./api";

export interface LiveExamEvent {
  type: "roster" | "question" | "progress" | "reveal" | "completed" | "cancelled";
  [key: string]: unknown;
}

export type LiveExamSocketStatus = "connecting" | "open" | "closed";

export interface LiveExamSocketHandle {
  close(): void;
}

// Push-only: the server never expects messages back over this socket, and
// on (re)connect the caller is expected to also hit GET /live-exams/:id to
// resync full state - this wrapper only guarantees delivery of events while
// connected, not that none were missed while reconnecting.
export function connectLiveExamSocket(
  liveExamId: string,
  onEvent: (event: LiveExamEvent) => void,
  onStatusChange?: (status: LiveExamSocketStatus) => void
): LiveExamSocketHandle {
  let socket: WebSocket | null = null;
  let closedByUser = false;
  let retryDelay = 1000;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;

  function open() {
    const token = getAccessToken();
    if (!token || !WS_URL) return;

    onStatusChange?.("connecting");
    socket = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}&liveExamId=${encodeURIComponent(liveExamId)}`);

    socket.onopen = () => {
      retryDelay = 1000;
      onStatusChange?.("open");
    };
    socket.onmessage = (e) => {
      try {
        onEvent(JSON.parse(e.data));
      } catch {
        // Ignore malformed frames rather than crash the room.
      }
    };
    socket.onclose = () => {
      onStatusChange?.("closed");
      if (!closedByUser) {
        retryTimer = setTimeout(open, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 15000);
      }
    };
    socket.onerror = () => {
      socket?.close();
    };
  }

  open();

  return {
    close() {
      closedByUser = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    },
  };
}
