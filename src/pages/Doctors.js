import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import {
  ref,
  onValue,
  update,
  remove,
  query,
  orderByChild,
  equalTo,
} from 'firebase/database';

const TEAL = '#00796b';
const BG = '#f5f7fb';

function Doctors() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [bookingFilter, setBookingFilter] = useState('all');
  const [specializationFilter, setSpecializationFilter] = useState('all');
  const [experienceFilter, setExperienceFilter] = useState('all');

  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [doctorAppointments, setDoctorAppointments] = useState([]);
  const [profileLoading, setProfileLoading] = useState(false);

  const [updatingDoctorId, setUpdatingDoctorId] = useState(null);

  // =========================================================
  // Load doctors only
  // =========================================================
  useEffect(() => {
    const doctorsQuery = query(
      ref(db, 'users'),
      orderByChild('role'),
      equalTo('doctor')
    );

    const unsubscribe = onValue(
      doctorsQuery,
      (snapshot) => {
        if (!snapshot.exists()) {
          setDoctors([]);
          setLoading(false);
          return;
        }

        const data = snapshot.val();

        const list = Object.entries(data).map(([id, user]) =>
          normalizeDoctor(id, user)
        );

        setDoctors(list);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading doctors:', error);
        setDoctors([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // =========================================================
  // Approve / disable doctor account
  // =========================================================
  const toggleApproval = async (id, currentStatus) => {
    try {
      setUpdatingDoctorId(id);

      await update(ref(db, `users/${id}`), {
        isApproved: !currentStatus,
        rejected: false,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء تحديث حالة الطبيب');
    } finally {
      setUpdatingDoctorId(null);
    }
  };

  // =========================================================
  // Enable / disable BOOKING only
  // Doctor stays visible in the app
  // =========================================================
  const toggleBooking = async (doctor) => {
    const currentlyEnabled = doctor.bookingEnabled !== false;
    const nextValue = !currentlyEnabled;

    try {
      setUpdatingDoctorId(doctor.id);

      await update(ref(db, `users/${doctor.id}`), {
        bookingEnabled: nextValue,
        bookingStatusUpdatedAt: Date.now(),
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء تحديث حالة الحجز');
    } finally {
      setUpdatingDoctorId(null);
    }
  };

  // =========================================================
  // Delete doctor
  // =========================================================
  const deleteDoctor = async (id) => {
    const ok = window.confirm('هل أنت متأكد من حذف هذا الطبيب؟');

    if (!ok) return;

    try {
      setUpdatingDoctorId(id);

      await remove(ref(db, `users/${id}`));

      alert('تم حذف الطبيب بنجاح');
    } catch (error) {
      console.error(error);
      alert('حدث خطأ أثناء حذف الطبيب');
    } finally {
      setUpdatingDoctorId(null);
    }
  };

  // =========================================================
  // Doctor profile / appointments
  //
  // ملاحظة:
  // هيكل appointments الحالي عندك:
  // appointments / patientId / appointmentId
  //
  // لذلك لا يمكن عمل query مباشر بـ doctorId على المستوى الحالي
  // بدون تغيير هيكل قاعدة البيانات.
  // حافظنا هنا على نفس منطق المشروع الحالي حتى لا نكسر البيانات.
  // =========================================================
  const openDoctorProfile = async (doctor) => {
    try {
      setSelectedDoctor(doctor);
      setDoctorAppointments([]);
      setProfileLoading(true);

      const appointmentsRef = ref(db, 'appointments');

      onValue(
        appointmentsRef,
        (snapshot) => {
          if (!snapshot.exists()) {
            setDoctorAppointments([]);
            setProfileLoading(false);
            return;
          }

          const data = snapshot.val();
          const list = [];

          Object.entries(data).forEach(
            ([patientId, patientAppointments]) => {
              if (
                patientAppointments &&
                typeof patientAppointments === 'object'
              ) {
                Object.entries(patientAppointments).forEach(
                  ([appointmentId, app]) => {
                    if (app && app.doctorId === doctor.id) {
                      list.push({
                        appointmentId,
                        patientId,
                        ...app,
                      });
                    }
                  }
                );
              }
            }
          );

          list.sort(
            (a, b) =>
              Number(b.createdAt || 0) -
              Number(a.createdAt || 0)
          );

          setDoctorAppointments(list);
          setProfileLoading(false);
        },
        {
          onlyOnce: true,
        }
      );
    } catch (error) {
      console.error(error);
      setDoctorAppointments([]);
      setProfileLoading(false);
    }
  };

  // =========================================================
  // Filters
  // =========================================================
  const filteredDoctors = useMemo(() => {
    const q = search.trim().toLowerCase();

    return doctors.filter((doc) => {
      const matchesSearch =
        !q ||
        doc.name.toLowerCase().includes(q) ||
        doc.phone.toLowerCase().includes(q) ||
        doc.email.toLowerCase().includes(q) ||
        doc.specialization.toLowerCase().includes(q) ||
        doc.code.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'approved'
          ? doc.isApproved === true
          : doc.isApproved !== true;

      const matchesBooking =
        bookingFilter === 'all'
          ? true
          : bookingFilter === 'enabled'
          ? doc.bookingEnabled === true
          : doc.bookingEnabled === false;

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
          ? doc.experienceNumber >= 5 &&
            doc.experienceNumber <= 10
          : doc.experienceNumber > 10;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesBooking &&
        matchesSpecialization &&
        matchesExperience
      );
    });
  }, [
    doctors,
    search,
    statusFilter,
    bookingFilter,
    specializationFilter,
    experienceFilter,
  ]);

  const specializations = useMemo(
    () => [
      ...new Set(
        doctors
          .map((doctor) => doctor.specialization)
          .filter(Boolean)
      ),
    ],
    [doctors]
  );

  // =========================================================
  // Stats
  // =========================================================
  const stats = useMemo(() => {
    const total = doctors.length;

    const active = doctors.filter(
      (doctor) => doctor.isApproved === true
    ).length;

    const pending = doctors.filter(
      (doctor) => doctor.isApproved !== true
    ).length;

    const bookingPaused = doctors.filter(
      (doctor) => doctor.bookingEnabled === false
    ).length;

    const rating =
      total === 0
        ? '0.0'
        : (
            doctors.reduce(
              (sum, doctor) =>
                sum + Number(doctor.rating || 0),
              0
            ) / total
          ).toFixed(1);

    return {
      total,
      active,
      pending,
      bookingPaused,
      rating,
    };
  }, [doctors]);

  const resetFilters = () => {
    setStatusFilter('all');
    setBookingFilter('all');
    setSpecializationFilter('all');
    setExperienceFilter('all');
    setSearch('');
  };

  if (loading) {
    return <Loader />;
  }

  return (
    <div className="doctorsPage" dir="rtl">
      <Topbar
        search={search}
        onSearch={setSearch}
        placeholder="بحث عن طبيب، تخصص، هاتف أو رقم معرف..."
      />

      {/* ================= HERO ================= */}

      <section className="hero">
        <div>
          <h1>إدارة الأطباء</h1>

          <p>
            إدارة وتتبع الكادر الطبي والتحكم في إتاحة
            الحجوزات.
          </p>
        </div>
      </section>

      {/* ================= STATS ================= */}

      <section className="statsGrid">
        <StatCard
          title="إجمالي الأطباء"
          value={stats.total}
          icon="☤"
          hint="كل الأطباء"
        />

        <StatCard
          title="أطباء نشطون"
          value={stats.active}
          icon="◇"
          hint="معتمد"
        />

        <StatCard
          title="بانتظار الموافقة"
          value={stats.pending}
          icon="!"
          hint="مراجعة"
        />

        <StatCard
          title="الحجز متوقف"
          value={stats.bookingPaused}
          icon="⏸"
          hint="ظاهرون بالتطبيق"
          warning={stats.bookingPaused > 0}
        />

        <StatCard
          title="متوسط التقييم"
          value={stats.rating}
          icon="☆"
          hint="عام"
        />
      </section>

      {/* ================= FILTERS ================= */}

      <section className="filtersCard">
        <FilterBox title="التخصص">
          <select
            value={specializationFilter}
            onChange={(e) =>
              setSpecializationFilter(e.target.value)
            }
          >
            <option value="all">الكل</option>

            {specializations.map((spec) => (
              <option key={spec} value={spec}>
                {spec}
              </option>
            ))}
          </select>
        </FilterBox>

        <FilterBox title="حالة الطبيب">
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value)
            }
          >
            <option value="all">الكل</option>
            <option value="approved">نشط</option>
            <option value="pending">غير نشط</option>
          </select>
        </FilterBox>

        <FilterBox title="حالة الحجز">
          <select
            value={bookingFilter}
            onChange={(e) =>
              setBookingFilter(e.target.value)
            }
          >
            <option value="all">الكل</option>
            <option value="enabled">
              متاح للحجز
            </option>
            <option value="disabled">
              غير متاح للحجز
            </option>
          </select>
        </FilterBox>

        <FilterBox title="الخبرة">
          <select
            value={experienceFilter}
            onChange={(e) =>
              setExperienceFilter(e.target.value)
            }
          >
            <option value="all">الكل</option>
            <option value="less5">
              أقل من 5 سنوات
            </option>
            <option value="5to10">
              من 5 إلى 10 سنوات
            </option>
            <option value="more10">
              أكثر من 10 سنوات
            </option>
          </select>
        </FilterBox>

        <button
          className="filterBtn"
          onClick={resetFilters}
        >
          إعادة ضبط
        </button>
      </section>

      {/* ================= TABLE ================= */}

      <section className="tableCard">
        <div className="tableTop">
          <div>
            <strong>قائمة الأطباء</strong>

            <small>
              {filteredDoctors.length} طبيب
            </small>
          </div>
        </div>

        <div className="tableScroll">
          <div className="tableHead">
            <span>الطبيب</span>
            <span>التخصص</span>
            <span>الخبرة</span>
            <span>التقييم</span>
            <span>الحالة</span>
            <span>الحجز</span>
            <span>الإجراءات</span>
          </div>

          {filteredDoctors.length === 0 ? (
            <EmptyState />
          ) : (
            filteredDoctors.map((doctor) => {
              const updating =
                updatingDoctorId === doctor.id;

              return (
                <div
                  className="tableRow"
                  key={doctor.id}
                >
                  {/* Doctor */}

                  <div className="doctorCell">
                    <img
                      src={doctor.photoUrl}
                      alt={doctor.name}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.src =
                          'https://i.pravatar.cc/150?img=12';
                      }}
                    />

                    <div>
                      <strong>{doctor.name}</strong>
                      <small>{doctor.code}</small>
                    </div>
                  </div>

                  {/* Specialization */}

                  <div className="textCell">
                    {doctor.specialization}
                  </div>

                  {/* Experience */}

                  <div className="textCell">
                    {doctor.experience}
                  </div>

                  {/* Rating */}

                  <div className="rating">
                    ☆ {doctor.rating}
                  </div>

                  {/* Account status */}

                  <div>
                    <span
                      className={
                        doctor.isApproved
                          ? 'pill active'
                          : 'pill inactive'
                      }
                    >
                      {doctor.isApproved
                        ? 'نشط'
                        : 'غير نشط'}
                    </span>
                  </div>

                  {/* Booking status */}

                  <div>
                    <span
                      className={
                        doctor.bookingEnabled
                          ? 'pill bookingActive'
                          : 'pill bookingPaused'
                      }
                    >
                      <span className="statusDot" />

                      {doctor.bookingEnabled
                        ? 'متاح للحجز'
                        : 'غير متاح'}
                    </span>
                  </div>

                  {/* Actions */}

                  <div className="actions">
                    <button
                      className="softInfo"
                      onClick={() =>
                        openDoctorProfile(doctor)
                      }
                      disabled={updating}
                    >
                      الملف
                    </button>

                    <button
                      className={
                        doctor.bookingEnabled
                          ? 'softPause'
                          : 'softResume'
                      }
                      onClick={() =>
                        toggleBooking(doctor)
                      }
                      disabled={updating}
                      title={
                        doctor.bookingEnabled
                          ? 'سيظل الطبيب ظاهرًا في التطبيق ولكن سيتم إيقاف الحجز'
                          : 'إعادة تفعيل الحجز للطبيب'
                      }
                    >
                      {updating
                        ? 'جارٍ...'
                        : doctor.bookingEnabled
                        ? 'إيقاف الحجز'
                        : 'تفعيل الحجز'}
                    </button>

                    <button
                      className={
                        doctor.isApproved
                          ? 'softWarn'
                          : 'softApprove'
                      }
                      onClick={() =>
                        toggleApproval(
                          doctor.id,
                          doctor.isApproved
                        )
                      }
                      disabled={updating}
                    >
                      {doctor.isApproved
                        ? 'إلغاء'
                        : 'اعتماد'}
                    </button>

                    <button
                      className="softDanger"
                      onClick={() =>
                        deleteDoctor(doctor.id)
                      }
                      disabled={updating}
                    >
                      حذف
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* ================= MODAL ================= */}

      {selectedDoctor && (
        <DoctorModal
          doctor={selectedDoctor}
          appointments={doctorAppointments}
          loading={profileLoading}
          onClose={() => {
            setSelectedDoctor(null);
            setDoctorAppointments([]);
          }}
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

        /* ================= STATS ================= */

        .statsGrid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 18px;
          margin-bottom: 28px;
        }

        /* ================= FILTERS ================= */

        .filtersCard {
          background: white;
          border: 1px solid #dfe7ef;
          border-radius: 18px;
          padding: 20px;

          display: grid;
          grid-template-columns:
            1.2fr
            1fr
            1fr
            1fr
            130px;

          gap: 14px;
          align-items: end;

          margin-bottom: 24px;

          box-shadow:
            0 5px 16px
            rgba(15, 23, 42, 0.035);
        }

        .filtersCard select {
          height: 48px;

          border:
            1px solid
            #d6dee8;

          border-radius: 12px;

          padding:
            0
            12px;

          background:
            white;

          font-weight:
            800;

          color:
            #0f172a;

          width:
            100%;

          outline:
            none;

          cursor:
            pointer;
        }

        .filtersCard select:focus {
          border-color:
            ${TEAL};

          box-shadow:
            0
            0
            0
            3px
            rgba(
              0,
              121,
              107,
              0.08
            );
        }

        .filterBtn {
          height: 48px;

          border:
            none;

          border-radius:
            12px;

          background:
            #e2f7f6;

          color:
            ${TEAL};

          font-weight:
            900;

          cursor:
            pointer;

          transition:
            0.2s;
        }

        .filterBtn:hover {
          background:
            #d3f1ef;
        }

        /* ================= TABLE ================= */

        .tableCard {
          background:
            white;

          border:
            1px solid
            #dfe7ef;

          border-radius:
            20px;

          overflow:
            hidden;

          box-shadow:
            0
            5px
            16px
            rgba(
              15,
              23,
              42,
              0.035
            );
        }

        .tableTop {
          min-height:
            68px;

          padding:
            0
            24px;

          display:
            flex;

          align-items:
            center;

          justify-content:
            space-between;

          border-bottom:
            1px solid
            #edf2f7;
        }

        .tableTop > div {
          display:
            flex;

          align-items:
            center;

          gap:
            12px;
        }

        .tableTop strong {
          color:
            #0f172a;

          font-size:
            16px;

          font-weight:
            900;
        }

        .tableTop small {
          padding:
            5px
            10px;

          border-radius:
            999px;

          background:
            #f1f5f9;

          color:
            #64748b;

          font-weight:
            800;
        }

        .tableScroll {
          width:
            100%;

          overflow-x:
            auto;
        }

        .tableHead,
        .tableRow {
          display:
            grid;

          grid-template-columns:
            minmax(190px, 2fr)
            minmax(120px, 1.1fr)
            minmax(90px, 0.8fr)
            minmax(75px, 0.7fr)
            minmax(100px, 0.9fr)
            minmax(125px, 1.1fr)
            minmax(310px, 2.4fr);

          align-items:
            center;

          gap:
            12px;

          padding:
            18px
            24px;

          min-width:
            1250px;
        }

        .tableHead {
          background:
            #edf4ff;

          color:
            #0f172a;

          font-weight:
            900;

          font-size:
            13px;
        }

        .tableRow {
          border-top:
            1px solid
            #edf2f7;

          min-height:
            82px;

          transition:
            background
            0.18s
            ease;
        }

        .tableRow:hover {
          background:
            #fbfdfd;
        }

        /* ================= DOCTOR ================= */

        .doctorCell {
          display:
            flex;

          align-items:
            center;

          gap:
            12px;

          min-width:
            0;
        }

        .doctorCell img {
          width:
            50px;

          height:
            50px;

          flex:
            0
            0
            50px;

          border-radius:
            50%;

          object-fit:
            cover;

          border:
            2px
            solid
            #d9f5f2;

          background:
            #f1f5f9;
        }

        .doctorCell strong {
          display:
            block;

          font-size:
            14px;

          color:
            #0f172a;

          font-weight:
            900;

          overflow:
            hidden;

          text-overflow:
            ellipsis;

          white-space:
            nowrap;
        }

        .doctorCell small {
          color:
            #64748b;

          font-weight:
            700;

          margin-top:
            4px;

          display:
            block;

          font-size:
            11px;
        }

        .textCell {
          color:
            #0f172a;

          font-weight:
            800;

          font-size:
            13px;
        }

        .rating {
          color:
            #f59e0b;

          font-weight:
            900;
        }

        /* ================= PILLS ================= */

        .pill {
          display:
            inline-flex;

          align-items:
            center;

          justify-content:
            center;

          gap:
            6px;

          min-height:
            32px;

          padding:
            6px
            12px;

          border-radius:
            999px;

          font-size:
            11px;

          font-weight:
            900;

          white-space:
            nowrap;
        }

        .active {
          background:
            #dcfce7;

          color:
            #166534;

          border:
            1px solid
            #86efac;
        }

        .inactive {
          background:
            #fee2e2;

          color:
            #991b1b;

          border:
            1px solid
            #fecaca;
        }

        .bookingActive {
          background:
            #ecfdf5;

          color:
            #047857;

          border:
            1px solid
            #a7f3d0;
        }

        .bookingPaused {
          background:
            #fff7ed;

          color:
            #c2410c;

          border:
            1px solid
            #fed7aa;
        }

        .statusDot {
          width:
            7px;

          height:
            7px;

          border-radius:
            50%;

          background:
            currentColor;
        }

        /* ================= ACTIONS ================= */

        .actions {
          display:
            flex;

          align-items:
            center;

          gap:
            6px;

          flex-wrap:
            nowrap;
        }

        .actions button {
          border:
            none;

          border-radius:
            9px;

          padding:
            9px
            11px;

          font-size:
            11px;

          font-weight:
            900;

          cursor:
            pointer;

          white-space:
            nowrap;

          transition:
            transform
            0.15s
            ease,
            opacity
            0.15s
            ease;
        }

        .actions button:hover:not(:disabled) {
          transform:
            translateY(-1px);
        }

        .actions button:disabled {
          opacity:
            0.55;

          cursor:
            not-allowed;
        }

        .softInfo {
          background:
            #dbeafe;

          color:
            #1d4ed8;
        }

        .softApprove {
          background:
            #dcfce7;

          color:
            #166534;
        }

        .softWarn {
          background:
            #f1f5f9;

          color:
            #475569;
        }

        .softPause {
          background:
            #fff7ed;

          color:
            #c2410c;

          border:
            1px solid
            #fed7aa !important;
        }

        .softResume {
          background:
            #ecfdf5;

          color:
            #047857;

          border:
            1px solid
            #a7f3d0 !important;
        }

        .softDanger {
          background:
            #fee2e2;

          color:
            #b91c1c;
        }

        /* ================= RESPONSIVE ================= */

        @media (max-width: 1250px) {
          .statsGrid {
            grid-template-columns:
              repeat(
                3,
                minmax(
                  0,
                  1fr
                )
              );
          }

          .filtersCard {
            grid-template-columns:
              repeat(
                2,
                minmax(
                  0,
                  1fr
                )
              );
          }
        }

        @media (max-width: 700px) {
          .hero {
            margin:
              24px
              0
              20px;
          }

          .hero h1 {
            font-size:
              25px;
          }

          .statsGrid {
            grid-template-columns:
              1fr
              1fr;

            gap:
              10px;
          }

          .filtersCard {
            grid-template-columns:
              1fr;
          }

          .tableTop {
            padding:
              0
              16px;
          }
        }

        @media (max-width: 480px) {
          .statsGrid {
            grid-template-columns:
              1fr;
          }
        }
      `}</style>
    </div>
  );
}

// =========================================================
// Normalize Doctor
// =========================================================

function normalizeDoctor(id, user = {}) {
  const photo =
    user.photoUrl ||
    user.image ||
    user.avatar ||
    'https://i.pravatar.cc/150?img=12';

  const expRaw =
    user.experience ||
    user.yearsOfExperience ||
    user.experienceYears ||
    0;

  const expNum =
    Number(
      String(expRaw).replace(/[^\d]/g, '')
    ) || 0;

  return {
    id,

    name:
      user.name ||
      user.fullName ||
      'طبيب غير معروف',

    phone:
      String(
        user.phone ||
        ''
      ),

    email:
      String(
        user.email ||
        ''
      ),

    specialization:
      user.specialization ||
      user.speciality ||
      'غير محدد',

    experience:
      expNum
        ? `${expNum} ${
            expNum > 10
              ? 'عامًا'
              : 'سنوات'
          }`
        : 'غير محدد',

    experienceNumber:
      expNum,

    rating:
      Number(
        user.rating ||
        0
      ).toFixed(1),

    isApproved:
      user.isApproved === true,

    /*
      مهم:
      الأطباء القدامى لن يكون عندهم bookingEnabled.
      لذلك أي قيمة غير false = الحجز متاح.
    */
    bookingEnabled:
      user.bookingEnabled !== false,

    photoUrl:
      photo,

    code:
      user.code ||
      user.doctorCode ||
      `DOC-${id
        .slice(0, 6)
        .toUpperCase()}`,
  };
}

// =========================================================
// Topbar
// =========================================================

const Topbar = ({
  search,
  onSearch,
  placeholder,
}) => (
  <div className="topbar">
    <div className="search">
      <span>⌕</span>

      <input
        value={search}
        onChange={(e) =>
          onSearch(
            e.target.value
          )
        }
        placeholder={placeholder}
      />
    </div>

    <style>{`
      .topbar {
        height:
          72px;

        border-bottom:
          1px solid
          #dfe7ef;

        display:
          flex;

        align-items:
          center;

        justify-content:
          flex-end;
      }

      .search {
        width:
          min(
            560px,
            100%
          );

        height:
          46px;

        background:
          white;

        border:
          1px solid
          #cfd8e3;

        border-radius:
          16px;

        display:
          flex;

        align-items:
          center;

        gap:
          8px;

        padding:
          0
          16px;
      }

      .search span {
        color:
          #64748b;

        font-size:
          22px;
      }

      .search input {
        border:
          none;

        outline:
          none;

        flex:
          1;

        font-size:
          14px;

        background:
          transparent;

        text-align:
          right;

        min-width:
          0;
      }
    `}</style>
  </div>
);

// =========================================================
// Stat Card
// =========================================================

const StatCard = ({
  title,
  value,
  icon,
  hint,
  warning = false,
}) => (
  <div
    className={`stat ${
      warning
        ? 'statWarning'
        : ''
    }`}
  >
    <div>
      <p>{title}</p>

      <strong>
        {value}
      </strong>

      <small>
        {hint}
      </small>
    </div>

    <span className="statIcon">
      {icon}
    </span>

    <style>{`
      .stat {
        background:
          white;

        min-height:
          122px;

        border:
          1px solid
          #dfe7ef;

        border-radius:
          18px;

        padding:
          22px;

        display:
          flex;

        justify-content:
          space-between;

        align-items:
          flex-end;

        overflow:
          hidden;

        position:
          relative;

        box-shadow:
          0
          5px
          16px
          rgba(
            15,
            23,
            42,
            0.035
          );
      }

      .statWarning {
        border-color:
          #fed7aa;
      }

      .stat p {
        margin:
          0
          0
          10px;

        color:
          #1e293b;

        font-weight:
          800;

        font-size:
          13px;
      }

      .stat strong {
        display:
          inline-block;

        color:
          #082f3a;

        font-size:
          32px;

        font-weight:
          900;
      }

      .stat small {
        margin-right:
          8px;

        color:
          ${TEAL};

        font-weight:
          900;

        font-size:
          11px;
      }

      .statIcon {
        font-size:
          68px;

        opacity:
          0.055;

        position:
          absolute;

        left:
          12px;

        bottom:
          -12px;
      }
    `}</style>
  </div>
);

// =========================================================
// Filter Box
// =========================================================

const FilterBox = ({
  title,
  children,
}) => (
  <div className="filterBox">
    <label>
      {title}
    </label>

    {children}

    <style>{`
      .filterBox label {
        display:
          block;

        color:
          #334155;

        font-weight:
          900;

        margin-bottom:
          8px;

        font-size:
          12px;
      }
    `}</style>
  </div>
);

// =========================================================
// Doctor Modal
// =========================================================

const DoctorModal = ({
  doctor,
  appointments,
  loading,
  onClose,
}) => {
  const confirmed =
    appointments.filter(
      (appointment) =>
        appointment.status ===
        'confirmed'
    );

  const pending =
    appointments.filter(
      (appointment) =>
        appointment.status ===
        'pending'
    );

  const cancelled =
    appointments.filter(
      (appointment) =>
        appointment.status ===
        'cancelled'
    );

  const walletRevenue =
    confirmed
      .filter(
        (appointment) => {
          const method =
            String(
              appointment.paymentMethod ||
              appointment.paymentType ||
              ''
            ).toLowerCase();

          return (
            method.includes(
              'wallet'
            ) ||
            method.includes(
              'محفظ'
            )
          );
        }
      )
      .reduce(
        (
          total,
          appointment
        ) =>
          total +
          Number(
            appointment.price ||
            appointment.appointmentPrice ||
            0
          ),
        0
      );

  const totalRevenue =
    confirmed.reduce(
      (
        total,
        appointment
      ) =>
        total +
        Number(
          appointment.price ||
          appointment.appointmentPrice ||
          0
        ),
      0
    );

  return (
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (
          e.target ===
          e.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="modal">
        {/* HEADER */}

        <div className="modalHeader">
          <div className="doctorInfo">
            <img
              src={doctor.photoUrl}
              alt={doctor.name}
            />

            <div>
              <h2>
                {doctor.name}
              </h2>

              <p>
                {
                  doctor.specialization
                }
              </p>

              <div className="modalBadges">
                <span
                  className={
                    doctor.isApproved
                      ? 'modalApproved'
                      : 'modalInactive'
                  }
                >
                  {doctor.isApproved
                    ? 'طبيب معتمد'
                    : 'غير معتمد'}
                </span>

                <span
                  className={
                    doctor.bookingEnabled
                      ? 'modalBookingOn'
                      : 'modalBookingOff'
                  }
                >
                  {doctor.bookingEnabled
                    ? 'متاح للحجز'
                    : 'الحجز متوقف'}
                </span>
              </div>
            </div>
          </div>

          <button
            className="closeModal"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="profileLoader">
            <div className="smallSpinner" />

            <span>
              جاري تحميل بيانات
              الطبيب...
            </span>
          </div>
        ) : (
          <>
            {/* STATS */}

            <div className="modalStats">
              <div className="box">
                <span>
                  إجمالي الحجوزات
                </span>

                <strong>
                  {
                    appointments.length
                  }
                </strong>
              </div>

              <div className="box">
                <span>
                  الحجوزات المؤكدة
                </span>

                <strong>
                  {
                    confirmed.length
                  }
                </strong>
              </div>

              <div className="box">
                <span>
                  الحجوزات المعلقة
                </span>

                <strong>
                  {pending.length}
                </strong>
              </div>

              <div className="box">
                <span>
                  الحجوزات الملغية
                </span>

                <strong>
                  {
                    cancelled.length
                  }
                </strong>
              </div>

              <div className="box">
                <span>
                  رصيد المحفظة
                </span>

                <strong>
                  {walletRevenue.toLocaleString()}
                  {' '}
                  ج
                </strong>
              </div>

              <div className="box">
                <span>
                  إجمالي الإيرادات
                </span>

                <strong>
                  {totalRevenue.toLocaleString()}
                  {' '}
                  ج
                </strong>
              </div>
            </div>

            {/* APPOINTMENTS */}

            <div className="appointmentsTable">
              <div className="modalHead">
                <span>
                  المريض
                </span>

                <span>
                  التاريخ
                </span>

                <span>
                  الوقت
                </span>

                <span>
                  السعر
                </span>

                <span>
                  الدفع
                </span>

                <span>
                  الحالة
                </span>
              </div>

              {appointments.length ===
              0 ? (
                <div className="modalEmpty">
                  لا توجد حجوزات
                  لهذا الطبيب
                </div>
              ) : (
                appointments.map(
                  (appointment) => {
                    const status =
                      appointment.status ||
                      'pending';

                    const method =
                      appointment.paymentMethod ||
                      appointment.paymentType ||
                      '-';

                    return (
                      <div
                        className="modalRow"
                        key={
                          appointment.appointmentId
                        }
                      >
                        <span>
                          {appointment.patientName ||
                            'مريض'}
                        </span>

                        <span>
                          {appointment.date ||
                            '-'}
                        </span>

                        <span>
                          {appointment.time ||
                            appointment.slot ||
                            '-'}
                        </span>

                        <span>
                          {Number(
                            appointment.price ||
                              appointment.appointmentPrice ||
                              0
                          ).toLocaleString()}
                          {' '}
                          ج
                        </span>

                        <span>
                          {method}
                        </span>

                        <span
                          className={`modalStatus ${status}`}
                        >
                          {status ===
                          'confirmed'
                            ? 'مؤكد'
                            : status ===
                              'pending'
                            ? 'قيد المراجعة'
                            : 'ملغي'}
                        </span>
                      </div>
                    );
                  }
                )
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        .overlay {
          position:
            fixed;

          inset:
            0;

          background:
            rgba(
              15,
              23,
              42,
              0.7
            );

          display:
            grid;

          place-items:
            center;

          z-index:
            9999;

          padding:
            20px;

          backdrop-filter:
            blur(
              3px
            );
        }

        .modal {
          width:
            min(
              1120px,
              100%
            );

          background:
            white;

          border-radius:
            24px;

          padding:
            28px;

          max-height:
            90vh;

          overflow:
            auto;

          box-shadow:
            0
            24px
            80px
            rgba(
              0,
              0,
              0,
              0.22
            );
        }

        .modalHeader {
          display:
            flex;

          justify-content:
            space-between;

          align-items:
            center;

          margin-bottom:
            28px;
        }

        .doctorInfo {
          display:
            flex;

          align-items:
            center;

          gap:
            18px;
        }

        .doctorInfo img {
          width:
            84px;

          height:
            84px;

          border-radius:
            50%;

          object-fit:
            cover;

          border:
            4px solid
            #d9f5f2;
        }

        .doctorInfo h2 {
          margin:
            0
            0
            7px;

          color:
            #082f3a;

          font-size:
            24px;

          font-weight:
            900;
        }

        .doctorInfo p {
          margin:
            0;

          color:
            #64748b;

          font-weight:
            800;
        }

        .modalBadges {
          display:
            flex;

          align-items:
            center;

          flex-wrap:
            wrap;

          gap:
            7px;

          margin-top:
            10px;
        }

        .modalBadges span {
          padding:
            5px
            10px;

          border-radius:
            999px;

          font-size:
            10px;

          font-weight:
            900;
        }

        .modalApproved {
          background:
            #dcfce7;

          color:
            #166534;
        }

        .modalInactive {
          background:
            #fee2e2;

          color:
            #991b1b;
        }

        .modalBookingOn {
          background:
            #ecfdf5;

          color:
            #047857;
        }

        .modalBookingOff {
          background:
            #fff7ed;

          color:
            #c2410c;
        }

        .closeModal {
          width:
            44px;

          height:
            44px;

          border-radius:
            50%;

          border:
            none;

          background:
            #fee2e2;

          color:
            #b91c1c;

          font-size:
            20px;

          cursor:
            pointer;
        }

        .profileLoader {
          min-height:
            300px;

          display:
            flex;

          flex-direction:
            column;

          align-items:
            center;

          justify-content:
            center;

          gap:
            14px;

          color:
            #64748b;

          font-weight:
            800;
        }

        .smallSpinner {
          width:
            38px;

          height:
            38px;

          border-radius:
            50%;

          border:
            4px solid
            #dbe4ea;

          border-top-color:
            ${TEAL};

          animation:
            spin
            0.8s
            linear
            infinite;
        }

        .modalStats {
          display:
            grid;

          grid-template-columns:
            repeat(
              3,
              1fr
            );

          gap:
            16px;

          margin-bottom:
            28px;
        }

        .box {
          background:
            #f8fafc;

          border:
            1px solid
            #e2e8f0;

          border-radius:
            16px;

          padding:
            20px;
        }

        .box span {
          display:
            block;

          margin-bottom:
            9px;

          color:
            #64748b;

          font-weight:
            800;

          font-size:
            12px;
        }

        .box strong {
          font-size:
            26px;

          color:
            #082f3a;

          font-weight:
            900;
        }

        .appointmentsTable {
          border:
            1px solid
            #e2e8f0;

          border-radius:
            18px;

          overflow:
            hidden;
        }

        .modalHead,
        .modalRow {
          display:
            grid;

          grid-template-columns:
            1.5fr
            1fr
            1fr
            1fr
            1fr
            1fr;

          gap:
            14px;

          padding:
            17px
            20px;

          align-items:
            center;
        }

        .modalHead {
          background:
            #eff6ff;

          font-weight:
            900;

          font-size:
            12px;
        }

        .modalRow {
          border-top:
            1px solid
            #edf2f7;

          font-weight:
            800;

          font-size:
            12px;
        }

        .modalStatus {
          width:
            fit-content;

          padding:
            7px
            12px;

          border-radius:
            999px;

          font-size:
            10px;

          font-weight:
            900;
        }

        .modalStatus.confirmed {
          background:
            #dcfce7;

          color:
            #166534;
        }

        .modalStatus.pending {
          background:
            #fef3c7;

          color:
            #92400e;
        }

        .modalStatus.cancelled {
          background:
            #fee2e2;

          color:
            #991b1b;
        }

        .modalEmpty {
          padding:
            50px;

          text-align:
            center;

          color:
            #64748b;

          font-weight:
            900;
        }

        @keyframes spin {
          to {
            transform:
              rotate(
                360deg
              );
          }
        }

        @media (max-width: 900px) {
          .modalStats {
            grid-template-columns:
              1fr
              1fr;
          }

          .modalHead {
            display:
              none;
          }

          .modalRow {
            grid-template-columns:
              1fr
              1fr;
          }
        }

        @media (max-width: 600px) {
          .modal {
            padding:
              18px;

            border-radius:
              18px;
          }

          .doctorInfo img {
            width:
              64px;

            height:
              64px;
          }

          .doctorInfo h2 {
            font-size:
              19px;
          }

          .modalStats {
            grid-template-columns:
              1fr;
          }

          .modalRow {
            grid-template-columns:
              1fr;
          }
        }
      `}</style>
    </div>
  );
};

// =========================================================
// Empty State
// =========================================================

const EmptyState = () => (
  <div className="empty">
    <h3>
      لا توجد بيانات
    </h3>

    <p>
      جرّب تغيير الفلاتر
      أو البحث.
    </p>

    <style>{`
      .empty {
        padding:
          70px;

        text-align:
          center;

        color:
          #64748b;
      }

      .empty h3 {
        color:
          #0f172a;

        font-size:
          22px;

        margin-bottom:
          8px;
      }

      .empty p {
        margin:
          0;

        font-weight:
          700;
      }
    `}</style>
  </div>
);

// =========================================================
// Loader
// =========================================================

const Loader = () => (
  <div className="loader">
    <div className="spinner" />

    <style>{`
      .loader {
        height:
          80vh;

        display:
          grid;

        place-items:
          center;
      }

      .spinner {
        width:
          54px;

        height:
          54px;

        border-radius:
          50%;

        border:
          5px solid
          #dbe4ea;

        border-top-color:
          ${TEAL};

        animation:
          spin
          0.8s
          linear
          infinite;
      }

      @keyframes spin {
        to {
          transform:
            rotate(
              360deg
            );
        }
      }
    `}</style>
  </div>
);

export default Doctors;