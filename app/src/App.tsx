import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Contracts from './pages/Contracts';
import ParkingSpots from './pages/ParkingSpots';
import Payments from './pages/Payments';
import Payment from './pages/Payment';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          
          {/* 契約者向けページ - トップページに設定 */}
          <Route path="/" element={
            <ProtectedRoute>
              <Payment />
            </ProtectedRoute>
          } />
          
          {/* 管理者向けページ */}
          <Route path="/admin" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin/customers" element={
            <ProtectedRoute>
              <Customers />
            </ProtectedRoute>
          } />
          <Route path="/admin/contracts" element={
            <ProtectedRoute>
              <Contracts />
            </ProtectedRoute>
          } />
          <Route path="/admin/parking-spots" element={
            <ProtectedRoute>
              <ParkingSpots />
            </ProtectedRoute>
          } />
          <Route path="/admin/payments" element={
            <ProtectedRoute>
              <Payments />
            </ProtectedRoute>
          } />
          
          {/* Redirect any unknown routes to home page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
