import axios from 'axios';

/**
 * Fetches Padlet feed data using a CORS proxy.
 * We expect the user to provide the RSS Feed URL of the Padlet.
 */
export const fetchPadletFeed = async (rssUrl) => {
  try {
    // We use allorigins.win as a free CORS proxy
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(rssUrl)}`;
    const response = await axios.get(proxyUrl);
    
    if (!response.data || !response.data.contents) {
      throw new Error("Proxy failed to fetch content");
    }

    const xmlData = response.data.contents;
    
    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlData, "text/xml");
    
    const items = xmlDoc.querySelectorAll("item");
    const posts = [];
    
    items.forEach((item) => {
      const title = item.querySelector("title")?.textContent || "No Title";
      const link = item.querySelector("link")?.textContent || "";
      const pubDate = item.querySelector("pubDate")?.textContent || "";
      const description = item.querySelector("description")?.textContent || "";
      const guid = item.querySelector("guid")?.textContent || "";
      
      posts.push({
        id: guid || link || title,
        title,
        link,
        pubDate: new Date(pubDate),
        description
      });
    });
    
    // Sort by date descending
    posts.sort((a, b) => b.pubDate - a.pubDate);
    
    return { success: true, posts };
  } catch (error) {
    console.error('Failed to fetch Padlet feed:', error);
    return { success: false, error: error.message };
  }
};
