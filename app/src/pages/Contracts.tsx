import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Customer, ParkingSpot, ContractWithDetails } from '../lib/supabase';
import Layout from '../components/Layout';
import Table from '../components/Table';
import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import LoadingSpinner from '../components/LoadingSpinner';

const Contracts: React.FC = () => {
  const [contracts, setContracts] = useState<ContractWithDetails[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [parkingSpots, setParkingSpots] = useState<ParkingSpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form state
  const [customerId, setCustomerId] = useState('');
  const [spotId, setSpotId] = useState('');
  const [startMonth, setStartMonth] = useState('');
  const [durationMonths, setDurationMonths] = useState('1');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch contracts with customer and parking spot details
      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select(`
          *,
          customer:customer_id(*),
          parking_spot:spot_id(*)
        `)
        .order('created_at', { ascending: false });
        
      if (contractsError) throw contractsError;
      
      // Fetch customers for dropdown
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('*')
        .order('name');
        
      if (customersError) throw customersError;
      
      // Fetch available parking spots for dropdown
      const { data: spotsData, error: spotsError } = await supabase
        .from('parking_spots')
        .select('*')
        .order('spot_number');
        
      if (spotsError) throw spotsError;
      
      setContracts(contractsData as ContractWithDetails[] || []);
      setCustomers(customersData || []);
      setParkingSpots(spotsData || []);
      
      // Set default start month to current month
      if (!startMonth) {
        const now = new Date();
        setStartMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
      }
      
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Add new contract
  const handleAddContract = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerId || !spotId || !startMonth || !durationMonths) {
      setFormError('すべての項目を入力してください');
      return;
    }
    
    try {
      setFormLoading(true);
      setFormError('');
      
      // Check if parking spot is already assigned to another contract
      const { data: existingContracts, error: checkError } = await supabase
        .from('contracts')
        .select('*')
        .eq('spot_id', spotId);
        
      if (checkError) throw checkError;
      
      if (existingContracts && existingContracts.length > 0) {
        setFormError('選択した駐車スペースは既に契約されています');
        return;
      }
      
      // Create new contract
      const { data: newContract, error: insertError } = await supabase
        .from('contracts')
        .insert([{
          customer_id: customerId,
          spot_id: spotId,
          start_month: startMonth,
          duration_months: parseInt(durationMonths),
        }])
        .select();
        
      if (insertError) throw insertError;
      
      // Update parking spot availability
      const { error: updateError } = await supabase
        .from('parking_spots')
        .update({ is_available: false })
        .eq('id', spotId);
        
      if (updateError) throw updateError;
      
      // Create payment record for the first month
      const { error: paymentError } = await supabase
        .from('payments')
        .insert([{
          contract_id: newContract![0].id,
          year_month: startMonth,
          status: 'unpaid',
          amount: parseInt(import.meta.env.VITE_MONTHLY_PARKING_FEE || '10000'),
        }]);
        
      if (paymentError) throw paymentError;
      
      // Reset form
      setCustomerId('');
      setSpotId('');
      setDurationMonths('1');
      setShowAddForm(false);
      
      // Refresh data
      fetchData();
      
    } catch (err) {
      console.error('Error adding contract:', err);
      setFormError('契約の追加中にエラーが発生しました');
    } finally {
      setFormLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP');
  };

  const formatYearMonth = (yearMonth: string) => {
    const [year, month] = yearMonth.split('-');
    return `${year}年${month}月`;
  };

  const calculateEndMonth = (startMonth: string, durationMonths: number) => {
    const [year, month] = startMonth.split('-').map(Number);
    let endMonth = month + durationMonths - 1;
    let endYear = year;
    
    if (endMonth > 12) {
      endYear += Math.floor(endMonth / 12);
      endMonth = endMonth % 12 || 12;
    }
    
    return `${endYear}年${endMonth}月`;
  };

  const columns = [
    {
      header: '契約者名',
      accessor: (contract: ContractWithDetails) => contract.customer?.name || '不明',
    },
    {
      header: '駐車スペース',
      accessor: (contract: ContractWithDetails) => 
        `No.${contract.parking_spot?.spot_number || '不明'}`,
    },
    {
      header: '契約開始日',
      accessor: (contract: ContractWithDetails) => formatYearMonth(contract.start_month),
    },
    {
      header: '契約終了日',
      accessor: (contract: ContractWithDetails) => 
        calculateEndMonth(contract.start_month, contract.duration_months),
    },
    {
      header: '契約期間',
      accessor: (contract: ContractWithDetails) => `${contract.duration_months}ヶ月`,
    },
    {
      header: '契約日',
      accessor: (contract: ContractWithDetails) => formatDate(contract.created_at),
    },
  ];

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">契約管理</h1>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'キャンセル' : '新規契約登録'}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {showAddForm && (
        <Card className="mb-6" title="新規契約登録">
          <form onSubmit={handleAddContract}>
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                {formError}
              </div>
            )}
            
            <div className="mb-4">
              <label htmlFor="customer" className="block text-sm font-medium text-gray-700 mb-1">
                契約者 <span className="text-red-500">*</span>
              </label>
              <select
                id="customer"
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">契約者を選択</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="mb-4">
              <label htmlFor="spot" className="block text-sm font-medium text-gray-700 mb-1">
                駐車スペース <span className="text-red-500">*</span>
              </label>
              <select
                id="spot"
                value={spotId}
                onChange={(e) => setSpotId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              >
                <option value="">駐車スペースを選択</option>
                {parkingSpots
                  .filter((spot) => spot.is_available)
                  .map((spot) => (
                    <option key={spot.id} value={spot.id}>
                      No.{spot.spot_number}
                    </option>
                  ))}
              </select>
            </div>
            
            <Input
              id="startMonth"
              label="契約開始月"
              type="month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              required
            />
            
            <div className="mb-4">
              <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-1">
                契約月数 <span className="text-red-500">*</span>
              </label>
              <select
                id="duration"
                value={durationMonths}
                onChange={(e) => setDurationMonths(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              >
                {[1, 2, 3, 6, 12, 24].map((months) => (
                  <option key={months} value={months}>
                    {months}ヶ月
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex justify-end mt-4">
              <Button type="submit" disabled={formLoading}>
                {formLoading ? <LoadingSpinner size="sm" color="white" /> : '登録'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <Table
          columns={columns}
          data={contracts}
          keyExtractor={(item) => item.id}
          emptyMessage="契約データがありません"
        />
      )}
    </Layout>
  );
};

export default Contracts;
