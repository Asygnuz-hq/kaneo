import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invalidateQueries = vi.fn();
const playNotificationSound = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries }),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: { useSession: () => ({ data: { user: { id: "user-1" } } }) },
}));

vi.mock("@/lib/notification-sound", () => ({ playNotificationSound }));

vi.mock("@/fetchers/get-api-url", () => ({
  getApiUrl: () => "http://kaneo.test/api",
}));

vi.mock("@kaneo/libs", () => ({ windowId: "window-1" }));

// A minimal stand-in for the browser WebSocket: opens synchronously and
// hands the test a way to push server messages and close events.
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  send = vi.fn();
  close = vi.fn();

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  emitMessage(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

const { useUserWebSocket } = await import("./use-user-websocket");

describe("useUserWebSocket: a live notification arriving", () => {
  beforeEach(() => {
    invalidateQueries.mockClear();
    playNotificationSound.mockClear();
    FakeWebSocket.instances = [];
    vi.stubGlobal("WebSocket", FakeWebSocket as unknown as typeof WebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refreshes the notification list and plays the chime", () => {
    renderHook(() => useUserWebSocket());
    const socket = FakeWebSocket.instances[0];
    expect(socket).toBeTruthy();

    socket?.emitMessage({ type: "NOTIFICATION_CREATED" });

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["notifications"],
    });
    expect(playNotificationSound).toHaveBeenCalledTimes(1);
  });

  it("stays silent for a message that is not a notification", () => {
    renderHook(() => useUserWebSocket());
    const socket = FakeWebSocket.instances[0];

    socket?.emitMessage({ type: "SOMETHING_ELSE" });

    expect(playNotificationSound).not.toHaveBeenCalled();
  });
});
