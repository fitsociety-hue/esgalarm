import React, { useState } from 'react';
import useStore from '../store/useStore';
import { Plus, Trash2, Edit2, Info } from 'lucide-react';

const Padlets = () => {
  const { padlets, addPadlet, removePadlet } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: '', url: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.name && formData.url) {
      addPadlet(formData);
      setFormData({ name: '', url: '' });
      setIsAdding(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>패들렛 관리</h1>
          <p>모니터링할 패들렛의 RSS 피드 URL을 등록하세요.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsAdding(!isAdding)}>
          <Plus size={18} />
          새 패들렛 등록
        </button>
      </div>

      {isAdding && (
        <div className="card glass-panel" style={{ animation: 'fadeIn 0.3s ease-out' }}>
          <div className="card-header">
            <h3>새 패들렛 추가</h3>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">패들렛 이름 (별칭)</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="예: 2024 ESG 실천활동 모음" 
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">패들렛 RSS 피드 URL</label>
              <input 
                type="url" 
                className="form-input" 
                placeholder="예: https://padlet.com/feed/board/xxxxxx" 
                value={formData.url}
                onChange={(e) => setFormData({...formData, url: e.target.value})}
                required
              />
              <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-light)', display: 'flex', gap: '0.5rem' }}>
                <Info size={14} style={{ flexShrink: 0 }} />
                <span>패들렛에서 [공유] &gt; [고급] &gt; [피드] &gt; [RSS 피드 URL 복사]를 통해 얻은 주소를 입력해주세요.</span>
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
                <th>RSS URL</th>
                <th>마지막 확인</th>
                <th style={{ width: '100px' }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {padlets.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-light)' }}>
                    등록된 패들렛이 없습니다.
                  </td>
                </tr>
              ) : (
                padlets.map(padlet => (
                  <tr key={padlet.id}>
                    <td style={{ fontWeight: 500 }}>{padlet.name}</td>
                    <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <a href={padlet.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-blue)' }}>
                        {padlet.url}
                      </a>
                    </td>
                    <td>{padlet.lastChecked ? new Date(padlet.lastChecked).toLocaleString() : '확인 전'}</td>
                    <td>
                      <button 
                        className="btn btn-danger" 
                        style={{ padding: '0.4rem', borderRadius: '6px' }}
                        onClick={() => {
                          if(window.confirm('정말 삭제하시겠습니까?')) removePadlet(padlet.id);
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

export default Padlets;
