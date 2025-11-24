// metro.config.js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Cho phép ONNX và lazy loading
config.resolver.sourceExts.push('cjs');
config.resolver.assetExts.push('onnx');

// Bật inline requires để lazy load ONNX
config.transformer = {
  ...config.transformer,
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

module.exports = withNativeWind(config, { input: './app/global.css' });