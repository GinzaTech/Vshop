/** Native app.json and React startup surface share this tested visual contract. */
export const STARTUP_ICON_SIZE = 112;
export const STARTUP_ICON_SOURCE = require("../assets/generated/production/startup/vshop-launch-mark-v1.png");
export const STARTUP_RECOVERY_ART_SOURCE = require("../assets/generated/production/startup/vshop-connection-recovery-v1.png");

export type StartupPhase = "prepare" | "session" | "data" | "ready";
export const STARTUP_COMPLETED_STAGES: Readonly<Record<StartupPhase, number>> = {
  prepare: 0, session: 1, data: 2, ready: 3,
};
