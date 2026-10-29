import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { PosView } from './components/PosView';
import { OrdersView } from './components/OrdersView';
import { DashboardView } from './components/DashboardView';
import { ReportsView } from './components/ReportsView';
import { CatalogView } from './components/CatalogView';
import { InventoryView } from './components/InventoryView';
import { TransfersView } from './components/TransfersView';
import { ExpensesView } from './components/ExpensesView';
import { BranchesView } from './components/BranchesView';
import { PermissionsView } from './components/PermissionsView';
import { AuditLogsView } from './components/AuditLogsView';
import { LoginView } from './components/LoginView';
import { hasPermission } from './services/permissionService';
import { CupSoda, ShieldAlert, LogOut } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { firebaseUser, userProfile, loading, isUnauthorized, logout } = useAuth();
  const [currentView, setCurrentView] = useState<string>('pos');

  // Guard against unauthorized view selection (staff should never view catalog)
  useEffect(() => {
    if (userProfile?.role === 'staff' && currentView === 'catalog') {
      setCurrentView('pos');
    }
  }, [userProfile, currentView]);

  // Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FFF9F0] flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#D98591] to-[#70445B] flex items-center justify-center text-white shadow-xl shadow-[#D98591]/20 animate-pulse mb-4">
          <CupSoda className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-[#70445B]">Falooda Point POS</h2>
        <p className="text-xs text-[#79696D] mt-1">Verifying account authorization...</p>
      </div>
    );
  }

  // Not Logged In
  if (!firebaseUser) {
    return <LoginView />;
  }

  // Unauthorized Account Screen (User not enrolled by Admin)
  if (isUnauthorized) {
    return (
      <div className="min-h-screen bg-[#FFF9F0] flex flex-col items-center justify-center p-4 text-center">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-[#EADBD6] shadow-xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center mx-auto border border-amber-200">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#70445B]">Access Denied</h2>
          <div className="p-3 bg-[#FFF9F0] rounded-xl border border-[#EADBD6] text-xs">
            <span className="text-[#79696D]">Signed in with Google:</span>
            <div className="font-bold text-[#493A3E] text-sm truncate mt-0.5">{firebaseUser.email}</div>
          </div>
          <p className="text-xs text-[#79696D] leading-relaxed">
            This POS system is private. Your account has not been added by an administrator.
            Please ask your <strong>Super Admin</strong> or <strong>Branch Manager</strong> to enroll your account in the Staff Management panel before signing in.
          </p>
          <div className="pt-2">
            <button
              onClick={logout}
              className="px-5 py-2.5 rounded-xl bg-[#70445B] text-white text-xs font-bold hover:bg-[#D98591] transition flex items-center gap-2 mx-auto shadow-sm"
            >
              <LogOut className="w-4 h-4" />
              Sign Out & Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Suspended / Deactivated Account Screen
  if (userProfile && !userProfile.active) {
    return (
      <div className="min-h-screen bg-[#FFF9F0] flex flex-col items-center justify-center p-4 text-center">
        <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-[#EADBD6] shadow-xl space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#70445B]">Account Suspended</h2>
          <p className="text-xs text-[#79696D] leading-relaxed">
            Your staff account ({userProfile.email}) has been deactivated by the shop administration. All operational and POS access has been suspended.
          </p>
          <div className="pt-2">
            <button
              onClick={logout}
              className="px-5 py-2.5 rounded-xl bg-[#70445B] text-white text-xs font-bold hover:bg-[#D98591] transition flex items-center gap-2 mx-auto"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF9F0] flex flex-col">
      <Header currentView={currentView} onSelectView={setCurrentView} />

      <main className="flex-1 pb-12">
        {currentView === 'pos' && <PosView />}
        {currentView === 'orders' && <OrdersView />}
        {currentView === 'dashboard' && <DashboardView />}
        {currentView === 'reports' && <ReportsView />}
        {currentView === 'catalog' && (
          userProfile?.role !== 'staff' && hasPermission(userProfile, 'products.view') ? (
            <CatalogView />
          ) : (
            <PosView />
          )
        )}
        {currentView === 'inventory' && <InventoryView />}
        {currentView === 'transfers' && <TransfersView />}
        {currentView === 'expenses' && <ExpensesView />}
        {currentView === 'branches' && <BranchesView />}
        {currentView === 'permissions' && <PermissionsView />}
        {currentView === 'audit' && <AuditLogsView />}
      </main>

      {/* Footer */}
      <footer className="bg-white/60 border-t border-[#EADBD6] py-3 text-center text-[11px] text-[#79696D] no-print">
        <p>Falooda Point POS • Multi-Branch Role-Based System • Connected to Google Cloud Firestore</p>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
