import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { ref, onValue } from 'firebase/database';

const TEAL_DARK = '#0b4f5c';
const TEAL = '#00796b';
const BG = '#f5f7fb';

function Patients() {
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedPatient, setSelectedPatient] = useState(null);

  useEffect(() => {
    const usersRef = ref(db, 'users');
    const dashboardAppointmentsRef = ref(db, 'dashboardAppointments');
    const legacyAppointmentsRef = ref(db, 'appointments');

    const unsubUsers = onValue(usersRef, (snapshot) => {
      if (!snapshot.exists()) {
        setPatients([]);
        setLoading(false);
        return;
      }

      const data = snapshot.val();

      const list = Object.entries(data)
        .filter(([_, user]) => user.role === 'patient')
        .map(([id, user]) => ({
          id,
          name: user.name || user.fullName || 'غير محدد',
          phone: user.phone || 'غير متوفر',
          email: user.email || 'غير متوفر',
          createdAt: user.createdAt || '',
          age: user.age || 'غير محدد',
          gender: user.gender || 'غير محدد',
          photoUrl: user.photoUrl || '',
        }));

      setPatients(list);
      setLoading(false);
    });

    const unsubDashboardAppointments = onValue(dashboardAppointmentsRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const list = Object.entries(data).map(([id, app]) => ({ id, ...app }));
        setAppointments(list);
      } else {
        onValue(legacyAppointmentsRef, (legacySnap) => {
          if (!legacySnap.exists()) {
            setAppointments([]);
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
        });
      }
    });

    return () => {
      unsubUsers();
      unsubDashboardAppointments();
    };
  }, []);

  const patientsWithStats = useMemo(() => {
    return patients.map((patient) => {
      const patientAppointments = appointments.filter(
        (a) => String(a.patientId || '') === String(patient.id)
      );

      const sorted = [...patientAppointments].sort((a, b) => {
        const da = `${a.date || ''} ${a.time || ''}`;
        const db = `${b.date || ''} ${b.time || ''}`;
        return db.localeCompare(da);
      });

      const lastAppointment = sorted[0] || null;
      const nextAppointment =
        sorted.find((a) => a.status === 'pending' || a.status === 'confirmed') ||
        null;

      return {
        ...patient,
        appointmentsCount: patientAppointments.length,
        lastAppointment,
        nextAppointment,
      };
    });
  }, [patients, appointments]);

  const filteredPatients = useMemo(() => {
    const q = searchTerm.toLowerCase();

    return patientsWithStats.filter(
      (patient) =>
        patient.name.toLowerCase().includes(q) ||
        patient.phone.includes(searchTerm) ||
        patient.email.toLowerCase().includes(q)
    );
  }, [patientsWithStats, searchTerm]);

  const today = new Date().toISOString().split('T')[0];

  const todayVisits = appointments.filter((a) => a.date === today).length;

  if (loading) return <Loader />;

  return (
    <div className="patientsPage" dir="rtl">
      <Topbar search={searchTerm} onSearch={setSearchTerm} />

      <section className="pageHeader">
        <div>
          <h1>إدارة ملفات المرضى</h1>
          <p>نظرة عامة على قاعدة بيانات المرضى وجدولة المواعيد.</p>
        </div>

        <div className="headerActions">
          <button className="exportBtn">تحميل البيانات ⬇</button>
          <button className="addBtn">إضافة مريض جديد ＋</button>
        </div>
      </section>

      <section className="statsGrid">
        <StatCard title="إجمالي المرضى" value={patients.length} hint="+12%" />
        <AgeCard />
        <GenderCard />
        <StatCard title="زيارات اليوم" value={todayVisits} hint="مريض مسجل" />
      </section>

      <section className="tableCard">
        <div className="tableHeader">
          <div>
            <h2>قائمة المرضى</h2>
            <div className="chips">
              <span>الكل ({patients.length})</span>
              <span>نشط اليوم ({todayVisits})</span>
            </div>
          </div>

          <div className="tableIcons">
            <button>☰</button>
            <button>≡</button>
          </div>
        </div>

        <div className="tableHead">
          <span>المريض</span>
          <span>رقم الهاتف / الهوية</span>
          <span>آخر زيارة</span>
          <span>الموعد القادم</span>
          <span>عدد الحجوزات</span>
          <span>الحالة</span>
          <span>الإجراءات</span>
        </div>

        {filteredPatients.length === 0 ? (
          <EmptyState />
        ) : (
          filteredPatients.map((patient) => (
            <div className="tableRow" key={patient.id}>
              <div className="patientCell">
                <Avatar name={patient.name} photoUrl={patient.photoUrl} />
                <div>
                  <strong>{patient.name}</strong>
                  <small>{patient.age !== 'غير محدد' ? `${patient.age} سنة` : patient.email}</small>
                </div>
              </div>

              <div className="textCell">
                <strong>{patient.phone}</strong>
                <small>ID-{patient.id.slice(0, 6).toUpperCase()}</small>
              </div>

              <div className="textCell">
                <strong>
                  {patient.lastAppointment?.date || 'لا يوجد'}
                </strong>
                <small>
                  {patient.lastAppointment?.doctorName
                    ? `د. ${patient.lastAppointment.doctorName}`
                    : '-'}
                </small>
              </div>

              <div className="nextCell">
                {patient.nextAppointment ? (
                  <>
                    <strong>
                      {patient.nextAppointment.date} - {patient.nextAppointment.time}
                    </strong>
                    <small>{patient.nextAppointment.specialization || '-'}</small>
                  </>
                ) : (
                  <strong>لا يوجد موعد</strong>
                )}
              </div>

              <div className="countCell">{patient.appointmentsCount} حجز</div>

              <div>
                <span className={patient.appointmentsCount > 0 ? 'status stable' : 'status watch'}>
                  {patient.appointmentsCount > 0 ? 'مستقرة' : 'لا يوجد حجوزات'}
                </span>
              </div>

              <div className="actions">
                <button onClick={() => setSelectedPatient(patient)}>
                  عرض ملف
                </button>
              </div>
            </div>
          ))
        )}

        <div className="pagination">
          <span>
            عرض 1-10 من أصل {filteredPatients.length} مريض
          </span>

          <div>
            <button>‹</button>
            <button className="current">1</button>
            <button>2</button>
            <button>3</button>
            <button>›</button>
          </div>
        </div>
      </section>

      <section className="bottomGrid">
        <div className="reminderCard">
          <button>＋</button>
          <p>مواعيد اليوم القادمة</p>
          <h3>{todayVisits} موعد متبقي</h3>
          <span>عرض جدول المواعيد</span>
        </div>

        <div className="records">
          <h3>السجلات المضافة حديثاً</h3>
          <div className="recordItem">
            <span>▣</span>
            <div>
              <strong>تقرير أشعة - آخر مريض</strong>
              <small>PDF • منذ ساعتين</small>
            </div>
          </div>
        </div>
      </section>

      {selectedPatient && (
        <PatientModal
          patient={selectedPatient}
          appointments={appointments.filter(
            (a) => String(a.patientId || '') === String(selectedPatient.id)
          )}
          onClose={() => setSelectedPatient(null)}
        />
      )}

      <style jsx>{`
        .patientsPage {
          width: 100%;
          min-height: 100vh;
          background: ${BG};
          color: #082f3a;
        }

        .pageHeader {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin: 34px 0 30px;
        }

        h1 {
          margin: 0 0 10px;
          font-size: 28px;
          font-weight: 900;
          color: #082f3a;
        }

        p {
          margin: 0;
          color: #475569;
          font-weight: 700;
        }

        .headerActions {
          display: flex;
          gap: 12px;
        }

        .headerActions button {
          height: 48px;
          padding: 0 24px;
          border-radius: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        .exportBtn {
          background: white;
          color: ${TEAL};
          border: 1px solid ${TEAL};
        }

        .addBtn {
          background: ${TEAL_DARK};
          color: white;
          border: none;
          box-shadow: 0 10px 20px rgba(11, 79, 92, 0.18);
        }

        .statsGrid {
          display: grid;
          grid-template-columns: 1fr 2.1fr 1.4fr 1fr;
          gap: 24px;
          margin-bottom: 28px;
        }

        .tableCard {
          background: white;
          border: 1px solid #dfe7ef;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
        }

        .tableHeader {
          padding: 26px 30px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .tableHeader h2 {
          margin: 0;
          font-size: 22px;
          font-weight: 900;
        }

        .chips {
          display: flex;
          gap: 10px;
          margin-top: 12px;
        }

        .chips span {
          background: #edf4ff;
          color: #0f172a;
          border-radius: 999px;
          padding: 7px 15px;
          font-weight: 900;
          font-size: 12px;
        }

        .tableIcons {
          display: flex;
          gap: 20px;
        }

        .tableIcons button {
          border: none;
          background: transparent;
          font-size: 24px;
          cursor: pointer;
        }

        .tableHead,
        .tableRow {
          display: grid;
          grid-template-columns: 1.8fr 1.4fr 1.4fr 1.7fr 1fr 1fr 1fr;
          gap: 14px;
          align-items: center;
          padding: 18px 28px;
        }

        .tableHead {
          background: #eaf2ff;
          color: #0f172a;
          font-weight: 900;
        }

        .tableRow {
          border-top: 1px solid #edf2f7;
          min-height: 84px;
          color: #0f172a;
          font-weight: 800;
        }

        .patientCell {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .patientCell strong,
        .textCell strong,
        .nextCell strong {
          display: block;
          color: #0f172a;
          font-weight: 900;
          margin-bottom: 4px;
        }

        .patientCell small,
        .textCell small,
        .nextCell small {
          color: #64748b;
          font-weight: 700;
        }

        .nextCell strong {
          color: ${TEAL};
        }

        .countCell {
          color: ${TEAL_DARK};
          font-size: 16px;
          font-weight: 900;
        }

        .status {
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
        }

        .stable {
          background: #d9fbf6;
          color: ${TEAL};
        }

        .watch {
          background: #fee2e2;
          color: #b91c1c;
        }

        .actions button {
          background: white;
          border: 1px solid #cbd5e1;
          color: #0f172a;
          border-radius: 10px;
          padding: 10px 16px;
          font-weight: 900;
          cursor: pointer;
        }

        .pagination {
          padding: 22px 28px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #475569;
          font-weight: 700;
        }

        .pagination button {
          width: 38px;
          height: 38px;
          border: 1px solid #dfe7ef;
          border-radius: 8px;
          background: white;
          margin-inline-start: 8px;
          cursor: pointer;
          font-weight: 900;
        }

        .pagination .current {
          background: ${TEAL_DARK};
          color: white;
        }

        .bottomGrid {
          margin-top: 28px;
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 28px;
        }

        .reminderCard {
          background: ${TEAL_DARK};
          color: white;
          border-radius: 16px;
          padding: 30px;
          min-height: 170px;
          position: relative;
        }

        .reminderCard button {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          border: none;
          background: #003847;
          color: white;
          font-size: 34px;
          cursor: pointer;
        }

        .reminderCard p {
          margin-top: 22px;
          color: #bdece8;
        }

        .reminderCard h3 {
          margin: 8px 0 16px;
          font-size: 26px;
        }

        .reminderCard span {
          display: block;
          border: 1px solid rgba(255,255,255,0.25);
          padding: 12px;
          border-radius: 10px;
          text-align: center;
          color: #d9fbf6;
          font-weight: 900;
        }

        .records h3 {
          margin: 0 0 20px;
          color: #082f3a;
          font-weight: 900;
        }

        .recordItem {
          background: white;
          border: 1px solid #dfe7ef;
          border-radius: 14px;
          padding: 18px;
          display: flex;
          gap: 14px;
          align-items: center;
          width: 360px;
        }

        .recordItem span {
          width: 50px;
          height: 50px;
          background: #f1f5f9;
          display: grid;
          place-items: center;
          border-radius: 10px;
        }

        .recordItem strong {
          color: #0f172a;
          display: block;
          font-weight: 900;
        }

        .recordItem small {
          color: #64748b;
          font-weight: 700;
        }

        @media (max-width: 1100px) {
          .pageHeader,
          .pagination {
            flex-direction: column;
            gap: 16px;
            align-items: stretch;
          }

          .statsGrid,
          .bottomGrid {
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
    <div className="icons">
      <span className="bell">♧</span>
      <span>؟</span>
      <span>🌐</span>
    </div>

    <div className="search">
      <span>⌕</span>
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="بحث عن مريض بالاسم، الهوية، أو الجوال..."
      />
    </div>

    <style jsx>{`
      .topbar {
        height: 72px;
        border-bottom: 1px solid #dfe7ef;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .icons {
        display: flex;
        gap: 28px;
        font-size: 22px;
        color: #0f172a;
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
        top: -2px;
        right: -3px;
      }

      .search {
        width: 520px;
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
        flex: 1;
        border: none;
        outline: none;
        background: transparent;
        text-align: right;
        font-size: 15px;
      }
    `}</style>
  </div>
);

const StatCard = ({ title, value, hint }) => (
  <div className="statCard">
    <p>{title}</p>
    <h2>{Number(value || 0).toLocaleString()}</h2>
    <span>{hint}</span>

    <style jsx>{`
      .statCard {
        background: white;
        border: 1px solid #dfe7ef;
        border-radius: 16px;
        min-height: 150px;
        padding: 26px;
        box-shadow: 0 8px 18px rgba(15, 23, 42, 0.04);
      }

      p {
        margin: 0 0 18px;
        color: #334155;
        font-weight: 800;
      }

      h2 {
        margin: 0;
        color: #082f3a;
        font-size: 38px;
        font-weight: 900;
      }

      span {
        color: ${TEAL};
        font-weight: 900;
        margin-top: 10px;
        display: block;
      }
    `}</style>
  </div>
);

const AgeCard = () => (
  <div className="ageCard">
    <h3>توزيع الفئات العمرية</h3>

    <div className="line">
      <span>أطفال (0-18)</span>
      <div><em style={{ width: '24%' }} /></div>
      <b>24%</b>
    </div>

    <div className="line">
      <span>بالغين (19-60)</span>
      <div><em style={{ width: '58%' }} /></div>
      <b>58%</b>
    </div>

    <style jsx>{`
      .ageCard {
        background: white;
        border: 1px solid #dfe7ef;
        border-radius: 16px;
        min-height: 150px;
        padding: 26px;
      }

      h3 {
        margin: 0 0 20px;
        color: #334155;
        font-size: 16px;
      }

      .line {
        display: grid;
        grid-template-columns: 110px 1fr 50px;
        gap: 12px;
        align-items: center;
        margin-bottom: 18px;
        color: #334155;
        font-weight: 800;
      }

      .line div {
        height: 8px;
        background: #dbeafe;
        border-radius: 999px;
        overflow: hidden;
      }

      .line em {
        display: block;
        height: 100%;
        background: ${TEAL_DARK};
      }
    `}</style>
  </div>
);

const GenderCard = () => (
  <div className="genderCard">
    <h3>توزيع النوع</h3>
    <div className="circle">
      <span>52%</span>
      <small>نساء</small>
    </div>

    <style jsx>{`
      .genderCard {
        background: white;
        border: 1px solid #dfe7ef;
        border-radius: 16px;
        min-height: 150px;
        padding: 26px;
      }

      h3 {
        margin: 0 0 14px;
        color: #334155;
        font-size: 16px;
      }

      .circle {
        width: 88px;
        height: 88px;
        border-radius: 50%;
        border: 10px solid #dbeafe;
        border-right-color: ${TEAL_DARK};
        display: grid;
        place-items: center;
        margin: auto;
        color: #0f172a;
        font-weight: 900;
      }

      small {
        font-size: 11px;
        margin-top: -12px;
      }
    `}</style>
  </div>
);

const Avatar = ({ name, photoUrl }) => {
  if (photoUrl && photoUrl.startsWith('data:image')) {
    return <img className="avatarImg" src={photoUrl} alt="" />;
  }

  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2);

  return (
    <>
      <div className="avatar">{initials}</div>
      <style jsx>{`
        .avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: #e2e8e6;
          display: grid;
          place-items: center;
          color: #082f3a;
          font-weight: 900;
        }

        .avatarImg {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          object-fit: cover;
        }
      `}</style>
    </>
  );
};

const PatientModal = ({ patient, appointments, onClose }) => (
  <div className="overlay">
    <div className="modal">
      <header>
        <h2>{patient.name}</h2>
        <button onClick={onClose}>×</button>
      </header>

      <div className="summary">
        <div><span>الهاتف</span><strong>{patient.phone}</strong></div>
        <div><span>البريد</span><strong>{patient.email}</strong></div>
        <div><span>عدد الحجوزات</span><strong>{appointments.length}</strong></div>
      </div>

      <h3>تفاصيل الحجوزات</h3>

      {appointments.length === 0 ? (
        <p className="noData">لا يوجد حجوزات لهذا المريض</p>
      ) : (
        appointments.map((app) => (
          <div className="appointment" key={app.id}>
            <strong>د. {app.doctorName || 'غير محدد'}</strong>
            <span>{app.specialization || '-'}</span>
            <span>{app.date || '-'} - {app.time || '-'}</span>
            <span>{app.price || app.appointmentPrice || 0} جنيه</span>
            <em>{app.status || 'pending'}</em>
          </div>
        ))
      )}
    </div>

    <style jsx>{`
      .overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.65);
        display: grid;
        place-items: center;
        z-index: 9999;
        padding: 20px;
      }

      .modal {
        width: min(760px, 100%);
        max-height: 90vh;
        overflow: auto;
        background: white;
        border-radius: 20px;
        padding: 24px;
      }

      header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      h2 {
        margin: 0;
        color: #082f3a;
      }

      header button {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        border: none;
        background: #fee2e2;
        color: #b91c1c;
        font-size: 26px;
        cursor: pointer;
      }

      .summary {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 14px;
        margin: 24px 0;
      }

      .summary div {
        background: #f8fafc;
        border: 1px solid #e2e8f0;
        border-radius: 14px;
        padding: 14px;
      }

      .summary span {
        display: block;
        color: #64748b;
        font-size: 12px;
        margin-bottom: 6px;
      }

      .summary strong {
        color: #0f172a;
      }

      .appointment {
        display: grid;
        grid-template-columns: 1.3fr 1fr 1.2fr 0.8fr 0.8fr;
        gap: 12px;
        align-items: center;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        padding: 14px;
        margin-bottom: 10px;
      }

      .appointment strong {
        color: #0f172a;
      }

      .appointment span {
        color: #334155;
        font-weight: 700;
      }

      .appointment em {
        background: #e2f7f6;
        color: ${TEAL};
        border-radius: 999px;
        padding: 7px 10px;
        text-align: center;
        font-style: normal;
        font-weight: 900;
      }

      .noData {
        text-align: center;
        color: #64748b;
        padding: 30px;
      }
    `}</style>
  </div>
);

const EmptyState = () => (
  <div className="empty">
    لا يوجد مرضى مطابقين للبحث

    <style jsx>{`
      .empty {
        padding: 70px;
        text-align: center;
        color: #64748b;
        font-weight: 900;
      }
    `}</style>
  </div>
);

const Loader = () => (
  <div className="loader">
    <div className="spin"></div>

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

export default Patients;