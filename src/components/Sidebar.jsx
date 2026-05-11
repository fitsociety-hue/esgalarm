import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Link as LinkIcon, MessageSquare, Activity, Settings } from 'lucide-react';

const Sidebar = () => {
  return (
    <div className="sidebar glass-panel">
      <div className="logo">
        <Activity size={24} />
        <span>ESG Alarm</span>
      </div>
      
      <nav className="sidebar-nav">
        <NavLink 
          to="/" 
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
          end
        >
          <LayoutDashboard size={20} />
          대시보드
        </NavLink>
        
        <NavLink 
          to="/padlets" 
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
        >
          <LinkIcon size={20} />
          패들렛 관리
        </NavLink>
        
        <NavLink 
          to="/webhooks" 
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
        >
          <MessageSquare size={20} />
          구글 챗 웹훅
        </NavLink>

        <NavLink 
          to="/background" 
          className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
        >
          <Settings size={20} />
          백그라운드 실행
        </NavLink>

        <div style={{ marginTop: 'auto', paddingTop: '2rem' }}>
          <div className="nav-item" style={{ fontSize: '0.8rem', color: 'var(--text-light)', cursor: 'default' }}>
            v1.0.0
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Sidebar;
