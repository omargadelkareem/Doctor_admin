import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { ref, onValue, update } from 'firebase/database';

function Appointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);

  useEffect(() => {
    const dashboardRef = ref(db, 'dashboardAppointments');

    const unsubscribe = onValue(dashboardRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();

        const list = Object.entries(data).map(([id, app]) =>
          normalizeAppointment(id, app)
        );

        list.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
        setAppointments(list);
        setLoading(false);
      } else {
        loadLegacyAppointments();
      }
    });

    return () => unsubscribe();
  }, []);

  const loadLegacyAppointments = () => {
    const appointmentsRef = ref(db, 'appointments');

    onValue(appointmentsRef, (snapshot) => {
      if (!snapshot.exists()) {
        setAppointments([]);
        setLoading(false);
        return;
      }

      const data = snapshot.val();
      const list = [];

      Object.entries(data).forEach(([patientId, patientAppointments]) => {
        if (patientAppointments && typeof patientAppointments === 'object') {
          Object.entries(patientAppointments).forEach(([appointmentId, app]) => {
            list.push(
              normalizeAppointment(appointmentId, {
                ...app,
                patientId: app.patientId || patientId,
                mainPath: `appointments/${patientId}/${appointmentId}`,
              })
            );
          });
        }
      });

      list.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      setAppointments(list);
      setLoading(false);
    });
  };

  const updateAppointmentStatus = async (app, action) => {
    const isApproveForDoctor = action === 'send_to_doctor';

    const ok = window.confirm(
      isApproveForDoctor
        ? 'هل تريد الموافقة على هذا الحجز وإرساله للطبيب؟'
        : 'هل تريد إلغاء هذا الحجز؟'
    );

    if (!ok) return;

    const updates = isApproveForDoctor
      ? {
          // موافقة الأدمن فقط: يظهر للطبيب كطلب Pending وليس Confirmed
          status: 'pending',
          bookingStatus: 'pending',
          visibleToDoctor: true,
          adminApproved: true,
          adminApprovedAt: Date.now(),
          updatedAt: Date.now(),
        }
      : {
          status: 'cancelled',
          bookingStatus: 'cancelled',
          visibleToDoctor: false,
          adminRejected: true,
          adminRejectedAt: Date.now(),
          updatedAt: Date.now(),
        };

    try {
      await update(ref(db, `dashboardAppointments/${app.id}`), updates);

      if (app.mainPath) {
        await update(ref(db, app.mainPath), updates);
      } else if (app.patientId) {
        await update(ref(db, `appointments/${app.patientId}/${app.id}`), updates);
      }

      alert(isApproveForDoctor ? 'تم إرسال الحجز للطبيب بنجاح' : 'تم إلغاء الحجز');
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء تحديث الحجز');
    }
  };

  const confirmPayment = async (app) => {
    const ok = window.confirm('هل تأكدت أن التحويل وصل بالفعل؟');
    if (!ok) return;

    const updates = {
      paymentStatus: 'paid',
      paidAt: Date.now(),
      updatedAt: Date.now(),
    };

    try {
      await update(ref(db, `dashboardAppointments/${app.id}`), updates);

      if (app.mainPath) {
        await update(ref(db, app.mainPath), updates);
      } else if (app.patientId) {
        await update(ref(db, `appointments/${app.patientId}/${app.id}`), updates);
      }

      alert('تم تأكيد الدفع');
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء تأكيد الدفع');
    }
  };

  const filtered = useMemo(() => {
    return appointments.filter((a) => {
      const q = search.toLowerCase();

      const matchesSearch =
        a.patientName.toLowerCase().includes(q) ||
        a.patientPhone.toLowerCase().includes(q) ||
        a.doctorName.toLowerCase().includes(q) ||
        a.specialization.toLowerCase().includes(q) ||
        a.address.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === 'all' ? true : a.status === statusFilter;

      const matchesPayment =
        paymentFilter === 'all' ? true : a.paymentStatus === paymentFilter;

      const matchesDate = dateFilter === '' ? true : a.date === dateFilter;

      return matchesSearch && matchesStatus && matchesPayment && matchesDate;
    });
  }, [appointments, search, statusFilter, paymentFilter, dateFilter]);

  if (loading) return <Loader />;

  return (
    <div className="container" dir="rtl">
      <Header count={filtered.length} />

      <div className="stats">
        <Stat title="كل الحجوزات" value={appointments.length} />
        <Stat
          title="بانتظار موافقة الأدمن"
          value={appointments.filter((x) => x.status === 'admin_pending').length}
        />
        <Stat
          title="مؤكد"
          value={appointments.filter((x) => x.status === 'confirmed').length}
        />
        <Stat
          title="بانتظار الدفع"
          value={appointments.filter((x) => x.paymentStatus === 'pending').length}
        />
      </div>

      <div className="filters">
        <input
          placeholder="ابحث باسم المريض، الدكتور، رقم الهاتف، التخصص..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">كل حالات الحجز</option>
          <option value="admin_pending">بانتظار موافقة الأدمن</option>
          <option value="pending">عند الطبيب</option>
          <option value="confirmed">مؤكد</option>
          <option value="cancelled">ملغى</option>
        </select>

        <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
          <option value="all">كل حالات الدفع</option>
          <option value="unpaid">دفع في العيادة</option>
          <option value="pending">إيصال قيد المراجعة</option>
          <option value="paid">مدفوع</option>
        </select>

        <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <Empty />
      ) : (
        <div className="grid">
          {filtered.map((app) => {
            const status = getStatus(app.status);
            const payment = getPaymentStatus(app.paymentStatus, app.paymentMethod);

            return (
              <div key={app.id} className="card">
                <div className="cardTop">
                  <div>
                    <h3>{app.patientName}</h3>
                    <p>{app.patientPhone}</p>
                  </div>

                  <span className="badge" style={{ background: status.bg, color: status.color }}>
                    {status.text}
                  </span>
                </div>

                <div className="details">
                  <Info label="الدكتور" value={`د. ${app.doctorName}`} />
                  <Info label="التخصص" value={app.specialization} />
                  <Info label="العنوان" value={app.address} />
                  <Info label="موعد الحجز" value={`${app.date} - ${app.time}`} />
                  <Info label="سعر الكشف" value={`${app.price} جنيه`} strong />
                  <Info label="الدفع" value={payment.text} />
                </div>

                {app.hasReceiptImage && (
                  <button className="receiptBtn" onClick={() => setSelectedAppointment(app)}>
                    عرض إيصال التحويل
                  </button>
                )}

                <div className="actions">
                  <button
                    className="approve"
                    disabled={app.status !== 'admin_pending'}
                    onClick={() => updateAppointmentStatus(app, 'send_to_doctor')}
                  >
                    إرسال للطبيب
                  </button>

                  <button
                    className="cancel"
                    disabled={app.status === 'cancelled'}
                    onClick={() => updateAppointmentStatus(app, 'cancelled')}
                  >
                    إلغاء
                  </button>

                  {app.paymentStatus === 'pending' && (
                    <button className="paid" onClick={() => confirmPayment(app)}>
                      تأكيد الدفع
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedAppointment && (
        <ReceiptModal
          appointment={selectedAppointment}
          onClose={() => setSelectedAppointment(null)}
        />
      )}

      <style>{`
        .container {
          padding: 28px;
          background: #f8fafc;
          min-height: 100vh;
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 14px;
          margin: 22px 0;
        }

        .filters {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr 1fr;
          gap: 12px;
          margin-bottom: 22px;
        }

        input,
        select {
          padding: 13px 14px;
          border-radius: 14px;
          border: 1px solid #dbe4ea;
          background: white;
          font-size: 14px;
          outline: none;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
          gap: 16px;
        }

        .card {
          background: white;
          border-radius: 22px;
          padding: 18px;
          border: 1px solid #e2e8f0;
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.07);
        }

        .cardTop {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 16px;
        }

        h3 {
          margin: 0 0 5px;
          font-size: 19px;
          color: #0f172a;
        }

        p {
          margin: 0;
          color: #64748b;
          font-size: 13px;
        }

        .badge {
          padding: 7px 12px;
          border-radius: 999px;
          font-weight: 800;
          font-size: 12px;
          white-space: nowrap;
        }

        .details {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: linear-gradient(
    180deg,
    #ffffff 0%,
    #f8fafc 100%
  );
  border-radius: 18px;
  border: 1px solid #dbe4ea;
  margin-top: 8px;
}

        .actions {
          display: flex;
          gap: 8px;
          margin-top: 14px;
          flex-wrap: wrap;
        }

        button {
          border: none;
          border-radius: 12px;
          padding: 11px 14px;
          font-weight: 800;
          cursor: pointer;
        }

        button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        .approve {
          background: #10b981;
          color: white;
        }

        .cancel {
          background: #ef4444;
          color: white;
        }

        .paid {
          background: #0f766e;
          color: white;
        }

        .receiptBtn {
          margin-top: 14px;
          width: 100%;
          background: #ecfeff;
          color: #0f766e;
          border: 1px solid #99f6e4;
        }

        @media (max-width: 900px) {
          .filters {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

function normalizeAppointment(id, app = {}) {
  return {
    id,
    mainPath: app.mainPath || '',
    patientId: String(app.patientId || ''),
    patientName: String(app.patientName || 'مريض'),
    patientPhone: String(app.patientPhone || 'غير متوفر'),
    doctorId: String(app.doctorId || ''),
    doctorName: String(app.doctorName || 'دكتور'),
    specialization: String(app.specialization || 'غير محدد'),
    address: String(app.address || app.clinicAddress || app.doctorAddress || 'غير متوفر'),
    date: String(app.date || ''),
    time: String(app.time || ''),
    price: app.price || app.appointmentPrice || 300,
    status: String(app.status || app.bookingStatus || 'admin_pending'),
    visibleToDoctor: app.visibleToDoctor === true,
    adminApproved: app.adminApproved === true,
    paymentMethod: String(app.paymentMethod || 'clinic'),
    paymentStatus: String(app.paymentStatus || 'unpaid'),
    receiptImageBase64: app.receiptImageBase64 || '',
    hasReceiptImage: Boolean(app.hasReceiptImage || app.receiptImageBase64),
    createdAt: app.createdAt || 0,
  };
}

const Header = ({ count }) => (
  <div className="header">
    <div>
      <h1>إدارة الحجوزات</h1>
      <p>عرض تفاصيل الحجز، مراجعة الدفع، والموافقة على المواعيد</p>
    </div>
    <span>{count} حجز</span>

    <style>{`
      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 14px;
      }

      h1 {
        margin: 0;
        font-size: 28px;
        font-weight: 900;
        color: #0f172a;
      }

      p {
        margin: 6px 0 0;
        color: #64748b;
      }

      span {
        background: #0f766e;
        color: white;
        padding: 9px 16px;
        border-radius: 999px;
        font-weight: 900;
      }
    `}</style>
  </div>
);

const Stat = ({ title, value }) => (
  <div className="stat">
    <p>{title}</p>
    <strong>{value}</strong>

    <style>{`
      .stat {
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 18px;
        padding: 16px;
        box-shadow: 0 8px 22px rgba(15, 23, 42, 0.05);
      }

      p {
        margin: 0 0 8px;
        color: #64748b;
        font-weight: 700;
      }

      strong {
        font-size: 26px;
        color: #0f766e;
      }
    `}</style>
  </div>
);

const Info = ({ label, value, strong }) => (
  <div className="info">
    <div className="label">{label}</div>

    <div className={strong ? 'value strong' : 'value'}>
      {value || '-'}
    </div>

    <style>{`
      .info {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 12px 14px;
        background: white;
        border-radius: 14px;
        border: 1px solid #eef2f7;
      }

      .label {
        color: #475569;
        font-size: 13px;
        font-weight: 800;
        white-space: nowrap;
      }

      .value {
        color: #020617 !important;
        font-size: 15px;
        font-weight: 900;
        text-align: left;
        line-height: 1.5;
      }

      .strong {
        color: #0f766e !important;
        font-size: 18px;
      }
    `}</style>
  </div>
);

const ReceiptModal = ({ appointment, onClose }) => (
  <div className="overlay">
    <div className="modal">
      <div className="modalHeader">
        <h2>إيصال التحويل</h2>
        <button onClick={onClose}>×</button>
      </div>

      <p>
        {appointment.patientName} - د. {appointment.doctorName}
      </p>

      {appointment.receiptImageBase64 ? (
        <img
          src={`data:image/jpeg;base64,${appointment.receiptImageBase64}`}
          alt="receipt"
        />
      ) : (
        <div className="noImage">لا يوجد إيصال</div>
      )}
    </div>

    <style>{`
      .overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.65);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 9999;
        padding: 20px;
      }

      .modal {
        background: white;
        width: min(620px, 100%);
        max-height: 90vh;
        overflow: auto;
        border-radius: 22px;
        padding: 18px;
      }

      .modalHeader {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      h2 {
        margin: 0;
        color: #0f172a;
      }

      button {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        border: none;
        background: #fee2e2;
        color: #ef4444;
        font-size: 24px;
        cursor: pointer;
      }

      p {
        color: #64748b;
        font-weight: 700;
      }

      img {
        width: 100%;
        border-radius: 16px;
        border: 1px solid #e2e8f0;
      }

      .noImage {
        padding: 40px;
        text-align: center;
        color: #64748b;
        background: #f8fafc;
        border-radius: 16px;
      }
    `}</style>
  </div>
);

function getStatus(status) {
  switch (status) {
    case 'admin_pending':
      return { text: 'بانتظار موافقة الأدمن', color: '#7c2d12', bg: '#ffedd5' };
    case 'confirmed':
      return { text: 'مؤكد', color: '#047857', bg: '#d1fae5' };
    case 'cancelled':
      return { text: 'ملغى', color: '#dc2626', bg: '#fee2e2' };
    default:
      return { text: 'قيد الانتظار', color: '#b45309', bg: '#fef3c7' };
  }
}

function getPaymentStatus(status, method) {
  if (method === 'clinic') return { text: 'الدفع داخل العيادة' };

  switch (status) {
    case 'paid':
      return { text: 'تم الدفع' };
    case 'pending':
      return { text: 'إيصال قيد المراجعة' };
    default:
      return { text: 'غير مدفوع' };
  }
}

const Empty = () => (
  <div className="empty">
    <h2>لا يوجد حجوزات</h2>
    <p>جرّب تغيير الفلاتر أو التاريخ</p>

    <style>{`
      .empty {
        text-align: center;
        margin-top: 90px;
        color: #64748b;
      }

      h2 {
        color: #0f172a;
      }
    `}</style>
  </div>
);

const Loader = () => (
  <div className="loader">
    <div className="spin"></div>

    <style>{`
      .loader {
        height: 80vh;
        display: flex;
        justify-content: center;
        align-items: center;
      }

      .spin {
        width: 50px;
        color:white;
        height: 50px;
        border: 5px solid #e2e8f0;
        border-top: 5px solid #14b8a6;
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

export default Appointments;