import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { ContractWithDetails } from '../lib/supabase';
import Layout from '../components/Layout';
import { format, addMonths, parseISO } from 'date-fns';

// shadcn/ui components
import { Card, CardTitle, CardContent, CardHeader } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '../components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
// Labelコンポーネントの代わりに標準のHTMLラベル要素を使用

// Icons
import { 
  AlertCircle, CarFront, CheckCircle2, CreditCard, Info, Loader2, Search, User 
} from 'lucide-react';

// Utility functions
const formatYearMonth = (yearMonth: string): string => {
  if (!yearMonth) return '';
  const year = yearMonth.substring(0, 4);
  const month = yearMonth.substring(4);
  return `${year}年${month}月`;
};

const getPaymentPeriod = (startYearMonth: string, months: number) => {
  if (!startYearMonth) return null;
  
  const year = parseInt(startYearMonth.substring(0, 4));
  const month = parseInt(startYearMonth.substring(4));
  const startDate = new Date(year, month - 1, 1);
  const endDate = addMonths(startDate, months);
  
  const endYearMonth = format(endDate, 'yyyyMM');
  return {
    startYearMonth,
    endYearMonth,
    formattedStart: formatYearMonth(startYearMonth),
    formattedEnd: formatYearMonth(endYearMonth),
    months
  };
};

