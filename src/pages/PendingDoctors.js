import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { ref, onValue, update } from 'firebase/database';

const TEAL_DARK = '#003f4f';
const TEAL = '#00796b';
const BG = '#f5f7fb';

function PendingDoctors() {
  const [pendingDoctors, setPendingDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const usersRef = ref(db, 'users');

    const unsubscribe = onValue(usersRef, (snapshot) => {
      if (!snapshot.exists()) {
        setPendingDoctors([]);
        setLoading(false);
        return;
      }

      const data = snapshot.val();

      const list = Object.entries(data)
        .filter(([_, user]) => user.role === 'doctor' && user.isApproved !== true)
        .map(([id, user]) => normalizePendingDoctor(id, user));

      setPendingDoctors(list);
      setSelectedDoctor((prev) => prev || list[0] || null);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return pendingDoctors.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.specialization.toLowerCase().includes(q) ||
        d.phone.includes(search)
    );
  }, [pendingDoctors, search]);

  const approveDoctor = async (id) => {
    const ok = window.confirm('هل تريد الموافقة واعتماد هذا الطبيب؟');
    if (!ok) return;

    await update(ref(db, `users/${id}`), {
      isApproved: true,
      rejected: false,
      approvedAt: Date.now(),
      updatedAt: Date.now(),
    });
  };

  const rejectDoctor = async (id) => {
    const ok = window.confirm('هل تريد رفض هذا الطلب؟');
    if (!ok) return;

    await update(ref(db, `users/${id}`), {
      isApproved: false,
      rejected: true,
      rejectedAt: Date.now(),
      updatedAt: Date.now(),
    });
  };

  if (loading) return <Loader />;

  return (
    <div className="page" dir="rtl">
      <Sidebar active="pending" />

      <main className="content">
        <Topbar search={search} onSearch={setSearch} />

        <section className="hero">
          <div>
            <h1>الموافقة على الأطباء الجدد</h1>
            <p>يوجد حالياً {filtered.length} طبيباً بانتظار مراجعة بياناتهم</p>
          </div>

          <div className="heroActions">
            <button className="filter">☰ تصفية</button>
            <button className="history">↻ سجل الموافقات</button>
          </div>
        </section>

        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <section className="reviewLayout">
            <aside className="requestsList">
              {filtered.map((doctor) => (
                <button
                  key={doctor.id}
                  className={
                    selectedDoctor?.id === doctor.id ? 'request active' : 'request'
                  }
                  onClick={() => setSelectedDoctor(doctor)}
                >
                  <img src={doctor.photoUrl} alt="" />

                  <div>
                    <strong>{doctor.name}</strong>
                    <span>{doctor.specialization}</span>
                    <small>◷ منذ {doctor.waitingTime}</small>
                  </div>

                  <em>{doctor.statusLabel}</em>
                </button>
              ))}
            </aside>

            {selectedDoctor && (
              <DoctorReviewPanel
                doctor={selectedDoctor}
                onApprove={approveDoctor}
                onReject={rejectDoctor}
              />
            )}
          </section>
        )}
      </main>

      <style jsx>{`
        .page {
          min-height: 100vh;
          background: ${BG};
          display: grid;
          grid-template-columns: 280px 1fr;
          color: #0f172a;
        }

        .content {
          padding: 0 32px 32px;
        }

        .hero {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin: 34px 0 34px;
        }

        h1 {
          margin: 0 0 12px;
          font-size: 28px;
          color: #082f3a;
          font-weight: 900;
        }

        p {
          margin: 0;
          color: #475569;
          font-weight: 700;
        }

        .heroActions {
          display: flex;
          gap: 12px;
        }

        .heroActions button {
          border: none;
          height: 48px;
          padding: 0 22px;
          border-radius: 12px;
          font-weight: 900;
          cursor: pointer;
        }

        .filter {
          background: #dbeafe;
          color: #334155;
        }

        .history {
          background: ${TEAL_DARK};
          color: white;
        }

        .reviewLayout {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 28px;
          align-items: start;
        }

        .requestsList {
          display: grid;
          gap: 16px;
        }

        .request {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 18px;
          display: grid;
          grid-template-columns: 70px 1fr auto;
          gap: 12px;
          text-align: right;
          cursor: pointer;
          align-items: center;
        }

        .request.active {
          border: 2px solid ${TEAL};
          box-shadow: 0 10px 28px rgba(0, 121, 107, 0.12);
        }

        .request img {
          width: 64px;
          height: 64px;
          border-radius: 14px;
          object-fit: cover;
        }

        .request strong {
          display: block;
          color: #0f172a;
          font-weight: 900;
          margin-bottom: 4px;
        }

        .request span,
        .request small {
          display: block;
          color: #64748b;
          font-weight: 700;
          font-size: 12px;
        }

        .request em {
          background: #d9fbf6;
          color: ${TEAL};
          border-radius: 999px;
          padding: 6px 10px;
          font-style: normal;
          font-size: 11px;
          font-weight: 900;
        }

        @media (max-width: 1100px) {
          .page {
            grid-template-columns: 1fr;
          }

          .reviewLayout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

const DoctorReviewPanel = ({ doctor, onApprove, onReject }) => (
  <section className="panel">
    <header className="panelHeader">
      <div className="status">
        <span>الحالة: مراجعة الوثائق</span>
        <small>تاريخ التقديم: {doctor.createdDate}</small>
      </div>

      <div className="doctorMain">
        <img src={doctor.photoUrl} alt="" />
        <div>
          <h2>{doctor.name}</h2>
          <p>رقم الطلب: {doctor.requestCode}</p>
        </div>
      </div>
    </header>

    <div className="panelBody">
      <div className="infoCol">
        <h4>البيانات المهنية</h4>

        <Detail label="التخصص الدقيق" value={doctor.specialization} />
        <Detail label="سنوات الخبرة" value={doctor.experience} />
        <Detail label="المؤسسة التعليمية" value={doctor.education} />
        <Detail label="رقم ترخيص الهيئة" value={doctor.license} highlight />

        <h4 className="mt">مراحل التحقق</h4>

        <Timeline title="إكمال الملف الشخصي" done time="اكتمل في 09:00 ص" />
        <Timeline title="التحقق من رقم الهاتف والبريد" done time="اكتمل في 09:15 ص" />
        <Timeline title="مراجعة الوثائق المرفوعة" active time="قيد المعالجة حالياً..." />
      </div>

      <div className="docsCol">
        <h4>الوثائق والمرفقات</h4>

        {doctor.documents.map((doc, index) => (
          <DocumentItem key={index} doc={doc} />
        ))}

        <div className="preview">
          <img src={doctor.documentPreview} alt="" />
          <p>معاينة: ترخيص مزاولة المهنة</p>
        </div>
      </div>
    </div>

    <footer className="panelFooter">
      <button className="contact">▣ التواصل مع الطبيب</button>
      <button className="approve" onClick={() => onApprove(doctor.id)}>
        ✓ الموافقة والاعتماد
      </button>
      <button className="reject" onClick={() => onReject(doctor.id)}>
        × رفض الطلب
      </button>
    </footer>

    <style jsx>{`
      .panel {
        background: white;
        border: 1px solid #dfe7ef;
        border-radius: 18px;
        overflow: hidden;
        box-shadow: 0 12px 26px rgba(15, 23, 42, 0.04);
      }

      .panelHeader {
        padding: 28px;
        border-bottom: 1px solid #edf2f7;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .doctorMain {
        display: flex;
        align-items: center;
        gap: 18px;
      }

      .doctorMain img {
        width: 76px;
        height: 76px;
        object-fit: cover;
        border-radius: 16px;
      }

      h2 {
        margin: 0 0 10px;
        color: #082f3a;
        font-size: 26px;
        font-weight: 900;
      }

      p {
        margin: 0;
        color: #334155;
        font-weight: 800;
      }

      .status span {
        display: inline-block;
        padding: 10px 20px;
        background: #d9fbf6;
        color: ${TEAL};
        border-radius: 999px;
        font-weight: 900;
      }

      .status small {
        display: block;
        margin-top: 12px;
        color: #64748b;
        font-weight: 700;
      }

      .panelBody {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 34px;
        padding: 30px;
      }

      h4 {
        color: #64748b;
        font-size: 13px;
        margin: 0 0 18px;
        font-weight: 900;
      }

      .mt {
        margin-top: 32px;
      }

      .preview {
        margin-top: 26px;
        border-radius: 16px;
        overflow: hidden;
        border: 1px solid #dfe7ef;
        background: #f8fafc;
      }

      .preview img {
        width: 100%;
        height: 260px;
        object-fit: cover;
        display: block;
      }

      .preview p {
        text-align: center;
        padding: 14px;
        color: #334155;
      }

      .panelFooter {
        background: #eef4ff;
        padding: 26px;
        display: grid;
        grid-template-columns: 1fr 240px 210px;
        gap: 18px;
      }

      .panelFooter button {
        height: 58px;
        border: none;
        border-radius: 14px;
        font-weight: 900;
        font-size: 16px;
        cursor: pointer;
      }

      .contact {
        background: transparent;
        color: #0f172a;
        text-align: right;
      }

      .approve {
        background: ${TEAL};
        color: white;
        box-shadow: 0 10px 18px rgba(0, 121, 107, 0.22);
      }

      .reject {
        background: #c51f1f;
        color: white;
        box-shadow: 0 10px 18px rgba(197, 31, 31, 0.2);
      }

      @media (max-width: 900px) {
        .panelHeader,
        .panelBody,
        .panelFooter {
          grid-template-columns: 1fr;
          display: grid;
        }
      }
    `}</style>
  </section>
);

function normalizePendingDoctor(id, user = {}) {
  const photo =
    user.photoUrl ||
    user.image ||
    user.avatar ||
    'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=160&h=160&fit=crop';

  const docs = user.documents || user.files || [];

  return {
    id,
    name: user.name || user.fullName || 'طبيب غير معروف',
    phone: String(user.phone || ''),
    email: String(user.email || ''),
    specialization: user.specialization || user.speciality || 'غير محدد',
    experience: user.experience || user.experienceYears || 'غير محدد',
    education: user.education || user.university || 'غير متوفر',
    license: user.licenseNumber || user.license || 'SCFHS-2023-884930',
    requestCode: user.requestCode || `APR-${id.slice(0, 5).toUpperCase()}#`,
    createdDate: user.createdDate || '12 أكتوبر 2023',
    waitingTime: user.waitingTime || 'ساعتين',
    statusLabel: user.rejected ? 'مرفوض' : 'جديد',
    photoUrl: photo,
    documentPreview:
      user.documentPreview ||
      'https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=800&h=500&fit=crop',
    documents:
      docs.length > 0
        ? docs
        : [
            { title: 'ترخيص مزاولة المهنة', type: 'PDF', size: '2.4 MB' },
            { title: 'شهادة الزمالة البريطانية', type: 'JPG', size: '1.1 MB' },
            { title: 'الهوية الوطنية / الإقامة', type: 'PDF', size: '800 KB' },
          ],
  };
}

