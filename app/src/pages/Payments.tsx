import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Payment, ContractWithDetails } from '../lib/supabase';
import Layout from '../components/Layout';
import Table from '../components/Table';
import Button from '../components/Button';
import Card from '../components/Card';
import LoadingSpinner from '../components/LoadingSpinner';

type PaymentWithDetails = Payment & {
  contract: ContractWithDetails;
};

const Payments: React.FC = () => {
  const [payments, setPayments] = useState<PaymentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentMonth, setCurrentMonth] = useState('');

  useEffect(() => {
    // Set current month in YYYY-MM format
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setCurrentMonth(month);
    
    fetchPayments(month);
  }, []);

  const fetchPayments = async (month: string) => {
    try {
      setLoading(true);
      
      // Fetch payments for the selected month with contract and customer details
      const { data, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          *,
          contract:contract_id (
            *,
            customer:customer_id(*),
            parking_spot:spot_id(*)
          )
        `)
        .eq('year_month', month)
        .order('status');
        
      if (paymentsError) throw paymentsError;
      
      setPayments(data as PaymentWithDetails[] || []);
      
    } catch (err) {
      console.error('Error fetching payments:', err);
      setError('支払いデータの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const month = e.target.value;
    setCurrentMonth(month);
    fetchPayments(month);
  };

  const updatePaymentStatus = async (paymentId: string, status: 'paid' | 'unpaid') => {
    try {
      const { error } = await supabase
        .from('payments')
        .update({ 
          status,
          paid_at: status === 'paid' ? new Date().toISOString() : null 
        })
        .eq('id', paymentId);
        
      if (error) throw error;
      
      // Refresh payments
      fetchPayments(currentMonth);
      
    } catch (err) {
      console.error('Error updating payment status:', err);
      setError('支払いステータスの更新中にエラーが発生しました');
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP');
  };

  const formatYearMonth = (yearMonth: string) => {
    const [year, month] = yearMonth.split('-');
    return `${year}年${month}月`;
  };

  const columns = [
    {
      header: '契約者名',
      accessor: (payment: PaymentWithDetails) => payment.contract?.customer?.name || '不明',
    },
    {
      header: '駐車スペース',
      accessor: (payment: PaymentWithDetails) => 
        `No.${payment.contract?.parking_spot?.spot_number || '不明'}`,
    },
    {
      header: '対象月',
      accessor: (payment: PaymentWithDetails) => formatYearMonth(payment.year_month),
    },
    {
      header: '金額',
      accessor: (payment: PaymentWithDetails) => `¥${payment.amount.toLocaleString()}`,
    },
    {
      header: '支払い状況',
      accessor: (payment: PaymentWithDetails) => (
        <span
          className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
            payment.status === 'paid'
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}
        >
          {payment.status === 'paid' ? '支払い済み' : '未払い'}
        </span>
      ),
    },
    {
      header: '支払日',
      accessor: (payment: PaymentWithDetails) => formatDate(payment.paid_at),
    },
    {
      header: 'アクション',
      accessor: (payment: PaymentWithDetails) => (
        <Button
          variant={payment.status === 'paid' ? 'danger' : 'success'}
          size="sm"
          onClick={() => updatePaymentStatus(
            payment.id, 
            payment.status === 'paid' ? 'unpaid' : 'paid'
          )}
        >
          {payment.status === 'paid' ? '未払いに変更' : '支払い済みに変更'}
        </Button>
      ),
    },
  ];

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">支払い管理</h1>
        
        <div className="flex items-center">
          <label htmlFor="month" className="mr-2 text-gray-700">対象月:</label>
          <input
            id="month"
            type="month"
            value={currentMonth}
            onChange={handleMonthChange}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <Card className="mb-6">
        <div className="flex justify-between">
          <div>
            <h3 className="text-lg font-medium text-gray-900">支払い状況サマリー</h3>
            <p className="text-sm text-gray-500">{formatYearMonth(currentMonth)}</p>
          </div>
          
          <div className="flex space-x-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">総契約数</p>
              <p className="text-xl font-bold">{payments.length}</p>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-gray-500">支払い済み</p>
              <p className="text-xl font-bold text-green-600">
                {payments.filter(p => p.status === 'paid').length}
              </p>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-gray-500">未払い</p>
              <p className="text-xl font-bold text-red-600">
                {payments.filter(p => p.status === 'unpaid').length}
              </p>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-gray-500">合計金額</p>
              <p className="text-xl font-bold">
                ¥{payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : (
        <Table
          columns={columns}
          data={payments}
          keyExtractor={(item) => item.id}
          emptyMessage={`${formatYearMonth(currentMonth)}の支払いデータがありません`}
        />
      )}
    </Layout>
  );
};

export default Payments;
