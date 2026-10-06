// A brief two-note chime for a notification arriving live, synthesized with
// the Web Audio API instead of shipped as an audio file -- one less binary
// asset to keep track of for something this small.
//
// One shared context, created lazily on first use (most browsers refuse to
// start an AudioContext before the page has seen any user gesture at all;
// by the time a live notification can arrive, someone has already signed in
// and clicked around). `resume()` covers a context that starts suspended.

const STORAGE_KEY = "kaneo:notification-sound";

// On unless someone turned it off. Per device on purpose: a chime that is
// welcome at a desk is not welcome on a phone in a meeting.
export function isNotificationSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Storage blocked: the switch just will not outlive the page.
  }
}

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext) {
    audioContext = new Ctor();
  }
  return audioContext;
}

const NOTES: ReadonlyArray<{ freq: number; start: number }> = [
  { freq: 880, start: 0 },
  { freq: 1318.5, start: 0.09 },
];
const NOTE_DURATION_S = 0.18;
const PEAK_GAIN = 0.15;

export function playNotificationSound(): void {
  if (!isNotificationSoundEnabled()) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const now = ctx.currentTime;
    for (const { freq, start } of NOTES) {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = freq;

      // A quick fade in and out so each note clicks rather than pops.
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(PEAK_GAIN, now + start + 0.01);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + start + NOTE_DURATION_S,
      );

      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now + start);
      oscillator.stop(now + start + NOTE_DURATION_S + 0.02);
    }
  } catch {
    // Autoplay restrictions or no Web Audio support -- the bell icon still
    // shows the notification either way, so this is never worth surfacing.
  }
}
