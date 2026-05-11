import React, { useState } from 'react';
import useStore from '../store/useStore';
import { Plus, Trash2, Info } from 'lucide-react';
import { sendGoogleChatMessage } from '../services/webhookService';

const Webhooks = () => {
  const { webhooks, addWebhook, removeWebhook, addLog } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '', url: '' });
  const [isTesting, setIsTesting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name && formData.url) {
      addWebhook(formData);
      setFormData({ name: '', url: '' });
      setIsAdding(false);
    }
  };

  const handleTestWebhook = async (webhook) => {
    setIsTesting(true);
    try {
      const message = `<b>웹훅 테스트 성공!</b><br><br>ESG 알람 시스템과 '${webhook.name}' 구글 챗 공간이 정상적으로 연결되었습니다.`;
      const result = await sendGoogleChatMessage(webhook.url, message, '연결 테스트');
      
      if (result.success) {
        addLog({
          type: 'SYSTEM',
          message: `'${webhook.name}' 웹훅 테스트 메시지를 발송했습니다.`,
          status: 'success'
        });
        alert('테스트 메시지가 발송되었습니다. 구글 챗을 확인해주세요.');
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      alert(`테스트 실패: ${error.message}`);
      addLog({
        type: 'ERROR',
        message: `'${webhook.name}' 웹훅 테스트 실패: ${error.message}`,
        status: 'error'
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>구글 챗 웹훅 관리</h1>
          <p>알람을 받을 구글 챗 스페이스의 웹훅 URL을 등록하세요.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsAdding(!isAdding)}>
          <Plus size={18} />
          새 웹훅 등록
        </button>
      </div>

      {isAdding && (
        <div className="card glass-panel" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <div className="card-header">
            <h3>새 웹훅 추가</h3>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">웹훅 이름 (별칭)</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="예: ESG 팀 알림방" 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">구글 챗 웹훅 URL</label>
              <input 
                type="url" 
                className="form-input" 
                placeholder="https://chat.googleapis.com/v1/spaces/..." 
                value={formData.url}
                onChange={(e) => setFormData({...formData, url: e.target.value})}
                required
              />
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-light)', display: 'flex', gap: '0.5rem' }}>
                <Info size={14} style={{ flexShrink: 0 }} />
                <span>구글 챗 스페이스 이름 클릭 &gt; [앱 및 통합] &gt; [Webhooks]에서 생성한 URL을 입력하세요.</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn-glass" onClick={() => setIsAdding(false)}>취소</button>
              <button type="submit" className="btn btn-primary">저장하기</button>
            </div>
          </form>
        </div>
      )}

      <div className="card glass-panel">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>이름</th>
                <th>웹훅 URL</th>
                <th style={{ width: '150px', textAlign: 'center' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.length === 0 ? (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-light)' }}>
                    등록된 웹훅이 없습니다.
                  </td>
                </tr>
              ) : (
                webhooks.map(webhook => (
                  <tr key={webhook.id}>
                    <td style={{ fontWeight: 500 }}>{webhook.name}</td>
                    <td style={{ maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span style={{ color: 'var(--text-light)' }}>
                        {webhook.url.substring(0, 50)}...
                      </span>
                    </td>
                    <td style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                      <button 
                        className="btn btn-glass" 
                        style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                        onClick={() => handleTestWebhook(webhook)}
                        disabled={isTesting}
                      >
                        테스트
                      </button>
                      <button 
                        className="btn btn-danger" 
                        style={{ padding: '0.4rem', borderRadius: '6px' }}
                        onClick={() => {
                          if(window.confirm('정말 삭제하시겠습니까?')) removeWebhook(webhook.id);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Webhooks;