const Detail = ({ label, value, highlight }) => (
  <div className="detail">
    <span>{label}</span>
    <strong className={highlight ? 'highlight' : ''}>{value}</strong>

    <style jsx>{`
      .detail {
        margin-bottom: 20px;
      }

      span {
        color: #94a3b8;
        font-weight: 800;
        display: block;
        margin-bottom: 6px;
      }

      strong {
        color: #0f172a;
        font-size: 17px;
        font-weight: 900;
      }

      .highlight {
        color: ${TEAL};
        font-size: 22px;
      }
    `}</style>
  </div>
);

const Timeline = ({ title, time, done, active }) => (
  <div className="timeline">
    <div className={done ? 'dot done' : active ? 'dot active' : 'dot'}>{done ? '✓' : ''}</div>
    <div>
      <strong>{title}</strong>
      <span>{time}</span>
    </div>

    <style jsx>{`
      .timeline {
        display: flex;
        gap: 14px;
        margin-bottom: 20px;
        align-items: flex-start;
      }

      .dot {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        border: 3px solid ${TEAL_DARK};
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 900;
        background: #d9edf2;
      }

      .done {
        background: ${TEAL};
        border-color: ${TEAL};
      }

      .active {
        background: #cfe7ef;
      }

      strong {
        color: #0f172a;
        display: block;
        font-weight: 900;
      }

      span {
        color: #64748b;
        font-weight: 700;
        font-size: 12px;
      }
    `}</style>
  </div>
);

