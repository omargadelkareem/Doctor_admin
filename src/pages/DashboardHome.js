import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';

const TEAL_DARK = '#0b4f5c';
const TEAL = '#00796b';
const BG = '#f5f7fb';

function Dashboard() {
  const [users, setUsers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const usersRef = ref(db, 'users');
    const dashboardAppointmentsRef = ref(db, 'dashboardAppointments');
    const legacyAppointmentsRef = ref(db, 'appointments');

    const unsubUsers = onValue(usersRef, (snap) => {
      if (!snap.exists()) {
        setUsers([]);
        return;
      }

      const data = snap.val();
      const list = Object.entries(data).map(([id, user]) => ({
        id,
        ...user,
      }));

      setUsers(list);
    });

    const unsubDashboardAppointments = onValue(dashboardAppointmentsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();

        const list = Object.entries(data).map(([id, app]) => ({
          id,
          ...app,
        }));

        setAppointments(list);
        setLoading(false);
      } else {
        onValue(legacyAppointmentsRef, (legacySnap) => {
          if (!legacySnap.exists()) {
            setAppointments([]);
            setLoading(false);
            return;
          }

          const data = legacySnap.val();
          const list = [];

          Object.entries(data).forEach(([patientId, patientAppointments]) => {
            if (patientAppointments && typeof patientAppointments === 'object') {
              Object.entries(patientAppointments).forEach(([appointmentId, app]) => {
                list.push({
                  id: appointmentId,
                  patientId,
                  ...app,
                });
              });
            }
          });

          setAppointments(list);
          setLoading(false);
        });
      }
    });

    return () => {
      unsubUsers();
      unsubDashboardAppointments();
    };
  }, []);

  const stats = useMemo(() => {
    const doctors = users.filter((u) => u.role === 'doctor');
    const patients = users.filter((u) => u.role === 'patient');

    const today = new Date().toISOString().split('T')[0];

    return {
      totalPatients: patients.length,
      activeDoctors: doctors.filter((d) => d.isApproved === true).length,
      todayAppointments: appointments.filter((a) => a.date === today).length,
      monthlyRevenue: appointments.reduce((sum, a) => {
        const price = Number(a.price || a.appointmentPrice || 0);
        return sum + price;
      }, 0),
      pendingDoctors: doctors.filter((d) => d.role === 'doctor' && d.isApproved !== true).length,
    };
  }, [users, appointments]);

  const todaySchedule = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];

    return appointments
      .filter((a) => a.date === today)
      .slice(0, 4)
      .map((a) => ({
        id: a.id,
        time: a.time || '--:--',
        doctorName: a.doctorName || 'دكتور غير محدد',
        specialization: a.specialization || 'غير محدد',
      }));
  }, [appointments]);

  const pendingDoctors = useMemo(() => {
    return users
      .filter((u) => u.role === 'doctor' && u.isApproved !== true)
      .slice(0, 4)
      .map((doctor) => ({
        id: doctor.id,
        name: doctor.name || doctor.fullName || 'طبيب غير معروف',
        specialization: doctor.specialization || doctor.speciality || 'غير محدد',
        city: doctor.city || doctor.address || 'غير محدد',
        photoUrl:
          doctor.photoUrl ||
          doctor.image ||
          'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop',
        certificatesCount:
          doctor.documents?.length ||
          doctor.files?.length ||
          doctor.certificates?.length ||
          0,
        createdAt: doctor.createdAt || doctor.registeredAt || '',
      }));
  }, [users]);

  if (loading) return <Loader />;

  return (
    <div className="page" dir="rtl">
     

      <main className="main">
        <Topbar search={search} onSearch={setSearch} />

        <section className="welcome">
          <div>
            <h1>مرحباً بك مجدداً، </h1>
            <p>إليك نظرة سريعة على أداء المنصة اليوم.</p>
          </div>
        </section>

        <section className="stats">
          <RevenueCard value={stats.monthlyRevenue} />

          <StatCard
            title="حجوزات اليوم"
            value={stats.todayAppointments}
            icon="▣"
            trend="-5%"
            danger
          />

          <StatCard
            title="الأطباء النشطون"
            value={stats.activeDoctors}
            icon="✚"
            trend="نشط"
          />

          <StatCard
            title="إجمالي المرضى"
            value={stats.totalPatients}
            icon="♚"
            trend="+12%"
          />
        </section>

        <section className="middleGrid">
          <TodaySchedule items={todaySchedule} />

          <ChartPlaceholder />
        </section>

        <section className="pendingSection">
          <div className="floatingBtn">
            <span>＋</span>
            إضافة حجز سريع
          </div>

          <div className="sectionHeader">
            <div>
              <h2>طلبات اعتماد الأطباء الجديدة</h2>
              <p>لديك {stats.pendingDoctors} طلب بانتظار المراجعة</p>
            </div>
          </div>

          <div className="table">
            <div className="tableHead">
              <span>الطبيب</span>
              <span>التخصص</span>
              <span>الشهادات</span>
              <span>تاريخ الطلب</span>
              <span>الحالة</span>
              <span>الإجراءات</span>
            </div>

            {pendingDoctors.length === 0 ? (
              <div className="empty">لا توجد طلبات أطباء حالياً</div>
            ) : (
              pendingDoctors.map((doctor) => (
                <div className="tableRow" key={doctor.id}>
                  <div className="doctorCell">
                    <img src={doctor.photoUrl} alt="" />
                    <div>
                      <strong>{doctor.name}</strong>
                      <small>{doctor.city}</small>
                    </div>
                  </div>

                  <div>{doctor.specialization}</div>

                  <div className="docs">
                    {doctor.certificatesCount || 3} ملفات مرفقة
                  </div>

                  <div>{doctor.createdAt || 'منذ ساعتين'}</div>

                  <div>
                    <span className="status">بانتظار المراجعة</span>
                  </div>

                  <div>
                    <button className="reviewBtn">مراجعة</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      <style jsx>{`
       
        .page {
    width: 100%;
    min-height: 100vh;
    background: ${BG};
    color: #082f3a;
  }

  .main {
    width: 100%;
    max-width: 100%;
    padding: 0;
  }

        .welcome {
          margin: 38px 0 42px;
          text-align: right;
        }

        .welcome h1 {
          margin: 0 0 10px;
          font-size: 28px;
          font-weight: 900;
          color: #082f3a;
        }

        .welcome p {
          margin: 0;
          color: #475569;
          font-weight: 700;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
          margin-bottom: 28px;
        }

        .middleGrid {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 24px;
          margin-bottom: 28px;
        }

        .pendingSection {
          position: relative;
          background: white;
          border: 1px solid #dfe7ef;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
        }

        .floatingBtn {
          position: absolute;
          right: 0;
          top: 22px;
          transform: translateY(-50%);
          background: ${TEAL_DARK};
          color: white;
          padding: 17px 26px;
          border-radius: 0 16px 16px 0;
          font-weight: 900;
          display: flex;
          align-items: center;
          gap: 14px;
          box-shadow: 0 10px 20px rgba(0, 63, 79, 0.22);
        }

        .floatingBtn span {
          font-size: 26px;
        }

        .sectionHeader {
          padding: 32px 32px 24px;
          text-align: left;
          border-bottom: 1px solid #edf2f7;
        }

        .sectionHeader h2 {
          margin: 0 0 8px;
          color: #082f3a;
          font-size: 18px;
          font-weight: 900;
        }

        .sectionHeader p {
          margin: 0;
          color: #64748b;
          font-weight: 700;
        }

        .tableHead,
        .tableRow {
          display: grid;
          grid-template-columns: 2fr 1.3fr 1.1fr 1.1fr 1fr 1fr;
          align-items: center;
          gap: 14px;
          padding: 18px 28px;
        }

        .tableHead {
          background: #edf4ff;
          color: #0f172a;
          font-weight: 900;
        }

        .tableRow {
          border-top: 1px solid #edf2f7;
          min-height: 78px;
          color: #0f172a;
          font-weight: 800;
        }

        .doctorCell {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .doctorCell img {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          object-fit: cover;
          background: #e2e8f0;
        }

        .doctorCell strong {
          display: block;
          font-weight: 900;
          color: #0f172a;
        }

        .doctorCell small {
          display: block;
          color: #64748b;
          margin-top: 4px;
          font-weight: 700;
        }

        .docs {
          color: ${TEAL};
          font-weight: 900;
        }

        .status {
          background: #e2e8e6;
          color: #475569;
          padding: 8px 16px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
        }

        .reviewBtn {
          border: none;
          background: #e2f7f6;
          color: ${TEAL};
          padding: 10px 18px;
          border-radius: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .empty {
          padding: 55px;
          text-align: center;
          color: #64748b;
          font-weight: 800;
        }

        @media (max-width: 1100px) {
          .page {
            grid-template-columns: 1fr;
          }

          .stats,
          .middleGrid {
            grid-template-columns: 1fr;
          }

          .tableHead {
            display: none;
          }

          .tableRow {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}



const Topbar = ({ search, onSearch }) => (
  <div className="topbar">
    <div className="adminMini">
      <img
        src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=80&h=80&fit=crop"
        alt=""
      />
      <div>
        <strong>أحمد الإداري</strong>
        <small>مدير النظام</small>
      </div>
    </div>

    <div className="icons">
      <span>AR</span>
      <span>🌐</span>
      <span>؟</span>
      <span className="bell">♧</span>
    </div>

    <div className="search">
      <span>⌕</span>
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="البحث عن مرضى، أطباء، أو تقارير..."
      />
    </div>

    <style jsx>{`
      .topbar {
        height: 72px;
        border-bottom: 1px solid #dfe7ef;
        display: grid;
        grid-template-columns: 220px 210px 1fr;
        align-items: center;
        gap: 24px;
      }

      .adminMini {
        display: flex;
        align-items: center;
        gap: 12px;
        border-left: 1px solid #dfe7ef;
        padding-left: 24px;
      }

      .adminMini img {
        width: 46px;
        height: 46px;
        border-radius: 50%;
        object-fit: cover;
      }

      .adminMini strong {
        display: block;
        color: #0f172a;
        font-weight: 900;
      }

      .adminMini small {
        color: #64748b;
        font-weight: 700;
      }

      .icons {
        display: flex;
        gap: 20px;
        font-size: 20px;
        align-items: center;
        color: #0f172a;
        font-weight: 900;
      }

      .bell {
        position: relative;
      }

      .bell:after {
        content: '';
        position: absolute;
        width: 7px;
        height: 7px;
        background: #dc2626;
        border-radius: 50%;
        top: -1px;
        right: -3px;
      }

      .search {
        height: 46px;
        background: white;
        border: 1px solid #cfd8e3;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 16px;
      }

      .search input {
        border: none;
        outline: none;
        flex: 1;
        background: transparent;
        font-size: 15px;
        text-align: right;
      }
    `}</style>
  </div>
);

const RevenueCard = ({ value }) => (
  <div className="revenue">
    <div className="walletIcon">▣</div>
    <p>الإيرادات الشهرية</p>
    <h2>{Number(value || 0).toLocaleString()}</h2>
    <span>ر.س</span>

    <style jsx>{`
      .revenue {
        background: ${TEAL_DARK};
        color: white;
        border-radius: 16px;
        min-height: 230px;
        padding: 28px;
        position: relative;
        overflow: hidden;
        box-shadow: 0 12px 24px rgba(0, 63, 79, 0.18);
      }

      .walletIcon {
        width: 54px;
        height: 54px;
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.1);
        display: grid;
        place-items: center;
        font-size: 24px;
        margin-right: auto;
      }

      p {
        margin: 48px 0 12px;
        color: #bdece8;
        font-weight: 800;
      }

      h2 {
        margin: 0;
        font-size: 46px;
        font-weight: 900;
        letter-spacing: 1px;
      }

      span {
        display: block;
        margin-top: 12px;
        font-weight: 800;
      }

      .revenue:after {
        content: '';
        position: absolute;
        width: 110px;
        height: 90px;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.08);
        left: 18px;
        bottom: 18px;
      }
    `}</style>
  </div>
);

const StatCard = ({ title, value, icon, trend, danger }) => (
  <div className="card">
    <div className="top">
      <span className="trend">{trend}</span>
      <span className="icon">{icon}</span>
    </div>

    <p>{title}</p>
    <h2>{Number(value || 0).toLocaleString()}</h2>

    <style jsx>{`
      .card {
        background: white;
        border-radius: 16px;
        border: 1px solid #dfe7ef;
        min-height: 230px;
        padding: 28px;
        box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
      }

      .top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 50px;
      }

      .trend {
        color: ${danger ? '#dc2626' : TEAL};
        font-weight: 900;
      }

      .icon {
        width: 54px;
        height: 54px;
        border-radius: 10px;
        background: ${danger ? '#f1f5f9' : '#d9fbf6'};
        display: grid;
        place-items: center;
        font-size: 24px;
        color: ${TEAL_DARK};
      }

      p {
        margin: 0 0 20px;
        color: #334155;
        font-weight: 800;
      }

      h2 {
        margin: 0;
        font-size: 46px;
        color: #082f3a;
        font-weight: 900;
      }
    `}</style>
  </div>
);

const TodaySchedule = ({ items }) => (
  <section className="schedule">
    <header>
      <strong>جدول اليوم</strong>
      <button>عرض الكل</button>
    </header>

    <div className="items">
      {items.length === 0 ? (
        <div className="noData">لا توجد حجوزات اليوم</div>
      ) : (
        items.map((item, index) => (
          <div className="item" key={item.id}>
            <div className={`line c${index}`} />
            <div>
              <strong>د. {item.doctorName}</strong>
              <small>{item.specialization}</small>
            </div>
            <div className="time">
              <b>{item.time}</b>
              <small>صباحاً</small>
            </div>
          </div>
        ))
      )}
    </div>

    <style jsx>{`
      .schedule {
        background: white;
        border: 1px solid #dfe7ef;
        border-radius: 16px;
        padding: 20px;
        min-height: 390px;
      }

      header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 26px;
      }

      header strong {
        color: #0f172a;
        font-weight: 900;
      }

      header button {
        border: none;
        background: transparent;
        color: ${TEAL};
        font-weight: 900;
      }

      .items {
        display: grid;
        gap: 16px;
      }

      .item {
        display: grid;
        grid-template-columns: 4px 1fr 72px;
        gap: 16px;
        align-items: center;
        background: white;
        border: 1px solid #edf2f7;
        border-radius: 12px;
        padding: 16px;
      }

      .line {
        height: 52px;
        border-radius: 999px;
        background: ${TEAL};
      }

      .c1 {
        background: #67c7e8;
      }

      .c2 {
        background: #ef4444;
      }

      .c3 {
        background: #94a3b8;
      }

      .item strong {
        color: #0f172a;
        font-weight: 900;
      }

      .item small {
        display: block;
        margin-top: 5px;
        color: #64748b;
        font-weight: 700;
      }

      .time {
        text-align: center;
      }

      .time b {
        color: #082f3a;
        font-weight: 900;
      }

      .noData {
        padding: 40px 0;
        text-align: center;
        color: #64748b;
        font-weight: 800;
      }
    `}</style>
  </section>
);

const ChartPlaceholder = () => (
  <section className="chart">
    <div className="chartHead">
      <div>
        <h3>اتجاهات المواعيد</h3>
        <p>مقارنة الحجوزات خلال الـ 7 أيام الماضية</p>
      </div>
      <span>أسبوعي</span>
    </div>

    <div className="days">
      <span>السبت</span>
      <span>الأحد</span>
      <span>الإثنين</span>
      <span className="active">اليوم</span>
      <span>الأربعاء</span>
      <span>الخميس</span>
      <span>الجمعة</span>
    </div>

    <style jsx>{`
      .chart {
        background: white;
        border: 1px solid #dfe7ef;
        border-radius: 16px;
        padding: 28px;
        min-height: 390px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }

      .chartHead {
        display: flex;
        justify-content: space-between;
      }

      h3 {
        margin: 0 0 8px;
        color: #0f172a;
        font-weight: 900;
      }

      p {
        margin: 0;
        color: #64748b;
        font-weight: 700;
      }

      .chartHead span {
        background: #dbeafe;
        color: #334155;
        border-radius: 999px;
        padding: 8px 20px;
        font-weight: 900;
        height: fit-content;
      }

      .days {
        display: flex;
        justify-content: space-between;
        color: #0f172a;
        font-weight: 800;
      }

      .days .active {
        color: ${TEAL};
      }
    `}</style>
  </section>
);

const Loader = () => (
  <div className="loader">
    <div className="spin" />

    <style jsx>{`
      .loader {
        height: 80vh;
        display: grid;
        place-items: center;
      }

      .spin {
        width: 52px;
        height: 52px;
        border: 5px solid #e2e8f0;
        border-top: 5px solid ${TEAL};
        border-radius: 50%;
        animation: spin 1s linear infinite;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }
    `}</style>
  </div>
);

export default Dashboard;