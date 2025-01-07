export default function(eleventyConfig) {
    eleventyConfig.addCollection("posts", function (collectionApi) {
        return collectionApi.getFilteredByGlob("./src/content/posts/*.md").reverse();
    });

    eleventyConfig.addCollection("recentPosts", function (collectionApi) {
        return collectionApi.getFilteredByGlob("./src/content/posts/*.md").reverse().slice(0, 3);
    });
}