import { ALL_SLOTS, SLOT_INFO, type Slot } from "../clap/drums";

type Props = {
  slot: Slot;
  onSlotChange: (next: Slot) => void;
  sensitivity: number;
  onSensitivityChange: (next: number) => void;
};

export function SettingsExtras({ slot, onSlotChange, sensitivity, onSensitivityChange }: Props) {
  return (
    <>
      <label>
        <span>Your drum</span>
        <select value={slot} onChange={(e) => onSlotChange(e.target.value as Slot)}>
          {ALL_SLOTS.map((s) => (
            <option key={s} value={s}>
              {SLOT_INFO[s].emoji} {SLOT_INFO[s].label}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span>Mic sensitivity ({sensitivity.toFixed(2)})</span>
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.05}
          value={sensitivity}
          onChange={(e) => onSensitivityChange(Number(e.target.value))}
        />
        <span className="settings-help">
          Lower = more sensitive (more claps detected). Raise if music or chatter false-triggers.
        </span>
      </label>

      <p className="settings-help">
        Use the <strong>Clear loop</strong> button on the main screen to wipe the shared loop.
      </p>
    </>
  );
}
