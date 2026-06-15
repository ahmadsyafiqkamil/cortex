module.exports = function (eleventyConfig) {
  eleventyConfig.addPassthroughCopy("src/assets");

  eleventyConfig.addFilter("unique", function (arr) {
    if (!Array.isArray(arr)) return arr;
    return [...new Set(arr)];
  });

  eleventyConfig.addFilter("selectattr", function (arr, key, test, value) {
    if (!Array.isArray(arr)) return [];
    return arr.filter(item => {
      if (test === "equalto") return item[key] === value;
      return false;
    });
  });

  return {
    dir: {
      input: "src",
      output: "dist",
      includes: "_includes",
      data: "_data",
    },
    templateFormats: ["njk", "html", "md"],
    htmlTemplateEngine: "njk",
  };
};
