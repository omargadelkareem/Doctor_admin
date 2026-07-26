import React, { useEffect, useMemo, useRef, useState } from 'react';
import { db } from '../firebase';
import { get, ref } from 'firebase/database';

const COLORS = {
  dark: '#0f766e',
  teal: '#14b8a6',
  bg: '#f6f8fb',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  danger: '#dc2626',
  warning: '#f59e0b',
  success: '#16a34a',
  info: '#2563eb',
};

const REPORT_TYPES = [
  { value: 'overview', label: 'التقرير الشامل' },
  { value: 'appointments', label: 'تقرير الحجوزات' },
  { value: 'doctors', label: 'تقرير الأطباء' },
  { value: 'patients', label: 'تقرير المرضى' },
  { value: 'recommendations', label: 'ترشيحات الأطباء' },
  { value: 'financial', label: 'التقرير المالي' },
  { value: 'withdrawals', label: 'طلبات السحب' },
];

const APPOINTMENT_STATUS_OPTIONS = [
  { value: 'all', label: 'كل الحالات' },
  { value: 'admin_pending', label: 'مراجعة الإدارة' },
  { value: 'pending', label: 'قيد الانتظار' },
  { value: 'confirmed', label: 'مؤكد' },
  { value: 'accepted', label: 'مقبول' },
  { value: 'completed', label: 'مكتمل' },
  { value: 'cancelled', label: 'ملغي' },
  { value: 'rejected', label: 'مرفوض' },
];

const CURRENCY = 'جنيه';
const PAGE_SIZE = 20;

