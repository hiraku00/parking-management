import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { ContractWithDetails } from '../lib/supabase';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { format, parseISO, addMonths } from 'date-fns';
import { Badge } from '../components/ui/badge';
import { 
  AlertCircle, 
  CheckCircle2, 
  CreditCard, 
  Info, 
  Loader2, 
  Search, 
  X, 
  User 
} from 'lucide-react';

// Utility functions
const formatYearMonth = (yearMonth: string): string => {
  if (!yearMonth) return '';
  const year = yearMonth.substring(0, 4);
  const month = yearMonth.substring(4);
  return `${year}年${month}月`;
};

// コンポーネントの状態を管理する型定義
// コメントとして残し、コードの理解を助ける
// type PaymentState = {
//   searchType: 'spot' | 'name';
//   searchValue: string;
//   contract: ContractWithDetails | null;
//   loading: boolean;
//   error: string;
//   success: boolean;
//   paymentMonths: number;
//   lastPaidMonth: string | null;
//   paymentLoading: boolean;
// };

const Payment: React.FC = () => {
  const { user } = useAuth();
  const [searchType, setSearchType] = useState<'spot' | 'name'>('spot');
  const [searchValue, setSearchValue] = useState('');
  const [contract, setContract] = useState<ContractWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [paymentMonths, setPaymentMonths] = useState<number>(1);
  const [lastPaidMonth, setLastPaidMonth] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  const monthlyFee = parseInt(import.meta.env.VITE_MONTHLY_PARKING_FEE || '10000');

  // Reset state when component mounts
  useEffect(() => {
    try {
      // 初期状態を設定
      setSearchType('spot');
      setSearchValue('');
      setContract(null);
      setLoading(false);
      setError('');
      setSuccess(false);
      setPaymentMonths(1);
      setLastPaidMonth(null);
      setPaymentLoading(false);
      
      // Supabase接続テスト
      const testConnection = async () => {
        try {
          console.log('Supabase接続テスト開始');
          const { error } = await supabase.from('parking_spots').select('count').limit(1);
          
          if (error) {
            console.error('Supabase接続エラー:', error.message);
            setError(`データベース接続エラー: ${error.message}`);
          } else {
            console.log('Supabase接続成功');
          }
        } catch (err) {
          console.error('Supabase接続例外:', err);
          setError(`データベース接続例外: ${err instanceof Error ? err.message : String(err)}`);
        }
      };
      
      testConnection();
    } catch (err) {
      console.error('コンポーネント初期化エラー:', err);
      setError(`初期化エラー: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  // Calculate the last paid month for a contract
  const calculateLastPaidMonth = (contract: ContractWithDetails): string => {
    if (!contract || !contract.payments || contract.payments.length === 0) {
      // If no payments, return the month before contract start
      const startDate = parseISO(`${contract.start_month}-01`);
      const prevMonth = addMonths(startDate, -1);
      return format(prevMonth, 'yyyyMM');
    }

    // Filter for paid payments only
    const paidPayments = contract.payments.filter(payment => payment.status === 'paid');

    if (paidPayments.length === 0) {
      // If no paid payments, return the month before contract start
      const startDate = parseISO(`${contract.start_month}-01`);
      const prevMonth = addMonths(startDate, -1);
      return format(prevMonth, 'yyyyMM');
    }

    // Sort payments by year_month (descending)
    const sortedPayments = [...paidPayments].sort((a, b) => {
      return b.year_month.localeCompare(a.year_month);
    });

    // Return the most recent paid month
    return sortedPayments[0].year_month;
  };

  // Handle the search form submission
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchValue.trim()) {
      setError('検索値を入力してください');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);
    setContract(null);

    // デバッグ用: テーブル構造を確認
    console.log('検索開始 - 値:', searchValue, '検索タイプ:', searchType);
    
    // Supabase接続確認
    try {
      // 接続確認テスト
      const { error: connectionError } = await supabase.from('parking_spots').select('count').limit(1);
      
      if (connectionError) {
        console.error('Supabase接続エラー:', connectionError.message);
        setError(`データベース接続エラー: ${connectionError.message}`);
        setLoading(false);
        return;
      }
      
      // 接続成功後、実際の検索処理を実行
      let data;

      if (searchType === 'spot') {
        // 駐車場番号で検索
        console.log('駐車場番号で検索:', searchValue);

        try {
          // 駐車場スポットを検索
          // 駐車場番号は整数型の可能性があるので、整数値と文字列値の両方で検索を試みる
          let parkingSpots, spotError;
          
          try {
            // 駐車場番号が数値かチェック
            if (!isNaN(Number(searchValue))) {
              const result = await supabase
                .from('parking_spots')
                .select('*')
                .eq('spot_number', Number(searchValue));
              
              parkingSpots = result.data;
              spotError = result.error;
            } else {
              // 数値でない場合はエラーを設定
              throw new Error('駐車場番号は数値で入力してください');
            }
            
            // 整数値で見つからない場合は文字列として検索
            if (!parkingSpots || parkingSpots.length === 0) {
              const result = await supabase
                .from('parking_spots')
                .select('*')
                .eq('spot_number', searchValue);
              
              parkingSpots = result.data;
              spotError = result.error;
            }
          } catch (err) {
            console.error('駐車場検索エラー:', err);
            // ユーザーフレンドリーなエラーメッセージ
            if (err instanceof Error && err.message === '駐車場番号は数値で入力してください') {
              throw new Error(err.message);
            } else {
              throw new Error(`駐車場スポット検索エラーが発生しました`);
            }
          }

          console.log('駐車場検索結果:', { parkingSpots, spotError });

          if (spotError) {
            throw new Error(`駐車場スポット検索エラー: ${spotError.message}`);
          }

          if (!parkingSpots || parkingSpots.length === 0) {
            setError(`駐車場番号 "${searchValue}" が見つかりませんでした`);
            setLoading(false);
            return;
          }

          const spotId = parkingSpots[0].id;

          // 契約を検索
          const { data: contracts, error: contractError } = await supabase
            .from('contracts')
            .select(`
              *,
              parking_spot:parking_spots(*),
              customer:customers(*),
              payments:payments(*)
            `)
            .eq('spot_id', spotId);
          
          // デバッグ用: SQLクエリを出力
          console.log('駐車場番号検索SQL:', {
            table: 'contracts',
            condition: { spot_id: spotId },
            joins: ['parking_spot:parking_spots(*)', 'customer:customers(*)', 'payments:payments(*)'] 
          });

          console.log('契約検索結果:', { contracts, contractError });

          if (contractError) {
            throw new Error(`契約検索エラー: ${contractError.message}`);
          }

          if (!contracts || contracts.length === 0) {
            setError(`駐車場番号 "${searchValue}" の有効な契約が見つかりませんでした`);
            setLoading(false);
            return;
          }

          data = contracts[0];
        } catch (err) {
          console.error('駐車場番号検索エラー:', err);
          setError(`検索中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`);
          setLoading(false);
          return;
        }
      } else {
        // 契約者名で検索
        console.log('契約者名で検索:', searchValue);

        try {
          // 顧客を検索
          const { data: customers, error: customerError } = await supabase
            .from('customers')
            .select('*')
            .ilike('name', `%${searchValue}%`);

          console.log('顧客検索結果:', { customers, customerError });

          if (customerError) {
            throw new Error(`顧客検索エラー: ${customerError.message}`);
          }

          if (!customers || customers.length === 0) {
            setError(`契約者名 "${searchValue}" に一致する顧客が見つかりませんでした`);
            setLoading(false);
            return;
          }

          const customerId = customers[0].id;

          // 契約を検索
          const { data: contracts, error: contractError } = await supabase
            .from('contracts')
            .select(`
              *,
              parking_spot:parking_spots(*),
              customer:customers(*),
              payments:payments(*)
            `)
            .eq('customer_id', customerId);

          // デバッグ用: SQLクエリを出力
          console.log('契約検索SQL:', {
            table: 'contracts',
            condition: { customer_id: customerId },
            joins: ['parking_spot:parking_spots(*)', 'customer:customers(*)', 'payments:payments(*)'] 
          });

          console.log('契約検索結果:', { contracts, contractError });

          if (contractError) {
            throw new Error(`契約検索エラー: ${contractError.message}`);
          }

          if (!contracts || contracts.length === 0) {
            setError(`契約者名 "${searchValue}" の有効な契約が見つかりませんでした`);
            setLoading(false);
            return;
          }

          data = contracts[0];
        } catch (err) {
          console.error('契約者名検索エラー:', err);
          setError(`検索中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`);
          setLoading(false);
          return;
        }
      }

      // 契約データを設定
      setContract(data);
      
      // 最終支払い月を計算して設定
      const lastPaid = calculateLastPaidMonth(data);
      setLastPaidMonth(lastPaid);
      
      console.log('契約データ:', data);
      console.log('最終支払い月:', lastPaid);
    } catch (err) {
      console.error('検索エラー:', err);
      setError(`検索中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle the payment process
  const handlePayment = async () => {
    if (!contract || !lastPaidMonth) {
      setError('契約情報が見つかりません');
      return;
    }

    setPaymentLoading(true);
    setError('');
    setSuccess(false);

    try {
      // 支払い月を計算
      const paymentYearMonths: string[] = [];
      let currentYearMonth = lastPaidMonth;

      for (let i = 0; i < paymentMonths; i++) {
        // 次の月を計算
        const date = parseISO(`${currentYearMonth.substring(0, 4)}-${currentYearMonth.substring(4, 6)}-01`);
        const nextMonth = addMonths(date, 1);
        currentYearMonth = format(nextMonth, 'yyyyMM');
        paymentYearMonths.push(currentYearMonth);
      }

      console.log('支払い月:', paymentYearMonths);

      // 支払いレコードを作成
      const paymentRecords = paymentYearMonths.map(yearMonth => ({
        contract_id: contract.id,
        year_month: yearMonth,
        amount: monthlyFee,
        status: 'paid',
        paid_at: new Date().toISOString(),
      }));

      // 支払いを登録
      const { data, error } = await supabase
        .from('payments')
        .insert(paymentRecords)
        .select();

      if (error) {
        throw new Error(`支払い登録エラー: ${error.message}`);
      }

      console.log('支払い登録成功:', data);

      // 契約情報を再取得
      const { data: updatedContract, error: contractError } = await supabase
        .from('contracts')
        .select(`
          *,
          parking_spot:parking_spots(*),
          user:users(*),
          payments:payments(*)
        `)
        .eq('id', contract.id)
        .single();

      if (contractError) {
        throw new Error(`契約情報更新エラー: ${contractError.message}`);
      }

      // 状態を更新
      setContract(updatedContract);
      const newLastPaid = calculateLastPaidMonth(updatedContract);
      setLastPaidMonth(newLastPaid);
      setSuccess(true);
      setPaymentMonths(1);

      // 3秒後に成功メッセージをクリア
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('支払い処理エラー:', err);
      setError(`支払い処理中にエラーが発生しました: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPaymentLoading(false);
    }
  };

  // Calculate the next payment deadline
  const getNextPaymentDeadline = (lastPaidYearMonth: string | null, contract: ContractWithDetails | null) => {
    if (!lastPaidYearMonth || !contract) return null;

    // Parse the last paid month
    const year = parseInt(lastPaidYearMonth.substring(0, 4));
    const month = parseInt(lastPaidYearMonth.substring(4, 6));
    
    // Create a date for the last paid month
    const date = new Date(year, month - 1, 1); // month is 0-indexed in JS Date
    
    // Add one month to get the next payment month
    const nextPaymentDate = addMonths(date, 1);
    
    // Format the next payment deadline
    return format(nextPaymentDate, 'yyyy年MM月dd日');
  };

  // Reset the search form
  const resetForm = () => {
    setSearchType('spot');
    setSearchValue('');
    setContract(null);
    setLoading(false);
    setError('');
    setSuccess(false);
    setPaymentMonths(1);
    setLastPaidMonth(null);
    setPaymentLoading(false);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ページヘッダー - デジタル庁スタイル */}
        <div className="border-b border-[#DDDDDD] pb-6 mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-1.5 bg-[#0075C2] rounded-full"></div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#0075C2]">駐車場料金お支払い</h1>
          </div>
          <p className="text-[#505050] text-base ml-4">契約情報の確認と駐車場料金のお支払いができます</p>
          
          {user && (
            <div className="mt-5 bg-[#F3F9FF] border-l-4 border-[#0075C2] px-4 py-3 rounded-md flex items-center gap-2">
              <User className="h-4 w-4 text-[#0075C2]" />
              <span className="text-sm font-medium text-[#333333]">ログイン中: </span>
              <span className="text-sm text-[#505050]">{user.email}</span>
            </div>
          )}
        </div>

        {/* Search Section - デジタル庁スタイル */}
        <Card className="mb-10 border border-[#DDDDDD] rounded-lg overflow-hidden shadow-sm">
          <CardHeader className="bg-[#0075C2] text-white py-4">
            <CardTitle className="flex items-center gap-2 text-white font-bold">
              <Search className="h-5 w-5 text-white" />
              <span className="text-white">契約検索</span>
            </CardTitle>
            <p className="text-white text-sm mt-1">契約情報を検索して支払い手続きを行います</p>
          </CardHeader>
          <CardContent className="pt-6 pb-8">
            <form onSubmit={handleSearch} className="space-y-5">
              <div className="flex flex-col space-y-4">
                {/* 情報ボックス - デジタル庁スタイル */}
                <div className="w-full bg-[#F3F9FF] p-5 rounded-lg mb-6 border-l-4 border-[#0075C2] shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="text-[#0075C2] bg-white p-1.5 rounded-full shadow-sm">
                      <Info className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-medium text-[#333333] mb-2">検索方法</h3>
                      <p className="text-sm text-[#505050] leading-relaxed">
                        契約者名または駐車場番号で検索できます。該当する情報を入力してください。
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* 検索フォーム - デジタル庁スタイル */}
                <div className="flex flex-col sm:flex-row sm:items-start gap-6 bg-white p-6 rounded-lg border border-[#DDDDDD] shadow-sm">
                  <div className="w-full sm:w-1/2">
                    <label className="block text-sm font-medium text-[#333333] mb-3">
                      検索方法
                    </label>
                    <div className="flex flex-col sm:flex-row gap-4 mt-1">
                      <div className="flex items-center bg-[#F8F9FA] px-4 py-3 rounded-md border border-[#DDDDDD] hover:border-[#0075C2] transition-colors">
                        <input
                          type="radio"
                          id="searchTypeSpot"
                          name="searchType"
                          value="spot"
                          checked={searchType === 'spot'}
                          onChange={() => {
                            console.log('Search type changed to: spot');
                            setSearchType('spot');
                          }}
                          className="h-4 w-4 text-[#0075C2] border-[#CCCCCC] focus:ring-[#0075C2] mr-3"
                        />
                        <label htmlFor="searchTypeSpot" className="text-[#333333] font-medium cursor-pointer">
                          駐車場番号
                        </label>
                      </div>
                      <div className="flex items-center bg-[#F8F9FA] px-4 py-3 rounded-md border border-[#DDDDDD] hover:border-[#0075C2] transition-colors">
                        <input
                          type="radio"
                          id="searchTypeName"
                          name="searchType"
                          value="name"
                          checked={searchType === 'name'}
                          onChange={() => {
                            console.log('Search type changed to: name');
                            setSearchType('name');
                          }}
                          className="h-4 w-4 text-[#0075C2] border-[#CCCCCC] focus:ring-[#0075C2] mr-3"
                        />
                        <label htmlFor="searchTypeName" className="text-[#333333] font-medium cursor-pointer">
                          契約者名
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="w-full sm:w-1/2">
                    <label htmlFor="searchValue" className="block text-sm font-medium text-[#333333] mb-3">
                      検索値
                    </label>
                    <div className="relative">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#666666]" />
                        <Input
                          id="searchValue"
                          type="text"
                          placeholder={searchType === 'spot' ? '駐車場番号を入力' : '契約者名を入力'}
                          value={searchValue}
                          onChange={(e) => setSearchValue(e.target.value)}
                          className="w-full pl-10 border-[#DDDDDD] hover:border-[#0075C2] focus-visible:border-[#0075C2] focus-visible:ring-[#0075C2] transition-colors rounded-md"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ボタングループ - デジタル庁スタイル */}
                <div className="flex justify-end pt-6 border-t border-[#EEEEEE] mt-6">
                  <div className="flex gap-4 w-full sm:w-auto">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={resetForm} 
                      disabled={loading}
                      className="border-[#DDDDDD] text-[#505050] hover:bg-[#F8F9FA] hover:text-[#333333] px-5 py-2.5 rounded-md shadow-sm"
                    >
                      <X className="mr-2 h-4 w-4" />
                      リセット
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={loading}
                      className="bg-[#0075C2] hover:bg-[#005A94] text-white px-5 py-2.5 rounded-md shadow-sm"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          検索中...
                        </>
                      ) : (
                        <>
                          <Search className="mr-2 h-4 w-4" />
                          検索
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              
              {error && (
                <div className="bg-red-50/80 backdrop-blur-sm text-red-700 p-4 rounded-xl flex items-start gap-3 max-w-md border border-red-100 mt-4">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        {/* Contract Details Section - デジタル庁スタイル */}
        {contract && (
          <div className="space-y-8">
            <Card className="mb-10 border-[#E6E6E6] rounded-lg overflow-hidden">
              <CardHeader className="bg-[hsl(var(--primary))] text-white py-4">
                <CardTitle className="flex items-center gap-2 text-white font-bold">
                  <User className="h-5 w-5 text-white" />
                  契約情報
                </CardTitle>
                <p className="text-white text-sm mt-1 opacity-90">契約内容と支払い状況の確認</p>
              </CardHeader>
              <CardContent className="pt-6">
                {/* 契約基本情報 - デジタル庁スタイル */}
                <div className="bg-white p-6 rounded-lg border border-[#E6E6E6] mb-6">
                  <h3 className="text-[#0075C2] font-bold text-lg mb-4 border-b border-[#E6E6E6] pb-2">基本情報</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-5">
                      <div>
                        <h4 className="text-sm font-medium text-[#505050] mb-1">契約者名</h4>
                        <p className="text-lg font-medium text-[#333333]">{contract.customer?.name || '不明'}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-[#505050] mb-1">駐車場番号</h4>
                        <p className="text-lg font-medium text-[#333333]">{contract.parking_spot?.spot_number || '不明'}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-[#505050] mb-1">契約開始月</h4>
                        <p className="text-lg font-medium text-[#333333]">{formatYearMonth(contract.start_month)}</p>
                      </div>
                    </div>
                    <div className="space-y-5">
                      <div>
                        <h4 className="text-sm font-medium text-[#505050] mb-1">契約状態</h4>
                        <Badge className="mt-1 bg-[#00ADA9] text-white hover:bg-[#00ADA9] hover:opacity-90 font-normal px-3 py-1">
                          有効
                        </Badge>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-[#505050] mb-1">月額料金</h4>
                        <p className="text-lg font-medium text-[#333333]">¥{monthlyFee.toLocaleString()}</p>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-[#505050] mb-1">最終支払い月</h4>
                        <p className="text-lg font-medium text-[#333333]">
                          {lastPaidMonth ? formatYearMonth(lastPaidMonth) : '支払い履歴なし'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 支払い情報 - デジタル庁スタイル */}
                <div className="space-y-6">
                  <div className="bg-[#FFF9E6] p-5 rounded-lg border-l-4 border-[#F2C94C]">
                    <div className="flex items-start gap-3">
                      <div className="text-[#F2C94C]">
                        <AlertCircle className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-medium text-[#333333] mb-1">次回支払い期限</h3>
                        <p className="text-[#505050]">
                          {lastPaidMonth 
                            ? `${getNextPaymentDeadline(lastPaidMonth, contract)}まで` 
                            : '契約開始月の支払いが必要です'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {user && (
                    <div className="bg-[#F3F9FF] p-6 rounded-lg border border-[#E6E6E6]">
                      <h3 className="text-[#0075C2] font-bold text-lg mb-4 border-b border-[#E6E6E6] pb-2">支払い処理</h3>
                      <div className="flex flex-col md:flex-row md:items-end gap-6">
                        <div className="w-full md:w-1/3">
                          <label htmlFor="paymentMonths" className="block text-sm font-medium text-[#333333] mb-2">
                            支払い月数
                          </label>
                          <Select
                            value={paymentMonths.toString()}
                            onValueChange={(value) => setPaymentMonths(parseInt(value))}
                          >
                            <SelectTrigger className="w-full bg-white border-[#CCCCCC] hover:border-[#0075C2] transition-colors text-[#333333]">
                              <SelectValue>
                                {paymentMonths}ヶ月 (¥{(monthlyFee * paymentMonths).toLocaleString()})
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent className="bg-white w-[280px]">
                              {[1, 2, 3, 6, 12].map((months) => (
                                <SelectItem 
                                  key={months} 
                                  value={months.toString()}
                                  className="flex justify-between items-center py-2 px-3"
                                >
                                  <div className="flex justify-between w-full">
                                    <span className="font-medium">{months}ヶ月</span>
                                    <span className="text-[#757575]">¥{(monthlyFee * months).toLocaleString()}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1">
                          <Button
                            onClick={handlePayment}
                            disabled={paymentLoading || !contract}
                            className="w-full md:w-auto bg-[#0075C2] hover:bg-[#0062A3] text-white font-medium px-6 py-2 h-auto"
                          >
                            {paymentLoading ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                処理中...
                              </>
                            ) : (
                              <>
                                <CreditCard className="h-4 w-4 mr-2" />
                                支払い処理
                              </>
                            )}
                          </Button>
                        </div>
                      </div>

                      {success && (
                        <div className="mt-4 bg-[#E7F6E7] text-[#00ADA9] p-4 rounded-lg flex items-start gap-3 border border-[#00ADA9]/20">
                          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                          <p className="font-medium">支払いが完了しました！</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Payment History - デジタル庁スタイル */}
            {contract?.payments && contract.payments.length > 0 && (
              <Card className="mt-8 border-[#E6E6E6] rounded-lg overflow-hidden">
                <CardHeader className="bg-white py-4 border-b border-[#E6E6E6]">
                  <CardTitle className="flex items-center gap-2 text-[#333333] font-bold">
                    <CreditCard className="h-5 w-5 text-[#0075C2]" />
                    支払い履歴
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table className="min-w-full">
                      <TableHeader>
                        <TableRow className="border-b border-[#E6E6E6]">
                          <TableHead className="text-[#505050] text-xs sm:text-sm whitespace-nowrap bg-[#F8F9FA] py-3">支払い月</TableHead>
                          <TableHead className="text-[#505050] text-xs sm:text-sm whitespace-nowrap bg-[#F8F9FA] py-3">支払い日</TableHead>
                          <TableHead className="text-[#505050] text-xs sm:text-sm whitespace-nowrap bg-[#F8F9FA] py-3">金額</TableHead>
                          <TableHead className="text-[#505050] text-xs sm:text-sm whitespace-nowrap bg-[#F8F9FA] py-3">状態</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...contract?.payments || []]
                          .sort((a, b) => b.year_month.localeCompare(a.year_month))
                          .map((payment, index) => (
                            <TableRow key={index} className="border-b border-[#E6E6E6] hover:bg-[#F8F9FA]">
                              <TableCell className="font-medium text-[#333333] text-xs sm:text-sm py-3 whitespace-nowrap">
                                {formatYearMonth(payment.year_month)}
                              </TableCell>
                              <TableCell className="text-[#505050] text-xs sm:text-sm py-3 whitespace-nowrap">
                                {payment.paid_at ? format(new Date(payment.paid_at), 'yyyy/MM/dd') : '-'}
                              </TableCell>
                              <TableCell className="text-[#505050] text-xs sm:text-sm py-3 whitespace-nowrap">¥{payment.amount.toLocaleString()}</TableCell>
                              <TableCell className="py-3">
                                {payment.status === 'paid' ? (
                                  <Badge className="bg-[#E7F6E7] text-[#00ADA9] border border-[#00ADA9]/20 hover:bg-[#E7F6E7] hover:opacity-90 rounded-full px-2 sm:px-3 text-xs sm:text-sm">
                                    <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" />
                                    <span className="whitespace-nowrap">支払い済み</span>
                                  </Badge>
                                ) : (
                                  <Badge className="bg-[#FFF9E6] text-[#F2C94C] border border-[#F2C94C]/20 hover:bg-[#FFF9E6] hover:opacity-90 rounded-full px-2 sm:px-3 text-xs sm:text-sm">
                                    <AlertCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 mr-1 sm:mr-1.5" />
                                    <span className="whitespace-nowrap">未払い</span>
                                  </Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Payment;
