import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { ref, onValue, update, remove } from 'firebase/database';


const TEAL = '#00796b';
const BG = '#f5f7fb';

function Doctors() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [specializationFilter, setSpecializationFilter] = useState('all');
  const [experienceFilter, setExperienceFilter] = useState('all');

  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [doctorAppointments, setDoctorAppointments] = useState([]);

  useEffect(() => {
    const usersRef = ref(db, 'users');

    const unsubscribe = onValue(usersRef, (snapshot) => {
      if (!snapshot.exists()) {
        setDoctors([]);
        setLoading(false);
        return;
      }

      const data = snapshot.val();

      const list = Object.entries(data)
        .filter(([_, user]) => user.role === 'doctor')
        .map(([id, user]) => normalizeDoctor(id, user));

      setDoctors(list);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const toggleApproval = async (id, currentStatus) => {
    await update(ref(db, `users/${id}`), {
      isApproved: !currentStatus,
      rejected: false,
      updatedAt: Date.now(),
    });
  };

  const deleteDoctor = async (id) => {
    const ok = window.confirm('هل أنت متأكد من حذف هذا الطبيب؟');
    if (!ok) return;

    try {
      await remove(ref(db, `users/${id}`));
      alert('تم حذف الطبيب بنجاح');
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء حذف الطبيب');
    }
  };

  const openDoctorProfile = async (doctor) => {
    try {
      const appointmentsRef = ref(db, 'appointments');

      onValue(
        appointmentsRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            setDoctorAppointments([]);
            setSelectedDoctor(doctor);
            return;
          }

          const data = snapshot.val();
          const list = [];

          Object.entries(data).forEach(([patientId, patientAppointments]) => {
            if (patientAppointments && typeof patientAppointments === 'object') {
              Object.entries(patientAppointments).forEach(([appointmentId, app]) => {
                if (app && app.doctorId === doctor.id) {
                  list.push({
                    appointmentId,
                    patientId,
                    ...app,
                  });
                }
              });
            }
          });

          list.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

          setDoctorAppointments(list);
          setSelectedDoctor(doctor);
        },
        { onlyOnce: true }
      );
    } catch (e) {
      console.log(e);
    }
  };

  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      const q = search.toLowerCase();

      const matchesSearch =
        doc.name.toLowerCase().includes(q) ||
        doc.phone.includes(search) ||
        doc.email.toLowerCase().includes(q) ||
        doc.specialization.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'approved'
          ? doc.isApproved === true
          : doc.isApproved !== true;

      const matchesSpecialization =
        specializationFilter === 'all'
          ? true
          : doc.specialization === specializationFilter;

      const matchesExperience =
        experienceFilter === 'all'
          ? true
          : experienceFilter === 'less5'
          ? doc.experienceNumber < 5
          : experienceFilter === '5to10'
          ? doc.experienceNumber >= 5 && doc.experienceNumber <= 10
          : doc.experienceNumber > 10;

      return matchesSearch && matchesStatus && matchesSpecialization && matchesExperience;
    });
  }, [doctors, search, statusFilter, specializationFilter, experienceFilter]);

  const specializations = [
    ...new Set(doctors.map((d) => d.specialization).filter(Boolean)),
  ];

  const stats = {
    total: doctors.length,
    active: doctors.filter((d) => d.isApproved === true).length,
    pending: doctors.filter((d) => d.isApproved !== true).length,
    rating:
      doctors.length === 0
        ? '0.0'
        : (
            doctors.reduce((sum, d) => sum + Number(d.rating || 0), 0) /
            doctors.length
          ).toFixed(1),
  };

  if (loading) return <Loader />;

  return (
    <div className="doctorsPage" dir="rtl">
      <Topbar
        search={search}
        onSearch={setSearch}
        placeholder="بحث عن طبيب، تخصص، أو رقم معرف..."
      />

      <section className="hero">
        <div>
          <h1>إدارة الأطباء</h1>
          <p>إدارة وتتبع الكادر الطبي المسجل في المنصة.</p>
        </div>
      </section>

      <section className="statsGrid">
        <StatCard title="إجمالي الأطباء" value={stats.total} icon="☤" hint="كل الأطباء" />
        <StatCard title="أطباء نشطون" value={stats.active} icon="◇" hint="معتمد" />
        <StatCard title="بانتظار الموافقة" value={stats.pending} icon="!" hint="مراجعة" />
        <StatCard title="متوسط التقييم" value={stats.rating} icon="☆" hint="عام" />
      </section>

      <section className="filtersCard">
        <FilterBox title="التخصص">
          <select
            value={specializationFilter}
            onChange={(e) => setSpecializationFilter(e.target.value)}
          >
            <option value="all">الكل</option>
            {specializations.map((spec) => (
              <option key={spec} value={spec}>
                {spec}
              </option>
            ))}
          </select>
        </FilterBox>

        <FilterBox title="الحالة">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">الكل</option>
            <option value="approved">نشط</option>
            <option value="pending">غير نشط</option>
          </select>
        </FilterBox>

        <FilterBox title="الخبرة">
          <select
            value={experienceFilter}
            onChange={(e) => setExperienceFilter(e.target.value)}
          >
            <option value="all">الكل</option>
            <option value="less5">أقل من 5 سنوات</option>
            <option value="5to10">من 5 إلى 10 سنوات</option>
            <option value="more10">أكثر من 10 سنوات</option>
          </select>
        </FilterBox>

        <button
          className="filterBtn"
          onClick={() => {
            setStatusFilter('all');
            setSpecializationFilter('all');
            setExperienceFilter('all');
            setSearch('');
          }}
        >
          إعادة ضبط
        </button>
      </section>

      <section className="tableCard">
        <div className="tableHead">
          <span>الطبيب</span>
          <span>التخصص</span>
          <span>الخبرة</span>
          <span>التقييم</span>
          <span>الحالة</span>
          <span>الإجراءات</span>
        </div>

        {filteredDoctors.length === 0 ? (
          <EmptyState />
        ) : (
          filteredDoctors.map((doctor) => (
            <div className="tableRow" key={doctor.id}>
              <div className="doctorCell">
                <img src={doctor.photoUrl} alt="" />
                <div>
                  <strong>{doctor.name}</strong>
                  <small>{doctor.code}</small>
                </div>
              </div>

              <div className="textCell">{doctor.specialization}</div>
              <div className="textCell">{doctor.experience}</div>
              <div className="rating">☆ {doctor.rating}</div>

              <div>
                <span className={doctor.isApproved ? 'pill active' : 'pill inactive'}>
                  {doctor.isApproved ? 'نشط' : 'غير نشط'}
                </span>
              </div>

              <div className="actions">
                <button className="softInfo" onClick={() => openDoctorProfile(doctor)}>
                  الملف
                </button>

                <button
                  className={doctor.isApproved ? 'softWarn' : 'softApprove'}
                  onClick={() => toggleApproval(doctor.id, doctor.isApproved)}
                >
                  {doctor.isApproved ? 'إلغاء' : 'اعتماد'}
                </button>

                <button className="softDanger" onClick={() => deleteDoctor(doctor.id)}>
                  حذف
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {selectedDoctor && (
        <DoctorModal
          doctor={selectedDoctor}
          appointments={doctorAppointments}
          onClose={() => setSelectedDoctor(null)}
        />
      )}

      <style>{`
        .doctorsPage {
          width: 100%;
          min-height: 100vh;
          background: ${BG};
          color: #0f172a;
          padding: 0 0 32px;
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin: 34px 0 28px;
        }

        .hero h1 {
          margin: 0 0 12px;
          font-size: 30px;
          font-weight: 900;
          color: #082f3a;
        }

        .hero p {
          margin: 0;
          color: #475569;
          font-weight: 700;
        }

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 22px;
          margin-bottom: 28px;
        }

        .filtersCard {
          background: white;
          border: 1px solid #dfe7ef;
          border-radius: 18px;
          padding: 20px;
          display: grid;
          grid-template-columns: 1fr 1fr 1fr 160px;
          gap: 18px;
          align-items: end;
          margin-bottom: 24px;
          box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
        }

        .filtersCard select {
          height: 48px;
          border: 1px solid #d6dee8;
          border-radius: 12px;
          padding: 0 12px;
          background: white;
          font-weight: 800;
          color: #0f172a;
          width: 100%;
          outline: none;
        }

        .filterBtn {
          height: 48px;
          border: none;
          border-radius: 12px;
          background: #e2f7f6;
          color: ${TEAL};
          font-weight: 900;
          cursor: pointer;
        }

        .tableCard {
          background: white;
          border: 1px solid #dfe7ef;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 10px 22px rgba(15, 23, 42, 0.04);
        }

        .tableHead,
        .tableRow {
          display: grid;
          grid-template-columns: 2.1fr 1.3fr 1fr 0.8fr 0.9fr 1.7fr;
          align-items: center;
          gap: 14px;
          padding: 20px 28px;
        }

        .tableHead {
          background: #edf4ff;
          color: #0f172a;
          font-weight: 900;
        }

        .tableRow {
          border-top: 1px solid #edf2f7;
          min-height: 86px;
        }

        .doctorCell {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .doctorCell img {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid #d9f5f2;
        }

        .doctorCell strong {
          display: block;
          font-size: 15px;
          color: #0f172a;
          font-weight: 900;
        }

        .doctorCell small {
          color: #64748b;
          font-weight: 700;
          margin-top: 4px;
          display: block;
        }

        .textCell {
          color: #0f172a;
          font-weight: 800;
        }

        .rating {
          color: #f59e0b;
          font-weight: 900;
        }

        .pill {
          padding: 8px 16px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
        }

        .active {
          background: #dcfce7;
          color: #166534;
          border: 1px solid #86efac;
        }

        .inactive {
          background: #fee2e2;
          color: #991b1b;
          border: 1px solid #fecaca;
        }

        .actions {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .actions button {
          border: none;
          border-radius: 10px;
          padding: 10px 13px;
          font-weight: 900;
          cursor: pointer;
        }

        .softInfo {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .softApprove {
          background: #dcfce7;
          color: #166534;
        }

        .softWarn {
          background: #fff7ed;
          color: #c2410c;
        }

        .softDanger {
          background: #fee2e2;
          color: #b91c1c;
        }

        @media (max-width: 1100px) {
          .statsGrid,
          .filtersCard {
            grid-template-columns: 1fr 1fr;
          }

          .tableHead {
            display: none;
          }

          .tableRow {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 700px) {
          .statsGrid,
          .filtersCard {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

function normalizeDoctor(id, user = {}) {
  const photo =
    user.photoUrl ||
    user.image ||
    user.avatar ||
    'https://i.pravatar.cc/150?img=12';

  const expRaw = user.experience || user.yearsOfExperience || user.experienceYears || 0;
  const expNum = Number(String(expRaw).replace(/[^\d]/g, '')) || 0;

  return {
    id,
    name: user.name || user.fullName || 'طبيب غير معروف',
    phone: String(user.phone || ''),
    email: String(user.email || ''),
    specialization: user.specialization || user.speciality || 'غير محدد',
    experience: expNum ? `${expNum} ${expNum > 10 ? 'عامًا' : 'سنوات'}` : 'غير محدد',
    experienceNumber: expNum,
    rating: Number(user.rating || 0).toFixed(1),
    isApproved: user.isApproved === true,
    photoUrl: photo,
    code: user.code || user.doctorCode || `DOC-${id.slice(0, 6).toUpperCase()}`,
  };
}

const Topbar = ({ search, onSearch, placeholder }) => (
  <div className="topbar">
    <div className="search">
      <span>⌕</span>
      <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder} />
    </div>

    <style>{`
      .topbar {
        height: 72px;
        border-bottom: 1px solid #dfe7ef;
        display: flex;
        align-items: center;
        justify-content: flex-end;
      }

      .search {
        width: min(560px, 100%);
        height: 46px;
        background: white;
        border: 1px solid #cfd8e3;
        border-radius: 16px;
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

const StatCard = ({ title, value, icon, hint }) => (
  <div className="stat">
    <div>
      <p>{title}</p>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
    <span>{icon}</span>

    <style>{`
      .stat {
        background: white;
        min-height: 128px;
        border: 1px solid #dfe7ef;
        border-radius: 18px;
        padding: 24px;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        overflow: hidden;
        position: relative;
        box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
      }

      .stat p {
        margin: 0 0 12px;
        color: #1e293b;
        font-weight: 800;
      }

      .stat strong {
        display: inline-block;
        color: #082f3a;
        font-size: 36px;
        font-weight: 900;
      }

      .stat small {
        margin-right: 10px;
        color: ${TEAL};
        font-weight: 900;
      }

      .stat span {
        font-size: 78px;
        opacity: 0.06;
        position: absolute;
        left: 14px;
        bottom: -14px;
      }
    `}</style>
  </div>
);

const FilterBox = ({ title, children }) => (
  <div className="filterBox">
    <label>{title}</label>
    {children}

    <style>{`
      .filterBox label {
        display: block;
        color: #334155;
        font-weight: 900;
        margin-bottom: 8px;
      }
    `}</style>
  </div>
);

const DoctorModal = ({ doctor, appointments, onClose }) => {
  const confirmed = appointments.filter((a) => a.status === 'confirmed');
  const pending = appointments.filter((a) => a.status === 'pending');
  const cancelled = appointments.filter((a) => a.status === 'cancelled');

  const walletRevenue = confirmed
    .filter((a) => {
      const method = String(a.paymentMethod || a.paymentType || '').toLowerCase();
      return method.includes('wallet') || method.includes('محفظ');
    })
    .reduce((s, a) => s + Number(a.price || a.appointmentPrice || 0), 0);

  const totalRevenue = confirmed.reduce(
    (s, a) => s + Number(a.price || a.appointmentPrice || 0),
    0
  );

  return (
    <div className="overlay">
      <div className="modal">
        <div className="modalHeader">
          <div className="doctorInfo">
            <img src={doctor.photoUrl} alt="" />
            <div>
              <h2>{doctor.name}</h2>
              <p>{doctor.specialization}</p>
            </div>
          </div>

          <button onClick={onClose}>✕</button>
        </div>

        <div className="modalStats">
          <div className="box">
            <span>إجمالي الحجوزات</span>
            <strong>{appointments.length}</strong>
          </div>

          <div className="box">
            <span>الحجوزات المؤكدة</span>
            <strong>{confirmed.length}</strong>
          </div>

          <div className="box">
            <span>الحجوزات المعلقة</span>
            <strong>{pending.length}</strong>
          </div>

          <div className="box">
            <span>الحجوزات الملغية</span>
            <strong>{cancelled.length}</strong>
          </div>

          <div className="box">
            <span>رصيد المحفظة</span>
            <strong>{walletRevenue.toLocaleString()} ج</strong>
          </div>

          <div className="box">
            <span>إجمالي الإيرادات</span>
            <strong>{totalRevenue.toLocaleString()} ج</strong>
          </div>
        </div>

        <div className="appointmentsTable">
          <div className="modalHead">
            <span>المريض</span>
            <span>التاريخ</span>
            <span>الوقت</span>
            <span>السعر</span>
            <span>الدفع</span>
            <span>الحالة</span>
          </div>

          {appointments.length === 0 ? (
            <div className="modalEmpty">لا توجد حجوزات لهذا الطبيب</div>
          ) : (
            appointments.map((a) => {
              const status = a.status || 'pending';
              const method = a.paymentMethod || a.paymentType || '-';

              return (
                <div className="modalRow" key={a.appointmentId}>
                  <span>{a.patientName || 'مريض'}</span>
                  <span>{a.date || '-'}</span>
                  <span>{a.time || a.slot || '-'}</span>
                  <span>{Number(a.price || a.appointmentPrice || 0).toLocaleString()} ج</span>
                  <span>{method}</span>
                  <span className={`modalStatus ${status}`}>
                    {status === 'confirmed'
                      ? 'مؤكد'
                      : status === 'pending'
                      ? 'قيد المراجعة'
                      : 'ملغي'}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <style>{`
        .overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.7);
          display: grid;
          place-items: center;
          z-index: 9999;
          padding: 20px;
        }

        .modal {
          width: min(1120px, 100%);
          background: white;
          border-radius: 24px;
          padding: 28px;
          max-height: 90vh;
          overflow: auto;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.22);
        }

        .modalHeader {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 28px;
        }

        .doctorInfo {
          display: flex;
          align-items: center;
          gap: 18px;
        }

        .doctorInfo img {
          width: 90px;
          height: 90px;
          border-radius: 50%;
          object-fit: cover;
          border: 4px solid #d9f5f2;
        }

        .doctorInfo h2 {
          margin: 0 0 8px;
          color: #082f3a;
          font-size: 26px;
          font-weight: 900;
        }

        .doctorInfo p {
          margin: 0;
          color: #64748b;
          font-weight: 800;
        }

        .modalHeader button {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          border: none;
          background: #fee2e2;
          color: #b91c1c;
          font-size: 22px;
          cursor: pointer;
        }

        .modalStats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
          margin-bottom: 28px;
        }

        .box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          padding: 22px;
        }

        .box span {
          display: block;
          margin-bottom: 10px;
          color: #64748b;
          font-weight: 800;
        }

        .box strong {
          font-size: 28px;
          color: #082f3a;
          font-weight: 900;
        }

        .appointmentsTable {
          border: 1px solid #e2e8f0;
          border-radius: 18px;
          overflow: hidden;
        }

        .modalHead,
        .modalRow {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr 1fr 1fr 1fr;
          gap: 14px;
          padding: 18px 22px;
          align-items: center;
        }

        .modalHead {
          background: #eff6ff;
          font-weight: 900;
        }

        .modalRow {
          border-top: 1px solid #edf2f7;
          font-weight: 800;
        }

        .modalStatus {
          width: fit-content;
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
        }

        .modalStatus.confirmed {
          background: #dcfce7;
          color: #166534;
        }

        .modalStatus.pending {
          background: #fef3c7;
          color: #92400e;
        }

        .modalStatus.cancelled {
          background: #fee2e2;
          color: #991b1b;
        }

        .modalEmpty {
          padding: 40px;
          text-align: center;
          color: #64748b;
          font-weight: 900;
        }

        @media (max-width: 900px) {
          .modalStats {
            grid-template-columns: 1fr;
          }

          .modalHead {
            display: none;
          }

          .modalRow {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

const EmptyState = () => (
  <div className="empty">
    <h3>لا توجد بيانات</h3>
    <p>جرّب تغيير الفلاتر أو البحث.</p>

    <style>{`
      .empty {
        padding: 70px;
        text-align: center;
        color: #64748b;
      }

      .empty h3 {
        color: #0f172a;
        font-size: 24px;
      }
    `}</style>
  </div>
);

const Loader = () => (
  <div className="loader">
    <div className="spinner"></div>

    <style>{`
      .loader {
        height: 80vh;
        display: grid;
        place-items: center;
      }

      .spinner {
        width: 54px;
        height: 54px;
        border-radius: 50%;
        border: 5px solid #dbe4ea;
        border-top-color: ${TEAL};
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

export default Doctors;