const Payment: React.FC = () => {
  const [searchType, setSearchType] = useState<'spot' | 'name'>('spot');
  const [searchValue, setSearchValue] = useState('');
  const [contract, setContract] = useState<ContractWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [paymentMonths, setPaymentMonths] = useState<number>(1);
  const [lastPaidMonth, setLastPaidMonth] = useState<string | null>(null);

  const monthlyFee = parseInt(import.meta.env.VITE_MONTHLY_PARKING_FEE || '10000');

  // Reset state when component mounts
  useEffect(() => {
    resetForm();
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

    if (!searchValue) {
      setError('検索値を入力してください');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);
    setContract(null);

    try {
      let data;
      let searchError;
      
      if (searchType === 'spot') {
        // Search by parking spot number
        const result = await supabase
          .from('contracts')
          .select(`
            *,
            customer:customers(id, name, phone),
            parking_spot:parking_spots(id, spot_number),
            payments(id, year_month, amount, status, paid_at)
          `)
          .eq('parking_spot.spot_number', searchValue);
          
        data = result.data;
        searchError = result.error;
      } else {
        // Search by customer name
        const result = await supabase
          .from('contracts')
          .select(`
            *,
            customer:customers(id, name, phone),
            parking_spot:parking_spots(id, spot_number),
            payments(id, year_month, amount, status, paid_at)
          `)
          .ilike('customer.name', `%${searchValue}%`);
          
        data = result.data;
        searchError = result.error;
      }

      if (searchError) {
        throw searchError;
      }

      if (!data || data.length === 0) {
        setError('契約が見つかりませんでした');
        setLoading(false);
        return;
      }

      // Use the first contract found
      const foundContract = data[0] as ContractWithDetails;
      setContract(foundContract);
      
      // Calculate the last paid month
      const lastPaid = calculateLastPaidMonth(foundContract);
      setLastPaidMonth(lastPaid);
      
      setLoading(false);
    } catch (err) {
      console.error('Search error:', err);
      setError('検索中にエラーが発生しました');
      setLoading(false);
    }
  };

  // Handle the payment process
  const handlePayment = async () => {
    if (!contract || !lastPaidMonth) {
      setError('契約情報がありません');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      // Calculate the payment period
      const lastPaidDate = new Date(
        parseInt(lastPaidMonth.substring(0, 4)),
        parseInt(lastPaidMonth.substring(4)) - 1,
        1
      );
      
      // Calculate the next month to be paid
      const nextPaymentDate = addMonths(lastPaidDate, 1);
      const nextPaymentYearMonth = format(nextPaymentDate, 'yyyyMM');
      
      // Calculate total payment amount
      const paymentAmount = monthlyFee * paymentMonths;

      // Create payment records for each month
      for (let i = 0; i < paymentMonths; i++) {
        const paymentDate = addMonths(nextPaymentDate, i);
        const paymentYearMonth = format(paymentDate, 'yyyyMM');
        
        // Check if payment already exists
        const { data: existingPayments } = await supabase
          .from('payments')
          .select('*')
          .eq('contract_id', contract.id)
          .eq('year_month', paymentYearMonth);
        
        if (existingPayments && existingPayments.length > 0) {
          // Update existing payment
          await supabase
            .from('payments')
            .update({
              amount: monthlyFee,
              status: 'paid',
              paid_at: new Date().toISOString()
            })
            .eq('id', existingPayments[0].id);
        } else {
          // Insert new payment
          await supabase.from('payments').insert({
            contract_id: contract.id,
            year_month: paymentYearMonth,
            amount: monthlyFee,
            status: 'paid',
            paid_at: new Date().toISOString()
          });
        }
      }

      // Refresh contract data
      const { data: updatedContract } = await supabase
        .from('contracts')
        .select(`
          *,
          customer:customers(id, name, phone),
          parking_spot:parking_spots(id, spot_number),
          payments(id, year_month, amount, status, paid_at)
        `)
        .eq('id', contract.id)
        .single();

      if (updatedContract) {
        setContract(updatedContract as ContractWithDetails);
        const updatedLastPaid = calculateLastPaidMonth(updatedContract as ContractWithDetails);
        setLastPaidMonth(updatedLastPaid);
      }

      setSuccess(true);
      setLoading(false);
    } catch (err) {
      console.error('Payment error:', err);
      setError('支払い処理中にエラーが発生しました');
      setLoading(false);
    }
  };

  // Calculate the next payment deadline
  const getNextPaymentDeadline = (lastPaidYearMonth: string | null, contract: ContractWithDetails | null) => {
    if (!lastPaidYearMonth || !contract) return null;

    // Parse the last paid year and month
    const year = parseInt(lastPaidYearMonth.substring(0, 4));
    const month = parseInt(lastPaidYearMonth.substring(4));
    
    // Create a date object for the last paid month
    const lastPaidDate = new Date(year, month - 1, 1);
    
    // Add one month to get the next payment month
    const nextPaymentDate = addMonths(lastPaidDate, 1);
    
    // The payment deadline is the 5th of the month
    nextPaymentDate.setDate(5);
    
    return nextPaymentDate;
  };

  // Reset the search form
  const resetForm = () => {
    setSearchValue('');
    setContract(null);
    setError('');
    setSuccess(false);
    setPaymentMonths(1);
  };

  return (
    <Layout>
      <div className="container mx-auto py-6 px-4 md:px-6">
        <h1 className="text-3xl font-bold mb-6 text-gray-800">駐車場料金支払い</h1>
        
        {/* Search Section */}
        <Card className="mb-8 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-600" />
              契約検索
            </CardTitle>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <Tabs defaultValue="spot" className="w-full" onValueChange={(value) => setSearchType(value as 'spot' | 'name')}>
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="spot" className="flex items-center gap-2">
                    <CarFront className="h-4 w-4" />
                    駐車場番号
                  </TabsTrigger>
                  <TabsTrigger value="name" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    契約者名
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="spot" className="pt-4">
                  <div className="space-y-2">
                    <label htmlFor="spot-search" className="text-sm font-medium leading-none">駐車場番号</label>
                    <Input
                      id="spot-search"
                      placeholder="例: A-101"
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      className="max-w-md"
                    />
                  </div>
                </TabsContent>
                
                <TabsContent value="name" className="pt-4">
                  <div className="space-y-2">
                    <label htmlFor="name-search" className="text-sm font-medium leading-none">契約者名</label>
                    <Input
                      id="name-search"
                      placeholder="例: 山田太郎"
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      className="max-w-md"
                    />
                  </div>
                </TabsContent>
              </Tabs>
              
              <div className="flex flex-wrap gap-3 pt-2">
                <Button type="submit" disabled={loading} className="flex items-center gap-2">
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      検索中...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4" />
                      検索
                    </>
                  )}
                </Button>
                
                <Button type="button" variant="outline" onClick={resetForm}>
                  リセット
                </Button>
              </div>
              
              {error && (
                <div className="bg-red-50 text-red-700 p-3 rounded-md flex items-start gap-2 max-w-md">
                  <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <p>{error}</p>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
        
        {/* Contract Information and Payment Section */}
        {contract && (
          <div className="space-y-8">
            {/* Success Message */}
            {success && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-100 p-4 rounded-lg shadow-sm flex items-start gap-3 mb-6">
                <CheckCircle2 className="h-6 w-6 text-green-500 shrink-0" />
                <div>
                  <h3 className="font-medium text-green-800">支払いが完了しました</h3>
                  <p className="text-green-700 mt-1">
                    {paymentMonths}ヶ月分の支払いが正常に処理されました。
                  </p>
                </div>
              </div>
            )}
            
            {/* Contract Details */}
            <Card className="shadow-md bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-800">
                  <Info className="h-5 w-5 text-blue-600" />
                  契約情報
                </CardTitle>
              </CardHeader>
              
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">契約者</h3>
                      <p className="text-lg font-medium text-gray-900">{contract.customer?.name}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">連絡先</h3>
                      <p className="text-lg font-medium text-gray-900">{contract.customer?.phone || '登録なし'}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">契約開始日</h3>
                      <p className="text-lg font-medium text-gray-900">{formatYearMonth(contract.start_month)}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">駐車場番号</h3>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 px-3 py-1 text-base">
                          {contract.parking_spot?.spot_number}
                        </Badge>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">月額料金</h3>
                      <p className="text-lg font-medium text-gray-900">¥{monthlyFee.toLocaleString()}</p>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-medium text-gray-500">最終支払い月</h3>
                      <p className="text-lg font-medium text-gray-900">
                        {lastPaidMonth ? formatYearMonth(lastPaidMonth) : '支払いなし'}
                      </p>
                    </div>
                  </div>
                </div>
                
                <Separator className="my-6" />
                
                {/* Payment Form */}
                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                  <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    支払い
                  </h3>
                  
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label htmlFor="payment-months" className="text-sm font-medium leading-none">支払い月数</label>
                      <Select
                        value={paymentMonths.toString()}
                        onValueChange={(value) => setPaymentMonths(parseInt(value))}
                      >
                        <SelectTrigger className="w-full max-w-xs">
                          <SelectValue placeholder="支払い月数を選択" />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 6, 12].map((months) => (
                            <SelectItem key={months} value={months.toString()}>
                              {months}ヶ月 (¥{(monthlyFee * months).toLocaleString()})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {lastPaidMonth && (
                      <div className="bg-amber-50 border border-amber-100 rounded-md p-4">
                        <h4 className="font-medium text-amber-800 flex items-center gap-2 mb-2">
                          <Info className="h-4 w-4 text-amber-600" />
                          支払い期間
                        </h4>
                        <p className="text-amber-700">
                          {lastPaidMonth && getPaymentPeriod(
                            format(addMonths(new Date(parseInt(lastPaidMonth.substring(0, 4)), parseInt(lastPaidMonth.substring(4)) - 1, 1), 1), 'yyyyMM'),
                            paymentMonths
                          )?.formattedStart} から {lastPaidMonth && getPaymentPeriod(
                            format(addMonths(new Date(parseInt(lastPaidMonth.substring(0, 4)), parseInt(lastPaidMonth.substring(4)) - 1, 1), 1), 'yyyyMM'),
                            paymentMonths
                          )?.formattedEnd} まで
                        </p>
                        <p className="text-amber-700 mt-1">
                          合計: <span className="font-bold">¥{(monthlyFee * paymentMonths).toLocaleString()}</span>
                        </p>
                      </div>
                    )}
                    
                    <Button
                      onClick={handlePayment}
                      disabled={loading}
                      className="w-full max-w-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    >
                      {loading ? (
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
              </CardContent>
            </Card>
            
            {/* Payment History */}
            {contract.payments && contract.payments.length > 0 && (
              <Card className="shadow-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-blue-600" />
                    支払い履歴
                  </CardTitle>
                </CardHeader>
                
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>支払い月</TableHead>
                          <TableHead>支払い日</TableHead>
                          <TableHead>金額</TableHead>
                          <TableHead>状態</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...contract.payments]
                          .sort((a, b) => b.year_month.localeCompare(a.year_month))
                          .map((payment, index) => (
                            <TableRow key={index}>
                              <TableCell className="font-medium">
                                {formatYearMonth(payment.year_month)}
                              </TableCell>
                              <TableCell>
                                {payment.paid_at ? format(new Date(payment.paid_at), 'yyyy/MM/dd') : '-'}
                              </TableCell>
                              <TableCell>¥{payment.amount.toLocaleString()}</TableCell>
                              <TableCell>
                                {payment.status === 'paid' ? (
                                  <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                                    支払い済み
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-amber-800 border-amber-300">
                                    未払い
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
