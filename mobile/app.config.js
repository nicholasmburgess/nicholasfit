// Adds the build time to app.json's config, so the app knows when this free-account install expires
// (an app signed with a free Apple account stops opening 7 days after it's built).
module.exports = ({ config }) => ({
  ...config,
  extra: { ...(config.extra ?? {}), builtAt: new Date().toISOString() },
});
