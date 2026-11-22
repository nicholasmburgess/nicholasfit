// Lets the app import the website's workout logic from ../src (shared code, one source of truth).
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const root = path.resolve(__dirname, "..");
const config = getDefaultConfig(__dirname);

config.watchFolders = [path.join(root, "src")];
config.resolver.nodeModulesPaths = [path.join(__dirname, "node_modules")];
const resolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, name, platform) => {
  const target = name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : name;
  return (resolve ?? context.resolveRequest)(context, target, platform);
};

module.exports = config;
