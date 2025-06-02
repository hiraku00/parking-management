import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { ParkingSpot, Customer, Contract } from '../lib/supabase';
import Layout from '../components/Layout';
import LoadingSpinner from '../components/LoadingSpinner';

type SpotWithContract = ParkingSpot & {
  contract?: Contract;
  customer?: Customer;
};

const ParkingSpots: React.FC = () => {
  const [spots, setSpots] = useState<SpotWithContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchParkingSpots = async () => {
    try {
      setLoading(true);
      
      // Fetch all parking spots
      const { data: spotsData, error: spotsError } = await supabase
        .from('parking_spots')
        .select('*')
        .order('spot_number');
        
      if (spotsError) throw spotsError;
      
      // If no spots exist yet, create the default 10 spots
      if (!spotsData || spotsData.length === 0) {
        const newSpots = Array.from({ length: 10 }, (_, i) => ({
          spot_number: i + 1,
          is_available: true,
        }));
        
        const { data: createdSpots, error: createError } = await supabase
          .from('parking_spots')
          .insert(newSpots)
          .select();
          
        if (createError) throw createError;
        
        setSpots(createdSpots as SpotWithContract[] || []);
        setLoading(false);
        return;
      }
      
      // Fetch contracts for each spot
      const spotsWithContracts: SpotWithContract[] = [];
      
      for (const spot of spotsData) {
        const { data: contracts, error: contractError } = await supabase
          .from('contracts')
          .select(`
            *,
            customer:customer_id(*)
          `)
          .eq('spot_id', spot.id)
          .maybeSingle();
          
        if (contractError) throw contractError;
        
        spotsWithContracts.push({
          ...spot,
          contract: contracts as Contract,
          customer: contracts?.customer as Customer,
        });
      }
      
      setSpots(spotsWithContracts);
      
    } catch (err) {
      console.error('Error fetching parking spots:', err);
      setError('駐車スペースデータの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParkingSpots();
  }, []);

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">駐車スペース管理</h1>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  スペースNo.
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  状態
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  契約者
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  契約開始日
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  契約終了日
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  契約期間
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {spots.map((spot) => {
                // 契約終了日の計算
                let endDate = '';
                if (spot.contract) {
                  const [startYear, startMonth] = spot.contract.start_month.split('-');
                  let endYear = parseInt(startYear);
                  let endMonth = parseInt(startMonth) + spot.contract.duration_months - 1;
                  
                  if (endMonth > 12) {
                    endYear += Math.floor(endMonth / 12);
                    endMonth = endMonth % 12;
                    if (endMonth === 0) {
                      endMonth = 12;
                      endYear--;
                    }
                  }
                  
                  endDate = `${endYear}年${endMonth}月`;
                }
                
                return (
                  <tr key={spot.id} className={spot.is_available ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      No.{spot.spot_number}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                        spot.is_available 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {spot.is_available ? '空き' : '契約中'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {spot.customer?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {spot.contract ? spot.contract.start_month.replace('-', '年') + '月' : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {endDate || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {spot.contract ? `${spot.contract.duration_months}ヶ月` : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  );
};

export default ParkingSpots;
