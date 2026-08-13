module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
    // SDK 57's Babel preset configures Reanimated 4 / Worklets automatically.
    plugins: ["react-native-paper/babel"],
  };
};
