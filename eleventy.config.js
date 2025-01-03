const prettier = require("prettier");

module.exports = eleventyConfig => {
    // Format HTML
    eleventyConfig.addTransform("prettyHtml", (content, outputPath) => {
        if (outputPath && outputPath.endsWith(".html")) {
          try {
            return prettier.format(content, { parser: "html" });
          } catch (error) {
            console.warn("Error prettifying HTML:", error);
          }
        }
        return content;
      });
    
    return {
        markdownTemplateEngine: 'njk',
        htmlTemplateEngine: 'njk',
        templateFormats: ['md', 'njk', 'html', '11ty.js'],
        dir: {
            input: 'src',
            output: 'dist',
            includes: '_includes',
            layouts: '_layouts',
            data: '_data',
        }
    };
}