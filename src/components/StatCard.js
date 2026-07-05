
    import React from 'react';

function StatCard({ title, value, color }) {
  return (
    <div style={{
      ...styles.card,
      backgroundColor: color,
    }}>
      <h3 style={styles.value}>{value}</h3>
      <p style={styles.title}>{title}</p>
    </div>
  );
}

const styles = {
  card: {
    color: 'white',
    padding: '40px',
    borderRadius: '30px',
    textAlign: 'center',
    boxShadow: '0 15px 30px rgba(0,0,0,0.2)',
  },
  value: {
    fontSize: '60px',
    fontWeight: 'bold',
    margin: 0,
  },
  title: {
    fontSize: '24px',
    marginTop: '20px',
  },
};

export default StatCard;