import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import {
  onValue,
  ref,
  remove,
  update,
} from 'firebase/database';

const COLORS = {
  dark: '#0f766e',
  teal: '#14b8a6',
  tealSoft: '#ccfbf1',
  bg: '#f6f8fb',
  card: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  warning: '#f59e0b',
  danger: '#dc2626',
  success: '#16a34a',
};

const STATUS_OPTIONS = [
  { value: 'new', label: 'جديد' },
  { value: 'contacted', label: 'تم التواصل' },
  { value: 'approved', label: 'تمت الموافقة' },
  { value: 'rejected', label: 'مرفوض' },
];

export default function DoctorRecommendations() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRecommendation, setSelectedRecommendation] = useState(null);
  const [updatingId, setUpdatingId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const recommendationsRef = ref(db, 'doctorRecommendations');

    const unsubscribe = onValue(
      recommendationsRef,
      (snapshot) => {
        const value = snapshot.val();

        const items =
          value && typeof value === 'object'
            ? Object.entries(value).map(([id, item]) => ({
                id,
                ...(item && typeof item === 'object' ? item : {}),
              }))
            : [];

        items.sort((a, b) => getCreatedAtValue(b) - getCreatedAtValue(a));

        setRecommendations(items);
        setLoading(false);
      },
      (error) => {
        console.error('doctorRecommendations listener error:', error);
        setRecommendations([]);
        setLoading(false);
        showMessage('تعذر تحميل ترشيحات الأطباء');
      },
    );

    return unsubscribe;
  }, []);

  const stats = useMemo(() => {
    const newItems = recommendations.filter(
      (item) => normalizeStatus(item.status) === 'new',
    ).length;

    const contacted = recommendations.filter(
      (item) => normalizeStatus(item.status) === 'contacted',
    ).length;

    const approved = recommendations.filter(
      (item) => normalizeStatus(item.status) === 'approved',
    ).length;

    return {
      total: recommendations.length,
      newItems,
      contacted,
      approved,
    };
  }, [recommendations]);

  const filteredRecommendations = useMemo(() => {
    const query = search.trim().toLowerCase();

    return recommendations.filter((item) => {
      const status = normalizeStatus(item.status);

      if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }

      if (!query) return true;

      return [
        getDoctorName(item),
        getSpecialization(item),
        getPhone(item),
        getGovernorate(item),
        getCenter(item),
        getAddress(item),
        getSenderName(item),
        getSenderPhone(item),
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [recommendations, search, statusFilter]);

  async function handleStatusChange(item, nextStatus) {
    if (!item?.id || updatingId) return;

    setUpdatingId(item.id);

    try {
      await update(ref(db, `doctorRecommendations/${item.id}`), {
        status: nextStatus,
        updatedAt: Date.now(),
      });

      if (selectedRecommendation?.id === item.id) {
        setSelectedRecommendation((current) => ({
          ...current,
          status: nextStatus,
          updatedAt: Date.now(),
        }));
      }

      showMessage('تم تحديث حالة الترشيح');
    } catch (error) {
      console.error('Update recommendation status error:', error);
      showMessage('حدث خطأ أثناء تحديث الحالة');
    } finally {
      setUpdatingId('');
    }
  }

  async function handleDelete(item) {
    if (!item?.id || deletingId) return;

    const confirmed = window.confirm(
      `هل تريد حذف ترشيح الطبيب "${getDoctorName(item)}" نهائيًا؟`,
    );

    if (!confirmed) return;

    setDeletingId(item.id);

    try {
      await remove(ref(db, `doctorRecommendations/${item.id}`));

      if (selectedRecommendation?.id === item.id) {
        setSelectedRecommendation(null);
      }

      showMessage('تم حذف الترشيح');
    } catch (error) {
      console.error('Delete recommendation error:', error);
      showMessage('حدث خطأ أثناء حذف الترشيح');
    } finally {
      setDeletingId('');
    }
  }

  function showMessage(text) {
    setMessage(text);
    window.clearTimeout(window.__doctorRecommendationsMessageTimer);
    window.__doctorRecommendationsMessageTimer = window.setTimeout(() => {
      setMessage('');
    }, 2600);
  }

  return (
    <div className="recommendations-page" dir="rtl">
      <header className="page-header">
        <div>
          <span className="eyebrow">إدارة الترشيحات</span>
          <h1>الأطباء المرشحون من العملاء</h1>
          <p>
            متابعة بيانات الأطباء التي يرسلها العملاء والتواصل معهم ومراجعتها.
          </p>
        </div>

        <div className="live-badge">
          <span />
          بيانات مباشرة
        </div>
      </header>

      <section className="stats-grid">
        <StatCard
          title="إجمالي الترشيحات"
          value={stats.total}
          icon="◫"
          tone="primary"
        />
        <StatCard
          title="ترشيحات جديدة"
          value={stats.newItems}
          icon="＋"
          tone="warning"
        />
        <StatCard
          title="تم التواصل"
          value={stats.contacted}
          icon="☎"
          tone="info"
        />
        <StatCard
          title="تمت الموافقة"
          value={stats.approved}
          icon="✓"
          tone="success"
        />
      </section>

      <section className="content-card">
        <div className="toolbar">
          <div className="search-box">
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث باسم الطبيب أو التخصص أو الهاتف أو المحافظة..."
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">كل الحالات</option>
            {STATUS_OPTIONS.map((status) => (
              <option value={status.value} key={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <RecommendationsSkeleton />
        ) : filteredRecommendations.length === 0 ? (
          <EmptyState
            title="لا توجد ترشيحات"
            description={
              recommendations.length === 0
                ? 'لم يرسل العملاء أي طبيب حتى الآن.'
                : 'لا توجد نتائج مطابقة للبحث أو الفلتر الحالي.'
            }
          />
        ) : (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>الطبيب</th>
                    <th>التخصص</th>
                    <th>رقم الهاتف</th>
                    <th>الموقع</th>
                    <th>المرسل</th>
                    <th>تاريخ الإرسال</th>
                    <th>الحالة</th>
                    <th>الإجراءات</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredRecommendations.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="doctor-cell">
                          <div className="doctor-avatar">
                            {getDoctorName(item).charAt(0) || 'ط'}
                          </div>
                          <div>
                            <strong>{getDoctorName(item)}</strong>
                            <small>{getAddress(item) || 'بدون عنوان مفصل'}</small>
                          </div>
                        </div>
                      </td>

                      <td>{getSpecialization(item)}</td>

                      <td>
                        {getPhone(item) ? (
                          <a
                            className="phone-link"
                            href={`tel:${getPhone(item)}`}
                          >
                            {getPhone(item)}
                          </a>
                        ) : (
                          <span className="muted">غير متوفر</span>
                        )}
                      </td>

                      <td>
                        <strong className="location-main">
                          {getGovernorate(item)}
                        </strong>
                        <small className="location-sub">
                          {getCenter(item)}
                        </small>
                      </td>

                      <td>
                        <strong className="sender-name">
                          {getSenderName(item)}
                        </strong>
                        <small className="sender-phone">
                          {getSenderPhone(item)}
                        </small>
                      </td>

                      <td>{formatDate(item.createdAt || item.timestamp)}</td>

                      <td>
                        <select
                          className={`status-select status-${normalizeStatus(
                            item.status,
                          )}`}
                          value={normalizeStatus(item.status)}
                          disabled={updatingId === item.id}
                          onChange={(event) =>
                            handleStatusChange(item, event.target.value)
                          }
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option value={status.value} key={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td>
                        <div className="actions">
                          <button
                            className="view-button"
                            onClick={() => setSelectedRecommendation(item)}
                          >
                            عرض
                          </button>

                          <button
                            className="delete-button"
                            disabled={deletingId === item.id}
                            onClick={() => handleDelete(item)}
                          >
                            {deletingId === item.id ? '...' : 'حذف'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-cards">
              {filteredRecommendations.map((item) => (
                <article className="mobile-card" key={item.id}>
                  <div className="mobile-card-head">
                    <div className="doctor-cell">
                      <div className="doctor-avatar">
                        {getDoctorName(item).charAt(0) || 'ط'}
                      </div>
                      <div>
                        <strong>{getDoctorName(item)}</strong>
                        <small>{getSpecialization(item)}</small>
                      </div>
                    </div>

                    <StatusBadge status={item.status} />
                  </div>

                  <div className="mobile-details">
                    <DetailLine label="الهاتف" value={getPhone(item)} />
                    <DetailLine
                      label="الموقع"
                      value={`${getGovernorate(item)} - ${getCenter(item)}`}
                    />
                    <DetailLine label="المرسل" value={getSenderName(item)} />
                    <DetailLine
                      label="التاريخ"
                      value={formatDate(item.createdAt || item.timestamp)}
                    />
                  </div>

                  <div className="mobile-actions">
                    <button
                      className="view-button"
                      onClick={() => setSelectedRecommendation(item)}
                    >
                      عرض التفاصيل
                    </button>
                    <button
                      className="delete-button"
                      onClick={() => handleDelete(item)}
                    >
                      حذف
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </section>

      {selectedRecommendation && (
        <RecommendationModal
          item={selectedRecommendation}
          updating={updatingId === selectedRecommendation.id}
          deleting={deletingId === selectedRecommendation.id}
          onClose={() => setSelectedRecommendation(null)}
          onStatusChange={(status) =>
            handleStatusChange(selectedRecommendation, status)
          }
          onDelete={() => handleDelete(selectedRecommendation)}
        />
      )}

      {message && <div className="toast">{message}</div>}

      <style>{styles}</style>
    </div>
  );
}

function StatCard({ title, value, icon, tone }) {
  return (
    <article className={`stat-card ${tone}`}>
      <div>
        <span>{title}</span>
        <strong>{formatNumber(value)}</strong>
      </div>
      <i>{icon}</i>
    </article>
  );
}

function StatusBadge({ status }) {
  const normalized = normalizeStatus(status);
  const config = STATUS_OPTIONS.find((item) => item.value === normalized);

  return (
    <span className={`status-badge status-${normalized}`}>
      {config?.label || 'جديد'}
    </span>
  );
}

function DetailLine({ label, value }) {
  return (
    <div className="detail-line">
      <span>{label}</span>
      <strong>{value || 'غير متوفر'}</strong>
    </div>
  );
}

function RecommendationModal({
  item,
  updating,
  deleting,
  onClose,
  onStatusChange,
  onDelete,
}) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <section
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            <span>تفاصيل الترشيح</span>
            <h2>{getDoctorName(item)}</h2>
          </div>
          <button onClick={onClose}>×</button>
        </header>

        <div className="modal-body">
          <div className="modal-grid">
            <InfoItem label="اسم الطبيب" value={getDoctorName(item)} />
            <InfoItem label="التخصص" value={getSpecialization(item)} />
            <InfoItem label="رقم الهاتف" value={getPhone(item)} phone />
            <InfoItem label="المحافظة" value={getGovernorate(item)} />
            <InfoItem label="المركز / المدينة" value={getCenter(item)} />
            <InfoItem label="عنوان العيادة" value={getAddress(item)} wide />
            <InfoItem label="اسم العميل المرسل" value={getSenderName(item)} />
            <InfoItem
              label="هاتف العميل"
              value={getSenderPhone(item)}
              phone
            />
            <InfoItem
              label="تاريخ الإرسال"
              value={formatDateTime(item.createdAt || item.timestamp)}
            />
            <InfoItem
              label="ملاحظات العميل"
              value={getNotes(item)}
              wide
            />
          </div>

          <div className="modal-status-row">
            <label>حالة الترشيح</label>
            <select
              value={normalizeStatus(item.status)}
              disabled={updating}
              onChange={(event) => onStatusChange(event.target.value)}
            >
              {STATUS_OPTIONS.map((status) => (
                <option value={status.value} key={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <footer className="modal-footer">
          <button className="close-button" onClick={onClose}>
            إغلاق
          </button>
          <button
            className="delete-button large"
            disabled={deleting}
            onClick={onDelete}
          >
            {deleting ? 'جاري الحذف...' : 'حذف الترشيح'}
          </button>
        </footer>
      </section>
    </div>
  );
}

function InfoItem({ label, value, phone, wide }) {
  return (
    <div className={`info-item ${wide ? 'wide' : ''}`}>
      <span>{label}</span>
      {phone && value ? (
        <a href={`tel:${value}`}>{value}</a>
      ) : (
        <strong>{value || 'غير متوفر'}</strong>
      )}
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="empty-state">
      <div>＋</div>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function RecommendationsSkeleton() {
  return (
    <div className="skeleton-list">
      {Array.from({ length: 6 }).map((_, index) => (
        <div className="skeleton-row" key={index}>
          <div className="shimmer skeleton-avatar" />
          <div className="shimmer skeleton-text large" />
          <div className="shimmer skeleton-text" />
          <div className="shimmer skeleton-text" />
          <div className="shimmer skeleton-button" />
        </div>
      ))}
    </div>
  );
}

function normalizeStatus(status) {
  const normalized = String(status || 'new').trim().toLowerCase();

  return STATUS_OPTIONS.some((item) => item.value === normalized)
    ? normalized
    : 'new';
}

function getDoctorName(item) {
  return (
    item.doctorName ||
    item.name ||
    item.fullName ||
    item.doctorFullName ||
    'طبيب غير محدد'
  );
}

function getSpecialization(item) {
  return (
    item.specialization ||
    item.speciality ||
    item.doctorSpecialization ||
    item.specialty ||
    'غير محدد'
  );
}

function getPhone(item) {
  return (
    item.phone ||
    item.doctorPhone ||
    item.phoneNumber ||
    item.mobile ||
    ''
  );
}

function getGovernorate(item) {
  return (
    item.governorate ||
    item.doctorGovernorate ||
    item.city ||
    'غير محدد'
  );
}

function getCenter(item) {
  return (
    item.center ||
    item.doctorCenter ||
    item.area ||
    item.district ||
    'غير محدد'
  );
}

function getAddress(item) {
  return (
    item.address ||
    item.clinicAddress ||
    item.detailedAddress ||
    item.doctorAddress ||
    ''
  );
}

function getSenderName(item) {
  return (
    item.patientName ||
    item.senderName ||
    item.userName ||
    item.recommendedByName ||
    'عميل غير محدد'
  );
}

function getSenderPhone(item) {
  return (
    item.patientPhone ||
    item.senderPhone ||
    item.userPhone ||
    item.recommendedByPhone ||
    ''
  );
}

function getNotes(item) {
  return (
    item.notes ||
    item.note ||
    item.description ||
    item.additionalNotes ||
    'لا توجد ملاحظات'
  );
}

function getCreatedAtValue(item) {
  const raw = item.createdAt || item.timestamp || item.submittedAt || 0;

  if (typeof raw === 'number') return raw;

  const parsed = new Date(raw).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString('ar-EG');
}

function formatDate(value) {
  const date = parseDate(value);

  if (!date) return 'غير محدد';

  return new Intl.DateTimeFormat('ar-EG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value) {
  const date = parseDate(value);

  if (!date) return 'غير محدد';

  return new Intl.DateTimeFormat('ar-EG', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function parseDate(value) {
  if (!value) return null;

  if (typeof value === 'number') {
    const milliseconds = value < 100000000000 ? value * 1000 : value;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const styles = `
  * {
    box-sizing: border-box;
  }

  .recommendations-page {
    min-height: 100vh;
    padding: clamp(20px, 3vw, 38px);
    background: ${COLORS.bg};
    color: ${COLORS.text};
    font-family: "Tajawal", "Cairo", Arial, sans-serif;
  }

  .page-header {
    min-height: 154px;
    padding: clamp(22px, 3vw, 34px);
    border-radius: 24px;
    background:
      radial-gradient(circle at 12% 25%, rgba(255,255,255,.16), transparent 32%),
      linear-gradient(135deg, #0f766e, #115e59);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    box-shadow: 0 18px 42px rgba(15, 118, 110, 0.18);
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
    font-size: clamp(24px, 3vw, 36px);
    font-weight: 900;
  }

  .page-header p {
    margin: 10px 0 0;
    color: rgba(255,255,255,.80);
    font-size: 14px;
    font-weight: 700;
    line-height: 1.7;
  }

  .live-badge {
    height: 42px;
    padding: 0 14px;
    border-radius: 13px;
    background: rgba(255,255,255,.13);
    border: 1px solid rgba(255,255,255,.20);
    display: flex;
    align-items: center;
    gap: 9px;
    font-size: 12px;
    font-weight: 900;
    white-space: nowrap;
  }

  .live-badge span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #86efac;
    box-shadow: 0 0 0 5px rgba(134,239,172,.14);
  }

  .stats-grid {
    margin-top: 18px;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 15px;
  }

  .stat-card {
    min-height: 122px;
    padding: 20px;
    background: ${COLORS.card};
    border: 1px solid ${COLORS.border};
    border-radius: 19px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    box-shadow: 0 8px 24px rgba(15,23,42,.045);
  }

  .stat-card div > span {
    display: block;
    color: ${COLORS.muted};
    font-size: 12px;
    font-weight: 900;
  }

  .stat-card div > strong {
    display: block;
    margin-top: 12px;
    font-size: 32px;
    font-weight: 900;
  }

  .stat-card i {
    width: 48px;
    height: 48px;
    border-radius: 15px;
    display: grid;
    place-items: center;
    background: ${COLORS.tealSoft};
    color: ${COLORS.dark};
    font-style: normal;
    font-size: 20px;
    font-weight: 900;
  }

  .stat-card.primary {
    color: #fff;
    background: linear-gradient(145deg, #0f766e, #115e59);
    border-color: transparent;
  }

  .stat-card.primary div > span {
    color: rgba(255,255,255,.76);
  }

  .stat-card.primary i {
    color: #fff;
    background: rgba(255,255,255,.14);
  }

  .stat-card.warning i {
    background: #fff7ed;
    color: #c2410c;
  }

  .stat-card.info i {
    background: #eff6ff;
    color: #2563eb;
  }

  .stat-card.success i {
    background: #ecfdf5;
    color: #15803d;
  }

  .content-card {
    margin-top: 18px;
    padding: 20px;
    background: #fff;
    border: 1px solid ${COLORS.border};
    border-radius: 22px;
    box-shadow: 0 8px 24px rgba(15,23,42,.045);
  }

  .toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    margin-bottom: 18px;
  }

  .search-box {
    width: min(560px, 65%);
    height: 46px;
    padding: 0 14px;
    background: #f8fafc;
    border: 1px solid ${COLORS.border};
    border-radius: 14px;
    display: flex;
    align-items: center;
    gap: 9px;
  }

  .search-box span {
    color: ${COLORS.muted};
    font-size: 21px;
  }

  .search-box input {
    width: 100%;
    border: 0;
    outline: 0;
    background: transparent;
    font: inherit;
    text-align: right;
  }

  .toolbar > select,
  .modal-status-row select {
    height: 46px;
    min-width: 170px;
    padding: 0 13px;
    border: 1px solid ${COLORS.border};
    border-radius: 13px;
    background: #fff;
    color: ${COLORS.text};
    outline: 0;
    font: inherit;
    font-size: 12px;
    font-weight: 800;
  }

  .table-scroll {
    overflow-x: auto;
  }

  table {
    width: 100%;
    min-width: 1120px;
    border-collapse: collapse;
  }

  th {
    padding: 13px 11px;
    background: #f8fafc;
    color: ${COLORS.muted};
    border-bottom: 1px solid ${COLORS.border};
    text-align: right;
    font-size: 11px;
    font-weight: 900;
  }

  td {
    padding: 14px 11px;
    border-bottom: 1px solid #edf2f7;
    color: #334155;
    font-size: 12px;
    font-weight: 700;
    vertical-align: middle;
  }

  tbody tr:last-child td {
    border-bottom: 0;
  }

  tbody tr:hover {
    background: #fcfdfd;
  }

  .doctor-cell {
    min-width: 190px;
    display: flex;
    align-items: center;
    gap: 11px;
  }

  .doctor-avatar {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    background: #f0fdfa;
    color: ${COLORS.dark};
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    font-size: 17px;
    font-weight: 900;
  }

  .doctor-cell strong,
  .location-main,
  .sender-name {
    display: block;
    color: ${COLORS.text};
    font-weight: 900;
  }

  .doctor-cell small,
  .location-sub,
  .sender-phone {
    display: block;
    margin-top: 4px;
    color: ${COLORS.muted};
    font-size: 10px;
  }

  .phone-link {
    color: ${COLORS.dark};
    text-decoration: none;
    font-weight: 900;
  }

  .muted {
    color: ${COLORS.muted};
  }

  .status-select {
    min-width: 120px;
    height: 36px;
    padding: 0 9px;
    border: 0;
    border-radius: 999px;
    outline: 0;
    font: inherit;
    font-size: 10px;
    font-weight: 900;
  }

  .status-select.status-new,
  .status-badge.status-new {
    background: #eff6ff;
    color: #1d4ed8;
  }

  .status-select.status-contacted,
  .status-badge.status-contacted {
    background: #fff7ed;
    color: #c2410c;
  }

  .status-select.status-approved,
  .status-badge.status-approved {
    background: #ecfdf5;
    color: #15803d;
  }

  .status-select.status-rejected,
  .status-badge.status-rejected {
    background: #fef2f2;
    color: #dc2626;
  }

  .actions,
  .mobile-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  button {
    font-family: inherit;
  }

  .view-button,
  .delete-button,
  .close-button {
    min-height: 36px;
    padding: 0 13px;
    border: 0;
    border-radius: 10px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 900;
  }

  .view-button {
    background: #f0fdfa;
    color: ${COLORS.dark};
  }

  .delete-button {
    background: #fef2f2;
    color: ${COLORS.danger};
  }

  .delete-button.large {
    min-height: 42px;
  }

  .close-button {
    min-height: 42px;
    background: #f1f5f9;
    color: #334155;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: .58;
  }

  .mobile-cards {
    display: none;
  }

  .status-badge {
    padding: 7px 10px;
    border-radius: 999px;
    font-size: 10px;
    font-weight: 900;
    white-space: nowrap;
  }

  .empty-state {
    min-height: 320px;
    padding: 35px 20px;
    display: grid;
    place-items: center;
    align-content: center;
    text-align: center;
  }

  .empty-state > div {
    width: 60px;
    height: 60px;
    border-radius: 20px;
    background: #f0fdfa;
    color: ${COLORS.dark};
    display: grid;
    place-items: center;
    font-size: 27px;
    font-weight: 900;
  }

  .empty-state h3 {
    margin: 16px 0 0;
    font-size: 17px;
  }

  .empty-state p {
    margin: 7px 0 0;
    color: ${COLORS.muted};
    font-size: 12px;
    font-weight: 700;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    padding: 22px;
    background: rgba(15,23,42,.48);
    backdrop-filter: blur(5px);
    display: grid;
    place-items: center;
  }

  .modal {
    width: min(780px, 100%);
    max-height: 90vh;
    overflow: auto;
    background: #fff;
    border-radius: 22px;
    box-shadow: 0 30px 70px rgba(15,23,42,.25);
  }

  .modal-header {
    padding: 20px 22px;
    border-bottom: 1px solid ${COLORS.border};
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .modal-header span {
    color: ${COLORS.muted};
    font-size: 11px;
    font-weight: 900;
  }

  .modal-header h2 {
    margin: 5px 0 0;
    font-size: 21px;
  }

  .modal-header button {
    width: 38px;
    height: 38px;
    border: 0;
    border-radius: 12px;
    background: #f1f5f9;
    color: #334155;
    cursor: pointer;
    font-size: 25px;
  }

  .modal-body {
    padding: 22px;
  }

  .modal-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0,1fr));
    gap: 13px;
  }

  .info-item {
    padding: 14px;
    border: 1px solid #edf2f7;
    border-radius: 14px;
    background: #fcfdfd;
  }

  .info-item.wide {
    grid-column: 1 / -1;
  }

  .info-item span {
    display: block;
    color: ${COLORS.muted};
    font-size: 10px;
    font-weight: 900;
  }

  .info-item strong,
  .info-item a {
    display: block;
    margin-top: 7px;
    color: ${COLORS.text};
    text-decoration: none;
    font-size: 13px;
    font-weight: 900;
    line-height: 1.6;
  }

  .modal-status-row {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid ${COLORS.border};
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
  }

  .modal-status-row label {
    font-size: 13px;
    font-weight: 900;
  }

  .modal-footer {
    padding: 18px 22px;
    border-top: 1px solid ${COLORS.border};
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }

  .toast {
    position: fixed;
    left: 25px;
    bottom: 25px;
    z-index: 1300;
    padding: 13px 17px;
    border-radius: 13px;
    background: #0f172a;
    color: #fff;
    box-shadow: 0 14px 35px rgba(15,23,42,.22);
    font-size: 12px;
    font-weight: 900;
  }

  .skeleton-list {
    display: grid;
    gap: 10px;
  }

  .skeleton-row {
    min-height: 74px;
    padding: 13px;
    border: 1px solid #edf2f7;
    border-radius: 14px;
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .shimmer {
    position: relative;
    overflow: hidden;
    background: #e8edf3;
  }

  .shimmer::after {
    content: "";
    position: absolute;
    inset: 0;
    transform: translateX(100%);
    background: linear-gradient(90deg, transparent, rgba(255,255,255,.68), transparent);
    animation: shimmer 1.2s infinite;
  }

  .skeleton-avatar {
    width: 44px;
    height: 44px;
    border-radius: 14px;
  }

  .skeleton-text {
    width: 16%;
    height: 13px;
    border-radius: 999px;
  }

  .skeleton-text.large {
    width: 25%;
  }

  .skeleton-button {
    width: 76px;
    height: 34px;
    margin-right: auto;
    border-radius: 10px;
  }

  @keyframes shimmer {
    to {
      transform: translateX(-100%);
    }
  }

  @media (max-width: 1100px) {
    .stats-grid {
      grid-template-columns: repeat(2, minmax(0,1fr));
    }
  }

  @media (max-width: 760px) {
    .recommendations-page {
      padding: 15px;
    }

    .page-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .live-badge {
      width: 100%;
      justify-content: center;
    }

    .stats-grid {
      grid-template-columns: 1fr;
    }

    .toolbar {
      align-items: stretch;
      flex-direction: column;
    }

    .search-box {
      width: 100%;
    }

    .toolbar > select {
      width: 100%;
    }

    .table-scroll {
      display: none;
    }

    .mobile-cards {
      display: grid;
      gap: 12px;
    }

    .mobile-card {
      padding: 15px;
      border: 1px solid ${COLORS.border};
      border-radius: 17px;
      background: #fff;
    }

    .mobile-card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    .mobile-details {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid #edf2f7;
      display: grid;
      gap: 9px;
    }

    .detail-line {
      display: flex;
      justify-content: space-between;
      gap: 15px;
      font-size: 11px;
    }

    .detail-line span {
      color: ${COLORS.muted};
      font-weight: 800;
    }

    .detail-line strong {
      text-align: left;
      font-weight: 900;
    }

    .mobile-actions {
      margin-top: 14px;
    }

    .mobile-actions .view-button {
      flex: 1;
    }

    .modal-backdrop {
      padding: 10px;
    }

    .modal-grid {
      grid-template-columns: 1fr;
    }

    .info-item.wide {
      grid-column: auto;
    }

    .modal-status-row {
      align-items: stretch;
      flex-direction: column;
    }

    .modal-status-row select {
      width: 100%;
    }
  }
`;
