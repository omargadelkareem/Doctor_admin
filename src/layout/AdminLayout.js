import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const TEAL = '#00796b';
const TEAL_DARK = '#0b4f5c';

export default function AdminLayout() {
  return (
    <div className="adminPage" dir="rtl">
      <aside className="sidebar">
        <div className="brand">
          <h2>سلامتك</h2>
          <p>لوحة التحكم الإدارية</p>
        </div>

        <nav>
          <NavLink to="/dashboard">الرئيسية <span>▦</span></NavLink>
          <NavLink to="/doctors">إدارة الأطباء <span>✚</span></NavLink>
          <NavLink to="/pending-doctors">الموافقة على الأطباء <span>◇</span></NavLink>
          <NavLink to="/patients">إدارة المرضى <span>♚</span></NavLink>
            <NavLink to="/withdrawals">
    طلبات السحب
    <span>💰</span>
  </NavLink>
          <NavLink to="/appointments">الحجوزات <span>▤</span></NavLink>
          <NavLink to="/reports">التقارير <span>▥</span></NavLink>
        </nav>

        <div className="bottomNav">
          <NavLink to="/notifications">الإشعارات <span>♧</span></NavLink>
          <NavLink to="/settings">الإعدادات <span>⚙</span></NavLink>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>

      <style jsx>{`
        .adminPage {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 280px 1fr;
          background: #f5f7fb;
        }

        .content {
          min-width: 0;
          padding: 0 32px 32px;
        }

        .sidebar {
          background: #f6f8fd;
          border-left: 1px solid #dde5ef;
          min-height: 100vh;
          padding: 32px 22px;
          position: sticky;
          top: 0;
        }

        .brand {
          margin-bottom: 48px;
        }

        .brand h2 {
          margin: 0;
          color: #082f3a;
          font-size: 28px;
          font-weight: 900;
        }

        .brand p {
          margin-top: 8px;
          color: #64748b;
          font-weight: 700;
        }

        nav,
        .bottomNav {
          display: grid;
          gap: 14px;
        }

        nav a,
        .bottomNav a {
          height: 54px;
          padding: 0 18px;
          border-radius: 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #1e293b;
          font-weight: 900;
          text-decoration: none;
        }

        nav a.active,
        .bottomNav a.active {
          background: #e2f7f6;
          color: ${TEAL};
          border-left: 5px solid ${TEAL};
        }

        nav span,
        .bottomNav span {
          font-size: 22px;
        }

        .bottomNav {
          position: absolute;
          bottom: 34px;
          left: 22px;
          right: 22px;
        }

        @media (max-width: 900px) {
          .adminPage {
            grid-template-columns: 1fr;
          }

          .sidebar {
            position: relative;
            min-height: auto;
          }

          .bottomNav {
            position: relative;
            bottom: auto;
            left: auto;
            right: auto;
            margin-top: 20px;
          }
        }
      `}</style>
    </div>
  );
}