const DocumentItem = ({ doc }) => (
  <div className="doc">
    <span>◎</span>
    <div>
      <strong>{doc.title || doc.name || 'مستند'}</strong>
      <small>{doc.type || 'PDF'} • {doc.size || '-'}</small>
    </div>
    <em>▣</em>

    <style jsx>{`
      .doc {
        height: 82px;
        background: #f7f9fe;
        border: 1px solid #dfe7ef;
        border-radius: 14px;
        display: grid;
        grid-template-columns: 32px 1fr 50px;
        align-items: center;
        gap: 14px;
        padding: 0 16px;
        margin-bottom: 16px;
      }

      span {
        font-size: 24px;
        color: #64748b;
      }

      strong {
        color: #0f172a;
        font-weight: 900;
        display: block;
        margin-bottom: 6px;
      }

      small {
        color: #64748b;
        font-weight: 700;
      }

      em {
        width: 44px;
        height: 44px;
        background: #e5eef7;
        border-radius: 10px;
        display: grid;
        place-items: center;
        color: ${TEAL_DARK};
        font-style: normal;
      }
    `}</style>
  </div>
);

const Sidebar = ({ active }) => (
  <aside className="sidebar">
    <div className="brand">
      <h2>سلامتك</h2>
      <p>لوحة التحكم الإدارية</p>
    </div>

    <nav>
      <a>الرئيسية <span>▦</span></a>
      <a>إدارة الأطباء <span>▣</span></a>
      <a className={active === 'pending' ? 'active' : ''}>الموافقة على الأطباء <span>◇</span></a>
      <a>إدارة المرضى <span>♚</span></a>
      <a>الحجوزات <span>▤</span></a>
      <a>التقارير <span>▥</span></a>
      <a>الإشعارات <span>♧</span></a>
      <a>الإعدادات <span>⚙</span></a>
    </nav>

    <div className="adminBox">
      <div>
        <strong>أحمد العلي</strong>
        <small>مدير النظام</small>
      </div>
      <img src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=80&h=80&fit=crop" />
    </div>

    <style jsx>{`
      .sidebar {
        background: #f6f8fd;
        border-left: 1px solid #dde5ef;
        min-height: 100vh;
        padding: 32px 22px;
        position: sticky;
        top: 0;
      }

      .brand {
        text-align: right;
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

      nav {
        display: grid;
        gap: 14px;
      }

      nav a {
        height: 54px;
        padding: 0 18px;
        border-radius: 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: #1e293b;
        font-weight: 800;
        text-decoration: none;
      }

      nav a.active {
        background: #e2f7f6;
        color: ${TEAL};
        border-left: 5px solid ${TEAL};
      }

      .adminBox {
        position: absolute;
        bottom: 24px;
        left: 22px;
        right: 22px;
        background: #dfe8f1;
        color: #082f3a;
        border-radius: 14px;
        padding: 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .adminBox img {
        width: 50px;
        height: 50px;
        border-radius: 50%;
      }

      .adminBox small {
        color: #64748b;
      }
    `}</style>
  </aside>
);

