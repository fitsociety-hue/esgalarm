import axios from 'axios';

/**
 * Fetches Padlet feed data using a CORS proxy.
 * We expect the user to provide the RSS Feed URL of the Padlet.
 */
export const fetchPadletFeed = async (inputUrl) => {
  try {
    // We use allorigins.win as a free CORS proxy
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(inputUrl)}`;
    const response = await axios.get(proxyUrl);
    
    if (!response.data) {
      throw new Error("Proxy failed to fetch content");
    }

    // CORS proxy might return the content directly
    let dataContent = response.data.contents ? response.data.contents : response.data;
    if (typeof dataContent !== 'string') {
        dataContent = JSON.stringify(dataContent);
    }
    
    // Check if the response is an HTML page (like a normal Padlet URL)
    // and try to extract the RSS feed URL from it.
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
