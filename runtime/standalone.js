(() => {
  "use strict";
  const launchOptions = { miniToolEnv: { buildVersion: 9510000 } };
  const complete = (options, value) => {
    options?.success?.(value);
    return Promise.resolve(value);
  };
  // The static game has no player identity, score service or network polling.
  window.xhs = {
    launchOptions,
    miniTool: {
      getLaunchOptions: options => complete(options, launchOptions),
      getFollowStatus: options => complete(options, { follow_status: 1 }),
      vibrateShort: () => { navigator.vibrate?.(12); return Promise.resolve({}); }
    }
  };
})();
