import rss from "@astrojs/rss";
import { loadAllPosts } from "../lib/markdown.js";
import { SITE_URL } from "../lib/constants.js";

export async function GET(context) {
  const posts = loadAllPosts();

  return rss({
    title: "Half Baked — Blog",
    description: "Writing about work, ideas, and things worth thinking about.",
    site: SITE_URL,
    items: posts.map((post) => ({
      title: post.title,
      pubDate: new Date(post.date),
      description: post.excerpt || "",
      link: `/blog/${post.slug}/`,
    })),
    customData: `<language>en-us</language>`,
  });
}
