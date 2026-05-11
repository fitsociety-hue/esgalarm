import axios from 'axios';

// Cache for user names to avoid duplicate requests
const userCache = {};

async function getUserName(userId) {
  if (!userId) return "익명";
  if (userCache[userId]) return userCache[userId];
  try {
    const res = await axios.get(`https://padlet.com/api/5/users/${userId}`);
    if (res.data && res.data.data && res.data.data.attributes) {
      userCache[userId] = res.data.data.attributes.name || "익명";
      return userCache[userId];
    }
  } catch (e) {
    // Ignore error
  }
  return "익명";
}

/**
 * Fetches Padlet feed data using a CORS proxy.
 * It also fetches comments via Padlet's native API.
 */
export const fetchPadletFeed = async (inputUrl) => {
  try {
    // We use corsproxy.io as a free CORS proxy for HTML/RSS
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(inputUrl)}`;
    const response = await axios.get(proxyUrl);
    
    if (!response.data) {
      throw new Error("Proxy failed to fetch content");
    }

    let dataContent = response.data.contents ? response.data.contents : response.data;
    if (typeof dataContent !== 'string') {
        dataContent = JSON.stringify(dataContent);
    }
    
    // Check if the response is an HTML page (like a normal Padlet URL)
    if (dataContent.includes('<html') || dataContent.includes('<!DOCTYPE html>')) {
      const match = dataContent.match(/<link[^>]*rel=["']alternate["'][^>]*type=["']application\/rss\+xml["'][^>]*href=["']([^"']+)["']/i);
      if (match && match[1]) {
        const rssUrlToFetch = match[1].replace(/&amp;/g, '&');
        const rssProxyUrl = `https://corsproxy.io/?${encodeURIComponent(rssUrlToFetch)}`;
        const rssResponse = await axios.get(rssProxyUrl);
        if (rssResponse.data) {
          dataContent = rssResponse.data.contents ? rssResponse.data.contents : rssResponse.data;
        } else {
          throw new Error("RSS 피드 주소를 추출했으나, 피드를 가져오는데 실패했습니다.");
        }
      } else {
        throw new Error("올바른 패들렛 주소가 아니거나 RSS 피드가 비활성화되어 있습니다.");
      }
    }

    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(dataContent, "text/xml");
    
    const items = xmlDoc.querySelectorAll("item");
    const posts = [];
    const wishPromises = [];
    
    items.forEach((item) => {
      const title = item.querySelector("title")?.textContent || "No Title";
      const link = item.querySelector("link")?.textContent || "";
      const pubDate = item.querySelector("pubDate")?.textContent || "";
      const description = item.querySelector("description")?.textContent || "";
      const author = item.querySelector("author")?.textContent || "작성자 모름";
      const guid = item.querySelector("guid")?.textContent || "";
      
      const wishIdMatch = link.match(/\/wish\/(\d+)/);
      const wishId = wishIdMatch ? wishIdMatch[1] : null;

      posts.push({
        id: `wish_${wishId || guid || link}`,
        category: "새 카테고리(섹션)",
        title,
        author,
        link,
        pubDate: new Date(pubDate),
        description: description.replace(/<[^>]*>?/gm, '')
      });

      if (wishId) {
        const p = axios.get(`https://padlet.com/api/5/comments?wish_id=${wishId}`).then(async (res) => {
          if (res.data && res.data.data) {
            for (const comment of res.data.data) {
              const attr = comment.attributes;
              const commentAuthor = await getUserName(attr.user_id);
              let content = attr.body || attr.html_body || "";
              if (!content.trim()) {
                 content = "[미디어 파일 첨부됨]";
              }
              const cleanContent = content.replace(/<[^>]*>?/gm, '');

              posts.push({
                id: `comment_${attr.id}`,
                category: title, // Parent wish title as category
                title: cleanContent.substring(0, 50) + (cleanContent.length > 50 ? "..." : ""),
                author: commentAuthor,
                link: link,
                pubDate: new Date(attr.created_at),
                description: cleanContent
              });
            }
          }
        }).catch(err => {
          console.error("Failed to fetch comments for wish " + wishId, err);
        });
        wishPromises.push(p);
      }
    });
    
    // Wait for all comments to be fetched
    await Promise.all(wishPromises);
    
    // Sort by date descending
    posts.sort((a, b) => b.pubDate - a.pubDate);
    
    return { success: true, posts };
  } catch (error) {
    console.error('Failed to fetch Padlet feed:', error);
    return { success: false, error: error.message };
  }
};
