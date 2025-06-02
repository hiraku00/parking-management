import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { ContractWithDetails } from '../lib/supabase';
import Layout from '../components/Layout';
import Card from '../components/Card';
import Input from '../components/Input';
import Button from '../components/Button';
import LoadingSpinner from '../components/LoadingSpinner';
import { format, addMonths, parseISO } from 'date-fns';

const Payment: React.FC = () => {
  const [searchType, setSearchType] = useState<'spot' | 'name'>('spot');
  const [searchValue, setSearchValue] = useState('');
  const [contract, setContract] = useState<ContractWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [paymentMonths, setPaymentMonths] = useState<number>(1); // 支払い月数の状態
  const [lastPaidMonth, setLastPaidMonth] = useState<string | null>(null); // 最後に支払われた月

  const monthlyFee = parseInt(import.meta.env.VITE_MONTHLY_PARKING_FEE || '10000');
  
  // Supabaseからデータを取得するための状態管理
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    if (isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [isInitialLoad]);

  // 最後に支払われた月を計算する関数
  const calculateLastPaidMonth = (contract: ContractWithDetails) => {
    if (!contract || !contract.payments || contract.payments.length === 0) {
      // 支払いがない場合は契約開始月の前月を返す（まだ1ヶ月も支払われていない）
      const startDate = parseISO(`${contract.start_month}-01`);
      const prevMonth = addMonths(startDate, -1);
      return format(prevMonth, 'yyyy-MM');
    }

    // 支払い済みの支払いだけをフィルタリング
    const paidPayments = contract.payments.filter(payment => payment.status === 'paid');
    
    if (paidPayments.length === 0) {
      // 支払い済みの支払いがない場合
      const startDate = parseISO(`${contract.start_month}-01`);
      const prevMonth = addMonths(startDate, -1);
      return format(prevMonth, 'yyyy-MM');
    }

    // 支払い情報を年月でソート（最新の支払い月を取得するため）
    const sortedPayments = [...paidPayments].sort((a, b) => {
      // year_monthを比較（例: '2025-06' > '2025-05'）
      return b.year_month.localeCompare(a.year_month);
    });

    // 最新の支払い月を返す
    return sortedPayments[0].year_month;
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchValue) {
      setError('検索値を入力してください');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      setContract(null);
      setSuccess(false);
      
      // 検索結果をシミュレートするための遅延
      await new Promise(resolve => setTimeout(resolve, 500));
      
      let query;
      
      if (searchType === 'spot') {
        // 駐車場番号で検索
        const spotNumber = parseInt(searchValue);
        if (isNaN(spotNumber)) {
          setError('有効な駐車スペース番号を入力してください');
          setLoading(false);
          return;
        }
        
        // 駐車スペース番号で検索する場合はまずスペースを検索してから契約を取得
        const { data: spotData } = await supabase
          .from('parking_spots')
          .select('id')
          .eq('spot_number', spotNumber)
          .single();
          
        if (!spotData) {
          setError('指定された駐車スペースが見つかりません');
          setLoading(false);
          return;
        }
        
        query = supabase
          .from('contracts')
          .select(`
            *,
            customer:customer_id(*),
            parking_spot:spot_id(*),
            payments(*)
          `)
          .eq('spot_id', spotData.id);
      } else if (searchType === 'name') {
        // 顧客名で検索
        if (searchValue.trim() === '') {
          setError('顧客名を入力してください');
          setLoading(false);
          return;
        }
        
        // 顧客名で検索する場合はまず顧客を検索してから契約を取得
        const { data: customerData } = await supabase
          .from('customers')
          .select('id')
          .ilike('name', `%${searchValue}%`);
          
        if (!customerData || customerData.length === 0) {
          setError('指定された名前の顧客が見つかりません');
          setLoading(false);
          return;
        }
        
        // 顧客IDの配列を作成
        const customerIds = customerData.map(c => c.id);
        
        query = supabase
          .from('contracts')
          .select(`
            *,
            customer:customer_id(*),
            parking_spot:spot_id(*),
            payments(*)
          `)
          .in('customer_id', customerIds);
      } else {
        setError('検索条件を入力してください');
        setLoading(false);
        return;
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        throw queryError;
      }

      if (data && data.length > 0) {
        const contractData = data[0] as ContractWithDetails;
        setContract(contractData);
        
        // 最後に支払われた月を計算して設定
        const lastPaid = calculateLastPaidMonth(contractData);
        setLastPaidMonth(lastPaid);
        
        // 支払い月数をデフォルトで1に設定
        setPaymentMonths(1);
      } else {
        setError('契約情報が見つかりませんでした');
      }
    } catch (error) {
      console.error('Error searching contract:', error);
      setError('契約情報の検索中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    try {
      setLoading(true);
      
      if (!contract || !lastPaidMonth) {
        throw new Error('契約情報が不足しています');
      }
      
      // 支払い対象の月を計算
      const lastPaidDate = parseISO(`${lastPaidMonth}-01`);
      const paymentMonthsArray = [];
      
      // 支払い対象の月を配列に追加
      for (let i = 1; i <= paymentMonths; i++) {
        const targetMonth = addMonths(lastPaidDate, i);
        paymentMonthsArray.push(format(targetMonth, 'yyyy-MM'));
      }
      
      // 支払い処理をシミュレート
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // 実際の実装では、ここでStripeなどの決済処理を行う
      // 支払い金額は月額料金 × 支払い月数
      const totalAmount = monthlyFee * paymentMonths;
      
      console.log(`支払い月数: ${paymentMonths}ヶ月分`);
      console.log(`支払い金額: ¥${totalAmount.toLocaleString()}`);
      console.log('支払い対象月:', paymentMonthsArray);
      
      // Supabaseに支払い情報を記録する処理
      // 各月分の支払いレコードを作成
      const paymentRecords = paymentMonthsArray.map(yearMonth => ({
        contract_id: contract.id,
        year_month: yearMonth,
        amount: monthlyFee,
        status: 'paid',
        paid_at: new Date().toISOString()
      }));
      
      console.log('支払いレコードを作成:', paymentRecords);
      
      const { error } = await supabase
        .from('payments')
        .insert(paymentRecords);
      
      if (error) throw error;
      
      // 支払い完了後の処理
      setSuccess(true);
      
      // 最後に支払われた月を更新
      if (paymentMonthsArray.length > 0) {
        setLastPaidMonth(paymentMonthsArray[paymentMonthsArray.length - 1]);
      }
      
    } catch (error) {
      console.error('Error processing payment:', error);
      setError('支払い処理中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const formatYearMonth = (yearMonth: string) => {
    return yearMonth.replace('-', '年') + '月';
  };

  // 契約終了日を計算する関数
  const calculateEndDate = (startMonth: string, durationMonths: number) => {
    try {
      const [year, month] = startMonth.split('-').map(Number);
      
      // 開始月から期間を加算して終了年月を計算
      let endYear = year;
      let endMonth = month + durationMonths - 1; // 契約開始月も含むため-1
      
      // 月が12を超える場合は年を繰り上げ
      if (endMonth > 12) {
        endYear += Math.floor(endMonth / 12);
        endMonth = endMonth % 12;
        if (endMonth === 0) {
          endMonth = 12;
          endYear -= 1;
        }
      }
      
      return `${endYear}年${endMonth}月`;
    } catch (error) {
      console.error('Error calculating end date:', error);
      return '計算エラー';
    }
  };

  // 次回支払い月の支払い期限を計算する関数
  const getNextPaymentDeadline = (lastPaidYearMonth: string | null, contract: ContractWithDetails | null) => {
    if (!lastPaidYearMonth && !contract) {
      // データがない場合は現在の月を使用
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const lastDay = new Date(year, month, 0).getDate();
      return `${year}年${month}月${lastDay}日`;
    }
    
    let nextPaymentMonth;
    
    if (lastPaidYearMonth) {
      // 最後に支払われた月から1ヶ月先を計算
      const lastPaidDate = parseISO(`${lastPaidYearMonth}-01`);
      nextPaymentMonth = addMonths(lastPaidDate, 1);
    } else if (contract) {
      // 支払いがない場合は契約開始月を使用
      nextPaymentMonth = parseISO(`${contract.start_month}-01`);
    } else {
      // フォールバックとして現在の月を使用
      nextPaymentMonth = new Date();
    }
    
    const year = nextPaymentMonth.getFullYear();
    const month = nextPaymentMonth.getMonth() + 1;
    
    // 月末日を取得
    const lastDay = new Date(year, month, 0).getDate();
    
    return `${year}年${month}月${lastDay}日`;
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <Card>
          <h1 className="text-2xl font-bold text-center mb-6">駐車場料金支払い</h1>
          
          {success ? (
            <div className="text-center">
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
                支払いが完了しました。ありがとうございます！
              </div>
              
              <p className="mb-4">
                支払い確認メールが登録されたメールアドレスに送信されます。
              </p>
              
              <Button onClick={() => {
                setSuccess(false);
                setContract(null);
                setSearchValue('');
              }}>
                別の支払いを行う
              </Button>
            </div>
          ) : (
            <>
              {!contract ? (
                <form onSubmit={handleSearch}>
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                      {error}
                    </div>
                  )}
                  
                  <div className="mb-4">
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          checked={searchType === 'spot'}
                          onChange={() => setSearchType('spot')}
                          className="mr-2"
                        />
                        駐車スペース番号で検索
                      </label>
                      
                      <label className="flex items-center">
                        <input
                          type="radio"
                          checked={searchType === 'name'}
                          onChange={() => setSearchType('name')}
                          className="mr-2"
                        />
                        契約者名で検索
                      </label>
                    </div>
                  </div>
                  
                  <Input
                    id="searchValue"
                    label={searchType === 'spot' ? '駐車スペース番号' : '契約者名'}
                    placeholder={searchType === 'spot' ? '例: 1' : '例: 山田太郎'}
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    required
                  />
                  
                  <div className="mt-6">
                    <Button type="submit" fullWidth disabled={loading}>
                      {loading ? <LoadingSpinner size="sm" color="white" /> : '検索'}
                    </Button>
                  </div>
                </form>
              ) : (
                <div>
                  <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-6">
                    契約情報が見つかりました
                  </div>
                  <div className="p-4">
                    <div className="mb-6">
                      <h3 className="text-lg font-medium mb-4">契約情報</h3>
                      <div className="overflow-x-auto bg-white rounded-lg shadow">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                契約者名
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                駐車スペース
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
                            <tr>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {contract.customer?.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                No.{contract.parking_spot?.spot_number}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatYearMonth(contract.start_month)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {calculateEndDate(contract.start_month, contract.duration_months)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {contract.duration_months}ヶ月
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                    
                    <div className="mb-6">
                      <h3 className="text-lg font-medium mb-4">月額料金情報</h3>
                      
                      <div className="overflow-x-auto bg-white rounded-lg shadow mb-4">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                月額料金
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                支払い状況
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                支払い期限
                              </th>
                              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                支払い月数
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            <tr>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-lg font-medium text-gray-900">¥{monthlyFee.toLocaleString()}</span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div>
                                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800 mb-1">
                                    {lastPaidMonth ? formatYearMonth(lastPaidMonth) : '未支払い'} まで支払い済み
                                  </span>
                                  <div className="text-xs text-gray-500 mt-1">
                                    次回支払い月: {lastPaidMonth ? formatYearMonth(format(addMonths(parseISO(`${lastPaidMonth}-01`), 1), 'yyyy-MM')) : formatYearMonth(contract.start_month)}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {getNextPaymentDeadline(lastPaidMonth, contract)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center space-x-4">
                                  <div>
                                    <label htmlFor="paymentMonths" className="block text-sm font-medium text-gray-700 mb-1">
                                      支払い月数
                                    </label>
                                    <select
                                      id="paymentMonths"
                                      value={paymentMonths}
                                      onChange={(e) => setPaymentMonths(parseInt(e.target.value))}
                                      className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                                      disabled={loading}
                                    >
                                      {[1, 2, 3, 4, 5, 6, 12].map((months) => (
                                        <option key={months} value={months}>
                                          {months} ヶ月分 (¥{(monthlyFee * months).toLocaleString()})
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="mt-4 text-center">
                        <Button onClick={handlePayment} disabled={loading} fullWidth>
                          {loading ? <LoadingSpinner size="sm" color="white" /> : `${paymentMonths}ヶ月分 (¥${(monthlyFee * paymentMonths).toLocaleString()}) 支払う`}
                        </Button>
                      </div>
                      
                      <div className="mt-8 mb-6">
                        <h3 className="text-lg font-medium mb-4">支払い履歴</h3>
                        {contract.payments && contract.payments.filter(p => p.status === 'paid').length > 0 ? (
                          <div className="overflow-x-auto bg-white rounded-lg shadow">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    支払い対象月
                                  </th>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    支払い日
                                  </th>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    金額
                                  </th>
                                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    ステータス
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {contract.payments
                                  .filter(payment => payment.status === 'paid')
                                  .sort((a, b) => b.year_month.localeCompare(a.year_month))
                                  .map((payment, index) => (
                                    <tr key={payment.id || index}>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {formatYearMonth(payment.year_month)}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('ja-JP') : '-'}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        ¥{payment.amount.toLocaleString()}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                          支払い済み
                                        </span>
                                      </td>
                                    </tr>
                                  ))
                                }
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-gray-500">支払い履歴がありません</p>
                          </div>
                        )}
                      </div>

                      <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg">
                        <h4 className="text-blue-800 font-medium mb-1">ご案内</h4>
                        <p className="text-sm text-blue-700">
                          この駒車場契約は月額制です。毎月の利用料金は月末までにお支払いください。
                        </p>
                      </div>
                      
                      <p className="text-sm text-gray-500 mt-2">
                        ※ 支払いはStripeの安全な決済ページで行われます
                      </p>
                    </div>
                    
                    <div className="mt-6 text-center">
                      <button
                        onClick={() => {
                          setContract(null);
                          setSearchValue('');
                          setError('');
                        }}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        別の契約を検索する
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </Layout>
  );
};

export default Payment;
