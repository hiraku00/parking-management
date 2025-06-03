import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ChevronRight, LogOut, Menu, X, LayoutDashboard, Users, Car, CreditCard, Info } from 'lucide-react';

type LayoutProps = {
  children: React.ReactNode;
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  // すべてのユーザーが管理画面にアクセス可能
  const isAdmin = true;
  
  // 管理者ページかどうかチェック
  const isAdminPage = location.pathname.startsWith('/admin');
  
  // 利用者向けのシンプルなレイアウトを表示
  if (!isAdminPage) {
    return (
      <div className="min-h-screen bg-[hsl(var(--background))]">
        <header className="bg-[hsl(var(--primary))] sticky top-0 z-10 text-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex flex-col space-y-3 sm:flex-row sm:justify-between sm:items-center sm:space-y-0">
              <div className="flex items-center">
                <h1 className="text-2xl font-bold text-white">駐車場利用者ポータル</h1>
              </div>
              
              <div className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-6">
                {/* ログイン状態に応じたボタン表示 */}
                {user ? (
                  <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
                    {/* 管理者の場合のみ管理画面へのリンクを表示 */}
                    {isAdmin && (
                      <Link 
                        to="/admin" 
                        className="bg-white/20 hover:bg-white/30 text-white rounded-md px-3 py-2 text-sm font-medium transition-colors flex items-center"
                      >
                        管理画面
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Link>
                    )}
                    <span className="text-sm text-white/90 hidden sm:inline">{user.email}</span>
                    <button
                      onClick={handleSignOut}
                      className="bg-white/10 hover:bg-white/20 text-white rounded-md px-3 py-2 text-sm font-medium transition-colors flex items-center"
                    >
                      <LogOut className="h-4 w-4 mr-1.5" />
                      <span>ログアウト</span>
                    </button>
                  </div>
                ) : (
                  <div className="flex space-x-3">
                    <Link 
                      to="/login" 
                      className="bg-white text-[hsl(var(--primary))] hover:bg-white/90 rounded-md px-3 py-2 text-sm font-medium transition-colors"
                    >
                      ログイン
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          {/* 利用者向けのガイダンス */}
          <div className="bg-[hsl(var(--secondary))] rounded-lg p-4 mb-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="bg-[hsl(var(--primary))] rounded-full p-2 text-white">
                <Info className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-[hsl(var(--primary))] font-bold text-lg mb-1">利用者の方へ</h2>
                <p className="text-[hsl(var(--foreground))] text-sm">
                  駐車場利用者ポータルでは、契約情報の確認や料金のお支払いが行えます。契約者名または駐車場番号を入力して検索してください。
                </p>
              </div>
            </div>
          </div>
          {children}
        </main>
        {/* フッター部分を削除 */}
      </div>
    );
  }

  // Admin layout with sidebar for authenticated users
  return (
    <div className="min-h-screen flex flex-col bg-[#F5F5F7]">
      {/* Top navigation */}
      <nav className="backdrop-blur-md bg-black/90 text-white sticky top-0 z-50 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex flex-col py-2 sm:flex-row sm:justify-between sm:items-center sm:h-16 sm:py-0">
            <div className="flex items-center justify-between">
              <Link to="/admin" className="text-xl font-medium py-2">
                駐車場管理システム
              </Link>
              
              {/* モバイルメニューボタン - 右上に配置 */}
              <div className="sm:hidden">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="text-white p-2"
                >
                  {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                </button>
              </div>
            </div>
            
            <div className="flex flex-col space-y-3 py-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-6 sm:py-0">
              <Link to="/" className="text-white hover:opacity-80 transition-opacity flex items-center py-1">
                <span>利用者ポータルへ</span>
                <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
              {user && (
                <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-4">
                  <span className="text-sm text-white/80">{user.email}</span>
                  <button
                    onClick={handleSignOut}
                    className="bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-full text-sm transition-colors flex items-center space-x-1 w-fit"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>ログアウト</span>
                  </button>
                </div>
              )}
              <button 
                className="md:hidden text-white" 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex flex-1">
        {/* Sidebar navigation */}
        {user && (
          <aside className={`${mobileMenuOpen ? 'block' : 'hidden'} md:block fixed md:static inset-0 md:inset-auto z-40 md:z-0 w-full md:w-64 bg-white/80 backdrop-blur-md md:border-r border-black/5 text-black overflow-y-auto md:h-[calc(100vh-4rem)]`}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4 md:hidden">
                <h2 className="text-sm font-medium text-black/60 uppercase tracking-wider">管理メニュー</h2>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 text-black/60 hover:text-black"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <h2 className="text-sm font-medium text-black/60 uppercase tracking-wider mb-4 hidden md:block">管理メニュー</h2>
              <nav>
                <ul className="space-y-2">
                  <li>
                    <Link
                      to="/admin"
                      className={`flex items-center px-3 py-3 md:py-2 rounded-md text-base md:text-sm ${location.pathname === '/admin' ? 'bg-black/5 font-medium' : 'hover:bg-black/5'}`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <LayoutDashboard className="h-5 w-5 mr-3 md:h-4 md:w-4" />
                      ダッシュボード
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/admin/users"
                      className={`flex items-center px-3 py-3 md:py-2 rounded-md text-base md:text-sm ${location.pathname === '/admin/users' ? 'bg-black/5 font-medium' : 'hover:bg-black/5'}`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Users className="h-5 w-5 mr-3 md:h-4 md:w-4" />
                      利用者管理
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/admin/parking"
                      className={`flex items-center px-3 py-3 md:py-2 rounded-md text-base md:text-sm ${location.pathname === '/admin/parking' ? 'bg-black/5 font-medium' : 'hover:bg-black/5'}`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Car className="h-5 w-5 mr-3 md:h-4 md:w-4" />
                      駐車場管理
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/admin/parking-spots"
                      className={`flex items-center px-3 py-3 md:py-2 rounded-md text-base md:text-sm ${location.pathname.startsWith('/admin/parking-spots') ? 'bg-black/5 font-medium' : 'hover:bg-black/5'}`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Car className="h-5 w-5 mr-3 md:h-4 md:w-4" />
                      駐車スペース管理
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/admin/payments"
                      className={`flex items-center px-3 py-3 md:py-2 rounded-md text-base md:text-sm ${location.pathname.startsWith('/admin/payments') ? 'bg-black/5 font-medium' : 'hover:bg-black/5'}`}
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <CreditCard className="h-5 w-5 mr-3 md:h-4 md:w-4" />
                      支払い管理
                    </Link>
                  </li>
                </ul>
              </nav>
            </div>
          </aside>
        )}

        {/* Main content */}
        <main className="flex-1 p-4 md:p-8 md:ml-0 md:mt-0">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
