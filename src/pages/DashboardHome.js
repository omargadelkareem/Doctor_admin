import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { onValue, ref } from 'firebase/database';

const C = {
  dark: '#0f766e',
  teal: '#14b8a6',
  bg: '#f6f8fb',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
};

const CURRENCY = 'جنيه';

export default function Dashboard() {
  const [users, setUsers] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const stopUsers = onValue(
      ref(db, 'users'),
      (snap) => {
        const value = snap.val();
        setUsers(
          value && typeof value === 'object'
            ? Object.entries(value).map(([id, item]) => ({
                id,
                ...(item && typeof item === 'object' ? item : {}),
              }))
            : [],
        );
        setUsersLoading(false);
      },
      (error) => {
        console.error('Dashboard users error:', error);
        setUsers([]);
        setUsersLoading(false);
      },
    );

    const stopAppointments = onValue(
      ref(db, 'dashboardAppointments'),
      (snap) => {
        const value = snap.val();
        setAppointments(
          value && typeof value === 'object'
            ? Object.entries(value).map(([id, item]) => ({
                id,
                ...(item && typeof item === 'object' ? item : {}),
              }))
            : [],
        );
        setAppointmentsLoading(false);
      },
      (error) => {
        console.error('Dashboard appointments error:', error);
        setAppointments([]);
        setAppointmentsLoading(false);
      },
    );

    return () => {
      stopUsers();
      stopAppointments();
    };
  }, []);

  const doctors = useMemo(
    () => users.filter((u) => String(u.role || '').toLowerCase() === 'doctor'),
    [users],
  );

  const patients = useMemo(
    () => users.filter((u) => String(u.role || '').toLowerCase() === 'patient'),
    [users],
  );

  const stats = useMemo(() => {
    const now = new Date();
    const today = dateKey(now);
    const month = today.slice(0, 7);

    const activeDoctors = doctors.filter(isApproved);
    const pendingDoctors = doctors.filter((d) => !isApproved(d));
    const todayAppointments = appointments.filter(
      (a) => normalizeDate(a.date) === today,
    );
    const pendingAppointments = appointments.filter((a) =>
      ['admin_pending', 'pending'].includes(statusOf(a)),
    );
    const monthlyRevenue = appointments
      .filter((a) => {
        const status = statusOf(a);
        return (
          normalizeDate(a.date).startsWith(month) &&
          !['cancelled', 'canceled', 'rejected'].includes(status)
        );
      })
      .reduce((sum, a) => sum + priceOf(a), 0);

    return {
      patients: patients.length,
      activeDoctors: activeDoctors.length,
      pendingDoctors: pendingDoctors.length,
      todayAppointments: todayAppointments.length,
      pendingAppointments: pendingAppointments.length,
      monthlyRevenue,
    };
  }, [appointments, doctors, patients]);

  const chartData = useMemo(() => {
    const today = new Date();

    return Array.from({ length: 7 }, (_, index) => {
      const offset = 6 - index;
      const date = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - offset,
      );
      const key = dateKey(date);

      return {
        key,
        label: new Intl.DateTimeFormat('ar-EG', {
          weekday: 'short',
        }).format(date),
        value: appointments.filter((a) => normalizeDate(a.date) === key).length,
        today: offset === 0,
      };
    });
  }, [appointments]);

  const todayAppointments = useMemo(() => {
    const today = dateKey(new Date());

    return appointments
      .filter((a) => normalizeDate(a.date) === today)
      .sort((a, b) => timeMinutes(a.time) - timeMinutes(b.time))
      .slice(0, 6);
  }, [appointments]);

  const recentAppointments = useMemo(() => {
    const q = search.trim().toLowerCase();

    return [...appointments]
      .sort((a, b) => createdAtOf(b) - createdAtOf(a))
      .filter((a) => {
        if (!q) return true;

        return [
          a.patientName,
          a.doctorName,
          a.patientPhone,
          a.specialization,
          a.status,
          a.bookingStatus,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      })
      .slice(0, 8);
  }, [appointments, search]);

  const pendingDoctors = useMemo(
    () =>
      doctors
        .filter((d) => !isApproved(d))
        .sort((a, b) => createdAtOf(b) - createdAtOf(a))
        .slice(0, 5),
    [doctors],
  );

  const loading = usersLoading && appointmentsLoading;

  return (
    <div className="dash" dir="rtl">
      <header className="topbar">
        <div>
          <h1>لوحة التحكم</h1>
          <p>{formatFullDate(new Date())}</p>
        </div>

        <div className="top-actions">
          <label className="search">
            <span>⌕</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث في الحجوزات..."
            />
          </label>

          <span className="live">
            <i />
            بيانات مباشرة
          </span>
        </div>
      </header>

      <main className="content">
        {loading ? (
          <Skeleton />
        ) : (
          <>
           

            <section className="stats">
              <Metric
                primary
                title="الإيرادات الشهرية"
                value={number(stats.monthlyRevenue)}
                suffix={CURRENCY}
                icon="ج"
                note="إجمالي الحجوزات غير الملغاة هذا الشهر"
              />
              <Metric
                title="حجوزات اليوم"
                value={number(stats.todayAppointments)}
                icon="◷"
                note={`${number(stats.pendingAppointments)} حجز بانتظار الإجراء`}
              />
              <Metric
                title="الأطباء المعتمدون"
                value={number(stats.activeDoctors)}
                icon="+"
                note={`${number(stats.pendingDoctors)} طلب اعتماد جديد`}
              />
              <Metric
                title="إجمالي المرضى"
                value={number(stats.patients)}
                icon="♙"
                note="حسابات المرضى المسجلة فعليًا"
              />
            </section>

            <section className="grid analytics">
              <Chart data={chartData} />
              <TodayList items={todayAppointments} />
            </section>

            <section className="grid tables">
              <RecentTable items={recentAppointments} />
              <DoctorsList items={pendingDoctors} />
            </section>
          </>
        )}
      </main>

      <style>{styles}</style>
    </div>
  );
}

