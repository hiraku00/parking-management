import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';
import Layout from '../components/Layout';

type DashboardStats = {
  totalContracts: number;
  paidCount: number;
  unpaidCount: number;
  availableSpots: number;
};

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalContracts: 0,
    paidCount: 0,
    unpaidCount: 0,
    availableSpots: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Get current month in YYYY-MM format
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        // Get all contracts
        const { data: contracts, error: contractsError } = await supabase
          .from('contracts')
          .select('*');
          
        if (contractsError) throw contractsError;
        
        // Get all parking spots
        const { data: parkingSpots, error: spotsError } = await supabase
          .from('parking_spots')
          .select('*');
          
        if (spotsError) throw spotsError;
        
        // Get payments for current month
        const { data: payments, error: paymentsError } = await supabase
          .from('payments')
          .select('*')
          .eq('year_month', currentMonth);
          
        if (paymentsError) throw paymentsError;
        
        // Calculate stats
        const totalContracts = contracts?.length || 0;
        const paidCount = payments?.filter(p => p.status === 'paid').length || 0;
        const unpaidCount = totalContracts - paidCount;
        const availableSpots = parkingSpots?.filter(spot => spot.is_available).length || 0;
        
        setStats({
          totalContracts,
          paidCount,
          unpaidCount,
          availableSpots,
        });
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('データの取得中にエラーが発生しました');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">ダッシュボード</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-blue-50 border-t-4 border-blue-500">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-500">契約者数</h3>
            <p className="text-3xl font-bold text-blue-600 mt-2">{stats.totalContracts}</p>
          </div>
        </Card>
        
        <Card className="bg-green-50 border-t-4 border-green-500">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-500">支払い済み</h3>
            <p className="text-3xl font-bold text-green-600 mt-2">{stats.paidCount}</p>
          </div>
        </Card>
        
        <Card className="bg-red-50 border-t-4 border-red-500">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-500">未払い</h3>
            <p className="text-3xl font-bold text-red-600 mt-2">{stats.unpaidCount}</p>
          </div>
        </Card>
        
        <Card className="bg-purple-50 border-t-4 border-purple-500">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-500">空きスペース</h3>
            <p className="text-3xl font-bold text-purple-600 mt-2">{stats.availableSpots}</p>
          </div>
        </Card>
      </div>
      
      <div className="mt-8">
        <Card title="今月の支払い状況">
          <div className="flex items-center justify-center h-32">
            <div className="w-64 h-64 relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-900">{stats.paidCount} / {stats.totalContracts}</p>
                  <p className="text-sm text-gray-500">支払い済み</p>
                </div>
              </div>
              <svg viewBox="0 0 36 36" className="w-full h-full">
                <path
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#eee"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#4ade80"
                  strokeWidth="3"
                  strokeDasharray={`${(stats.paidCount / stats.totalContracts) * 100}, 100`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default Dashboard;
