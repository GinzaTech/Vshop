// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: 'expo',
  rules: {
    // The app has not opted into React Compiler yet. Expo 57 enables its
    // migration diagnostics by default, including false positives for
    // Reanimated shared values and intentionally imperative native refs.
    'react-hooks/immutability': 'off',
    'react-hooks/preserve-manual-memoization': 'off',
    'react-hooks/purity': 'off',
    'react-hooks/refs': 'off',
    'react-hooks/set-state-in-effect': 'off',
    // Several native modules are loaded lazily so web builds never evaluate
    // their platform-only entry points.
    '@typescript-eslint/no-require-imports': 'off',
  },
};
