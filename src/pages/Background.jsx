import React, { useState } from 'react';
import useStore from '../store/useStore';
import { Copy, CheckCircle, TerminalSquare } from 'lucide-react';

const Background = () => {
  const { padlets, webhooks } = useStore();
  const [copied, setCopied] = useState(false);

  const generateGASCode = () => {
    return `/**
 * ESG 알람 자동화 스크립트 (Google Apps Script)
 * 이 스크립트를 복사하여 Google Apps Script (script.google.com) 에 붙여넣고,
 * '시간 기반 트리거(1분 또는 5분)'를 설정하세요.
 * 
 * 생성일: ${new Date().toLocaleString('ko-KR')}
 */

// === 설정 데이터 (앱에서 자동 생성됨) ===
const CONFIG = {
  padlets: ${JSON.stringify(padlets.map(p => ({ url: p.url, name: p.name, id: p.id })), null, 4)},
  webhooks: ${JSON.stringify(webhooks.map(w => ({ url: w.url, name: w.name })), null, 4)}
};

// ==========================================
// 아래 코드는 수정하지 마세요.
// ==========================================

const CACHE_USER_NAMES = {};

function getUserName(userId) {
  if (!userId) return "익명";
  if (CACHE_USER_NAMES[userId]) return CACHE_USER_NAMES[userId];
  try {
    const res = UrlFetchApp.fetch("https://padlet.com/api/5/users/" + userId, { muteHttpExceptions: true });
    if (res.getResponseCode() === 200) {
      const data = JSON.parse(res.getContentText());
      if (data && data.data && data.data.attributes) {
        CACHE_USER_NAMES[userId] = data.data.attributes.name || "익명";
        return CACHE_USER_NAMES[userId];
      }
    }
  } catch (e) {}
  return "익명";
}

function fetchPadletData(inputUrl) {
  const posts = [];
  try {
    const htmlRes = UrlFetchApp.fetch(inputUrl, { muteHttpExceptions: true });
    if (htmlRes.getResponseCode() !== 200) return posts;
    
    const html = htmlRes.getContentText();
    const rssMatch = html.match(/<link[^>]*rel=["']alternate["'][^>]*type=["']application\\/rss\\+xml["'][^>]*href=["']([^"']+)["']/i);
    if (!rssMatch) return posts;
    
    const rssUrl = rssMatch[1].replace(/&amp;/g, '&');
    const rssRes = UrlFetchApp.fetch(rssUrl, { muteHttpExceptions: true });
    if (rssRes.getResponseCode() !== 200) return posts;
    
    const xml = rssRes.getContentText();
    const document = XmlService.parse(xml);
    const channel = document.getRootElement().getChild('channel');
    if (!channel) return posts;
    
    const items = channel.getChildren('item');
    
    items.forEach(item => {
      const title = item.getChildText('title') || "No Title";
      const link = item.getChildText('link') || "";
      const pubDate = item.getChildText('pubDate') || "";
      let description = item.getChildText('description') || "";
      description = description.replace(/<[^>]*>?/gm, '');
      const author = item.getChildText('author') || "작성자 모름";
      const guid = item.getChildText('guid') || link;
      
      const wishIdMatch = link.match(/\\/wish\\/(\\d+)/);
      const wishId = wishIdMatch ? wishIdMatch[1] : null;

      posts.push({
        id: "wish_" + (wishId || guid),
        category: "새 카테고리(섹션)",
        title: title,
        author: author,
        link: link,
        pubDate: new Date(pubDate).getTime(),
        description: description
      });

      if (wishId) {
        try {
          const commentRes = UrlFetchApp.fetch("https://padlet.com/api/5/comments?wish_id=" + wishId, { muteHttpExceptions: true });
          if (commentRes.getResponseCode() === 200) {
            const commentData = JSON.parse(commentRes.getContentText());
            if (commentData && commentData.data) {
              commentData.data.forEach(comment => {
                const attr = comment.attributes;
                const commentAuthor = getUserName(attr.user_id);
                let content = attr.body || attr.html_body || "";
                if (!content.trim()) content = "[미디어 파일 첨부됨]";
                content = content.replace(/<[^>]*>?/gm, '');
                
                posts.push({
                  id: "comment_" + attr.id,
                  category: title, // Parent wish title as category
                  title: content.length > 50 ? content.substring(0, 50) + "..." : content,
                  author: commentAuthor,
                  link: link,
                  pubDate: new Date(attr.created_at).getTime(),
                  description: content
                });
              });
            }
          }
        } catch(e) {
          console.log("댓글 가져오기 실패: " + wishId);
        }
      }
    });
    
  } catch(e) {
    console.log("패들렛 데이터 파싱 오류: " + e.toString());
  }
  
  posts.sort((a, b) => a.pubDate - b.pubDate); // 오래된 것부터 정렬
  return posts;
}

function sendChat(webhookUrl, postData, customTitle) {
  try {
    const payload = {
      cardsV2: [
        {
          cardId: 'alarmCard',
          card: {
            header: {
              title: customTitle || '새로운 알림',
              subtitle: 'ESG 실천활동 시스템 (백그라운드)',
              imageUrl: 'https://cdn-icons-png.flaticon.com/512/3135/3135686.png',
              imageType: 'CIRCLE'
            },
            sections: [
              {
                widgets: [
                  {
                    decoratedText: {
                      topLabel: '카테고리',
                      text: postData.category || '기본',
                      wrapText: true
                    }
                  },
                  {
                    decoratedText: {
                      topLabel: '작성자',
                      text: postData.author || '익명',
                      wrapText: true
                    }
                  },
                  {
                    decoratedText: {
                      topLabel: '내용',
                      text: postData.description || '(내용 없음)',
                      wrapText: true
                    }
                  },
                  {
                    buttonList: {
                      buttons: [
                        {
                          text: '원문 보러가기',
                          onClick: {
                            openLink: {
                              url: postData.link || 'https://padlet.com'
                            }
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            ]
          }
        }
      ]
    };
    
    UrlFetchApp.fetch(webhookUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch(e) {
    console.log("구글 챗 전송 오류: " + e.toString());
  }
}

function isBusinessHours(now) {
  const kstHour = parseInt(Utilities.formatDate(now, "Asia/Seoul", "HH"), 10);
  const kstDay = parseInt(Utilities.formatDate(now, "Asia/Seoul", "u"), 10); // 1 = Monday, 7 = Sunday
  return (kstDay >= 1 && kstDay <= 5 && kstHour >= 9 && kstHour < 18);
}

// 이 함수가 트리거로 실행될 메인 함수입니다.
function checkEsgAlarms() {
  if (CONFIG.padlets.length === 0 || CONFIG.webhooks.length === 0) return;
  
  const props = PropertiesService.getScriptProperties();
  const queueStr = props.getProperty('ALARM_QUEUE');
  let alarmQueue = queueStr ? JSON.parse(queueStr) : [];
  
  const now = new Date();
  const businessHours = isBusinessHours(now);
  
  // 영업시간이면 대기열 발송
  if (alarmQueue.length > 0 && businessHours) {
    alarmQueue.forEach(q => sendChat(q.webhookUrl, q.post, q.title));
    alarmQueue = [];
    props.setProperty('ALARM_QUEUE', JSON.stringify(alarmQueue));
  }
  
  CONFIG.padlets.forEach(padlet => {
    const posts = fetchPadletData(padlet.url);
    if (posts.length > 0) {
      const lastCheckedKey = 'LAST_CHECK_' + padlet.id;
      const lastCheckedStr = props.getProperty(lastCheckedKey);
      
      let newPosts = [];
      if (!lastCheckedStr) {
         // 최초 실행 시 현재 시간만 저장하고 알람은 보내지 않음
         props.setProperty(lastCheckedKey, now.getTime().toString());
         return;
      } else {
         const lastDate = parseInt(lastCheckedStr, 10);
         newPosts = posts.filter(p => p.pubDate > lastDate);
      }
      
      if (newPosts.length > 0) {
        newPosts.forEach(post => {
          const title = "새로운 패들렛 알람: " + padlet.name;
          CONFIG.webhooks.forEach(wh => {
            if (businessHours) {
              sendChat(wh.url, post, title);
            } else {
              alarmQueue.push({ webhookUrl: wh.url, post: post, title: "(예약발송) " + title });
            }
          });
        });
        
        if (!businessHours) {
           props.setProperty('ALARM_QUEUE', JSON.stringify(alarmQueue));
        }
        
        props.setProperty(lastCheckedKey, now.getTime().toString());
      }
    }
  });
}
`;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateGASCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="dashboard-container" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1>백그라운드 실행 관리</h1>
        <p>브라우저를 닫아도 24시간 동안 구글 챗 알람을 받기 위한 설정입니다.</p>
      </div>

      <div className="card glass-panel">
        <div className="card-header">
          <h3>Google Apps Script 코드 생성기</h3>
        </div>
        <div style={{ padding: '0 1.5rem 1.5rem 1.5rem', lineHeight: '1.6' }}>
          <div className="alert-info" style={{ background: '#eff6ff', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid #bfdbfe' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e3a8a' }}>💡 왜 필요한가요?</h4>
            <p style={{ margin: 0, color: '#1e40af' }}>
              이 사이트는 무료 프론트엔드 환경에서 동작하기 때문에 <strong>웹 브라우저를 열어두어야만 알람이 작동</strong>합니다.
              창을 닫아도 작동하게 하려면, 구글의 무료 클라우드 서버(Apps Script)에 아래 코드를 등록해야 합니다.
            </p>
          </div>

          <ol style={{ paddingLeft: '1.5rem', marginBottom: '1.5rem' }}>
            <li>아래 <strong>[코드 복사하기]</strong> 버튼을 누릅니다. (현재 등록된 패들렛과 웹훅 정보가 자동 포함됩니다)</li>
            <li><a href="https://script.google.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-blue)', fontWeight: 'bold' }}>Google Apps Script (script.google.com)</a> 에 접속하여 새 프로젝트를 만듭니다.</li>
            <li>기존 코드를 모두 지우고, 복사한 코드를 붙여넣기 한 후 저장(Ctrl+S)합니다.</li>
            <li>왼쪽 메뉴에서 <strong>트리거(시계 모양 아이콘)</strong>를 클릭하고 <code>checkEsgAlarms</code> 함수를 <strong>시간 기반 (1분 또는 5분 단위)</strong>으로 실행되도록 설정합니다.</li>
            <li>권한 승인 창이 뜨면 승인합니다. 완료!</li>
          </ol>

          <div style={{ position: 'relative' }}>
            <button 
              onClick={handleCopy}
              className="btn btn-primary"
              style={{ position: 'absolute', top: '10px', right: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              {copied ? <CheckCircle size={18} /> : <Copy size={18} />}
              {copied ? '복사 완료!' : '코드 복사하기'}
            </button>
            <pre style={{ 
              background: '#1e293b', color: '#f8fafc', padding: '1.5rem', 
              borderRadius: '8px', overflowX: 'auto', maxHeight: '400px', fontSize: '0.9rem' 
            }}>
              <code>{generateGASCode()}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Background;