export default function Reports() {
  const [data, setData] = useState({
    users: [],
    appointments: [],
    recommendations: [],
    withdrawals: [],
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [reportType, setReportType] = useState('overview');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(firstDayOfCurrentMonth());
  const [dateTo, setDateTo] = useState(todayKey());
  const [page, setPage] = useState(1);
  const [previewOpen, setPreviewOpen] = useState(false);
  const reportRef = useRef(null);

  useEffect(() => {
    loadReportsData();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [reportType, search, statusFilter, dateFrom, dateTo]);

  async function loadReportsData() {
    setLoading(true);
    setError('');

    try {
      const [
        usersSnapshot,
        appointmentsSnapshot,
        recommendationsSnapshot,
        withdrawalsSnapshot,
      ] = await Promise.all([
        get(ref(db, 'users')),
        get(ref(db, 'dashboardAppointments')),
        get(ref(db, 'doctorRecommendations')),
        get(ref(db, 'withdrawals')),
      ]);

      setData({
        users: snapshotToList(usersSnapshot),
        appointments: snapshotToList(appointmentsSnapshot),
        recommendations: snapshotToList(recommendationsSnapshot),
        withdrawals: flattenWithdrawals(withdrawalsSnapshot.val()),
      });
    } catch (loadError) {
      console.error('Reports load error:', loadError);
      setError('تعذر تحميل بيانات التقارير. تأكد من اتصال Firebase والصلاحيات.');
    } finally {
      setLoading(false);
    }
  }

  const doctors = useMemo(
    () => data.users.filter((item) => normalizeRole(item.role) === 'doctor'),
    [data.users],
  );

  const patients = useMemo(
    () => data.users.filter((item) => normalizeRole(item.role) === 'patient'),
    [data.users],
  );

  const filteredAppointments = useMemo(() => {
    return data.appointments.filter((item) => {
      if (!isDateInside(item.date, dateFrom, dateTo)) return false;

      const status = appointmentStatus(item);

      if (statusFilter !== 'all' && status !== statusFilter) {
        return false;
      }

      return matchesSearch(item, search, [
        'patientName',
        'patientPhone',
        'doctorName',
        'doctorPhone',
        'specialization',
        'clinicName',
        'clinicAddress',
        'status',
        'bookingStatus',
      ]);
    });
  }, [data.appointments, dateFrom, dateTo, search, statusFilter]);

  const filteredDoctors = useMemo(() => {
    return doctors.filter((item) => {
      const createdAt = item.createdAt || item.registeredAt;
      if (createdAt && !isDateInside(createdAt, dateFrom, dateTo)) return false;

      return matchesSearch(item, search, [
        'name',
        'fullName',
        'displayName',
        'phone',
        'email',
        'specialization',
        'speciality',
        'governorate',
        'city',
      ]);
    });
  }, [doctors, dateFrom, dateTo, search]);

  const filteredPatients = useMemo(() => {
    return patients.filter((item) => {
      const createdAt = item.createdAt || item.registeredAt;
      if (createdAt && !isDateInside(createdAt, dateFrom, dateTo)) return false;

      return matchesSearch(item, search, [
        'name',
        'fullName',
        'displayName',
        'phone',
        'email',
        'governorate',
        'city',
      ]);
    });
  }, [patients, dateFrom, dateTo, search]);

  const filteredRecommendations = useMemo(() => {
    return data.recommendations.filter((item) => {
      const createdAt = item.createdAt || item.timestamp || item.submittedAt;
      if (createdAt && !isDateInside(createdAt, dateFrom, dateTo)) return false;

      return matchesSearch(item, search, [
        'doctorName',
        'name',
        'fullName',
        'specialization',
        'speciality',
        'phone',
        'doctorPhone',
        'governorate',
        'city',
        'patientName',
        'senderName',
      ]);
    });
  }, [data.recommendations, dateFrom, dateTo, search]);

  const filteredWithdrawals = useMemo(() => {
    return data.withdrawals.filter((item) => {
      const createdAt = item.createdAt || item.requestedAt || item.timestamp;
      if (createdAt && !isDateInside(createdAt, dateFrom, dateTo)) return false;

      return matchesSearch(item, search, [
        'doctorName',
        'name',
        'phone',
        'walletNumber',
        'method',
        'status',
      ]);
    });
  }, [data.withdrawals, dateFrom, dateTo, search]);

  const summary = useMemo(() => {
    const completed = filteredAppointments.filter(
      (item) => appointmentStatus(item) === 'completed',
    );
    const cancelled = filteredAppointments.filter((item) =>
      ['cancelled', 'canceled', 'rejected'].includes(appointmentStatus(item)),
    );
    const revenue = filteredAppointments
      .filter(
        (item) =>
          !['cancelled', 'canceled', 'rejected'].includes(
            appointmentStatus(item),
          ),
      )
      .reduce((sum, item) => sum + appointmentPrice(item), 0);
    const withdrawalsTotal = filteredWithdrawals.reduce(
      (sum, item) => sum + safeNumber(item.amount || item.value),
      0,
    );

    return {
      appointments: filteredAppointments.length,
      completed: completed.length,
      cancelled: cancelled.length,
      revenue,
      doctors: filteredDoctors.length,
      approvedDoctors: filteredDoctors.filter(isDoctorApproved).length,
      patients: filteredPatients.length,
      recommendations: filteredRecommendations.length,
      withdrawals: filteredWithdrawals.length,
      withdrawalsTotal,
      cancellationRate:
        filteredAppointments.length === 0
          ? 0
          : (cancelled.length / filteredAppointments.length) * 100,
      completionRate:
        filteredAppointments.length === 0
          ? 0
          : (completed.length / filteredAppointments.length) * 100,
    };
  }, [
    filteredAppointments,
    filteredDoctors,
    filteredPatients,
    filteredRecommendations,
    filteredWithdrawals,
  ]);

  const currentRows = useMemo(() => {
    switch (reportType) {
      case 'appointments':
      case 'financial':
        return filteredAppointments;
      case 'doctors':
        return filteredDoctors;
      case 'patients':
        return filteredPatients;
      case 'recommendations':
        return filteredRecommendations;
      case 'withdrawals':
        return filteredWithdrawals;
      default:
        return filteredAppointments;
    }
  }, [
    reportType,
    filteredAppointments,
    filteredDoctors,
    filteredPatients,
    filteredRecommendations,
    filteredWithdrawals,
  ]);

  const totalPages = Math.max(1, Math.ceil(currentRows.length / PAGE_SIZE));
  const paginatedRows = currentRows.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  async function exportExcel() {
    if (exporting) return;

    setExporting('excel');

    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();

      if (reportType === 'overview') {
        appendSheet(
          XLSX,
          workbook,
          'الملخص',
          overviewExportRows(summary, dateFrom, dateTo),
        );
        appendSheet(
          XLSX,
          workbook,
          'الحجوزات',
          filteredAppointments.map(appointmentExportRow),
        );
        appendSheet(
          XLSX,
          workbook,
          'الأطباء',
          filteredDoctors.map(doctorExportRow),
        );
        appendSheet(
          XLSX,
          workbook,
          'المرضى',
          filteredPatients.map(patientExportRow),
        );
        appendSheet(
          XLSX,
          workbook,
          'الترشيحات',
          filteredRecommendations.map(recommendationExportRow),
        );
        appendSheet(
          XLSX,
          workbook,
          'طلبات السحب',
          filteredWithdrawals.map(withdrawalExportRow),
        );
      } else {
        appendSheet(
          XLSX,
          workbook,
          reportTitle(reportType),
          exportRowsForType(reportType, currentRows),
        );
      }

      XLSX.writeFile(
        workbook,
        `تقرير_${reportType}_${dateFrom}_${dateTo}.xlsx`,
      );

      notify('تم إنشاء ملف Excel بنجاح');
    } catch (exportError) {
      console.error('Excel export error:', exportError);
      notify('تعذر إنشاء ملف Excel. تأكد من تثبيت مكتبة xlsx.');
    } finally {
      setExporting('');
    }
  }

  async function exportPdf() {
    if (exporting) return;

    setPreviewOpen(true);
    setExporting('pdf');

    try {
      await waitForRender();

      const [{ default: html2canvas }, jspdfModule] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const jsPDF = jspdfModule.jsPDF || jspdfModule.default;

      if (!reportRef.current) {
        throw new Error('Report preview element not found');
      }

      const canvas = await html2canvas(reportRef.current, {
        scale: 1.7,
        useCORS: true,
        backgroundColor: '#ffffff',
        windowWidth: reportRef.current.scrollWidth,
      });

      const image = canvas.toDataURL('image/jpeg', 0.94);
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const imageWidth = pageWidth - margin * 2;
      const imageHeight = (canvas.height * imageWidth) / canvas.width;
      const printableHeight = pageHeight - margin * 2;

      let renderedHeight = 0;
      let pageIndex = 0;

      while (renderedHeight < imageHeight) {
        if (pageIndex > 0) pdf.addPage();

        pdf.addImage(
          image,
          'JPEG',
          margin,
          margin - renderedHeight,
          imageWidth,
          imageHeight,
          undefined,
          'FAST',
        );

        renderedHeight += printableHeight;
        pageIndex += 1;
      }

      pdf.save(`تقرير_${reportType}_${dateFrom}_${dateTo}.pdf`);
      notify('تم إنشاء ملف PDF بنجاح');
    } catch (exportError) {
      console.error('PDF export error:', exportError);
      notify(
        'تعذر إنشاء PDF. تأكد من تثبيت html2canvas و jspdf ثم حاول مجددًا.',
      );
    } finally {
      setExporting('');
    }
  }

  function printReport() {
    setPreviewOpen(true);
    window.setTimeout(() => window.print(), 250);
  }

  function notify(text) {
    setMessage(text);
    window.clearTimeout(window.__reportsToastTimer);
    window.__reportsToastTimer = window.setTimeout(() => {
      setMessage('');
    }, 2800);
  }

  return (
    <div className="reports-page" dir="rtl">
      <header className="reports-header">
        <div>
          <span className="eyebrow">مركز التقارير</span>
          <h1>تقارير النظام</h1>
          <p>
            تقارير شاملة من بيانات Firebase الحقيقية مع التصفية والتصدير إلى
            PDF وExcel.
          </p>
        </div>

        <button className="refresh-button" onClick={loadReportsData}>
          تحديث البيانات
        </button>
      </header>

      <section className="filters-card">
        <div className="filter-group report-type">
          <label>نوع التقرير</label>
          <select
            value={reportType}
            onChange={(event) => setReportType(event.target.value)}
          >
            {REPORT_TYPES.map((type) => (
              <option value={type.value} key={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>من تاريخ</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>إلى تاريخ</label>
          <input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
          />
        </div>

        {(reportType === 'appointments' ||
          reportType === 'financial' ||
          reportType === 'overview') && (
          <div className="filter-group">
            <label>حالة الحجز</label>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              {APPOINTMENT_STATUS_OPTIONS.map((status) => (
                <option value={status.value} key={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="filter-group search-group">
          <label>البحث</label>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="اسم، هاتف، تخصص، حالة..."
          />
        </div>
      </section>

      <section className="export-bar">
        <div>
          <strong>{reportTitle(reportType)}</strong>
          <span>
            الفترة من {formatDate(dateFrom)} إلى {formatDate(dateTo)}
          </span>
        </div>

        <div className="export-actions">
          <button className="preview-button" onClick={() => setPreviewOpen(true)}>
            معاينة التقرير
          </button>
          <button className="print-button" onClick={printReport}>
            طباعة / حفظ PDF
          </button>
          <button
            className="pdf-button"
            disabled={Boolean(exporting)}
            onClick={exportPdf}
          >
            {exporting === 'pdf' ? 'جاري إنشاء PDF...' : 'تنزيل PDF'}
          </button>
          <button
            className="excel-button"
            disabled={Boolean(exporting)}
            onClick={exportExcel}
          >
            {exporting === 'excel' ? 'جاري إنشاء Excel...' : 'تنزيل Excel'}
          </button>
        </div>
      </section>

      {error && <div className="error-box">{error}</div>}

      {loading ? (
        <ReportsSkeleton />
      ) : (
        <>
          <section className="summary-grid">
            <SummaryCard
              title="إجمالي الحجوزات"
              value={summary.appointments}
              icon="◫"
              tone="primary"
            />
            <SummaryCard
              title="الإيرادات"
              value={formatMoney(summary.revenue)}
              icon="ج"
              tone="success"
            />
            <SummaryCard
              title="الحجوزات المكتملة"
              value={summary.completed}
              note={`${formatPercent(summary.completionRate)} معدل الإكمال`}
              icon="✓"
              tone="info"
            />
            <SummaryCard
              title="الحجوزات الملغاة"
              value={summary.cancelled}
              note={`${formatPercent(summary.cancellationRate)} معدل الإلغاء`}
              icon="×"
              tone="danger"
            />
            <SummaryCard
              title="الأطباء"
              value={summary.doctors}
              note={`${summary.approvedDoctors} معتمد`}
              icon="+"
            />
            <SummaryCard
              title="المرضى"
              value={summary.patients}
              icon="♙"
            />
            <SummaryCard
              title="ترشيحات الأطباء"
              value={summary.recommendations}
              icon="☆"
            />
            <SummaryCard
              title="طلبات السحب"
              value={summary.withdrawals}
              note={formatMoney(summary.withdrawalsTotal)}
              icon="↗"
            />
          </section>

          <section className="charts-grid">
            <AppointmentsTrend appointments={filteredAppointments} />
            <StatusDistribution appointments={filteredAppointments} />
          </section>

          <section className="report-table-card">
            <div className="table-header">
              <div>
                <h2>{reportTitle(reportType)}</h2>
                <p>{formatNumber(currentRows.length)} سجل مطابق للفلاتر الحالية</p>
              </div>
            </div>

            {reportType === 'overview' ? (
              <OverviewSections
                appointments={filteredAppointments}
                doctors={filteredDoctors}
                recommendations={filteredRecommendations}
              />
            ) : currentRows.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                <ReportTable type={reportType} rows={paginatedRows} />

                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onChange={setPage}
                />
              </>
            )}
          </section>
        </>
      )}

      {previewOpen && (
        <ReportPreviewModal
          reportRef={reportRef}
          reportType={reportType}
          dateFrom={dateFrom}
          dateTo={dateTo}
          summary={summary}
          appointments={filteredAppointments}
          doctors={filteredDoctors}
          patients={filteredPatients}
          recommendations={filteredRecommendations}
          withdrawals={filteredWithdrawals}
          onClose={() => setPreviewOpen(false)}
          onPdf={exportPdf}
          exporting={exporting}
        />
      )}

      {message && <div className="toast">{message}</div>}

      <style>{styles}</style>
    </div>
  );
}

function SummaryCard({ title, value, note, icon, tone = 'default' }) {
  return (
    <article className={`summary-card ${tone}`}>
      <div>
        <span>{title}</span>
        <strong>
          {typeof value === 'number' ? formatNumber(value) : value}
        </strong>
        {note && <small>{note}</small>}
      </div>
      <i>{icon}</i>
    </article>
  );
}

function AppointmentsTrend({ appointments }) {
  const data = useMemo(() => {
    const result = [];

    for (let index = 6; index >= 0; index -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - index);
      const key = localDateKey(date);

      result.push({
        key,
        label: new Intl.DateTimeFormat('ar-EG', {
          weekday: 'short',
        }).format(date),
        value: appointments.filter(
          (item) => normalizeDate(item.date) === key,
        ).length,
      });
    }

    return result;
  }, [appointments]);

  const max = Math.max(1, ...data.map((item) => item.value));

  return (
    <section className="chart-card">
      <div className="chart-header">
        <div>
          <h3>اتجاه الحجوزات</h3>
          <p>عدد الحجوزات خلال آخر 7 أيام</p>
        </div>
      </div>

      <div className="bar-chart">
        {data.map((item) => (
          <div className="bar-column" key={item.key}>
            <span>{formatNumber(item.value)}</span>
            <div className="bar-track">
              <i
                style={{
                  height: `${Math.max(4, (item.value / max) * 100)}%`,
                }}
              />
            </div>
            <b>{item.label}</b>
          </div>
        ))}
      </div>
    </section>
  );
}

function StatusDistribution({ appointments }) {
  const data = useMemo(() => {
    const counts = {};

    appointments.forEach((item) => {
      const status = appointmentStatus(item);
      counts[status] = (counts[status] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([status, value]) => ({
        status,
        label: appointmentStatusLabel(status),
        value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [appointments]);

  const total = Math.max(
    1,
    data.reduce((sum, item) => sum + item.value, 0),
  );

  return (
    <section className="chart-card">
      <div className="chart-header">
        <div>
          <h3>توزيع حالات الحجوزات</h3>
          <p>النسبة لكل حالة خلال الفترة المحددة</p>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="small-empty">لا توجد حجوزات خلال هذه الفترة</div>
      ) : (
        <div className="status-bars">
          {data.map((item) => {
            const percent = (item.value / total) * 100;

            return (
              <div className="status-row" key={item.status}>
                <div>
                  <strong>{item.label}</strong>
                  <span>
                    {formatNumber(item.value)} · {formatPercent(percent)}
                  </span>
                </div>
                <div className="progress-track">
                  <i style={{ width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function OverviewSections({ appointments, doctors, recommendations }) {
  return (
    <div className="overview-sections">
      <div>
        <h3>أحدث الحجوزات</h3>
        <ReportTable type="appointments" rows={appointments.slice(0, 8)} />
      </div>

      <div>
        <h3>أحدث الأطباء</h3>
        <ReportTable type="doctors" rows={doctors.slice(0, 6)} />
      </div>

      <div>
        <h3>أحدث الترشيحات</h3>
        <ReportTable
          type="recommendations"
          rows={recommendations.slice(0, 6)}
        />
      </div>
    </div>
  );
}

function ReportTable({ type, rows }) {
  if (rows.length === 0) return <EmptyState />;

  const columns = columnsForType(type);

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || index}>
              {columns.map((column) => (
                <td key={column.key}>
                  {column.render
                    ? column.render(row)
                    : safeDisplay(row[column.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({ page, totalPages, onChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="pagination">
      <button disabled={page <= 1} onClick={() => onChange(page - 1)}>
        السابق
      </button>

      <span>
        الصفحة {formatNumber(page)} من {formatNumber(totalPages)}
      </span>

      <button
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        التالي
      </button>
    </div>
  );
}

function ReportPreviewModal({
  reportRef,
  reportType,
  dateFrom,
  dateTo,
  summary,
  appointments,
  doctors,
  patients,
  recommendations,
  withdrawals,
  onClose,
  onPdf,
  exporting,
}) {
  return (
    <div className="preview-backdrop">
      <div className="preview-shell">
        <div className="preview-toolbar no-print">
          <strong>معاينة التقرير</strong>
          <div>
            <button onClick={() => window.print()}>طباعة / حفظ PDF</button>
            <button disabled={Boolean(exporting)} onClick={onPdf}>
              {exporting === 'pdf' ? 'جاري الإنشاء...' : 'تنزيل PDF'}
            </button>
            <button onClick={onClose}>إغلاق</button>
          </div>
        </div>

        <article className="print-report" ref={reportRef}>
          <header className="print-header">
            <div>
              <h1>{reportTitle(reportType)}</h1>
              <p>
                من {formatDate(dateFrom)} إلى {formatDate(dateTo)}
              </p>
            </div>
            <div className="print-brand">تقرير النظام</div>
          </header>

          <section className="print-summary">
            <PrintMetric title="الحجوزات" value={summary.appointments} />
            <PrintMetric title="الإيرادات" value={formatMoney(summary.revenue)} />
            <PrintMetric title="الأطباء" value={summary.doctors} />
            <PrintMetric title="المرضى" value={summary.patients} />
            <PrintMetric title="الترشيحات" value={summary.recommendations} />
            <PrintMetric title="طلبات السحب" value={summary.withdrawals} />
          </section>

          <PrintReportContent
            type={reportType}
            appointments={appointments}
            doctors={doctors}
            patients={patients}
            recommendations={recommendations}
            withdrawals={withdrawals}
          />

          <footer className="print-footer">
            تم إنشاء التقرير بتاريخ {formatDateTime(Date.now())}
          </footer>
        </article>
      </div>
    </div>
  );
}

function PrintMetric({ title, value }) {
  return (
    <div>
      <span>{title}</span>
      <strong>{typeof value === 'number' ? formatNumber(value) : value}</strong>
    </div>
  );
}

function PrintReportContent({
  type,
  appointments,
  doctors,
  patients,
  recommendations,
  withdrawals,
}) {
  if (type === 'overview') {
    return (
      <div className="print-sections">
        <PrintSection
          title="الحجوزات"
          type="appointments"
          rows={appointments.slice(0, 30)}
        />
        <PrintSection title="الأطباء" type="doctors" rows={doctors.slice(0, 25)} />
        <PrintSection
          title="المرضى"
          type="patients"
          rows={patients.slice(0, 25)}
        />
        <PrintSection
          title="ترشيحات الأطباء"
          type="recommendations"
          rows={recommendations.slice(0, 25)}
        />
        <PrintSection
          title="طلبات السحب"
          type="withdrawals"
          rows={withdrawals.slice(0, 25)}
        />
      </div>
    );
  }

  const rows =
    type === 'appointments' || type === 'financial'
      ? appointments
      : type === 'doctors'
        ? doctors
        : type === 'patients'
          ? patients
          : type === 'recommendations'
            ? recommendations
            : withdrawals;

  return <PrintSection title={reportTitle(type)} type={type} rows={rows} />;
}

function PrintSection({ title, type, rows }) {
  return (
    <section className="print-section">
      <h2>{title}</h2>
      <ReportTable type={type} rows={rows} />
    </section>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <div>◫</div>
      <h3>لا توجد بيانات</h3>
      <p>لا توجد سجلات مطابقة للفلاتر الحالية.</p>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <>
      <div className="skeleton-grid">
        {Array.from({ length: 8 }).map((_, index) => (
          <div className="shimmer skeleton-card" key={index} />
        ))}
      </div>
      <div className="skeleton-charts">
        <div className="shimmer skeleton-chart" />
        <div className="shimmer skeleton-chart" />
      </div>
      <div className="shimmer skeleton-table" />
    </>
  );
}

function columnsForType(type) {
  switch (type) {
    case 'appointments':
      return [
        {
          key: 'patientName',
          label: 'المريض',
          render: (item) => item.patientName || 'غير محدد',
        },
        {
          key: 'doctorName',
          label: 'الطبيب',
          render: (item) => item.doctorName || 'غير محدد',
        },
        {
          key: 'specialization',
          label: 'التخصص',
          render: (item) => item.specialization || 'غير محدد',
        },
        {
          key: 'date',
          label: 'التاريخ',
          render: (item) => formatDate(item.date),
        },
        {
          key: 'time',
          label: 'الوقت',
          render: (item) => item.time || '--:--',
        },
        {
          key: 'price',
          label: 'السعر',
          render: (item) => formatMoney(appointmentPrice(item)),
        },
        {
          key: 'status',
          label: 'الحالة',
          render: (item) => appointmentStatusLabel(appointmentStatus(item)),
        },
      ];

    case 'financial':
      return [
        {
          key: 'date',
          label: 'التاريخ',
          render: (item) => formatDate(item.date),
        },
        {
          key: 'patientName',
          label: 'المريض',
          render: (item) => item.patientName || 'غير محدد',
        },
        {
          key: 'doctorName',
          label: 'الطبيب',
          render: (item) => item.doctorName || 'غير محدد',
        },
        {
          key: 'clinicName',
          label: 'العيادة',
          render: (item) => item.clinicName || 'غير محدد',
        },
        {
          key: 'price',
          label: 'قيمة الحجز',
          render: (item) => formatMoney(appointmentPrice(item)),
        },
        {
          key: 'status',
          label: 'الحالة',
          render: (item) => appointmentStatusLabel(appointmentStatus(item)),
        },
      ];

    case 'doctors':
      return [
        {
          key: 'name',
          label: 'اسم الطبيب',
          render: (item) =>
            item.name || item.fullName || item.displayName || 'غير محدد',
        },
        {
          key: 'specialization',
          label: 'التخصص',
          render: (item) =>
            item.specialization || item.speciality || 'غير محدد',
        },
        {
          key: 'phone',
          label: 'الهاتف',
          render: (item) => item.phone || item.phoneNumber || 'غير متوفر',
        },
        {
          key: 'governorate',
          label: 'المحافظة',
          render: (item) => item.governorate || item.city || 'غير محدد',
        },
        {
          key: 'approved',
          label: 'الحالة',
          render: (item) => (isDoctorApproved(item) ? 'معتمد' : 'قيد المراجعة'),
        },
        {
          key: 'createdAt',
          label: 'تاريخ التسجيل',
          render: (item) =>
            formatDate(item.createdAt || item.registeredAt),
        },
      ];

    case 'patients':
      return [
        {
          key: 'name',
          label: 'اسم المريض',
          render: (item) =>
            item.name || item.fullName || item.displayName || 'غير محدد',
        },
        {
          key: 'phone',
          label: 'الهاتف',
          render: (item) => item.phone || item.phoneNumber || 'غير متوفر',
        },
        {
          key: 'email',
          label: 'البريد',
          render: (item) => item.email || 'غير متوفر',
        },
        {
          key: 'governorate',
          label: 'المحافظة',
          render: (item) => item.governorate || item.city || 'غير محدد',
        },
        {
          key: 'createdAt',
          label: 'تاريخ التسجيل',
          render: (item) =>
            formatDate(item.createdAt || item.registeredAt),
        },
      ];

    case 'recommendations':
      return [
        {
          key: 'doctorName',
          label: 'الطبيب المرشح',
          render: (item) =>
            item.doctorName || item.name || item.fullName || 'غير محدد',
        },
        {
          key: 'specialization',
          label: 'التخصص',
          render: (item) =>
            item.specialization || item.speciality || 'غير محدد',
        },
        {
          key: 'phone',
          label: 'الهاتف',
          render: (item) =>
            item.phone || item.doctorPhone || item.phoneNumber || 'غير متوفر',
        },
        {
          key: 'location',
          label: 'الموقع',
          render: (item) =>
            [
              item.governorate || item.city,
              item.center || item.area || item.district,
            ]
              .filter(Boolean)
              .join(' - ') || 'غير محدد',
        },
        {
          key: 'sender',
          label: 'المرسل',
          render: (item) =>
            item.patientName || item.senderName || item.userName || 'غير محدد',
        },
        {
          key: 'status',
          label: 'الحالة',
          render: (item) => recommendationStatusLabel(item.status),
        },
        {
          key: 'createdAt',
          label: 'التاريخ',
          render: (item) =>
            formatDate(item.createdAt || item.timestamp || item.submittedAt),
        },
      ];

    case 'withdrawals':
      return [
        {
          key: 'doctorName',
          label: 'الطبيب',
          render: (item) =>
            item.doctorName || item.name || item.userName || 'غير محدد',
        },
        {
          key: 'amount',
          label: 'المبلغ',
          render: (item) => formatMoney(item.amount || item.value),
        },
        {
          key: 'method',
          label: 'طريقة السحب',
          render: (item) => item.method || item.withdrawalMethod || 'غير محدد',
        },
        {
          key: 'walletNumber',
          label: 'رقم المحفظة',
          render: (item) =>
            item.walletNumber || item.accountNumber || item.phone || 'غير متوفر',
        },
        {
          key: 'status',
          label: 'الحالة',
          render: (item) => withdrawalStatusLabel(item.status),
        },
        {
          key: 'createdAt',
          label: 'التاريخ',
          render: (item) =>
            formatDate(item.createdAt || item.requestedAt || item.timestamp),
        },
      ];

    default:
      return [];
  }
}

function exportRowsForType(type, rows) {
  switch (type) {
    case 'appointments':
      return rows.map(appointmentExportRow);
    case 'financial':
      return rows.map(financialExportRow);
    case 'doctors':
      return rows.map(doctorExportRow);
    case 'patients':
      return rows.map(patientExportRow);
    case 'recommendations':
      return rows.map(recommendationExportRow);
    case 'withdrawals':
      return rows.map(withdrawalExportRow);
    default:
      return [];
  }
}

function appointmentExportRow(item) {
  return {
    'اسم المريض': item.patientName || 'غير محدد',
    'هاتف المريض': item.patientPhone || '',
    'اسم الطبيب': item.doctorName || 'غير محدد',
    التخصص: item.specialization || '',
    العيادة: item.clinicName || '',
    العنوان: item.clinicAddress || '',
    التاريخ: normalizeDate(item.date),
    الوقت: item.time || '',
    السعر: appointmentPrice(item),
    الحالة: appointmentStatusLabel(appointmentStatus(item)),
  };
}

function financialExportRow(item) {
  return {
    التاريخ: normalizeDate(item.date),
    المريض: item.patientName || 'غير محدد',
    الطبيب: item.doctorName || 'غير محدد',
    العيادة: item.clinicName || '',
    'قيمة الحجز': appointmentPrice(item),
    الحالة: appointmentStatusLabel(appointmentStatus(item)),
  };
}

function doctorExportRow(item) {
  return {
    'اسم الطبيب':
      item.name || item.fullName || item.displayName || 'غير محدد',
    التخصص: item.specialization || item.speciality || '',
    الهاتف: item.phone || item.phoneNumber || '',
    البريد: item.email || '',
    المحافظة: item.governorate || item.city || '',
    الحالة: isDoctorApproved(item) ? 'معتمد' : 'قيد المراجعة',
    'تاريخ التسجيل': normalizeDate(item.createdAt || item.registeredAt),
  };
}

function patientExportRow(item) {
  return {
    'اسم المريض':
      item.name || item.fullName || item.displayName || 'غير محدد',
    الهاتف: item.phone || item.phoneNumber || '',
    البريد: item.email || '',
    المحافظة: item.governorate || item.city || '',
    'تاريخ التسجيل': normalizeDate(item.createdAt || item.registeredAt),
  };
}

function recommendationExportRow(item) {
  return {
    'اسم الطبيب':
      item.doctorName || item.name || item.fullName || 'غير محدد',
    التخصص: item.specialization || item.speciality || '',
    الهاتف: item.phone || item.doctorPhone || item.phoneNumber || '',
    المحافظة: item.governorate || item.city || '',
    المركز: item.center || item.area || item.district || '',
    المرسل: item.patientName || item.senderName || item.userName || '',
    الحالة: recommendationStatusLabel(item.status),
    التاريخ: normalizeDate(
      item.createdAt || item.timestamp || item.submittedAt,
    ),
  };
}

function withdrawalExportRow(item) {
  return {
    الطبيب: item.doctorName || item.name || item.userName || 'غير محدد',
    المبلغ: safeNumber(item.amount || item.value),
    'طريقة السحب': item.method || item.withdrawalMethod || '',
    'رقم المحفظة':
      item.walletNumber || item.accountNumber || item.phone || '',
    الحالة: withdrawalStatusLabel(item.status),
    التاريخ: normalizeDate(
      item.createdAt || item.requestedAt || item.timestamp,
    ),
  };
}

function overviewExportRows(summary, dateFrom, dateTo) {
  return [
    { البيان: 'الفترة من', القيمة: dateFrom },
    { البيان: 'الفترة إلى', القيمة: dateTo },
    { البيان: 'إجمالي الحجوزات', القيمة: summary.appointments },
    { البيان: 'الحجوزات المكتملة', القيمة: summary.completed },
    { البيان: 'الحجوزات الملغاة', القيمة: summary.cancelled },
    { البيان: 'الإيرادات', القيمة: summary.revenue },
    { البيان: 'عدد الأطباء', القيمة: summary.doctors },
    { البيان: 'الأطباء المعتمدون', القيمة: summary.approvedDoctors },
    { البيان: 'عدد المرضى', القيمة: summary.patients },
    { البيان: 'ترشيحات الأطباء', القيمة: summary.recommendations },
    { البيان: 'طلبات السحب', القيمة: summary.withdrawals },
    { البيان: 'إجمالي طلبات السحب', القيمة: summary.withdrawalsTotal },
  ];
}

function appendSheet(XLSX, workbook, name, rows) {
  const safeRows = rows.length ? rows : [{ ملاحظة: 'لا توجد بيانات' }];
  const worksheet = XLSX.utils.json_to_sheet(safeRows);

  const columnWidths = Object.keys(safeRows[0]).map((key) => ({
    wch: Math.min(
      40,
      Math.max(
        String(key).length + 4,
        ...safeRows.map((row) => String(row[key] ?? '').length + 2),
      ),
    ),
  }));

  worksheet['!cols'] = columnWidths;
  XLSX.utils.book_append_sheet(workbook, worksheet, name.slice(0, 31));
}

function snapshotToList(snapshot) {
  const value = snapshot.val();

  return value && typeof value === 'object'
    ? Object.entries(value).map(([id, item]) => ({
        id,
        ...(item && typeof item === 'object' ? item : {}),
      }))
    : [];
}

function flattenWithdrawals(value) {
  if (!value || typeof value !== 'object') return [];

  const rows = [];

  Object.entries(value).forEach(([firstKey, firstValue]) => {
    if (!firstValue || typeof firstValue !== 'object') return;

    if (looksLikeWithdrawal(firstValue)) {
      rows.push({ id: firstKey, ...firstValue });
      return;
    }

    Object.entries(firstValue).forEach(([secondKey, secondValue]) => {
      if (!secondValue || typeof secondValue !== 'object') return;

      rows.push({
        id: secondKey,
        doctorId: secondValue.doctorId || firstKey,
        ...secondValue,
      });
    });
  });

  return rows;
}

function looksLikeWithdrawal(value) {
  return (
    'amount' in value ||
    'walletNumber' in value ||
    'withdrawalMethod' in value ||
    'requestedAt' in value
  );
}

function reportTitle(type) {
  return (
    REPORT_TYPES.find((item) => item.value === type)?.label || 'تقرير النظام'
  );
}

function normalizeRole(role) {
  return String(role || '').trim().toLowerCase();
}

function appointmentStatus(item) {
  return String(item.bookingStatus || item.status || 'unknown')
    .trim()
    .toLowerCase();
}

function appointmentStatusLabel(status) {
  const labels = {
    admin_pending: 'مراجعة الإدارة',
    pending: 'قيد الانتظار',
    confirmed: 'مؤكد',
    approved: 'مؤكد',
    accepted: 'مقبول',
    completed: 'مكتمل',
    cancelled: 'ملغي',
    canceled: 'ملغي',
    rejected: 'مرفوض',
    unknown: 'غير محدد',
  };

  return labels[status] || status || 'غير محدد';
}

function recommendationStatusLabel(status) {
  const labels = {
    new: 'جديد',
    contacted: 'تم التواصل',
    approved: 'تمت الموافقة',
    rejected: 'مرفوض',
  };

  return labels[String(status || 'new').toLowerCase()] || 'جديد';
}

function withdrawalStatusLabel(status) {
  const labels = {
    pending: 'قيد الانتظار',
    approved: 'تمت الموافقة',
    paid: 'تم الدفع',
    completed: 'مكتمل',
    rejected: 'مرفوض',
    cancelled: 'ملغي',
  };

  return labels[String(status || 'pending').toLowerCase()] || 'قيد الانتظار';
}

function appointmentPrice(item) {
  return safeNumber(
    item.price ??
      item.appointmentPrice ??
      item.clinicPrice ??
      item.totalPrice ??
      0,
  );
}

function isDoctorApproved(item) {
  return (
    item.isApproved === true ||
    item.approved === true ||
    String(item.status || '').toLowerCase() === 'approved'
  );
}

function matchesSearch(item, query, fields) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  if (!normalizedQuery) return true;

  return fields.some((field) =>
    String(item[field] || '').toLowerCase().includes(normalizedQuery),
  );
}

function isDateInside(value, from, to) {
  const normalized = normalizeDate(value);

  if (!normalized) return true;
  if (from && normalized < from) return false;
  if (to && normalized > to) return false;

  return true;
}

function normalizeDate(value) {
  const date = parseDate(value);
  return date ? localDateKey(date) : '';
}

function parseDate(value) {
  if (!value) return null;

  if (value instanceof Date) return value;

  if (typeof value === 'number') {
    const milliseconds = value < 100000000000 ? value * 1000 : value;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const text = String(value).trim();
  const directMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (directMatch) {
    return new Date(
      Number(directMatch[1]),
      Number(directMatch[2]) - 1,
      Number(directMatch[3]),
    );
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function localDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function todayKey() {
  return localDateKey(new Date());
}

function firstDayOfCurrentMonth() {
  const now = new Date();
  return localDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
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

function formatNumber(value) {
  return safeNumber(value).toLocaleString('ar-EG');
}

function formatMoney(value) {
  return `${formatNumber(value)} ${CURRENCY}`;
}

function formatPercent(value) {
  return `${safeNumber(value).toFixed(1)}%`;
}

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function safeDisplay(value) {
  if (value === undefined || value === null || value === '') {
    return 'غير محدد';
  }

  return String(value);
}

function waitForRender() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });
}

const styles = `
  * {
    box-sizing: border-box;
  }

  .reports-page {
    min-height: 100vh;
    padding: clamp(18px, 3vw, 38px);
    background: ${COLORS.bg};
    color: ${COLORS.text};
    font-family: "Tajawal", "Cairo", Arial, sans-serif;
  }

  .reports-header {
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
    box-shadow: 0 18px 42px rgba(15,118,110,.18);
  }

  .eyebrow {
    display: inline-block;
    margin-bottom: 8px;
    color: #ccfbf1;
    font-size: 12px;
    font-weight: 900;
  }

  .reports-header h1 {
    margin: 0;
    font-size: clamp(25px, 3vw, 37px);
    font-weight: 900;
  }

  .reports-header p {
    max-width: 720px;
    margin: 10px 0 0;
    color: rgba(255,255,255,.8);
    font-size: 13px;
    font-weight: 700;
    line-height: 1.8;
  }

  button,
  input,
  select {
    font-family: inherit;
  }

  .refresh-button {
    min-height: 43px;
    padding: 0 16px;
    border: 1px solid rgba(255,255,255,.22);
    border-radius: 13px;
    background: rgba(255,255,255,.13);
    color: #fff;
    cursor: pointer;
    font-size: 12px;
    font-weight: 900;
  }

  .filters-card,
  .export-bar,
  .report-table-card,
  .chart-card {
    background: #fff;
    border: 1px solid ${COLORS.border};
    border-radius: 20px;
    box-shadow: 0 8px 24px rgba(15,23,42,.045);
  }

  .filters-card {
    margin-top: 18px;
    padding: 18px;
    display: grid;
    grid-template-columns: 1.25fr repeat(3, minmax(145px,.7fr)) 1.5fr;
    gap: 13px;
    align-items: end;
  }

  .filter-group {
    min-width: 0;
  }

  .filter-group label {
    display: block;
    margin-bottom: 7px;
    color: ${COLORS.muted};
    font-size: 10px;
    font-weight: 900;
  }

  .filter-group input,
  .filter-group select {
    width: 100%;
    height: 44px;
    padding: 0 12px;
    border: 1px solid ${COLORS.border};
    border-radius: 12px;
    background: #f8fafc;
    color: ${COLORS.text};
    outline: none;
    font-size: 11px;
    font-weight: 800;
  }

  .export-bar {
    margin-top: 15px;
    padding: 16px 18px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }

  .export-bar > div:first-child strong {
    display: block;
    font-size: 15px;
    font-weight: 900;
  }

  .export-bar > div:first-child span {
    display: block;
    margin-top: 5px;
    color: ${COLORS.muted};
    font-size: 10px;
    font-weight: 700;
  }

  .export-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .export-actions button,
  .preview-toolbar button {
    min-height: 38px;
    padding: 0 13px;
    border: 0;
    border-radius: 11px;
    cursor: pointer;
    font-size: 10px;
    font-weight: 900;
  }

  .preview-button {
    background: #f1f5f9;
    color: #334155;
  }

  .print-button {
    background: #eff6ff;
    color: #1d4ed8;
  }

  .pdf-button {
    background: #fef2f2;
    color: #b91c1c;
  }

  .excel-button {
    background: #ecfdf5;
    color: #15803d;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: .58;
  }

  .error-box {
    margin-top: 15px;
    padding: 14px 16px;
    border-radius: 13px;
    background: #fef2f2;
    color: #b91c1c;
    font-size: 12px;
    font-weight: 800;
  }

  .summary-grid,
  .skeleton-grid {
    margin-top: 15px;
    display: grid;
    grid-template-columns: repeat(4, minmax(0,1fr));
    gap: 14px;
  }

  .summary-card {
    min-height: 125px;
    padding: 18px;
    background: #fff;
    border: 1px solid ${COLORS.border};
    border-radius: 18px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    box-shadow: 0 8px 24px rgba(15,23,42,.045);
  }

  .summary-card div > span {
    display: block;
    color: ${COLORS.muted};
    font-size: 10px;
    font-weight: 900;
  }

  .summary-card div > strong {
    display: block;
    margin-top: 10px;
    font-size: 27px;
    font-weight: 900;
  }

  .summary-card div > small {
    display: block;
    margin-top: 7px;
    color: ${COLORS.muted};
    font-size: 9px;
    font-weight: 800;
  }

  .summary-card i {
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

  .summary-card.primary {
    color: #fff;
    background: linear-gradient(145deg,#0f766e,#115e59);
    border-color: transparent;
  }

  .summary-card.primary div > span,
  .summary-card.primary div > small {
    color: rgba(255,255,255,.75);
  }

  .summary-card.primary i {
    color: #fff;
    background: rgba(255,255,255,.14);
  }

  .summary-card.success i {
    background: #ecfdf5;
    color: ${COLORS.success};
  }

  .summary-card.info i {
    background: #eff6ff;
    color: ${COLORS.info};
  }

  .summary-card.danger i {
    background: #fef2f2;
    color: ${COLORS.danger};
  }

  .charts-grid,
  .skeleton-charts {
    margin-top: 15px;
    display: grid;
    grid-template-columns: 1.25fr .85fr;
    gap: 15px;
  }

  .chart-card {
    min-height: 355px;
    padding: 20px;
  }

  .chart-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 900;
  }

  .chart-header p {
    margin: 6px 0 0;
    color: ${COLORS.muted};
    font-size: 10px;
    font-weight: 700;
  }

  .bar-chart {
    height: 260px;
    margin-top: 16px;
    padding: 12px 7px 0;
    display: flex;
    align-items: flex-end;
    gap: 9px;
    border-radius: 15px;
    background:
      linear-gradient(to top, rgba(226,232,240,.65) 1px, transparent 1px);
    background-size: 100% 25%;
  }

  .bar-column {
    min-width: 0;
    height: 100%;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-direction: column;
    gap: 7px;
  }

  .bar-column span {
    color: ${COLORS.muted};
    font-size: 9px;
    font-weight: 900;
  }

  .bar-track {
    width: min(42px,72%);
    height: 190px;
    display: flex;
    align-items: flex-end;
  }

  .bar-track i {
    width: 100%;
    min-height: 5px;
    border-radius: 10px 10px 4px 4px;
    background: linear-gradient(to top,#0f766e,#2dd4bf);
  }

  .bar-column b {
    color: ${COLORS.muted};
    font-size: 9px;
    white-space: nowrap;
  }

  .status-bars {
    margin-top: 22px;
    display: grid;
    gap: 18px;
  }

  .status-row > div:first-child {
    margin-bottom: 8px;
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }

  .status-row strong {
    font-size: 11px;
    font-weight: 900;
  }

  .status-row span {
    color: ${COLORS.muted};
    font-size: 9px;
    font-weight: 800;
  }

  .progress-track {
    height: 9px;
    border-radius: 999px;
    background: #e2e8f0;
    overflow: hidden;
  }

  .progress-track i {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg,#0f766e,#2dd4bf);
  }

  .small-empty {
    min-height: 230px;
    display: grid;
    place-items: center;
    color: ${COLORS.muted};
    font-size: 11px;
    font-weight: 800;
  }

  .report-table-card {
    margin-top: 15px;
    padding: 20px;
  }

  .table-header {
    margin-bottom: 16px;
  }

  .table-header h2 {
    margin: 0;
    font-size: 17px;
    font-weight: 900;
  }

  .table-header p {
    margin: 6px 0 0;
    color: ${COLORS.muted};
    font-size: 10px;
    font-weight: 700;
  }

  .table-scroll {
    overflow-x: auto;
  }

  table {
    width: 100%;
    min-width: 820px;
    border-collapse: collapse;
  }

  th {
    padding: 12px 10px;
    background: #f8fafc;
    color: ${COLORS.muted};
    border-bottom: 1px solid ${COLORS.border};
    text-align: right;
    font-size: 9px;
    font-weight: 900;
  }

  td {
    padding: 12px 10px;
    border-bottom: 1px solid #edf2f7;
    color: #334155;
    font-size: 10px;
    font-weight: 700;
    vertical-align: middle;
  }

  tbody tr:last-child td {
    border-bottom: 0;
  }

  .overview-sections {
    display: grid;
    gap: 26px;
  }

  .overview-sections h3 {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 900;
  }

  .pagination {
    margin-top: 17px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .pagination button {
    min-height: 36px;
    padding: 0 14px;
    border: 0;
    border-radius: 10px;
    background: #f0fdfa;
    color: ${COLORS.dark};
    cursor: pointer;
    font-size: 10px;
    font-weight: 900;
  }

  .pagination span {
    color: ${COLORS.muted};
    font-size: 10px;
    font-weight: 800;
  }

  .empty-state {
    min-height: 260px;
    display: grid;
    place-items: center;
    align-content: center;
    text-align: center;
  }

  .empty-state > div {
    width: 56px;
    height: 56px;
    border-radius: 18px;
    background: #f0fdfa;
    color: ${COLORS.dark};
    display: grid;
    place-items: center;
    font-size: 22px;
    font-weight: 900;
  }

  .empty-state h3 {
    margin: 14px 0 0;
    font-size: 15px;
  }

  .empty-state p {
    margin: 6px 0 0;
    color: ${COLORS.muted};
    font-size: 10px;
    font-weight: 700;
  }

  .preview-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1100;
    padding: 18px;
    background: rgba(15,23,42,.52);
    backdrop-filter: blur(5px);
    overflow: auto;
  }

  .preview-shell {
    width: min(1040px,100%);
    margin: 0 auto;
  }

  .preview-toolbar {
    margin-bottom: 10px;
    padding: 12px 14px;
    border-radius: 14px;
    background: #fff;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    box-shadow: 0 12px 30px rgba(15,23,42,.18);
  }

  .preview-toolbar > div {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
  }

  .preview-toolbar button {
    background: #f1f5f9;
    color: #334155;
  }

  .print-report {
    width: 100%;
    min-height: 1120px;
    padding: 34px;
    background: #fff;
    color: #111827;
    direction: rtl;
  }

  .print-header {
    padding-bottom: 18px;
    border-bottom: 2px solid #0f766e;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 20px;
  }

  .print-header h1 {
    margin: 0;
    font-size: 25px;
  }

  .print-header p {
    margin: 7px 0 0;
    color: #64748b;
    font-size: 11px;
    font-weight: 700;
  }

  .print-brand {
    padding: 10px 14px;
    border-radius: 11px;
    background: #0f766e;
    color: #fff;
    font-size: 12px;
    font-weight: 900;
  }

  .print-summary {
    margin-top: 18px;
    display: grid;
    grid-template-columns: repeat(3,1fr);
    gap: 10px;
  }

  .print-summary > div {
    padding: 12px;
    border: 1px solid #e2e8f0;
    border-radius: 11px;
  }

  .print-summary span {
    display: block;
    color: #64748b;
    font-size: 9px;
    font-weight: 800;
  }

  .print-summary strong {
    display: block;
    margin-top: 7px;
    font-size: 16px;
  }

  .print-section {
    margin-top: 24px;
    page-break-inside: auto;
  }

  .print-section h2 {
    margin: 0 0 10px;
    font-size: 15px;
  }

  .print-report table {
    min-width: 0;
  }

  .print-report th {
    font-size: 8px;
  }

  .print-report td {
    font-size: 8px;
  }

  .print-footer {
    margin-top: 25px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;
    color: #64748b;
    text-align: center;
    font-size: 9px;
    font-weight: 700;
  }

  .toast {
    position: fixed;
    left: 24px;
    bottom: 24px;
    z-index: 1500;
    padding: 13px 17px;
    border-radius: 13px;
    background: #0f172a;
    color: #fff;
    box-shadow: 0 14px 35px rgba(15,23,42,.23);
    font-size: 11px;
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

  .skeleton-card {
    height: 125px;
    border-radius: 18px;
  }

  .skeleton-chart {
    height: 355px;
    border-radius: 20px;
  }

  .skeleton-table {
    height: 390px;
    margin-top: 15px;
    border-radius: 20px;
  }

  @keyframes shimmer {
    to {
      transform: translateX(-100%);
    }
  }

  @media (max-width: 1180px) {
    .filters-card {
      grid-template-columns: repeat(3, minmax(0,1fr));
    }

    .search-group {
      grid-column: span 2;
    }

    .summary-grid,
    .skeleton-grid {
      grid-template-columns: repeat(2,minmax(0,1fr));
    }

    .charts-grid,
    .skeleton-charts {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 720px) {
    .reports-page {
      padding: 14px;
    }

    .reports-header {
      align-items: stretch;
      flex-direction: column;
    }

    .refresh-button {
      width: 100%;
    }

    .filters-card {
      grid-template-columns: 1fr;
    }

    .search-group {
      grid-column: auto;
    }

    .export-bar {
      align-items: stretch;
      flex-direction: column;
    }

    .export-actions button {
      flex: 1;
    }

    .summary-grid,
    .skeleton-grid {
      grid-template-columns: 1fr;
    }

    .bar-chart {
      gap: 4px;
    }

    .preview-backdrop {
      padding: 7px;
    }

    .preview-toolbar {
      align-items: stretch;
      flex-direction: column;
    }

    .print-report {
      padding: 18px;
    }

    .print-summary {
      grid-template-columns: repeat(2,1fr);
    }
  }

  @media print {
    body * {
      visibility: hidden !important;
    }

    .preview-backdrop,
    .preview-backdrop * {
      visibility: visible !important;
    }

    .preview-backdrop {
      position: absolute;
      inset: 0;
      padding: 0;
      background: #fff;
      overflow: visible;
    }

    .preview-shell {
      width: 100%;
    }

    .no-print {
      display: none !important;
    }

    .print-report {
      min-height: 0;
      padding: 12mm;
    }

    .print-section {
      break-inside: auto;
    }

    table,
    tr,
    td,
    th {
      break-inside: avoid;
    }
  }
`;