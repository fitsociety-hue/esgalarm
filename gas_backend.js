/**
 * ESG 알람 자동화 스크립트 (Google Apps Script)
 * 백엔드 서버 모드 - 앱과 자동으로 연동됩니다.
 * v2.1 - 업무시간 외 게시글 오전 9시 예약발송 버그 수정
 */

// ==========================================
// 웹앱 URL 통신 설정 (프론트엔드 연동)
// ==========================================

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    PropertiesService.getScriptProperties().setProperty('esgConfig', JSON.stringify(data));
    return ContentService.createTextOutput(JSON.stringify({success: true, message: "설정 저장 완료"}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({success: false, error: err.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  const config = PropertiesService.getScriptProperties().getProperty('esgConfig');
  return ContentService.createTextOutput(config || '{"padlets":[], "webhooks":[]}')
    .setMimeType(ContentService.MimeType.JSON);
}

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
    const rssMatch = html.match(/<link[^>]*rel=["']alternate["'][^>]*type=["']application\/rss\+xml["'][^>]*href=["']([^"']+)["']/i);
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
      
      const wishIdMatch = link.match(/\/wish\/(\d+)/);
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

/**
 * 업무시간 여부 판단 (평일 09:00~18:00 KST)
 */
function isBusinessHours(now) {
  const kstHour = parseInt(Utilities.formatDate(now, "Asia/Seoul", "HH"), 10);
  const kstDay = parseInt(Utilities.formatDate(now, "Asia/Seoul", "u"), 10); // 1=월, 7=일
  return (kstDay >= 1 && kstDay <= 5 && kstHour >= 9 && kstHour < 18);
}

/**
 * 오전 9시 예약발송 기준 시각 계산
 * - 평일 00:00~08:59 게시글 → 당일 09:00 발송
 * - 주말(토/일) 게시글 → 다음 월요일 09:00 발송
 */
function getNextDeliveryTime(now) {
  const kstDay  = parseInt(Utilities.formatDate(now, "Asia/Seoul", "u"), 10); // 1=월 ... 7=일
  const kstHour = parseInt(Utilities.formatDate(now, "Asia/Seoul", "HH"), 10);

  // KST 기준 오늘 00:00:00
  const todayKST = new Date(Utilities.formatDate(now, "Asia/Seoul", "yyyy-MM-dd") + "T00:00:00+09:00");

  if (kstDay >= 1 && kstDay <= 5) {
    // 평일: 아직 09:00 이전이면 오늘 09:00
    if (kstHour < 9) {
      return new Date(todayKST.getTime() + 9 * 3600 * 1000);
    }
    // 이미 18:00 이후면 다음 평일 09:00 (단순화: +1일, 혹은 금→월)
    const daysUntilMonday = kstDay === 5 ? 3 : 1; // 금요일이면 3일 후 월요일
    return new Date(todayKST.getTime() + daysUntilMonday * 24 * 3600 * 1000 + 9 * 3600 * 1000);
  } else if (kstDay === 6) {
    // 토요일 → 다음 월요일(+2일) 09:00
    return new Date(todayKST.getTime() + 2 * 24 * 3600 * 1000 + 9 * 3600 * 1000);
  } else {
    // 일요일 → 내일(월요일) 09:00
    return new Date(todayKST.getTime() + 1 * 24 * 3600 * 1000 + 9 * 3600 * 1000);
  }
}

// 이 함수가 트리거로 실행될 메인 함수입니다.
function checkEsgAlarms() {
  const configStr = PropertiesService.getScriptProperties().getProperty('esgConfig');
  if (!configStr) return; // 프론트엔드에서 아직 설정이 연동되지 않음
  
  const CONFIG = JSON.parse(configStr);
  if (!CONFIG.padlets || CONFIG.padlets.length === 0 || !CONFIG.webhooks || CONFIG.webhooks.length === 0) return;
  
  const props = PropertiesService.getScriptProperties();
  const now = new Date();
  const businessHours = isBusinessHours(now);

  // ------------------------------------------------------------------
  // 1단계: 대기열에 쌓인 예약 알람 발송 (업무 시작 시간 09:00 이후)
  //        deliverAt 시각이 현재 시각 이후인 항목만 발송
  // ------------------------------------------------------------------
  const queueStr = props.getProperty('ALARM_QUEUE');
  let alarmQueue = queueStr ? JSON.parse(queueStr) : [];

  if (alarmQueue.length > 0 && businessHours) {
    const nowMs = now.getTime();
    const toSend  = alarmQueue.filter(q => !q.deliverAt || q.deliverAt <= nowMs);
    const pending  = alarmQueue.filter(q =>  q.deliverAt && q.deliverAt >  nowMs);

    toSend.forEach(q => sendChat(q.webhookUrl, q.post, q.title));

    alarmQueue = pending;
    props.setProperty('ALARM_QUEUE', JSON.stringify(alarmQueue));
    console.log("✅ 예약 알람 " + toSend.length + "건 발송 완료, 대기 중: " + pending.length + "건");
  }

  // ------------------------------------------------------------------
  // 2단계: 새 게시글 감지 및 알람 발송 / 큐 등록
  // ------------------------------------------------------------------
  CONFIG.padlets.forEach(padlet => {
    const posts = fetchPadletData(padlet.url);
    if (posts.length === 0) return;

    const lastCheckedKey = 'LAST_CHECK_' + padlet.id;
    const lastCheckedStr = props.getProperty(lastCheckedKey);

    if (!lastCheckedStr) {
      // 최초 실행 시: 현재 시간을 기준으로 저장하고 알람은 보내지 않음
      props.setProperty(lastCheckedKey, now.getTime().toString());
      console.log("🔧 최초 실행 - 기준 시각 저장: " + padlet.name);
      return;
    }

    const lastDate = parseInt(lastCheckedStr, 10);
    const newPosts = posts.filter(p => p.pubDate > lastDate);

    if (newPosts.length > 0) {
      let queueUpdated = false;

      newPosts.forEach(post => {
        const title = "새로운 패들렛 알람: " + padlet.name;

        CONFIG.webhooks.forEach(wh => {
          if (businessHours) {
            // 업무시간: 즉시 발송
            sendChat(wh.url, post, title);
            console.log("📢 즉시 발송: " + post.author + " - " + post.title);
          } else {
            // 업무시간 외: 다음 발송 가능 시각(오전 9시)에 예약
            const deliverAt = getNextDeliveryTime(now).getTime();

            // 중복 등록 방지: 동일 post.id + webhookUrl 조합이 이미 큐에 없는 경우만 추가
            const isDuplicate = alarmQueue.some(q => q.postId === post.id && q.webhookUrl === wh.url);
            if (!isDuplicate) {
              alarmQueue.push({
                webhookUrl: wh.url,
                post: post,
                postId: post.id,                    // 중복 방지 키
                title: "(예약발송) " + title,
                deliverAt: deliverAt                // 발송 예정 시각 (ms)
              });
              queueUpdated = true;
              console.log("⏰ 예약 등록: " + post.author + " - " + post.title +
                          " → " + new Date(deliverAt).toLocaleString('ko-KR'));
            }
          }
        });
      });

      // 큐가 변경된 경우에만 저장
      if (queueUpdated) {
        props.setProperty('ALARM_QUEUE', JSON.stringify(alarmQueue));
      }

      // ⚠️ 핵심 수정: lastCheckedKey는 새 게시글 처리 후 반드시 업데이트
      //    (업무시간 외 큐 등록 후에도 업데이트하여 중복 감지 방지)
      props.setProperty(lastCheckedKey, now.getTime().toString());
    }
  });
}

// ==========================================
// 트리거 자동 설정 함수 (이 함수를 한 번 실행하세요!)
// ==========================================
function installTrigger() {
  // 기존 트리거가 있다면 모두 삭제
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  
  // 1분 단위로 실시간 확인하는 트리거 생성
  ScriptApp.newTrigger('checkEsgAlarms')
    .timeBased()
    .everyMinutes(1)
    .create();
    
  console.log("✅ 1분 단위 실시간 확인 트리거가 성공적으로 설정되었습니다!");
}

// ==========================================
// 디버그: 현재 대기열 확인용 (수동 실행)
// ==========================================
function debugShowQueue() {
  const props = PropertiesService.getScriptProperties();
  const queueStr = props.getProperty('ALARM_QUEUE');
  const queue = queueStr ? JSON.parse(queueStr) : [];
  console.log("📋 현재 대기열 (" + queue.length + "건):");
  queue.forEach((q, i) => {
    console.log("  [" + (i+1) + "] " + q.post.author + " - " + q.post.title +
                " | 발송 예정: " + (q.deliverAt ? new Date(q.deliverAt).toLocaleString('ko-KR') : '즉시'));
  });
}

// ==========================================
// 긴급 수동 발송: 대기열을 즉시 전부 발송 (수동 실행)
// ==========================================
function forceFlushQueue() {
  const props = PropertiesService.getScriptProperties();
  const configStr = props.getProperty('esgConfig');
  if (!configStr) { console.log("설정 없음"); return; }

  const queueStr = props.getProperty('ALARM_QUEUE');
  const queue = queueStr ? JSON.parse(queueStr) : [];

  if (queue.length === 0) {
    console.log("대기열이 비어 있습니다.");
    return;
  }

  queue.forEach(q => sendChat(q.webhookUrl, q.post, "🚨 (수동발송) " + q.title));
  props.setProperty('ALARM_QUEUE', JSON.stringify([]));
  console.log("✅ 대기열 " + queue.length + "건 수동 발송 완료.");
}