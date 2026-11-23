// Xcode's "User Script Sandboxing" blocks CocoaPods' copy-resources step in the widget
// extension ("Sandbox: bash deny file-write-create .../Pods/resources-to-copy-ExpoWidgetsTarget.txt").
// Turn it off for every target so `npm run setup` produces a project that builds as-is.
const { withXcodeProject } = require("expo/config-plugins");

module.exports = function withNoScriptSandbox(config) {
  return withXcodeProject(config, (c) => {
    const configs = c.modResults.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(configs)) {
      const bc = configs[key];
      if (bc && typeof bc === "object" && bc.buildSettings) bc.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = "NO";
    }
    return c;
  });
};
