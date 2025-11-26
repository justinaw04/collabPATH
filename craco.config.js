// craco.config.js
module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      // Find CRA's "oneOf" rules list
      const oneOfRule = webpackConfig.module.rules.find((r) =>
        Array.isArray(r.oneOf)
      );
      if (!oneOfRule) return webpackConfig;

      // Find babel-loader inside oneOf and exclude maplibre-gl
      oneOfRule.oneOf.forEach((rule) => {
        if (
          rule.loader &&
          rule.loader.includes("babel-loader") &&
          rule.include
        ) {
          // Ensure exclude exists
          rule.exclude = Array.isArray(rule.exclude)
            ? rule.exclude
            : rule.exclude
            ? [rule.exclude]
            : [];

          rule.exclude.push(/node_modules\/maplibre-gl/);
        }
      });

      return webpackConfig;
    },
  },
};
