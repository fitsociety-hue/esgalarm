import React, { useEffect } from 'react';
import { Routes, Route, HashRouter } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Padlets from './pages/Padlets';
import Webhooks from './pages/Webhooks';
import Background from './pages/Background';
import useStore from './store/useStore';
import { fetchPadletFeed } from './services/padletService';
import { sendGoogleChatMessage } from './services/webhookService';

function App() {
  const { monitoring, padlets, webhooks, backendUrl, updatePadlet, addLog, alarmQueue, enqueueAlarm, clearAlarmQueue } = useStore();

  // Sync to GAS Backend whenever config changes
  useEffect(() => {
    if (backendUrl && backendUrl.startsWith('https://script.google.com/')) {
      const syncToBackend = async () => {
        try {
          await fetch(backendUrl, {
            method: 'POST',
            mode: 'no-cors', // Important for GAS to avoid preflight issues from frontend
            headers: {
              'Content-Type': 'text/plain', // Use text/plain for GAS simple POST
            },
            body: JSON.stringify({ padlets, webhooks })
          });
          console.log("Synced config to GAS backend successfully.");
        } catch (err) {
          console.error("Failed to sync to GAS backend:", err);
        }
      };
      // Debounce the sync slightly to avoid multiple calls when adding items quickly
      const timeoutId = setTimeout(syncToBackend, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [padlets, webhooks, backendUrl]);

  // Helper to check KST business hours
  const isBusinessHours = () => {
    const now = new Date();
    // Convert to KST
    const kstTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Seoul"}));
    const day = kstTime.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
    const hour = kstTime.getHours();
    
    // Monday(1) to Friday(5), 09:00 to 17:59
    if (day >= 1 && day <= 5 && hour >= 9 && hour < 18) {
      return true;
    }
    return false;
  };

  // Background Monitoring Logic
  useEffect(() => {
    let intervalId;
    let isChecking = false; // Prevent concurrent checks

    const processQueue = async () => {
      const state = useStore.getState();
      const currentQueue = state.alarmQueue;
      const currentWebhooks = state.webhooks;

      if (currentQueue.length > 0 && isBusinessHours()) {
        console.log(`Processing ${currentQueue.length} queued alarms...`);
        for (const queuedAlarm of currentQueue) {
          for (const webhook of currentWebhooks) {
            await sendGoogleChatMessage(webhook.url, queuedAlarm.post, queuedAlarm.title);
            state.addLog({
              type: 'ALARM_SENT',
              message: `(예약발송) '${queuedAlarm.padletName}'의 새 게시글 알림을 발송했습니다.`,
              status: 'success'
            });
          }
        }
        state.clearAlarmQueue();
      }
    };

    const checkPadlets = async () => {
      if (isChecking) return;
      
      const state = useStore.getState();
      if (!state.monitoring.isActive || state.webhooks.length === 0 || state.padlets.length === 0) return;

      isChecking = true;
      try {
        console.log('Checking padlets for new posts...');
        
        await processQueue();
        
        for (const padlet of state.padlets) {
          if (!padlet.url) continue;

          const result = await fetchPadletFeed(padlet.url);
          
          if (result.success && result.posts.length > 0) {
            let newPosts = [];
            if (!padlet.lastCheckedDate) {
               newPosts = [result.posts[0]];
            } else {
               const lastDate = new Date(padlet.lastCheckedDate);
               newPosts = result.posts.filter(p => new Date(p.pubDate) > lastDate);
            }

            if (newPosts.length > 0) {
              for (const post of newPosts) {
                console.log(`New post/comment found on ${padlet.name}:`, post.title);
                
                if (isBusinessHours()) {
                  for (const webhook of state.webhooks) {
                    await sendGoogleChatMessage(webhook.url, post, `새로운 패들렛 알람: ${padlet.name}`);
                    state.addLog({
                      type: 'ALARM_SENT',
                      message: `'${padlet.name}'의 새 게시글 알림을 '${webhook.name}'(으)로 발송했습니다.`,
                      status: 'success'
                    });
                  }
                } else {
                  state.enqueueAlarm({ padletName: padlet.name, post, title: `새로운 패들렛 알람: ${padlet.name}` });
                  state.addLog({
                    type: 'ALARM_QUEUED',
                    message: `'${padlet.name}'의 새 알림이 업무시간 외에 발생하여 대기열에 추가되었습니다.`,
                    status: 'info'
                  });
                }
              }
              
              state.updatePadlet(padlet.id, { 
                lastPostId: newPosts[0].id, 
                lastCheckedDate: new Date().toISOString() 
              });
            } else {
              state.updatePadlet(padlet.id, { lastCheckedDate: new Date().toISOString() });
            }
          } else if (!result.success) {
            state.addLog({
              type: 'ERROR',
              message: `'${padlet.name}' 패들렛 확인 중 오류 발생: ${result.error}`,
              status: 'error'
            });
          }
        }
      } finally {
        isChecking = false;
      }
    };

    if (monitoring.isActive) {
      checkPadlets();
      intervalId = setInterval(checkPadlets, monitoring.interval * 60 * 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [monitoring.isActive, monitoring.interval]);

  return (
    <HashRouter>
      <div className="app-container">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/padlets" element={<Padlets />} />
            <Route path="/webhooks" element={<Webhooks />} />
            <Route path="/background" element={<Background />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

export default App;
