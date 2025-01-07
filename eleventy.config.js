import prettier from "prettier";
import filters from "./src/_11ty/filters.js";
import collections from "./src/_11ty/collections.js";

// plugins
import { footnote } from "@mdit/plugin-footnote";

// note: use ESM modules (https://www.11ty.dev/docs/cjs-esm/)
export default async function (eleventyConfig) {
    // Format HTML
    eleventyConfig.addTransform("prettyHtml", (content, outputPath) => {
        if (outputPath && outputPath.endsWith(".html")) {
            try {
                return prettier.format(content, {
                    parser: "html",
                    tabWidth: 2,
                    singleAttributePerLine: true,
                    trailingComma: "es5",
                });
            } catch (error) {
                console.warn("Error prettifying HTML:", error);
            }
        }
        return content;
    });

    // Plugins
    eleventyConfig.addPlugin(filters);

    eleventyConfig.addPlugin(collections);

    eleventyConfig.addPassthroughCopy({
        "./src/assets/": "/"
    });

    eleventyConfig.amendLibrary("md", (mdLib) => mdLib.use(footnote));

    // Per-page bundles, see https://github.com/11ty/eleventy-plugin-bundle
    // Adds the {% css %} paired shortcode
    eleventyConfig.addBundle("css", {
        toFileDirectory: "dist",
    });
    // Adds the {% js %} paired shortcode
    eleventyConfig.addBundle("js", {
        toFileDirectory: "dist",
    });
    eleventyConfig.addWatchTarget('./src/assets/css/'),
        eleventyConfig.addWatchTarget('./src/assets/js/')
};

export const config = {
    markdownTemplateEngine: 'njk',
    htmlTemplateEngine: 'njk',
    templateFormats: ['md', 'njk', 'html', '11ty.js'],
    dir: {
        input: 'src/content',
        output: 'dist',
        includes: '../../_includes',
        layouts: '../_layouts',
        data: '../_data',
    }
};