function Metric({ title, value, suffix, icon, note, primary }) {
  return (
    <article className={`metric ${primary ? 'primary' : ''}`}>
      <div className="metric-head">
        <span>{title}</span>
        <b>{icon}</b>
      </div>
      <div className="metric-value">
        <strong>{value}</strong>
        {suffix && <small>{suffix}</small>}
      </div>
      <p>{note}</p>
    </article>
  );
}

function Chart({ data }) {
  const max = Math.max(1, ...data.map((item) => item.value));

  return (
    <section className="panel">
      <PanelHead
        title="الحجوزات خلال آخر 7 أيام"
        subtitle="محسوبة من تواريخ الحجوزات الحقيقية"
        count={data.reduce((sum, item) => sum + item.value, 0)}
      />

      <div className="chart">
        {data.map((item) => (
          <div className="bar-col" key={item.key}>
            <span>{number(item.value)}</span>
            <div className="bar-track">
              <i
                className={item.today ? 'today' : ''}
                style={{
                  height: `${Math.max(4, (item.value / max) * 100)}%`,
                }}
              />
            </div>
            <b className={item.today ? 'today-label' : ''}>
              {item.today ? 'اليوم' : item.label}
            </b>
          </div>
        ))}
      </div>
    </section>
  );
}

function TodayList({ items }) {
  return (
    <section className="panel">
      <PanelHead
        title="مواعيد اليوم"
        subtitle="مرتبة حسب وقت الموعد"
        count={items.length}
      />

      {items.length === 0 ? (
        <Empty text="لا توجد حجوزات مسجلة اليوم" />
      ) : (
        <div className="list">
          {items.map((item) => (
            <div className="appointment" key={item.id}>
              <time>{shortTime(item.time)}</time>
              <div>
                <strong>{item.patientName || 'مريض غير محدد'}</strong>
                <small>
                  د. {item.doctorName || 'غير محدد'} ·{' '}
                  {item.specialization || 'بدون تخصص'}
                </small>
              </div>
              <Status item={item} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function RecentTable({ items }) {
  return (
    <section className="panel">
      <PanelHead
        title="أحدث الحجوزات"
        subtitle="آخر العمليات المسجلة على النظام"
        count={items.length}
      />

      {items.length === 0 ? (
        <Empty text="لا توجد حجوزات مطابقة" />
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>المريض</th>
                <th>الطبيب</th>
                <th>الموعد</th>
                <th>السعر</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>{item.patientName || 'مريض غير محدد'}</strong>
                    <small>{item.patientPhone || 'بدون رقم هاتف'}</small>
                  </td>
                  <td>
                    <strong>د. {item.doctorName || 'غير محدد'}</strong>
                    <small>{item.specialization || 'بدون تخصص'}</small>
                  </td>
                  <td>
                    {shortDate(item.date)}
                    <small>{item.time || '--:--'}</small>
                  </td>
                  <td className="price">
                    {number(priceOf(item))} {CURRENCY}
                  </td>
                  <td>
                    <Status item={item} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DoctorsList({ items }) {
  return (
    <section className="panel">
      <PanelHead
        title="طلبات اعتماد الأطباء"
        subtitle="الحسابات التي تحتاج مراجعة"
        count={items.length}
      />

      {items.length === 0 ? (
        <Empty text="لا توجد طلبات اعتماد جديدة" />
      ) : (
        <div className="list">
          {items.map((doctor) => {
            const image = doctor.photoUrl || doctor.image || '';
            const name =
              doctor.name || doctor.fullName || doctor.displayName || 'طبيب';

            return (
              <div className="doctor" key={doctor.id}>
                {image ? (
                  <img src={image} alt={name} loading="lazy" decoding="async" />
                ) : (
                  <span className="avatar">{name.charAt(0) || 'ط'}</span>
                )}
                <div>
                  <strong>{name}</strong>
                  <small>
                    {doctor.specialization ||
                      doctor.speciality ||
                      'التخصص غير محدد'}
                  </small>
                </div>
                <span className="chip pending">قيد المراجعة</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PanelHead({ title, subtitle, count }) {
  return (
    <div className="panel-head">
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <span>{number(count)}</span>
    </div>
  );
}

function Status({ item }) {
  const status = statusOf(item);
  let label = 'غير محدد';
  let type = 'default';

  if (status === 'admin_pending') {
    label = 'مراجعة الإدارة';
    type = 'pending';
  } else if (status === 'pending') {
    label = 'قيد الانتظار';
    type = 'pending';
  } else if (['approved', 'confirmed', 'accepted'].includes(status)) {
    label = status === 'accepted' ? 'مقبول' : 'مؤكد';
    type = 'success';
  } else if (status === 'completed') {
    label = 'مكتمل';
    type = 'success';
  } else if (['cancelled', 'canceled', 'rejected'].includes(status)) {
    label = status === 'rejected' ? 'مرفوض' : 'ملغي';
    type = 'danger';
  }

  return <span className={`chip ${type}`}>{label}</span>;
}

function Empty({ text }) {
  return <div className="empty">{text}</div>;
}

function Skeleton() {
  return (
    <>
      <div className="shimmer sk-hero" />
      <div className="sk-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="shimmer sk-card" key={i} />
        ))}
      </div>
      <div className="sk-panels">
        <div className="shimmer sk-panel" />
        <div className="shimmer sk-panel" />
      </div>
    </>
  );
}

function isApproved(doctor) {
  return (
    doctor.isApproved === true ||
    doctor.approved === true ||
    String(doctor.status || '').toLowerCase() === 'approved'
  );
}

function statusOf(item) {
  return String(item.bookingStatus || item.status || '')
    .trim()
    .toLowerCase();
}

function priceOf(item) {
  const parsed = Number(
    item.price ?? item.appointmentPrice ?? item.clinicPrice ?? 0,
  );
  return Number.isFinite(parsed) ? parsed : 0;
}

function createdAtOf(item) {
  const value = item.createdAt ?? item.registeredAt ?? item.timestamp ?? 0;
  if (typeof value === 'number') return value;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function normalizeDate(value) {
  if (!value) return '';
  if (typeof value === 'number') return dateKey(new Date(value));

  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : dateKey(parsed);
}

function dateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function timeMinutes(value) {
  const text = String(value || '').trim();
  const match = text.match(/(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 99999;

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const pm = text.includes('م') || text.toLowerCase().includes('pm');
  const am = text.includes('ص') || text.toLowerCase().includes('am');

  if (pm && hour < 12) hour += 12;
  if (am && hour === 12) hour = 0;

  return hour * 60 + minute;
}

function number(value) {
  return Number(value || 0).toLocaleString('ar-EG');
}

function shortTime(value) {
  const match = String(value || '').match(/(\d{1,2})(?::(\d{2}))?/);
  return match ? `${match[1]}:${match[2] || '00'}` : '--:--';
}

function shortDate(value) {
  const key = normalizeDate(value);
  if (!key) return 'غير محدد';
  const [y, m, d] = key.split('-').map(Number);

  return new Intl.DateTimeFormat('ar-EG', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(y, m - 1, d));
}

function formatFullDate(date) {
  return new Intl.DateTimeFormat('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

const styles = `
  * { box-sizing: border-box; }
  .dash {
    min-height: 100vh;
    background: ${C.bg};
    color: ${C.text};
    font-family: "Tajawal", "Cairo", Arial, sans-serif;
  }
  .topbar {
    min-height: 80px;
    padding: 15px clamp(18px, 3vw, 40px);
    background: rgba(255,255,255,.96);
    border-bottom: 1px solid ${C.border};
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 18px;
    position: sticky;
    top: 0;
    z-index: 20;
    backdrop-filter: blur(14px);
  }
  .topbar h1 { margin: 0; font-size: 23px; font-weight: 900; }
  .topbar p { margin: 5px 0 0; color: ${C.muted}; font-size: 12px; font-weight: 700; }
  .top-actions { display: flex; align-items: center; gap: 12px; }
  .search {
    width: min(380px, 34vw);
    height: 45px;
    padding: 0 14px;
    background: #f8fafc;
    border: 1px solid ${C.border};
    border-radius: 14px;
    display: flex;
    align-items: center;
    gap: 9px;
  }
  .search span { color: ${C.muted}; font-size: 21px; }
  .search input {
    width: 100%;
    border: 0;
    outline: 0;
    background: transparent;
    font: inherit;
    text-align: right;
  }
  .live {
    height: 39px;
    padding: 0 13px;
    border-radius: 12px;
    background: #ecfdf5;
    color: #166534;
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11px;
    font-weight: 900;
    white-space: nowrap;
  }
  .live i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 0 5px rgba(34,197,94,.12);
  }
  .content {
    width: 100%;
    max-width: 1540px;
    margin: auto;
    padding: 26px clamp(18px, 3vw, 40px) 50px;
  }
  .hero {
    min-height: 148px;
    padding: clamp(22px, 3vw, 32px);
    border-radius: 24px;
    background: radial-gradient(circle at 14% 20%, rgba(255,255,255,.16), transparent 30%),
      linear-gradient(135deg, #0f766e, #115e59);
    color: white;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
    box-shadow: 0 18px 42px rgba(15,118,110,.17);
  }
  .hero small { color: #ccfbf1; font-weight: 900; }
  .hero h2 { margin: 8px 0 0; font-size: clamp(22px, 2.5vw, 33px); font-weight: 900; }
  .hero p { margin: 9px 0 0; color: rgba(255,255,255,.8); font-weight: 700; }
  .hero-count {
    min-width: 125px;
    min-height: 92px;
    padding: 14px;
    border-radius: 20px;
    background: rgba(255,255,255,.13);
    border: 1px solid rgba(255,255,255,.22);
    display: grid;
    place-items: center;
    align-content: center;
  }
  .hero-count strong { font-size: 34px; line-height: 1; }
  .hero-count span { margin-top: 7px; color: #ccfbf1; font-size: 11px; font-weight: 900; }
  .stats {
    margin-top: 20px;
    display: grid;
    grid-template-columns: repeat(4, minmax(0,1fr));
    gap: 15px;
  }
  .metric, .panel {
    background: white;
    border: 1px solid ${C.border};
    border-radius: 20px;
    box-shadow: 0 8px 24px rgba(15,23,42,.045);
  }
  .metric { min-height: 164px; padding: 20px; }
  .metric.primary {
    color: white;
    background: linear-gradient(150deg,#0f766e,#115e59);
    border-color: transparent;
  }
  .metric-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .metric-head > span { color: ${C.muted}; font-size: 12px; font-weight: 900; }
  .primary .metric-head > span, .primary p { color: rgba(255,255,255,.74); }
  .metric-head b {
    width: 42px;
    height: 42px;
    border-radius: 14px;
    background: #ccfbf1;
    color: ${C.dark};
    display: grid;
    place-items: center;
    font-size: 18px;
  }
  .primary .metric-head b { color: white; background: rgba(255,255,255,.14); }
  .metric-value { margin-top: 21px; display: flex; align-items: baseline; gap: 7px; }
  .metric-value strong { font-size: clamp(29px,3vw,39px); line-height: 1; }
  .metric-value small { color: ${C.muted}; font-weight: 900; }
  .primary .metric-value small { color: #ccfbf1; }
  .metric p { margin: 13px 0 0; color: ${C.muted}; font-size: 11px; font-weight: 700; line-height: 1.6; }
  .grid { margin-top: 15px; display: grid; gap: 15px; align-items: start; }
  .analytics { grid-template-columns: minmax(0,1.6fr) minmax(320px,.8fr); }
  .tables { grid-template-columns: minmax(0,1.4fr) minmax(320px,.75fr); }
  .panel { padding: 20px; overflow: hidden; }
  .panel-head { display: flex; justify-content: space-between; gap: 14px; margin-bottom: 19px; }
  .panel-head h3 { margin: 0; font-size: 16px; font-weight: 900; }
  .panel-head p { margin: 6px 0 0; color: ${C.muted}; font-size: 11px; font-weight: 700; }
  .panel-head > span {
    min-width: 34px; height: 34px; padding: 0 9px; border-radius: 11px;
    background: #f1f5f9; display: grid; place-items: center; font-size: 11px; font-weight: 900;
  }
  .chart {
    height: 260px;
    padding: 15px 7px 2px;
    display: flex;
    align-items: flex-end;
    gap: 10px;
    border-radius: 16px;
    background: linear-gradient(to top,rgba(226,232,240,.65) 1px,transparent 1px);
    background-size: 100% 25%;
  }
  .bar-col {
    min-width: 0; height: 100%; flex: 1;
    display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 7px;
  }
  .bar-col > span { color: ${C.muted}; font-size: 10px; font-weight: 900; }
  .bar-track { width: min(40px,70%); height: 185px; display: flex; align-items: flex-end; }
  .bar-track i {
    width: 100%; min-height: 5px; border-radius: 10px 10px 4px 4px;
    background: linear-gradient(to top,#0f766e,#2dd4bf);
  }
  .bar-track i.today { box-shadow: 0 6px 18px rgba(20,184,166,.25); }
  .bar-col b { color: ${C.muted}; font-size: 10px; white-space: nowrap; }
  .bar-col b.today-label { color: ${C.dark}; }
  .list { display: grid; gap: 10px; }
  .appointment, .doctor {
    padding: 12px;
    border: 1px solid #edf2f7;
    border-radius: 15px;
    display: flex;
    align-items: center;
    gap: 11px;
  }
  .appointment time {
    width: 56px; height: 48px; border-radius: 13px; flex: 0 0 auto;
    background: #f0fdfa; color: ${C.dark}; display: grid; place-items: center;
    font-size: 11px; font-weight: 900;
  }
  .appointment > div, .doctor > div { min-width: 0; flex: 1; }
  .appointment strong, .doctor strong, table strong {
    display: block; color: ${C.text}; font-size: 12px; font-weight: 900;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .appointment small, .doctor small, table small {
    display: block; margin-top: 4px; color: ${C.muted}; font-size: 10px; font-weight: 700;
  }
  .doctor img, .avatar {
    width: 42px; height: 42px; border-radius: 13px; flex: 0 0 auto;
    object-fit: cover; background: #f0fdfa;
  }
  .avatar { display: grid; place-items: center; color: ${C.dark}; font-weight: 900; }
  .chip {
    flex: 0 0 auto; padding: 7px 9px; border-radius: 999px;
    font-size: 9px; font-weight: 900; white-space: nowrap;
  }
  .chip.pending { background: #fff7ed; color: #c2410c; }
  .chip.success { background: #ecfdf5; color: #15803d; }
  .chip.danger { background: #fef2f2; color: #dc2626; }
  .chip.default { background: #f1f5f9; color: #475569; }
  .table-scroll { overflow-x: auto; }
  table { width: 100%; min-width: 720px; border-collapse: collapse; }
  th {
    padding: 11px 9px; background: #f8fafc; color: ${C.muted};
    text-align: right; font-size: 10px; font-weight: 900; border-bottom: 1px solid ${C.border};
  }
  td {
    padding: 13px 9px; border-bottom: 1px solid #edf2f7;
    color: #334155; font-size: 11px; font-weight: 700; vertical-align: middle;
  }
  tbody tr:last-child td { border-bottom: 0; }
  td.price { color: ${C.dark}; font-weight: 900; white-space: nowrap; }
  .empty { min-height: 170px; display: grid; place-items: center; color: ${C.muted}; font-size: 12px; font-weight: 800; }
  .shimmer {
    position: relative; overflow: hidden; background: #e8edf3;
  }
  .shimmer:after {
    content: ""; position: absolute; inset: 0; transform: translateX(100%);
    background: linear-gradient(90deg,transparent,rgba(255,255,255,.65),transparent);
    animation: shimmer 1.2s infinite;
  }
  .sk-hero { height: 148px; border-radius: 24px; }
  .sk-grid { margin-top: 20px; display: grid; grid-template-columns: repeat(4,1fr); gap: 15px; }
  .sk-card { height: 164px; border-radius: 20px; }
  .sk-panels { margin-top: 15px; display: grid; grid-template-columns: 1.6fr .8fr; gap: 15px; }
  .sk-panel { height: 350px; border-radius: 20px; }
  @keyframes shimmer { to { transform: translateX(-100%); } }
  @media (max-width: 1180px) {
    .stats { grid-template-columns: repeat(2,minmax(0,1fr)); }
    .analytics, .tables, .sk-panels { grid-template-columns: 1fr; }
  }
  @media (max-width: 720px) {
    .topbar { position: static; flex-direction: column; align-items: stretch; }
    .top-actions { width: 100%; }
    .search { width: 100%; flex: 1; }
    .live { display: none; }
    .content { padding-top: 18px; }
    .hero { flex-direction: column; align-items: stretch; }
    .hero-count { min-height: 70px; grid-auto-flow: column; justify-content: center; gap: 10px; }
    .stats, .sk-grid { grid-template-columns: 1fr; }
    .chart { gap: 4px; }
    .bar-col b { font-size: 8px; }
  }
`;
