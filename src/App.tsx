import { useEffect, useState } from "react";
import { MeshShell } from "@baditaflorin/mesh-common";
import { ClapTrack } from "./features/clap/ClapTrack";
import { ALL_SLOTS, type Slot } from "./features/clap/drums";
import { SettingsExtras } from "./features/settings/SettingsExtras";
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
    <MeshShell
      config={appConfig}
      roomId={roomId}
      onRoomChange={setRoomId}
      settingsExtras={
        <SettingsExtras
          slot={slot}
          onSlotChange={setSlot}
          sensitivity={sensitivity}
          onSensitivityChange={setSensitivity}
        />
      }
    >
      <ClapTrack roomId={roomId} slot={slot} sensitivity={sensitivity} />
    </MeshShell>
  );
}
