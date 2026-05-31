import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

/**
 * Load-bearing cross-peer assertion for the advertised core action:
 *
 *   "real claps … become a synced drum loop" — a clap on one phone drops a
 *   TapEvent into the shared Y.Array("taps") and replays on every phone.
 *
 * A live mic transient can't be driven headless, so we exercise the
 * non-mic fallback (the "Join without mic" path + the Tap button), which
 * writes through the *identical* Yjs path as a detected onset. Peer A taps;
 * we assert peer B sees the taps cross the mesh (HUD count + a loop mark
 * from A's slot, which is "other" on B).
 *
 * This FAILS on code that has no shared-state fallback (the pre-fix app had
 * only the undrivable mic path) and PASSES once the tap writes to the doc.
 */
test("a tap on peer A appears in the synced loop on peer B", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    // Both peers join the mesh without granting the mic.
    const joinA = a.getByRole("button", { name: /join without mic/i });
    const joinB = b.getByRole("button", { name: /join without mic/i });
    await expect(joinA).toBeVisible();
    await expect(joinB).toBeVisible();
    await joinA.click();
    await joinB.click();

    // Both reach the stage (Tap button present).
    const tapA = a.getByTestId("clap-tap");
    const tapB = b.getByTestId("clap-tap");
    await expect(tapA).toBeVisible();
    await expect(tapB).toBeVisible();

    // Wait for the BroadcastChannel mesh to connect (HUD goes 2 phones).
    await expect(a.locator(".clap-hud")).toContainText(/2 phones/, { timeout: 15_000 });
    await expect(b.locator(".clap-hud")).toContainText(/2 phones/, { timeout: 15_000 });

    // Peer A drops three taps into the shared loop.
    await tapA.click();
    await tapA.click();
    await tapA.click();

    // Peer B — the OPPOSITE peer — must see A's taps cross the mesh.
    await expect(b.locator(".clap-hud")).toContainText(/3 taps in loop/, { timeout: 10_000 });
    // And render them as marks on the loop track (A's slot = "kick" is the
    // same default as B, so they show as "own"-colored on A and on B they
    // belong to the shared array regardless of class). Assert >=3 marks total.
    await expect
      .poll(async () => b.locator(".clap-loop-mark").count(), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(3);
  } finally {
    await cleanup();
  }
});
