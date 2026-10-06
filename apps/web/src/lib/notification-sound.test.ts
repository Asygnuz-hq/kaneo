import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class FakeOscillator {
  type = "";
  frequency = { value: 0 };
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class FakeGainParam {
  setValueAtTime = vi.fn();
  linearRampToValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}

class FakeGain {
  gain = new FakeGainParam();
  connect = vi.fn();
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  // Read at construction time, so a test can arrange a context that starts
  // suspended -- setting `.state` after the fact would be too late, since
  // playNotificationSound checks it immediately after creating the context.
  static nextState: "running" | "suspended" = "running";
  currentTime = 0;
  state: "running" | "suspended";
  destination = {};
  resume = vi.fn();
  createOscillator = vi.fn(() => new FakeOscillator());
  createGain = vi.fn(() => new FakeGain());

  constructor() {
    this.state = FakeAudioContext.nextState;
    FakeAudioContext.instances.push(this);
  }
}

// The runtime's own localStorage is not reliably a full Storage under test.
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, String(value)),
  };
}

describe("playNotificationSound", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", memoryStorage());
    FakeAudioContext.instances = [];
    FakeAudioContext.nextState = "running";
    vi.stubGlobal(
      "AudioContext",
      FakeAudioContext as unknown as typeof AudioContext,
    );
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("plays a two-note chime through the Web Audio API", async () => {
    const { playNotificationSound } = await import("./notification-sound");

    playNotificationSound();

    const ctx = FakeAudioContext.instances[0];
    expect(ctx).toBeTruthy();
    expect(ctx?.createOscillator).toHaveBeenCalledTimes(2);
    expect(ctx?.createGain).toHaveBeenCalledTimes(2);
  });

  it("resumes a suspended context before playing", async () => {
    FakeAudioContext.nextState = "suspended";
    const { playNotificationSound } = await import("./notification-sound");

    playNotificationSound();

    expect(FakeAudioContext.instances[0]?.resume).toHaveBeenCalled();
  });

  it("never throws when there is no Web Audio support at all", async () => {
    vi.stubGlobal("AudioContext", undefined);
    vi.stubGlobal("webkitAudioContext", undefined);
    const { playNotificationSound } = await import("./notification-sound");

    expect(() => playNotificationSound()).not.toThrow();
  });

  it("is on by default", async () => {
    const { isNotificationSoundEnabled } = await import("./notification-sound");

    expect(isNotificationSoundEnabled()).toBe(true);
  });

  it("stays silent once it has been turned off, and remembers that", async () => {
    const {
      isNotificationSoundEnabled,
      playNotificationSound,
      setNotificationSoundEnabled,
    } = await import("./notification-sound");

    setNotificationSoundEnabled(false);
    playNotificationSound();

    expect(isNotificationSoundEnabled()).toBe(false);
    expect(FakeAudioContext.instances).toHaveLength(0);
  });

  it("plays again after being turned back on", async () => {
    const { playNotificationSound, setNotificationSoundEnabled } = await import(
      "./notification-sound"
    );

    setNotificationSoundEnabled(false);
    setNotificationSoundEnabled(true);
    playNotificationSound();

    expect(FakeAudioContext.instances[0]?.createOscillator).toHaveBeenCalled();
  });
});
