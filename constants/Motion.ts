import { Easing, ReduceMotion } from "react-native-reanimated";

export const MOTION_DURATION = {
  instant: 0,
  fast: 140,
  standard: 220,
  emphasized: 360,
} as const;

export const MOTION_TIMING = {
  fast: {
    duration: MOTION_DURATION.fast,
    easing: Easing.out(Easing.cubic),
    reduceMotion: ReduceMotion.System,
  },
  standard: {
    duration: MOTION_DURATION.standard,
    easing: Easing.inOut(Easing.cubic),
    reduceMotion: ReduceMotion.System,
  },
  emphasized: {
    duration: MOTION_DURATION.emphasized,
    easing: Easing.out(Easing.cubic),
    reduceMotion: ReduceMotion.System,
  },
} as const;

export const MOTION_SPRING = {
  press: {
    damping: 20,
    stiffness: 260,
    mass: 0.7,
    energyThreshold: 0.001,
    reduceMotion: ReduceMotion.System,
  },
  settle: {
    damping: 18,
    stiffness: 190,
    mass: 0.8,
    energyThreshold: 0.001,
    reduceMotion: ReduceMotion.System,
  },
} as const;