const Topbar = ({ search, onSearch }) => (
  <div className="topbar">
    <div className="icons">
      <span>؟</span>
      <span>🌐</span>
      <span className="bell">♧</span>
    </div>

    <div className="search">
      <span>⌕</span>
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="البحث عن طبيب، أو رقم طلب..."
      />
    </div>

    <style jsx>{`
      .topbar {
        height: 72px;
        border-bottom: 1px solid #dfe7ef;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .icons {
        display: flex;
        gap: 28px;
        font-size: 22px;
        color: #1e293b;
      }

      .bell {
        position: relative;
      }

      .bell:after {
        content: '';
        position: absolute;
        width: 6px;
        height: 6px;
        background: #dc2626;
        border-radius: 50%;
        top: 2px;
        right: -2px;
      }

      .search {
        width: 520px;
        height: 46px;
        background: white;
        border: 1px solid #cfd8e3;
        border-radius: 14px;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 16px;
      }

      .search input {
        border: none;
        outline: none;
        flex: 1;
        font-size: 15px;
        background: transparent;
        text-align: right;
      }
    `}</style>
  </div>
);

const EmptyState = () => (
  <div style={{ padding: 80, textAlign: 'center', color: '#64748b' }}>
    لا توجد طلبات أطباء حالياً
  </div>
);

const Loader = () => <div style={{ padding: 60, textAlign: 'center' }}>Loading...</div>;

export default PendingDoctors;