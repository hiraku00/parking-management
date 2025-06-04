import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useEffect } from 'react';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Contracts from './pages/Contracts';
import ParkingSpots from './pages/ParkingSpots';
import Payments from './pages/Payments';
import Payment from './pages/Payment';

// デバッグ用コンポーネント
const DebugRouter = () => {
  const location = useLocation();
  const { user, loading } = useAuth();
  
  useEffect(() => {
    console.log('Route changed to:', location.pathname);
    console.log('Auth state - User:', user, 'Loading:', loading);
  }, [location, user, loading]);
  
  return null;
};

// 保護されたルートコンポーネント
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  console.log('ProtectedRoute - User:', user, 'Loading:', loading);
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!user) {
    console.log('Redirecting to login from:', location.pathname);
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <DebugRouter />
        <Routes>
          {/* パブリックルート */}
          <Route path="/login" element={<Login />} />
          
          {/* 支払いページ - 認証不要 */}
          <Route path="/payment" element={<Payment />} />
          
          {/* トップページを/paymentにリダイレクト */}
          <Route path="/" element={<Navigate to="/payment" replace />} />
          
          {/* 管理者用ルート */}
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
          
          {/* その他のルートはトップページにリダイレクト */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
