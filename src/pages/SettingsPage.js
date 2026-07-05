import React from 'react';

function StatsPage() {
  return <div style={styles.container}><h1 style={styles.title}>الإحصائيات والتقارير</h1></div>;
}

function SettingsPage() {
  return <div style={styles.container}><h1 style={styles.title}>الإعدادات</h1></div>;
}

 export default StatsPage; 

const styles = {
  container: {
    padding: '50px',
  },
  title: {
    fontSize: '40px',
    fontWeight: 'bold',
    color: '#1e3a8a',
  },
};

 // للـ StatsPage
// export default SettingsPage; للـ SettingsPage