import React from 'react';
import useStore from '../store/useStore';
import { Play, Square, Activity, Bell, Link2 } from 'lucide-react';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

const Dashboard = () => {
  const { padlets, webhooks, logs, monitoring, toggleMonitoring, setMonitoring } = useStore();

  const handleIntervalChange = (e) => {
    setMonitoring({ interval: parseInt(e.target.value) });
  };

  return (
    <div className="dashboard-container" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1>ESG 알람 대시보드</h1>
        <p>패들렛의 새로운 활동을 감지하고 구글 챗으로 알려줍니다.</p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
        <div className="card glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: 'var(--primary-light)', borderRadius: '12px', color: 'var(--primary-blue)' }}>
              <Link2 size={24} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>등록된 패들렛</p>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{padlets.length}개</h2>
            </div>
          </div>
        </div>

        <div className="card glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: '#f0fdf4', borderRadius: '12px', color: '#16a34a' }}>
              <Bell size={24} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>등록된 구글 챗</p>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>{webhooks.length}개</h2>
            </div>
          </div>
        </div>

        <div className="card glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', background: '#fff7ed', borderRadius: '12px', color: '#ea580c' }}>
              <Activity size={24} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: '0.875rem' }}>모니터링 상태</p>
              <h2 style={{ margin: 0, fontSize: '1.5rem' }}>
                {monitoring.isActive ? (
                  <span className="badge badge-active">작동 중</span>
                ) : (
                  <span className="badge badge-inactive">정지됨</span>
                )}
              </h2>
            </div>
          </div>
        </div>
      </div>

      {/* Monitoring Control */}
      <div className="card glass-panel">
        <div className="card-header" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
          <div>
            <h3>모니터링 제어</h3>
            <p>이 창이 열려있는 동안에만 알람이 작동합니다.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label className="form-label" style={{ margin: 0 }}>확인 주기:</label>
              <select 
                className="form-input" 
                style={{ width: 'auto', padding: '0.5rem' }}
                value={monitoring.interval}
                onChange={handleIntervalChange}
                disabled={monitoring.isActive}
              >
                <option value={1}>1분</option>
                <option value={5}>5분</option>
                <option value={15}>15분</option>
                <option value={30}>30분</option>
                <option value={60}>1시간</option>
              </select>
            </div>
            <label className="switch">
              <input type="checkbox" checked={monitoring.isActive} onChange={toggleMonitoring} />
              <span className="slider round"></span>
            </label>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="card glass-panel">
        <div className="card-header">
          <h3>최근 알람 기록</h3>
        </div>
        
        {logs.length === 0 ? (
          <div className="empty-state">
            <Activity size={48} />
            <p>아직 기록된 알람이 없습니다.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>시간</th>
                  <th>유형</th>
                  <th>내용</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 10).map((log) => (
                  <tr key={log.id}>
                    <td>{format(new Date(log.timestamp), 'MM.dd HH:mm:ss', { locale: ko })}</td>
                    <td>{log.type === 'ALARM_SENT' ? '알람 발송' : '시스템'}</td>
                    <td>{log.message}</td>
                    <td>
                      <span className={`badge ${log.status === 'success' ? 'badge-active' : 'badge-error'}`}>
                        {log.status === 'success' ? '성공' : '오류'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
