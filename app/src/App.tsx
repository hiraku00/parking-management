import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { useEffect, useState } from 'react';
import { checkEnvVariables } from './utils/envCheck';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Customers from './pages/Customers';
import Contracts from './pages/Contracts';
import ParkingSpots from './pages/ParkingSpots';
import Payments from './pages/Payments';
import Payment from './pages/Payment';

function App() {
  const [envStatus, setEnvStatus] = useState<{ supabaseUrl: boolean; supabaseAnonKey: boolean; monthlyFee: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 環境変数をチェック
    const status = checkEnvVariables();
    setEnvStatus(status);
    setLoading(false);
  }, []);

  // 環境変数チェック中はローディング表示
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[hsl(var(--primary))] mb-4">読み込み中...</h1>
          <p className="text-[hsl(var(--foreground))]">アプリケーションを初期化しています</p>
        </div>
      </div>
    );
  }

  // 環境変数が不足している場合はエラーメッセージを表示
  if (envStatus && (!envStatus.supabaseUrl || !envStatus.supabaseAnonKey)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
        <div className="max-w-md p-6 bg-white rounded-lg shadow-lg border border-red-300">
          <h1 className="text-2xl font-bold text-red-600 mb-4">環境変数エラー</h1>
          <p className="text-gray-700 mb-4">アプリケーションの起動に必要な環境変数が設定されていません：</p>
          <ul className="list-disc pl-5 mb-4 text-gray-700">
            {!envStatus.supabaseUrl && <li>VITE_SUPABASE_URL が未設定です</li>}
            {!envStatus.supabaseAnonKey && <li>VITE_SUPABASE_ANON_KEY が未設定です</li>}
            {!envStatus.monthlyFee && <li>VITE_MONTHLY_PARKING_FEE が未設定です（任意）</li>}
          </ul>
          <p className="text-gray-700">
            <code>.env</code> ファイルに上記の環境変数を設定してください。
            <code>.env.example</code> ファイルを参考にしてください。
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          
          {/* 利用者向けページ - トップページに設定 */}
          <Route path="/" element={<Payment />} />
          
          {/* 契約者向けページ（認証必要） */}
          <Route path="/my-account" element={
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
