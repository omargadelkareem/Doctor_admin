import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { onValue, ref, update } from 'firebase/database';

const COLORS = {
  dark: '#0f766e',
  teal: '#14b8a6',
  tealSoft: '#ccfbf1',
  bg: '#f6f8fb',
  card: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  success: '#16a34a',
  danger: '#dc2626',
  warning: '#f59e0b',
};

export default function PendingDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [search, setSearch] = useState('');
  const [specializationFilter, setSpecializationFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [actionDoctor, setActionDoctor] = useState(null);
  const [actionType, setActionType] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const usersRef = ref(db, 'users');

    const unsubscribe = onValue(
      usersRef,
      (snapshot) => {
        const value = snapshot.val();

        const pending = value && typeof value === 'object'
          ? Object.entries(value)
              .filter(([, user]) => {
                if (!user || typeof user !== 'object') return false;

                const role = String(user.role || '').toLowerCase();
                const isApproved =
                  user.isApproved === true ||
                  user.approved === true ||
                  String(user.status || '').toLowerCase() === 'approved';

                const isRejected =
                  user.rejected === true ||
                  String(user.status || '').toLowerCase() === 'rejected';

                return role === 'doctor' && !isApproved && !isRejected;
              })
              .map(([id, user]) => normalizeDoctor(id, user))
          : [];

        pending.sort((a, b) => b.createdAtValue - a.createdAtValue);

        setDoctors(pending);
        setSelectedDoctor((current) => {
          if (!pending.length) return null;
          if (!current) return pending[0];

          return pending.find((doctor) => doctor.id === current.id) || pending[0];
        });
        setLoading(false);
      },
      (error) => {
        console.error('Pending doctors listener error:', error);
        setDoctors([]);
        setSelectedDoctor(null);
        setLoading(false);
        showMessage('تعذر تحميل طلبات الأطباء');
      },
    );

    return unsubscribe;
  }, []);

  const specializations = useMemo(() => {
    return [...new Set(doctors.map((doctor) => doctor.specialization))]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, 'ar'));
  }, [doctors]);

  const filteredDoctors = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = doctors.filter((doctor) => {
      if (
        specializationFilter !== 'all' &&
        doctor.specialization !== specializationFilter
      ) {
        return false;
      }

      if (!query) return true;

      return [
        doctor.name,
        doctor.phone,
        doctor.email,
        doctor.specialization,
        doctor.governorate,
        doctor.city,
        doctor.license,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });

    return [...result].sort((a, b) => {
      if (sortBy === 'oldest') return a.createdAtValue - b.createdAtValue;
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'ar');
      return b.createdAtValue - a.createdAtValue;
    });
  }, [doctors, search, specializationFilter, sortBy]);

  const stats = useMemo(() => {
    const today = localDateKey(new Date());
    const todayCount = doctors.filter(
      (doctor) => normalizeDate(doctor.createdAt) === today,
    ).length;

    const completeProfiles = doctors.filter(
      (doctor) => doctor.profileCompletion >= 80,
    ).length;

    const withDocuments = doctors.filter(
      (doctor) => doctor.documents.length > 0,
    ).length;

    return {
      total: doctors.length,
      today: todayCount,
      complete: completeProfiles,
      withDocuments,
    };
  }, [doctors]);

  function openAction(doctor, type) {
    setActionDoctor(doctor);
    setActionType(type);
    setRejectReason('');
  }

  function closeAction() {
    if (actionLoading) return;

    setActionDoctor(null);
    setActionType('');
    setRejectReason('');
  }

  async function confirmAction() {
    if (!actionDoctor || !actionType || actionLoading) return;

    if (actionType === 'reject' && !rejectReason.trim()) {
      showMessage('اكتب سبب الرفض أولاً');
      return;
    }

    setActionLoading(true);

    try {
      const now = Date.now();

      if (actionType === 'approve') {
        await update(ref(db, `users/${actionDoctor.id}`), {
          isApproved: true,
          approved: true,
          rejected: false,
          status: 'approved',
          approvedAt: now,
          rejectedAt: null,
          rejectionReason: null,
          updatedAt: now,
        });

        showMessage(`تم اعتماد د. ${actionDoctor.name} بنجاح`);
      } else {
        await update(ref(db, `users/${actionDoctor.id}`), {
          isApproved: false,
          approved: false,
          rejected: true,
          status: 'rejected',
          rejectedAt: now,
          rejectionReason: rejectReason.trim(),
          updatedAt: now,
        });

        showMessage(`تم رفض طلب د. ${actionDoctor.name}`);
      }

      closeAction();
    } catch (error) {
      console.error('Doctor approval action error:', error);
      showMessage('حدث خطأ أثناء تنفيذ الإجراء');
    } finally {
      setActionLoading(false);
      setActionDoctor(null);
      setActionType('');
      setRejectReason('');
    }
  }

  function showMessage(text) {
    setMessage(text);
    window.clearTimeout(window.__pendingDoctorsMessageTimer);
    window.__pendingDoctorsMessageTimer = window.setTimeout(() => {
      setMessage('');
    }, 2800);
  }

  if (loading) {
    return (
      <div className="pending-doctors-page" dir="rtl">
        <PendingDoctorsSkeleton />
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="pending-doctors-page" dir="rtl">
      <section className="page-header">
        <div>
          <span className="eyebrow">إدارة واعتماد الأطباء</span>
          <h1>طلبات الأطباء الجديدة</h1>
          <p>
            راجع بيانات الطبيب ووثائقه بعناية، ثم اعتمد الطلب أو ارفضه مع
            تسجيل السبب.
          </p>
        </div>

        <div className="header-count">
          <strong>{formatNumber(stats.total)}</strong>
          <span>بانتظار المراجعة</span>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard
          title="إجمالي الطلبات"
          value={stats.total}
          note="طلبات قيد المراجعة"
          icon="◫"
          primary
        />
        <StatCard
          title="طلبات اليوم"
          value={stats.today}
          note="طلبات وصلت اليوم"
          icon="＋"
        />
        <StatCard
          title="ملفات مكتملة"
          value={stats.complete}
          note="اكتمال 80% أو أكثر"
          icon="✓"
        />
        <StatCard
          title="بها مستندات"
          value={stats.withDocuments}
          note="طلبات أرفقت وثائق"
          icon="▤"
        />
      </section>

      <section className="toolbar-card">
        <label className="search-box">
          <span>⌕</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث بالاسم أو الهاتف أو التخصص أو الترخيص..."
          />
        </label>

        <select
          value={specializationFilter}
          onChange={(event) => setSpecializationFilter(event.target.value)}
        >
          <option value="all">كل التخصصات</option>
          {specializations.map((specialization) => (
            <option value={specialization} key={specialization}>
              {specialization}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
        >
          <option value="newest">الأحدث أولاً</option>
          <option value="oldest">الأقدم أولاً</option>
          <option value="name">ترتيب بالاسم</option>
        </select>
      </section>

      {filteredDoctors.length === 0 ? (
        <EmptyState
          hasDoctors={doctors.length > 0}
          onClear={() => {
            setSearch('');
            setSpecializationFilter('all');
          }}
        />
      ) : (
        <section className="review-layout">
          <aside className="doctor-list-panel">
            <div className="list-header">
              <div>
                <h2>قائمة الطلبات</h2>
                <p>{formatNumber(filteredDoctors.length)} طلب مطابق</p>
              </div>
            </div>

            <div className="doctor-cards">
              {filteredDoctors.map((doctor) => (
                <button
                  className={`doctor-card ${
                    selectedDoctor?.id === doctor.id ? 'active' : ''
                  }`}
                  key={doctor.id}
                  onClick={() => setSelectedDoctor(doctor)}
                >
                  <DoctorAvatar doctor={doctor} />

                  <div className="doctor-card-content">
                    <div className="doctor-card-title">
                      <strong>{doctor.name}</strong>
                      <span className="new-badge">جديد</span>
                    </div>

                    <p>{doctor.specialization}</p>

                    <div className="doctor-card-meta">
                      <span>{doctor.governorate}</span>
                      <span>·</span>
                      <span>{doctor.waitingLabel}</span>
                    </div>

                    <div className="completion-row">
                      <div className="completion-track">
                        <i style={{ width: `${doctor.profileCompletion}%` }} />
                      </div>
                      <small>{doctor.profileCompletion}% مكتمل</small>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {selectedDoctor && (
            <DoctorDetails
              doctor={selectedDoctor}
              onApprove={() => openAction(selectedDoctor, 'approve')}
              onReject={() => openAction(selectedDoctor, 'reject')}
            />
          )}
        </section>
      )}

      {actionDoctor && (
        <ActionModal
          doctor={actionDoctor}
          type={actionType}
          rejectReason={rejectReason}
          loading={actionLoading}
          onRejectReasonChange={setRejectReason}
          onClose={closeAction}
          onConfirm={confirmAction}
        />
      )}

      {message && <div className="toast">{message}</div>}

      <style>{styles}</style>
    </div>
  );
}

function StatCard({ title, value, note, icon, primary }) {
  return (
    <article className={`stat-card ${primary ? 'primary' : ''}`}>
      <div>
        <span>{title}</span>
        <strong>{formatNumber(value)}</strong>
        <small>{note}</small>
      </div>
      <i>{icon}</i>
    </article>
  );
}

function DoctorDetails({ doctor, onApprove, onReject }) {
  return (
    <article className="doctor-details-panel">
      <header className="details-header">
        <div className="details-main">
          <DoctorAvatar doctor={doctor} large />

          <div>
            <div className="name-row">
              <h2>{doctor.name}</h2>
              <span>قيد المراجعة</span>
            </div>
            <p>{doctor.specialization}</p>
            <small>
              رقم الطلب: {doctor.requestCode} · تم التقديم{' '}
              {doctor.waitingLabel}
            </small>
          </div>
        </div>

        <div className="completion-card">
          <strong>{doctor.profileCompletion}%</strong>
          <span>اكتمال الملف</span>
        </div>
      </header>

      <div className="details-body">
        <section className="info-section">
          <SectionHeader
            title="البيانات الشخصية"
            subtitle="بيانات التواصل والحساب"
          />

          <div className="info-grid">
            <InfoItem label="الاسم بالكامل" value={doctor.name} />
            <InfoItem label="رقم الهاتف" value={doctor.phone} phone />
            <InfoItem label="البريد الإلكتروني" value={doctor.email} />
            <InfoItem
              label="المحافظة / المدينة"
              value={[doctor.governorate, doctor.city]
                .filter(Boolean)
                .join(' - ')}
            />
          </div>
        </section>

        <section className="info-section">
          <SectionHeader
            title="البيانات المهنية"
            subtitle="المعلومات اللازمة لاعتماد الطبيب"
          />

          <div className="info-grid">
            <InfoItem label="التخصص" value={doctor.specialization} />
            <InfoItem label="سنوات الخبرة" value={doctor.experience} />
            <InfoItem label="المؤهل العلمي" value={doctor.education} />
            <InfoItem
              label="رقم الترخيص"
              value={doctor.license}
              highlight
            />
          </div>
        </section>

        <section className="info-section documents-section">
          <SectionHeader
            title="المستندات والوثائق"
            subtitle={`${formatNumber(doctor.documents.length)} مستند مرفق`}
          />

          {doctor.documents.length === 0 ? (
            <div className="no-documents">
              لم يرفق الطبيب مستندات في طلب التسجيل.
            </div>
          ) : (
            <div className="documents-grid">
              {doctor.documents.map((document, index) => (
                <DocumentCard
                  document={document}
                  index={index}
                  key={`${document.name}-${index}`}
                />
              ))}
            </div>
          )}
        </section>

        {doctor.clinics.length > 0 && (
          <section className="info-section">
            <SectionHeader
              title="العيادات"
              subtitle={`${formatNumber(doctor.clinics.length)} عيادة مسجلة`}
            />

            <div className="clinics-grid">
              {doctor.clinics.map((clinic, index) => (
                <div className="clinic-card" key={clinic.id || index}>
                  <div className="clinic-number">{index + 1}</div>
                  <div>
                    <strong>
                      {clinic.name || clinic.clinicName || `العيادة ${index + 1}`}
                    </strong>
                    <p>
                      {clinic.address ||
                        clinic.clinicAddress ||
                        'العنوان غير متوفر'}
                    </p>
                    <small>
                      {clinic.phone || clinic.clinicPhone || 'بدون هاتف'}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <footer className="details-footer">
        <div className="review-note">
          <strong>قبل اتخاذ القرار</strong>
          <span>راجع رقم الترخيص والوثائق وبيانات التواصل.</span>
        </div>

        <div className="decision-actions">
          {doctor.phone && (
            <a className="contact-button" href={`tel:${doctor.phone}`}>
              تواصل مع الطبيب
            </a>
          )}

          <button className="reject-button" onClick={onReject}>
            رفض الطلب
          </button>

          <button className="approve-button" onClick={onApprove}>
            اعتماد الطبيب
          </button>
        </div>
      </footer>
    </article>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="section-header">
      <div>
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}

function InfoItem({ label, value, phone, highlight }) {
  const safeValue = value || 'غير متوفر';

  return (
    <div className="info-item">
      <span>{label}</span>
      {phone && value ? (
        <a href={`tel:${value}`}>{value}</a>
      ) : (
        <strong className={highlight ? 'highlight' : ''}>{safeValue}</strong>
      )}
    </div>
  );
}

function DoctorAvatar({ doctor, large }) {
  if (doctor.photoUrl) {
    return (
      <img
        className={`doctor-avatar ${large ? 'large' : ''}`}
        src={doctor.photoUrl}
        alt={doctor.name}
        loading="lazy"
        decoding="async"
        onError={(event) => {
          event.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  return (
    <div className={`doctor-avatar fallback ${large ? 'large' : ''}`}>
      {doctor.name.charAt(0) || 'ط'}
    </div>
  );
}

function DocumentCard({ document, index }) {
  const url = document.url || document.fileUrl || document.downloadUrl || '';
  const title =
    document.title ||
    document.name ||
    document.fileName ||
    `المستند ${index + 1}`;
  const type =
    document.type ||
    document.fileType ||
    getExtension(title) ||
    'ملف';

  return (
    <article className="document-card">
      <div className="document-icon">{type.slice(0, 3).toUpperCase()}</div>

      <div className="document-content">
        <strong>{title}</strong>
        <span>
          {type}
          {document.size ? ` · ${document.size}` : ''}
        </span>
      </div>

      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          عرض
        </a>
      ) : (
        <span className="missing-file">بدون رابط</span>
      )}
    </article>
  );
}

function ActionModal({
  doctor,
  type,
  rejectReason,
  loading,
  onRejectReasonChange,
  onClose,
  onConfirm,
}) {
  const approving = type === 'approve';

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="action-modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div
          className={`modal-icon ${approving ? 'approve' : 'reject'}`}
        >
          {approving ? '✓' : '×'}
        </div>

        <h2>{approving ? 'اعتماد الطبيب' : 'رفض طلب الطبيب'}</h2>

        <p>
          {approving
            ? `سيتم تفعيل حساب د. ${doctor.name} والسماح له باستخدام تطبيق الأطباء.`
            : `سيتم رفض طلب د. ${doctor.name} وإخفاؤه من قائمة الطلبات الجديدة.`}
        </p>

        {!approving && (
          <label className="reason-field">
            <span>سبب الرفض</span>
            <textarea
              value={rejectReason}
              onChange={(event) => onRejectReasonChange(event.target.value)}
              placeholder="اكتب سببًا واضحًا يمكن الرجوع إليه لاحقًا..."
              rows={4}
            />
          </label>
        )}

        <div className="modal-actions">
          <button className="cancel-action" disabled={loading} onClick={onClose}>
            إلغاء
          </button>
          <button
            className={approving ? 'confirm-approve' : 'confirm-reject'}
            disabled={loading}
            onClick={onConfirm}
          >
            {loading
              ? 'جاري التنفيذ...'
              : approving
                ? 'تأكيد الاعتماد'
                : 'تأكيد الرفض'}
          </button>
        </div>
      </section>
    </div>
  );
}

function EmptyState({ hasDoctors, onClear }) {
  return (
    <section className="empty-state">
      <div>✓</div>
      <h2>{hasDoctors ? 'لا توجد نتائج مطابقة' : 'تمت مراجعة جميع الطلبات'}</h2>
      <p>
        {hasDoctors
          ? 'غيّر عبارة البحث أو اختر تخصصًا آخر.'
          : 'لا توجد طلبات أطباء جديدة بانتظار الاعتماد حاليًا.'}
      </p>

      {hasDoctors && (
        <button onClick={onClear}>إزالة البحث والفلاتر</button>
      )}
    </section>
  );
}

function PendingDoctorsSkeleton() {
  return (
    <>
      <div className="shimmer skeleton-header" />

      <div className="skeleton-stats">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="shimmer skeleton-stat" key={index} />
        ))}
      </div>

      <div className="shimmer skeleton-toolbar" />

      <div className="skeleton-layout">
        <div className="skeleton-list">
          {Array.from({ length: 5 }).map((_, index) => (
            <div className="shimmer skeleton-list-item" key={index} />
          ))}
        </div>

        <div className="shimmer skeleton-details" />
      </div>
    </>
  );
}

function normalizeDoctor(id, user = {}) {
  const documents = normalizeCollection(
    user.documents || user.files || user.certificates,
  );

  const clinics = normalizeCollection(user.clinics);

  const fields = [
    user.name || user.fullName || user.displayName,
    user.phone || user.phoneNumber,
    user.email,
    user.specialization || user.speciality,
    user.experience || user.experienceYears,
    user.education || user.university || user.degree,
    user.licenseNumber || user.license,
    user.governorate || user.city,
    documents.length > 0,
  ];

  const completedFields = fields.filter(Boolean).length;
  const profileCompletion = Math.round(
    (completedFields / fields.length) * 100,
  );

  const createdAt =
    user.createdAt ||
    user.registeredAt ||
    user.submittedAt ||
    user.timestamp ||
    0;

  return {
    id,
    name:
      user.name ||
      user.fullName ||
      user.displayName ||
      'طبيب غير محدد',
    phone: String(user.phone || user.phoneNumber || ''),
    email: String(user.email || ''),
    specialization:
      user.specialization ||
      user.speciality ||
      user.specialty ||
      'التخصص غير محدد',
    experience:
      user.experience ||
      user.experienceYears ||
      user.yearsOfExperience ||
      'غير متوفر',
    education:
      user.education ||
      user.university ||
      user.degree ||
      user.qualification ||
      'غير متوفر',
    license:
      user.licenseNumber ||
      user.license ||
      user.medicalLicense ||
      'غير متوفر',
    governorate: user.governorate || user.city || 'غير محدد',
    city: user.center || user.area || user.district || '',
    photoUrl:
      user.photoUrl ||
      user.image ||
      user.avatar ||
      user.profileImage ||
      '',
    documents,
    clinics,
    profileCompletion,
    createdAt,
    createdAtValue: parseDateValue(createdAt),
    waitingLabel: relativeTime(createdAt),
    requestCode:
      user.requestCode ||
      `DOC-${String(id).slice(0, 6).toUpperCase()}`,
  };
}

function normalizeCollection(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  if (typeof value === 'object') {
    return Object.entries(value)
      .filter(([, item]) => item)
      .map(([id, item]) =>
        typeof item === 'object' ? { id, ...item } : { id, value: item },
      );
  }

  return [];
}

function getExtension(name) {
  const match = String(name || '').match(/\.([a-zA-Z0-9]+)$/);
  return match ? match[1] : '';
}

function parseDateValue(value) {
  if (!value) return 0;

  if (typeof value === 'number') {
    return value < 100000000000 ? value * 1000 : value;
  }

  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function relativeTime(value) {
  const timestamp = parseDateValue(value);
  if (!timestamp) return 'في وقت غير محدد';

  const difference = Date.now() - timestamp;
  const minutes = Math.max(0, Math.floor(difference / 60000));

  if (minutes < 1) return 'منذ لحظات';
  if (minutes < 60) return `منذ ${minutes} دقيقة`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${days} يوم`;

  return `بتاريخ ${formatDate(value)}`;
}

function normalizeDate(value) {
  const timestamp = parseDateValue(value);
  if (!timestamp) return '';

  return localDateKey(new Date(timestamp));
}

function localDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatDate(value) {
  const timestamp = parseDateValue(value);
  if (!timestamp) return 'غير محدد';

  return new Intl.DateTimeFormat('ar-EG', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(timestamp));
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ar-EG');
}

const styles = `
  * {
    box-sizing: border-box;
  }

  .pending-doctors-page {
    min-height: 100vh;
    padding: clamp(18px, 3vw, 38px);
    background: ${COLORS.bg};
    color: ${COLORS.text};
    font-family: "Tajawal", "Cairo", Arial, sans-serif;
  }

  .page-header {
    min-height: 150px;
    padding: clamp(22px, 3vw, 34px);
    border-radius: 24px;
    background:
      radial-gradient(circle at 12% 20%, rgba(255,255,255,.15), transparent 32%),
      linear-gradient(135deg, #0f766e, #115e59);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    box-shadow: 0 18px 42px rgba(15,118,110,.18);
  }

  .eyebrow {
    display: inline-block;
    margin-bottom: 8px;
    color: #ccfbf1;
    font-size: 12px;
    font-weight: 900;
  }

  .page-header h1 {
    margin: 0;
    font-size: clamp(25px, 3vw, 36px);
    font-weight: 900;
  }

  .page-header p {
    max-width: 720px;
    margin: 10px 0 0;
    color: rgba(255,255,255,.8);
    font-size: 13px;
    font-weight: 700;
    line-height: 1.75;
  }

  .header-count {
    min-width: 130px;
    min-height: 96px;
    padding: 16px;
    border-radius: 20px;
    background: rgba(255,255,255,.13);
    border: 1px solid rgba(255,255,255,.2);
    display: grid;
    place-items: center;
    align-content: center;
  }

  .header-count strong {
    font-size: 34px;
    line-height: 1;
  }

  .header-count span {
    margin-top: 7px;
    color: #ccfbf1;
    font-size: 11px;
    font-weight: 900;
  }

  .stats-grid,
  .skeleton-stats {
    margin-top: 18px;
    display: grid;
    grid-template-columns: repeat(4, minmax(0,1fr));
    gap: 14px;
  }

  .stat-card {
    min-height: 124px;
    padding: 19px;
    background: #fff;
    border: 1px solid ${COLORS.border};
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    box-shadow: 0 8px 24px rgba(15,23,42,.045);
  }

  .stat-card div > span {
    display: block;
    color: ${COLORS.muted};
    font-size: 10px;
    font-weight: 900;
  }

  .stat-card div > strong {
    display: block;
    margin-top: 9px;
    font-size: 28px;
    font-weight: 900;
  }

  .stat-card div > small {
    display: block;
    margin-top: 6px;
    color: ${COLORS.muted};
    font-size: 9px;
    font-weight: 700;
  }

  .stat-card i {
    width: 46px;
    height: 46px;
    border-radius: 15px;
    background: #f0fdfa;
    color: ${COLORS.dark};
    display: grid;
    place-items: center;
    font-style: normal;
    font-size: 19px;
    font-weight: 900;
  }

  .stat-card.primary {
    color: #fff;
    background: linear-gradient(145deg,#0f766e,#115e59);
    border-color: transparent;
  }

  .stat-card.primary div > span,
  .stat-card.primary div > small {
    color: rgba(255,255,255,.75);
  }

  .stat-card.primary i {
    color: #fff;
    background: rgba(255,255,255,.14);
  }

  .toolbar-card {
    margin-top: 15px;
    padding: 15px;
    background: #fff;
    border: 1px solid ${COLORS.border};
    border-radius: 18px;
    display: grid;
    grid-template-columns: minmax(260px,1fr) 220px 180px;
    gap: 12px;
    box-shadow: 0 8px 24px rgba(15,23,42,.04);
  }

  .search-box {
    height: 45px;
    padding: 0 13px;
    background: #f8fafc;
    border: 1px solid ${COLORS.border};
    border-radius: 13px;
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .search-box span {
    color: ${COLORS.muted};
    font-size: 20px;
  }

  .search-box input {
    width: 100%;
    border: 0;
    outline: 0;
    background: transparent;
    font: inherit;
    text-align: right;
  }

  .toolbar-card select {
    width: 100%;
    height: 45px;
    padding: 0 12px;
    border: 1px solid ${COLORS.border};
    border-radius: 13px;
    background: #f8fafc;
    color: ${COLORS.text};
    outline: 0;
    font: inherit;
    font-size: 11px;
    font-weight: 800;
  }

  .review-layout,
  .skeleton-layout {
    margin-top: 15px;
    display: grid;
    grid-template-columns: minmax(300px,370px) minmax(0,1fr);
    gap: 15px;
    align-items: start;
  }

  .doctor-list-panel,
  .doctor-details-panel {
    background: #fff;
    border: 1px solid ${COLORS.border};
    border-radius: 20px;
    box-shadow: 0 8px 24px rgba(15,23,42,.045);
  }

  .doctor-list-panel {
    padding: 16px;
    position: sticky;
    top: 16px;
  }

  .list-header {
    padding: 3px 3px 14px;
  }

  .list-header h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 900;
  }

  .list-header p {
    margin: 5px 0 0;
    color: ${COLORS.muted};
    font-size: 10px;
    font-weight: 700;
  }

  .doctor-cards {
    max-height: calc(100vh - 180px);
    overflow-y: auto;
    display: grid;
    gap: 10px;
    padding-left: 3px;
  }

  .doctor-card {
    width: 100%;
    padding: 13px;
    border: 1px solid #edf2f7;
    border-radius: 16px;
    background: #fff;
    display: flex;
    align-items: flex-start;
    gap: 11px;
    text-align: right;
    cursor: pointer;
    transition: border-color 150ms ease, box-shadow 150ms ease,
      transform 150ms ease;
  }

  .doctor-card:hover {
    transform: translateY(-1px);
    border-color: #99f6e4;
  }

  .doctor-card.active {
    border-color: ${COLORS.teal};
    background: #f8fffd;
    box-shadow: 0 9px 23px rgba(20,184,166,.12);
  }

  .doctor-avatar {
    width: 52px;
    height: 52px;
    border-radius: 15px;
    object-fit: cover;
    background: #e2e8f0;
    flex: 0 0 auto;
  }

  .doctor-avatar.large {
    width: 76px;
    height: 76px;
    border-radius: 20px;
  }

  .doctor-avatar.fallback {
    background: #f0fdfa;
    color: ${COLORS.dark};
    display: grid;
    place-items: center;
    font-size: 18px;
    font-weight: 900;
  }

  .doctor-avatar.fallback.large {
    font-size: 26px;
  }

  .doctor-card-content {
    min-width: 0;
    flex: 1;
  }

  .doctor-card-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 9px;
  }

  .doctor-card-title strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: ${COLORS.text};
    font-size: 12px;
    font-weight: 900;
  }

  .new-badge {
    padding: 5px 8px;
    border-radius: 999px;
    background: #eff6ff;
    color: #1d4ed8;
    font-size: 8px;
    font-weight: 900;
  }

  .doctor-card-content > p {
    margin: 5px 0 0;
    color: ${COLORS.dark};
    font-size: 10px;
    font-weight: 900;
  }

  .doctor-card-meta {
    margin-top: 6px;
    display: flex;
    align-items: center;
    gap: 5px;
    color: ${COLORS.muted};
    font-size: 9px;
    font-weight: 700;
  }

  .completion-row {
    margin-top: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .completion-track {
    height: 5px;
    flex: 1;
    border-radius: 999px;
    background: #e2e8f0;
    overflow: hidden;
  }

  .completion-track i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg,#0f766e,#2dd4bf);
  }

  .completion-row small {
    color: ${COLORS.muted};
    font-size: 8px;
    font-weight: 800;
    white-space: nowrap;
  }

  .doctor-details-panel {
    overflow: hidden;
  }

  .details-header {
    padding: 22px;
    border-bottom: 1px solid ${COLORS.border};
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
  }

  .details-main {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .name-row {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .name-row h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 900;
  }

  .name-row span {
    padding: 6px 9px;
    border-radius: 999px;
    background: #fff7ed;
    color: #c2410c;
    font-size: 9px;
    font-weight: 900;
  }

  .details-main p {
    margin: 6px 0 0;
    color: ${COLORS.dark};
    font-size: 12px;
    font-weight: 900;
  }

  .details-main small {
    display: block;
    margin-top: 7px;
    color: ${COLORS.muted};
    font-size: 9px;
    font-weight: 700;
  }

  .completion-card {
    min-width: 96px;
    min-height: 76px;
    padding: 10px;
    border-radius: 17px;
    background: #f0fdfa;
    display: grid;
    place-items: center;
    align-content: center;
  }

  .completion-card strong {
    color: ${COLORS.dark};
    font-size: 22px;
  }

  .completion-card span {
    margin-top: 4px;
    color: ${COLORS.muted};
    font-size: 8px;
    font-weight: 900;
  }

  .details-body {
    padding: 22px;
    display: grid;
    gap: 18px;
  }

  .info-section {
    padding: 18px;
    border: 1px solid #edf2f7;
    border-radius: 17px;
    background: #fcfdfd;
  }

  .section-header {
    margin-bottom: 15px;
  }

  .section-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 900;
  }

  .section-header p {
    margin: 5px 0 0;
    color: ${COLORS.muted};
    font-size: 9px;
    font-weight: 700;
  }

  .info-grid {
    display: grid;
    grid-template-columns: repeat(2,minmax(0,1fr));
    gap: 11px;
  }

  .info-item {
    min-width: 0;
    padding: 13px;
    border: 1px solid #edf2f7;
    border-radius: 13px;
    background: #fff;
  }

  .info-item span {
    display: block;
    color: ${COLORS.muted};
    font-size: 8px;
    font-weight: 900;
  }

  .info-item strong,
  .info-item a {
    display: block;
    margin-top: 7px;
    color: ${COLORS.text};
    text-decoration: none;
    overflow-wrap: anywhere;
    font-size: 11px;
    font-weight: 900;
    line-height: 1.5;
  }

  .info-item strong.highlight {
    color: ${COLORS.dark};
  }

  .documents-grid,
  .clinics-grid {
    display: grid;
    grid-template-columns: repeat(2,minmax(0,1fr));
    gap: 10px;
  }

  .document-card,
  .clinic-card {
    min-width: 0;
    padding: 12px;
    border: 1px solid #edf2f7;
    border-radius: 14px;
    background: #fff;
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .document-icon,
  .clinic-number {
    width: 42px;
    height: 42px;
    border-radius: 13px;
    background: #f0fdfa;
    color: ${COLORS.dark};
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    font-size: 9px;
    font-weight: 900;
  }

  .document-content,
  .clinic-card > div:last-child {
    min-width: 0;
    flex: 1;
  }

  .document-content strong,
  .clinic-card strong {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 10px;
    font-weight: 900;
  }

  .document-content span,
  .clinic-card p,
  .clinic-card small {
    display: block;
    margin: 4px 0 0;
    color: ${COLORS.muted};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 8px;
    font-weight: 700;
  }

  .document-card > a {
    padding: 7px 9px;
    border-radius: 9px;
    background: #f0fdfa;
    color: ${COLORS.dark};
    text-decoration: none;
    font-size: 8px;
    font-weight: 900;
  }

  .missing-file {
    color: ${COLORS.muted};
    font-size: 8px;
    font-weight: 800;
  }

  .no-documents {
    min-height: 90px;
    border: 1px dashed #cbd5e1;
    border-radius: 13px;
    display: grid;
    place-items: center;
    color: ${COLORS.muted};
    font-size: 10px;
    font-weight: 800;
  }

  .details-footer {
    padding: 18px 22px;
    border-top: 1px solid ${COLORS.border};
    background: #f8fafc;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 15px;
  }

  .review-note strong {
    display: block;
    font-size: 10px;
    font-weight: 900;
  }

  .review-note span {
    display: block;
    margin-top: 4px;
    color: ${COLORS.muted};
    font-size: 8px;
    font-weight: 700;
  }

  .decision-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .decision-actions button,
  .contact-button,
  .empty-state button,
  .modal-actions button {
    min-height: 40px;
    padding: 0 14px;
    border: 0;
    border-radius: 11px;
    cursor: pointer;
    font-family: inherit;
    font-size: 10px;
    font-weight: 900;
  }

  .contact-button {
    background: #eff6ff;
    color: #1d4ed8;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
  }

  .reject-button {
    background: #fef2f2;
    color: ${COLORS.danger};
  }

  .approve-button {
    background: ${COLORS.dark};
    color: #fff;
    box-shadow: 0 8px 18px rgba(15,118,110,.18);
  }

  .empty-state {
    min-height: 340px;
    margin-top: 15px;
    padding: 35px;
    border: 1px solid ${COLORS.border};
    border-radius: 20px;
    background: #fff;
    display: grid;
    place-items: center;
    align-content: center;
    text-align: center;
  }

  .empty-state > div {
    width: 62px;
    height: 62px;
    border-radius: 20px;
    background: #ecfdf5;
    color: ${COLORS.success};
    display: grid;
    place-items: center;
    font-size: 27px;
    font-weight: 900;
  }

  .empty-state h2 {
    margin: 16px 0 0;
    font-size: 17px;
  }

  .empty-state p {
    margin: 7px 0 0;
    color: ${COLORS.muted};
    font-size: 10px;
    font-weight: 700;
  }

  .empty-state button {
    margin-top: 15px;
    background: #f0fdfa;
    color: ${COLORS.dark};
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1200;
    padding: 18px;
    background: rgba(15,23,42,.5);
    backdrop-filter: blur(5px);
    display: grid;
    place-items: center;
  }

  .action-modal {
    width: min(470px,100%);
    padding: 26px;
    border-radius: 22px;
    background: #fff;
    text-align: center;
    box-shadow: 0 30px 70px rgba(15,23,42,.25);
  }

  .modal-icon {
    width: 62px;
    height: 62px;
    margin: 0 auto;
    border-radius: 20px;
    display: grid;
    place-items: center;
    font-size: 27px;
    font-weight: 900;
  }

  .modal-icon.approve {
    background: #ecfdf5;
    color: ${COLORS.success};
  }

  .modal-icon.reject {
    background: #fef2f2;
    color: ${COLORS.danger};
  }

  .action-modal h2 {
    margin: 16px 0 0;
    font-size: 20px;
  }

  .action-modal > p {
    margin: 9px 0 0;
    color: ${COLORS.muted};
    font-size: 11px;
    font-weight: 700;
    line-height: 1.8;
  }

  .reason-field {
    margin-top: 18px;
    display: block;
    text-align: right;
  }

  .reason-field span {
    display: block;
    margin-bottom: 7px;
    color: ${COLORS.text};
    font-size: 10px;
    font-weight: 900;
  }

  .reason-field textarea {
    width: 100%;
    padding: 12px;
    border: 1px solid ${COLORS.border};
    border-radius: 13px;
    outline: none;
    resize: vertical;
    font-family: inherit;
    font-size: 11px;
    line-height: 1.7;
  }

  .reason-field textarea:focus {
    border-color: ${COLORS.teal};
  }

  .modal-actions {
    margin-top: 20px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 9px;
  }

  .cancel-action {
    background: #f1f5f9;
    color: #334155;
  }

  .confirm-approve {
    background: ${COLORS.dark};
    color: #fff;
  }

  .confirm-reject {
    background: ${COLORS.danger};
    color: #fff;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: .58;
  }

  .toast {
    position: fixed;
    left: 24px;
    bottom: 24px;
    z-index: 1400;
    padding: 13px 17px;
    border-radius: 13px;
    background: #0f172a;
    color: #fff;
    box-shadow: 0 14px 35px rgba(15,23,42,.23);
    font-size: 10px;
    font-weight: 900;
  }

  .shimmer {
    position: relative;
    overflow: hidden;
    background: #e8edf3;
  }

  .shimmer:after {
    content: "";
    position: absolute;
    inset: 0;
    transform: translateX(100%);
    background: linear-gradient(90deg,transparent,rgba(255,255,255,.68),transparent);
    animation: shimmer 1.2s infinite;
  }

  .skeleton-header {
    height: 150px;
    border-radius: 24px;
  }

  .skeleton-stat {
    height: 124px;
    border-radius: 18px;
  }

  .skeleton-toolbar {
    height: 75px;
    margin-top: 15px;
    border-radius: 18px;
  }

  .skeleton-list {
    display: grid;
    gap: 10px;
  }

  .skeleton-list-item {
    height: 110px;
    border-radius: 16px;
  }

  .skeleton-details {
    height: 700px;
    border-radius: 20px;
  }

  @keyframes shimmer {
    to {
      transform: translateX(-100%);
    }
  }

  @media (max-width: 1100px) {
    .stats-grid,
    .skeleton-stats {
      grid-template-columns: repeat(2,minmax(0,1fr));
    }

    .review-layout,
    .skeleton-layout {
      grid-template-columns: 1fr;
    }

    .doctor-list-panel {
      position: static;
    }

    .doctor-cards {
      max-height: none;
      grid-template-columns: repeat(2,minmax(0,1fr));
    }
  }

  @media (max-width: 760px) {
    .pending-doctors-page {
      padding: 14px;
    }

    .page-header {
      align-items: stretch;
      flex-direction: column;
    }

    .header-count {
      width: 100%;
      min-height: 72px;
      grid-auto-flow: column;
      justify-content: center;
      gap: 10px;
    }

    .stats-grid,
    .skeleton-stats,
    .doctor-cards,
    .info-grid,
    .documents-grid,
    .clinics-grid {
      grid-template-columns: 1fr;
    }

    .toolbar-card {
      grid-template-columns: 1fr;
    }

    .details-header,
    .details-footer {
      align-items: stretch;
      flex-direction: column;
    }

    .details-main {
      align-items: flex-start;
    }

    .completion-card {
      width: 100%;
      min-height: 68px;
      grid-auto-flow: column;
      justify-content: center;
      gap: 8px;
    }

    .decision-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }

    .contact-button {
      grid-column: 1 / -1;
      justify-content: center;
    }

    .review-note {
      display: none;
    }
  }
`;
