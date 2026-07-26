import React from 'react';
import { NavLink } from 'react-router-dom';

function Sidebar() {
  const menuItems = [
    { path: '/', label: 'الرئيسية', icon: '🏠' },
    { path: '/doctors', label: 'إدارة الأطباء', icon: '👨‍⚕️' },
    { path: '/pending-doctors', label: 'الموافقة على الأطباء', icon: '⏳' },
    { path: '/patients', label: 'إدارة المرضى', icon: '👥' },
    { path: '/appointments', label: 'الحجوزات', icon: '📅' },
   
    {
  label: 'ترشيحات الأطباء',
  path: '/doctor-recommendations',
  icon: '🌟',
},
    { path: '/reports', label: 'التقارير والإحصائيات', icon: '📊' },
   
  ];

  const handleLogout = () => {
    // ضيف هنا كود تسجيل الخروج الحقيقي
    alert('تم تسجيل الخروج');
  };

  return (
    <div className="sidebar">
      {/* اللوجو */}
      <div className="logo">
        <div className="logo-circle">
          <span>س</span>
        </div>
        <h1>سلامتك</h1>
        <p>لوحة تحكم الإدارة</p>
      </div>

      {/* القائمة */}
      <nav className="nav-menu">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className="nav-item"
            activeClassName="active"
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* تسجيل الخروج */}
      <div className="logout-section">
        <button onClick={handleLogout} className="logout-btn">
          <span className="nav-icon">🚪</span>
          <span>تسجيل الخروج</span>
        </button>
      </div>

      <style jsx>{`
        .sidebar {
          width: 320px;
          height: 100vh;
          background: linear-gradient(to bottom, #ffffff, #f0f7ff);
          box-shadow: 10px 0 30px rgba(0, 0, 0, 0.1);
          display: flex;
          flex-direction: column;
          position: fixed;
          left: 0;
          top: 0;
          overflow-y: auto;
        }

        .logo {
          padding: 40px 30px;
          text-align: center;
          border-bottom: 1px solid #e5e7eb;
          background-color: white;
        }

        .logo-circle {
          width: 80px;
          height: 80px;
          background: #1e40af;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          box-shadow: 0 10px 20px rgba(30, 64, 175, 0.3);
        }

        .logo-circle span {
          font-size: 40px;
          font-weight: bold;
          color: white;
        }

        .logo h1 {
          font-size: 36px;
          font-weight: 800;
          color: #1e40af;
          margin: 0 0 10px 0;
        }

        .logo p {
          font-size: 18px;
          color: #6b7280;
          margin: 0;
        }

        .nav-menu {
          flex: 1;
          padding: 30px 20px;
        }

        .nav-item {
          display: flex;
          align-items: center;
          padding: 18px 25px;
          margin-bottom: 12px;
          font-size: 20px;
          font-weight: 500;
          color: #4b5563;
          text-decoration: none;
          border-radius: 20px;
          transition: all 0.4s ease;
          position: relative;
          overflow: hidden;
        }

        .nav-item:hover {
          background-color: #eff6ff;
          color: #1e40af;
          transform: translateX(10px);
          box-shadow: 0 8px 20px rgba(30, 64, 175, 0.15);
        }

        .nav-item.active {
          background: linear-gradient(to right, #1e40af, #1e3a8a);
          color: white;
          box-shadow: 0 10px 25px rgba(30, 64, 175, 0.4);
          transform: translateX(10px);
        }

        .nav-item.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 6px;
          background-color: #fbbf24;
          border-radius: 0 6px 6px 0;
        }

        .nav-icon {
          font-size: 30px;
          margin-right: 20px;
          transition: transform 0.3s ease;
        }

        .nav-item:hover .nav-icon,
        .nav-item.active .nav-icon {
          transform: scale(1.2);
        }

        .nav-label {
          flex: 1;
        }

        .logout-section {
          padding: 30px;
          border-top: 1px solid #e5e7eb;
          background-color: white;
        }

        .logout-btn {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 20px;
          background: linear-gradient(to right, #dc2626, #b91c1c);
          color: white;
          border: none;
          border-radius: 20px;
          font-size: 20px;
          font-weight: bold;
          cursor: pointer;
          transition: all 0.4s ease;
          box-shadow: 0 10px 25px rgba(220, 38, 38, 0.3);
        }

        .logout-btn:hover {
          background: linear-gradient(to right, #b91c1c, #991b1b);
          transform: translateY(-4px);
          box-shadow: 0 15px 30px rgba(220, 38, 38, 0.4);
        }

        /* Scrollbar أنيق */
        .sidebar::-webkit-scrollbar {
          width: 8px;
        }

        .sidebar::-webkit-scrollbar-track {
          background: #f1f5f9;
        }

        .sidebar::-webkit-scrollbar-thumb {
          background: #94a3b8;
          border-radius: 4px;
        }

        .sidebar::-webkit-scrollbar-thumb:hover {
          background: #64748b;
        }
      `}</style>
    </div>
  );
}

export default Sidebar;