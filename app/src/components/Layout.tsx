import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { FiMenu, FiX, FiChevronRight } from "react-icons/fi";

type LayoutProps = {
  children: React.ReactNode;
};

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  // すべてのユーザーが管理画面にアクセス可能
  const isAdmin = true;

  // 管理者ページかどうかチェック
  const isAdminPage = location.pathname.startsWith("/admin");

  // 契約者向けのトップページの場合は、シンプルなレイアウトを表示
  if (!isAdminPage && location.pathname === "/") {
    return (
      <div className="min-h-screen flex flex-col">
        {/* ヘッダー */}
        <header className="bg-primary text-white">
          <div className="max-w-screen-xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center">
              <div className="flex items-center">
                <h1 className="text-xl font-bold">駐車場利用者ポータル</h1>
              </div>

              {/* デスクトップナビゲーション */}
              <nav className="hidden md:flex items-center space-x-6">
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="text-white hover:bg-primary-dark px-3 py-2 rounded-md text-sm font-medium flex items-center"
                  >
                    管理画面へ <FiChevronRight className="ml-1" />
                  </Link>
                )}
                {user && (
                  <>
                    <span className="text-sm">{user.email}</span>
                    <button
                      onClick={handleSignOut}
                      className="bg-white text-primary hover:bg-gray-100 px-4 py-2 rounded text-sm font-medium"
                    >
                      ログアウト
                    </button>
                  </>
                )}
              </nav>

              {/* モバイルメニューボタン */}
              <div className="md:hidden">
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="text-white hover:text-primary-100 p-2 rounded-md"
                  aria-expanded="false"
                >
                  <span className="sr-only">メニューを開く</span>
                  {mobileMenuOpen ? (
                    <FiX className="h-6 w-6" />
                  ) : (
                    <FiMenu className="h-6 w-6" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* モバイルメニュー */}
          {mobileMenuOpen && (
            <div className="md:hidden bg-primary-dark">
              <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="text-white hover:bg-primary block px-3 py-2 rounded-md text-base font-medium"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    管理画面へ
                  </Link>
                )}
                {user && (
                  <>
                    <div className="px-3 py-2 text-sm text-white">
                      {user.email}
                    </div>
                    <button
                      onClick={() => {
                        handleSignOut();
                        setMobileMenuOpen(false);
                      }}
                      className="w-full text-left text-white hover:bg-primary block px-3 py-2 rounded-md text-base font-medium"
                    >
                      ログアウト
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </header>

        <main className="flex-grow bg-gray-50">
          <div className="max-w-screen-xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>

        <footer className="bg-gray-100 border-t border-gray-200 py-6 mt-12">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="md:flex md:items-center md:justify-between">
              <div className="text-center md:text-left">
                <p className="text-sm text-gray-600">
                  &copy; {new Date().getFullYear()} 駐車場管理システム.
                  すべての権利を保有します。
                </p>
              </div>
              <div className="mt-4 md:mt-0">
                <p className="text-sm text-gray-600 text-center md:text-right">
                  <Link to="/privacy" className="hover:text-primary">
                    プライバシーポリシー
                  </Link>
                  <span className="mx-2">|</span>
                  <Link to="/terms" className="hover:text-primary">
                    利用規約
                  </Link>
                </p>
              </div>
            </div>
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
                        location.pathname === "/admin"
                          ? "bg-gray-700"
                          : "hover:bg-gray-700"
                      }`}
                    >
                      ダッシュボード
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/admin/customers"
                      className={`block px-4 py-2 rounded ${
                        location.pathname.startsWith("/admin/customers")
                          ? "bg-gray-700"
                          : "hover:bg-gray-700"
                      }`}
                    >
                      顧客管理
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/admin/contracts"
                      className={`block px-4 py-2 rounded ${
                        location.pathname.startsWith("/admin/contracts")
                          ? "bg-gray-700"
                          : "hover:bg-gray-700"
                      }`}
                    >
                      契約管理
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/admin/parking-spots"
                      className={`block px-4 py-2 rounded ${
                        location.pathname.startsWith("/admin/parking-spots")
                          ? "bg-gray-700"
                          : "hover:bg-gray-700"
                      }`}
                    >
                      駐車スペース管理
                    </Link>
                  </li>
                  <li>
                    <Link
                      to="/admin/payments"
                      className={`block px-4 py-2 rounded ${
                        location.pathname.startsWith("/admin/payments")
                          ? "bg-gray-700"
                          : "hover:bg-gray-700"
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
