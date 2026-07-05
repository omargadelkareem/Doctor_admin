import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import AdminLayout from './layout/AdminLayout';

import Dashboard from './pages/DashboardHome';
import Doctors from './pages/Doctors';
import PendingDoctors from './pages/PendingDoctors';
import Patients from './pages/patient';
import Appointments from './pages/Appointments';
import Withdrawals from './pages/Withdrawals';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route element={<AdminLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/doctors" element={<Doctors />} />
        <Route path="/pending-doctors" element={<PendingDoctors />} />
        <Route path="/appointments" element={<Appointments />} />
        <Route
  path="/withdrawals"
  element={<Withdrawals />}
/>
        <Route path="/patients" element={<Patients />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;