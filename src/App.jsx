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
  const { monitoring, padlets, webhooks, updatePadlet, addLog, alarmQueue, enqueueAlarm, clearAlarmQueue } = useStore();

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

    const processQueue = async () => {
      if (alarmQueue.length > 0 && isBusinessHours()) {
        console.log(`Processing ${alarmQueue.length} queued alarms...`);
        for (const queuedAlarm of alarmQueue) {
          for (const webhook of webhooks) {
            await sendGoogleChatMessage(webhook.url, queuedAlarm.post, queuedAlarm.title);
            addLog({
              type: 'ALARM_SENT',
              message: `(예약발송) '${queuedAlarm.padletName}'의 새 게시글 알림을 발송했습니다.`,
              status: 'success'
            });
          }
        }
        clearAlarmQueue();
      }
    };

    const checkPadlets = async () => {
      if (!monitoring.isActive || webhooks.length === 0 || padlets.length === 0) return;

      console.log('Checking padlets for new posts...');
      
      // Process any delayed alarms if we just entered business hours
      await processQueue();
      
      for (const padlet of padlets) {
        if (!padlet.url) continue;

        const result = await fetchPadletFeed(padlet.url);
        
        if (result.success && result.posts.length > 0) {
          // Find all posts newer than lastCheckedDate
          // If never checked, only alert the very latest one (index 0) to avoid spam
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
                // Send immediately
                for (const webhook of webhooks) {
                  await sendGoogleChatMessage(webhook.url, post, `새로운 패들렛 알람: ${padlet.name}`);
                  addLog({
                    type: 'ALARM_SENT',
                    message: `'${padlet.name}'의 새 게시글 알림을 '${webhook.name}'(으)로 발송했습니다.`,
                    status: 'success'
                  });
                }
              } else {
                // Queue for later
                enqueueAlarm({ padletName: padlet.name, post, title: `새로운 패들렛 알람: ${padlet.name}` });
                addLog({
                  type: 'ALARM_QUEUED',
                  message: `'${padlet.name}'의 새 알림이 업무시간 외에 발생하여 대기열에 추가되었습니다.`,
                  status: 'info'
                });
              }
            }
            
            updatePadlet(padlet.id, { 
              lastPostId: newPosts[0].id, 
              lastCheckedDate: new Date().toISOString() 
            });
          } else {
            // Just update last checked time if needed
            // Actually better to only update when new things happen, or update to current time
            updatePadlet(padlet.id, { lastCheckedDate: new Date().toISOString() });
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
      checkPadlets();
      intervalId = setInterval(checkPadlets, monitoring.interval * 60 * 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [monitoring.isActive, monitoring.interval, padlets, webhooks, alarmQueue]);

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
