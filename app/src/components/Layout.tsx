import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

type LayoutProps = {
  children: React.ReactNode;
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // すべてのユーザーが管理画面にアクセス可能
  const isAdmin = true;
  
  // 管理者ページかどうかチェック
  const isAdminPage = location.pathname.startsWith('/admin');
  
  // 契約者向けのトップページの場合は、シンプルなレイアウトを表示
  if (!isAdminPage && location.pathname === '/') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">駐車場利用者ポータル</h1>
            <div className="flex items-center">
              {isAdmin && (
                <Link to="/admin" className="mr-4 text-blue-600 hover:text-blue-800">
                  管理画面へ
                </Link>
              )}
              <div className="flex items-center">
                <span className="mr-4 text-sm text-gray-600">{user?.email}</span>
                <button
                  onClick={handleSignOut}
                  className="bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-white text-sm"
                >
                  ログアウト
                </button>
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
        <footer className="bg-white border-t border-gray-200 py-4 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm text-gray-500">
              &copy; {new Date().getFullYear()} 駐車場管理システム
            </p>
          </div>
        </footer>
      </div>
    );
  }

  // Admin layout with sidebar for authenticated users
  return (
    <div className="min-h-screen flex flex-col">
      {/* Top navigation */}
      <nav className="bg-blue-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/admin" className="text-xl font-bold">
                駐車場管理システム 管理画面
              </Link>
            </div>
            <div className="flex items-center">
              <Link to="/" className="text-white hover:text-blue-200 mr-4">
                利用者ポータルへ
              </Link>
              {user && (
                <div className="flex items-center">
                  <span className="mr-4">{user.email}</span>
                  <button
                    onClick={handleSignOut}
                    className="bg-blue-700 hover:bg-blue-800 px-3 py-1 rounded text-sm"
                  >
                    ログアウト
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="flex flex-1">
        {/* Sidebar navigation */}
        {user && (
          <aside className="w-64 bg-gray-800 text-white">
            <div className="p-4">
              <nav>
                <ul className="space-y-2">
                  <li>
                    <Link
                      to="/admin"
                      className={`block px-4 py-2 rounded ${
                        location.pathname === '/admin' ? 'bg-gray-700' : 'hover:bg-gray-700'
                      }`}
                    >
                      ダッシュボード
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/admin/customers"
                      className={`block px-4 py-2 rounded ${
                        location.pathname.startsWith('/admin/customers') ? 'bg-gray-700' : 'hover:bg-gray-700'
                      }`}
                    >
                      顧客管理
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/admin/contracts"
                      className={`block px-4 py-2 rounded ${
                        location.pathname.startsWith('/admin/contracts') ? 'bg-gray-700' : 'hover:bg-gray-700'
                      }`}
                    >
                      契約管理
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/admin/parking-spots"
                      className={`block px-4 py-2 rounded ${
                        location.pathname.startsWith('/admin/parking-spots') ? 'bg-gray-700' : 'hover:bg-gray-700'
                      }`}
                    >
                      駐車スペース管理
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/admin/payments"
                      className={`block px-4 py-2 rounded ${
                        location.pathname.startsWith('/admin/payments') ? 'bg-gray-700' : 'hover:bg-gray-700'
                      }`}
                    >
                      支払い管理
                    </Link>
                  </li>
                </ul>
              </nav>
            </div>
          </aside>
        )}

        {/* Main content */}
        <main className="flex-1 bg-gray-100">
          <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
