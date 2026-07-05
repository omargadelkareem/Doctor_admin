
    import React from 'react';

function DoctorCard({ doctor, onApprove, onReject }) {
  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <img src={doctor.photoUrl || 'https://i.imgur.com/2h8Y9kP.png'} alt={doctor.name} style={styles.image} />
        <div style={styles.info}>
          <h3 style={styles.name}>{doctor.name}</h3>
          <p style={styles.specialty}>{doctor.specialization || 'غير محدد'}</p>
        </div>
      </div>

      <div style={styles.details}>
        <p><strong>البريد:</strong> {doctor.email}</p>
        <p><strong>الهاتف:</strong> {doctor.phone || 'غير محدد'}</p>
        <p><strong>العيادة:</strong> {doctor.clinicAddress || 'غير محدد'}</p>
        <p><strong>سعر الكشف:</strong> {doctor.price || 0} جنيه</p>
      </div>

      <div style={styles.actions}>
        <button onClick={() => onApprove(doctor.id)} style={styles.approveBtn}>موافقة</button>
        <button onClick={() => onReject(doctor.id)} style={styles.rejectBtn}>رفض</button>
      </div>
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: '40px',
    padding: '40px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
    border: '1px solid #e5e7eb',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    marginBottom: '40px',
  },
  image: {
    width: '140px',
    height: '140px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '8px solid white',
    boxShadow: '0 15px 30px rgba(0,0,0,0.2)',
  },
  info: {
    marginLeft: '30px',
  },
  name: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#1e3a8a',
    margin: 0,
  },
  specialty: {
    fontSize: '24px',
    color: '#4b5563',
    margin: '10px 0 0',
  },
  details: {
    marginBottom: '40px',
    lineHeight: '2.5',
    fontSize: '20px',
    color: '#374151',
  },
  actions: {
    display: 'flex',
    gap: '30px',
  },
  approveBtn: {
    flex: 1,
    backgroundColor: '#16a34a',
    color: 'white',
    padding: '24px',
    border: 'none',
    borderRadius: '30px',
    fontSize: '24px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#dc2626',
    color: 'white',
    padding: '24px',
    border: 'none',
    borderRadius: '30px',
    fontSize: '24px',
    fontWeight: 'bold',
    cursor: 'pointer',
  },
};

export default DoctorCard;