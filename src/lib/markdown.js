import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

marked.use({
  renderer: {
    image({ href, title, text }) {
      const titleAttr = title ? ` title="${title}"` : "";
      return `<img src="${href}" alt="${text}"${titleAttr} loading="lazy" decoding="async">`;
    },
  },
});

export function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: raw };

  const frontmatter = {};
  const lines = match[1].split("\n");
  let currentKey = null;
  let currentArray = null;

  for (const line of lines) {
    const kvMatch = line.match(/^(\w[\w_-]*?):\s*(.*)$/);
    if (kvMatch) {
      if (currentKey && currentArray) {
        frontmatter[currentKey] = currentArray;
        currentArray = null;
      }
      const [, key, value] = kvMatch;
      if (value === "") {
        currentKey = key;
        currentArray = [];
      } else {
        currentKey = null;
        if (value.startsWith("[") && value.endsWith("]")) {
          try {
            frontmatter[key] = JSON.parse(value);
          } catch {
            frontmatter[key] = value.replace(/^"(.*)"$/, "$1");
          }
        } else {
          frontmatter[key] = value.replace(/^"(.*)"$/, "$1").replace(/\\"/g, '"');
        }
      }
    } else if (currentArray !== null) {
      const itemMatch = line.match(/^\s+-\s+(.+)$/);
      if (itemMatch) {
        currentArray.push(
          itemMatch[1].replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1")
        );
      }
    }
  }
  if (currentKey && currentArray) {
    frontmatter[currentKey] = currentArray;
  }

  return { frontmatter, body: match[2] };
}

let _cachedPosts = null;

export function loadAllPosts() {
  if (_cachedPosts && process.env.NODE_ENV === "production") return _cachedPosts;

  const postsDir = path.join(process.cwd(), "content", "posts");
  if (!fs.existsSync(postsDir)) return [];

  const files = fs.readdirSync(postsDir).filter((f) => f.endsWith(".md"));
  const posts = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(postsDir, file), "utf-8");
    const { frontmatter, body } = parseFrontmatter(raw);
    const html = marked.parse(body);
    posts.push({
      ...frontmatter,
      slug: frontmatter.slug || file.replace(/\.md$/, ""),
      body: html,
    });
  }

  posts.sort((a, b) => {
    if (!a.date || !b.date) return 0;
    return new Date(b.date) - new Date(a.date);
  });

  _cachedPosts = posts;
  return posts;
}

let _cachedAuthors = null;

export function loadAllAuthors() {
  if (_cachedAuthors && process.env.NODE_ENV === "production") return _cachedAuthors;

  const authorsDir = path.join(process.cwd(), "content", "authors");
  if (!fs.existsSync(authorsDir)) return [];

  const files = fs.readdirSync(authorsDir).filter((f) => f.endsWith(".md"));
  const authors = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(authorsDir, file), "utf-8");
    const { frontmatter } = parseFrontmatter(raw);
    authors.push(frontmatter);
  }

  _cachedAuthors = authors;
  return authors;
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

export function extractHeadings(html) {
  const headings = [];
  const regex = /<(h[23])([^>]*)>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1][1]);
    const attrs = match[2];
    const text = decodeEntities(match[3].replace(/<[^>]+>/g, "").trim());
    const existingId = attrs.match(/id="([^"]+)"/)?.[1];
    if (text) {
      headings.push({ id: existingId || slugify(text), text, level });
    }
  }
  return headings;
}

export function injectHeadingIds(html) {
  return html.replace(/<(h[23])([^>]*)>([\s\S]*?)<\/\1>/gi, (full, tag, attrs, content) => {
    if (attrs.includes("id=")) return full;
    const text = content.replace(/<[^>]+>/g, "").trim();
    const id = slugify(text);
    return `<${tag}${attrs} id="${id}">${content}</${tag}>`;
  });
}
