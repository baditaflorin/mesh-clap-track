import { useEffect, useState } from "react";
import { ClapTrack } from "./features/clap/ClapTrack";
import { ALL_SLOTS, type Slot } from "./features/clap/drums";
import { SettingsDrawer } from "./features/settings/SettingsDrawer";
import { appConfig } from "./shared/config";

const STORAGE = {
  room: `${appConfig.storagePrefix}:room`,
  slot: `${appConfig.storagePrefix}:slot`,
  sensitivity: `${appConfig.storagePrefix}:sensitivity`,
};

function readString(key: string, fallback: string): string {
  return localStorage.getItem(key) ?? fallback;
}
function readNumber(key: string, fallback: number): number {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
function readSlot(key: string, fallback: Slot): Slot {
  const raw = localStorage.getItem(key);
  return (ALL_SLOTS as string[]).includes(raw ?? "") ? (raw as Slot) : fallback;
}

export function App() {
  const [roomId, setRoomId] = useState(() => readString(STORAGE.room, "default"));
  const [slot, setSlot] = useState<Slot>(() => readSlot(STORAGE.slot, "kick"));
  const [sensitivity, setSensitivity] = useState(() =>
    Math.max(0.5, Math.min(3, readNumber(STORAGE.sensitivity, 1))),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE.room, roomId);
  }, [roomId]);
  useEffect(() => {
    localStorage.setItem(STORAGE.slot, slot);
  }, [slot]);
  useEffect(() => {
    localStorage.setItem(STORAGE.sensitivity, String(sensitivity));
  }, [sensitivity]);

  return (
    <div className="app-root">
      <ClapTrack roomId={roomId} slot={slot} sensitivity={sensitivity} />

      <button
        type="button"
        className="settings-fab"
        onClick={() => setSettingsOpen(true)}
        aria-label="Open settings"
      >
        ⚙
      </button>

      <div className="self-ref">
        <a href={appConfig.repositoryUrl} target="_blank" rel="noreferrer">
          source
        </a>
        <span aria-hidden="true">·</span>
        <a href={appConfig.paypalUrl} target="_blank" rel="noreferrer">
          tip ♥
        </a>
        <span aria-hidden="true">·</span>
        <span>
          v{appConfig.version} · {appConfig.commit}
        </span>
      </div>

      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        roomId={roomId}
        onRoomChange={setRoomId}
        slot={slot}
        onSlotChange={setSlot}
        sensitivity={sensitivity}
        onSensitivityChange={setSensitivity}
      />
    </div>
  );
}
