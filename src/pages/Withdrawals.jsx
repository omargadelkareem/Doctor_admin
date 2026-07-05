import React, { useEffect, useMemo, useState } from 'react';
import { db } from '../firebase';
import { ref, onValue, update } from 'firebase/database';

const TEAL = '#00796b';
const DARK = '#0b4f5c';

export default function Withdrawals() {
  const [requests, setRequests] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const requestsRef = ref(db, 'withdrawal_requests');

    return onValue(requestsRef, (snapshot) => {
      if (!snapshot.exists()) {
        setRequests([]);
        return;
      }

      const data = snapshot.val();

      const list = [];

      Object.entries(data).forEach(([doctorId, doctorRequests]) => {
        if (doctorRequests && typeof doctorRequests === 'object') {
          Object.entries(doctorRequests).forEach(([requestId, request]) => {
            list.push({
              requestId,
              doctorId,
              ...request,
            });
          });
        }
      });

      list.sort(
        (a, b) =>
          (b.requestedAt || 0) - (a.requestedAt || 0)
      );

      setRequests(list);
    });
  }, []);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      const q = search.toLowerCase();

      return (
        (r.doctorName || '')
          .toLowerCase()
          .includes(q) ||
        (r.accountNumber || '').includes(search)
      );
    });
  }, [requests, search]);

  const totalPending = requests
    .filter((r) => r.status === 'pending')
    .reduce((s, r) => s + Number(r.amount || 0), 0);

  async function approveRequest(item) {
    try {
      await update(
        ref(
          db,
          `withdrawal_requests/${item.doctorId}/${item.requestId}`
        ),
        {
          status: 'approved',
          approvedAt: Date.now(),
        }
      );
    } catch (e) {
      console.log(e);
    }
  }

  async function rejectRequest(item) {
    try {
      await update(
        ref(
          db,
          `withdrawal_requests/${item.doctorId}/${item.requestId}`
        ),
        {
          status: 'rejected',
          rejectedAt: Date.now(),
        }
      );
    } catch (e) {
      console.log(e);
    }
  }

  return (
    <div className="page" dir="rtl">
      <div className="header">
        <div>
          <h1>طلبات السحب</h1>
          <p>إدارة طلبات سحب أرصدة الأطباء</p>
        </div>

        <div className="totalCard">
          <span>إجمالي السحب المعلق</span>
          <strong>
            {totalPending.toLocaleString()} جنيه
          </strong>
        </div>
      </div>

      <div className="searchBox">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث باسم الدكتور أو رقم الحساب..."
        />
      </div>

      <div className="table">
        <div className="head">
          <span>الدكتور</span>
          <span>طريقة السحب</span>
          <span>رقم الحساب</span>
          <span>المبلغ</span>
          <span>الحالة</span>
          <span>الإجراءات</span>
        </div>

        {filtered.map((item) => (
          <div className="row" key={item.requestId}>
            <div className="doctor">
              <strong>{item.doctorName}</strong>
              <small>{item.doctorPhone}</small>
            </div>

            <span>
              {item.method === 'wallet'
                ? 'محفظة'
                : 'InstaPay'}
            </span>

            <span>{item.accountNumber}</span>

            <strong className="money">
              {Number(item.amount || 0).toLocaleString()} ج
            </strong>

            <div>
              <span
                className={`status ${item.status}`}
              >
                {item.status === 'pending'
                  ? 'قيد المراجعة'
                  : item.status === 'approved'
                  ? 'تم التحويل'
                  : 'مرفوض'}
              </span>
            </div>

            <div className="actions">
              <button
                className="approve"
                onClick={() => approveRequest(item)}
              >
                قبول
              </button>

              <button
                className="reject"
                onClick={() => rejectRequest(item)}
              >
                رفض
              </button>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .page {
          padding: 28px;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 28px;
        }

        h1 {
          margin: 0;
          color: #082f3a;
        }

        p {
          margin-top: 8px;
          color: #64748b;
          font-weight: 700;
        }

        .totalCard {
          background: linear-gradient(
            135deg,
            ${DARK},
            ${TEAL}
          );
          color: white;
          border-radius: 18px;
          padding: 22px;
          min-width: 260px;
        }

        .totalCard span {
          display: block;
          margin-bottom: 12px;
          opacity: 0.9;
        }

        .totalCard strong {
          font-size: 28px;
        }

        .searchBox {
          margin-bottom: 22px;
        }

        .searchBox input {
          width: 100%;
          height: 54px;
          border-radius: 14px;
          border: 1px solid #d8e2eb;
          padding: 0 18px;
          font-size: 15px;
        }

        .table {
          background: white;
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid #e2e8f0;
        }

        .head,
        .row {
          display: grid;
          grid-template-columns:
            1.5fr
            1fr
            1.4fr
            1fr
            1fr
            1.3fr;

          gap: 14px;
          align-items: center;
          padding: 18px 24px;
        }

        .head {
          background: #eff6ff;
          font-weight: 900;
        }

        .row {
          border-top: 1px solid #edf2f7;
        }

        .doctor strong {
          display: block;
          margin-bottom: 6px;
        }

        .doctor small {
          color: #64748b;
        }

        .money {
          color: ${TEAL};
        }

        .status {
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 900;
        }

        .pending {
          background: #fef3c7;
          color: #92400e;
        }

        .approved {
          background: #dcfce7;
          color: #166534;
        }

        .rejected {
          background: #fee2e2;
          color: #991b1b;
        }

        .actions {
          display: flex;
          gap: 10px;
        }

        .actions button {
          border: none;
          padding: 10px 14px;
          border-radius: 10px;
          font-weight: 900;
          cursor: pointer;
        }

        .approve {
          background: #dcfce7;
          color: #166534;
        }

        .reject {
          background: #fee2e2;
          color: #991b1b;
        }
      `}</style>
    </div>
  );
}