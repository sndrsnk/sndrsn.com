export default function(eleventyConfig) {
    eleventyConfig.addCollection("posts", function (collectionApi) {
        return collectionApi.getFilteredByGlob("./src/content/posts/*.md").reverse();
    });

    eleventyConfig.addCollection("recentPosts", function (collectionApi) {
        return collectionApi.getFilteredByGlob("./src/content/posts/*.md").reverse().slice(0, 3);
    });

    // Sitemap collection - excludes pages that shouldn't be in sitemap
    eleventyConfig.addCollection("sitemap", function (collectionApi) {
        return collectionApi.getAll().filter(item => {
            // Exclude pages that shouldn't be in sitemap
            if (item.data.eleventyExcludeFromCollections) return false;
            if (item.data.draft) return false;
            if (item.url === false) return false;
            if (!item.url) return false;
            
            // Exclude specific file types or paths
            if (item.url.includes('.json')) return false;
            if (item.url.includes('.xml')) return false;
            if (item.url.includes('feed/')) return false;
            
            return true;
        });
    });
}