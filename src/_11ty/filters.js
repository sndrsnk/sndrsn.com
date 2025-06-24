import { DateTime } from "luxon";
import CleanCSS from "clean-css";

export default function(eleventyConfig) {
	eleventyConfig.addFilter("readableDate", (dateObj, format, zone) => {
		// Formatting tokens for Luxon: https://moment.github.io/luxon/#/formatting?id=table-of-tokens
		return DateTime.fromJSDate(dateObj, { zone: zone || "utc" }).toFormat(format || "MMM dd, yyyy");
	});

	eleventyConfig.addFilter("htmlDateString", (dateObj) => {
		// dateObj input: https://html.spec.whatwg.org/multipage/common-microsyntaxes.html#valid-date-string
		return DateTime.fromJSDate(dateObj, { zone: "utc" }).toFormat('yyyy-LL-dd');
	});

	eleventyConfig.addFilter("cssmin", function (code) {
		return new CleanCSS({}).minify(code).styles;
	});

	// Sitemap priority filter
	eleventyConfig.addFilter("sitemapPriority", function(page) {
		// Homepage gets highest priority
		if (page.url === "/") return "1.0";
		// Posts get high priority
		if (page.url.includes("/posts/")) return "0.8";
		// Other pages get medium priority
		return "0.5";
	});

	// Sitemap changefreq filter
	eleventyConfig.addFilter("sitemapChangefreq", function(page) {
		// Posts change more frequently
		if (page.url.includes("/posts/")) return "weekly";
		// Static pages change less frequently
		return "monthly";
	});
};