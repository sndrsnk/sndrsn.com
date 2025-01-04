import prettier from "prettier";
import filters from "./src/_11ty/filters.js";

// note: use ESM modules (https://www.11ty.dev/docs/cjs-esm/)
export default async function (eleventyConfig) {
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

    eleventyConfig.addPlugin(filters);
};

export const config = {
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