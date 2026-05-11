import React, { useEffect } from 'react';
import { Routes, Route, HashRouter } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Padlets from './pages/Padlets';
import Webhooks from './pages/Webhooks';
import useStore from './store/useStore';
import { fetchPadletFeed } from './services/padletService';
import { sendGoogleChatMessage } from './services/webhookService';

function App() {
  const { monitoring, padlets, webhooks, updatePadlet, addLog } = useStore();

  // Background Monitoring Logic
  useEffect(() => {
    let intervalId;

    const checkPadlets = async () => {
      if (!monitoring.isActive || webhooks.length === 0 || padlets.length === 0) return;

      console.log('Checking padlets for new posts...');
      
      for (const padlet of padlets) {
        if (!padlet.url) continue; // Skip if no URL

        const result = await fetchPadletFeed(padlet.url);
        
        if (result.success && result.posts.length > 0) {
          const latestPost = result.posts[0];
          
          // Check if this is a new post
          if (padlet.lastPostId !== latestPost.id) {
            console.log(`New post found on ${padlet.name || 'Padlet'}:`, latestPost.title);
            
            // Send to all active webhooks
            for (const webhook of webhooks) {
              const message = `<b>새로운 ESG 실천활동 등록 알림!</b><br><br><b>패들렛:</b> ${padlet.name || '이름 없음'}<br><b>제목:</b> ${latestPost.title}<br><b>내용:</b> ${latestPost.description.substring(0, 100)}...<br><br><a href="${latestPost.link}">게시글 확인하기</a>`;
              
              await sendGoogleChatMessage(webhook.url, message);
              
              addLog({
                type: 'ALARM_SENT',
                message: `'${padlet.name}'의 새 게시글 알림을 '${webhook.name}'(으)로 발송했습니다.`,
                status: 'success'
              });
            }
            
            // Update padlet with latest post ID
            updatePadlet(padlet.id, { 
              lastPostId: latestPost.id, 
              lastChecked: new Date().toISOString() 
            });
          } else {
            // Just update last checked time
            updatePadlet(padlet.id, { lastChecked: new Date().toISOString() });
          }
        } else if (!result.success) {
          addLog({
            type: 'ERROR',
            message: `'${padlet.name}' 패들렛 확인 중 오류 발생: ${result.error}`,
            status: 'error'
          });
        }
      }
    };

    if (monitoring.isActive) {
      // Check immediately on start
      checkPadlets();
      // Then check based on interval
      intervalId = setInterval(checkPadlets, monitoring.interval * 60 * 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [monitoring.isActive, monitoring.interval, padlets, webhooks]);

  return (
    <HashRouter>
      <div className="app-container">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/padlets" element={<Padlets />} />
            <Route path="/webhooks" element={<Webhooks />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

export default App;
