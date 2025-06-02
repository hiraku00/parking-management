import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Customer } from '../lib/supabase';
import Layout from '../components/Layout';
import Table from '../components/Table';
import Button from '../components/Button';
import Card from '../components/Card';
import Input from '../components/Input';
import LoadingSpinner from '../components/LoadingSpinner';

const Customers: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  // Fetch customers
  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name');
        
      if (error) throw error;
      
      setCustomers(data || []);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError('顧客データの取得中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Add new customer
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !email) {
      setFormError('名前とメールアドレスは必須です');
      return;
    }
    
    try {
      setFormLoading(true);
      setFormError('');
      
      const { error } = await supabase
        .from('customers')
        .insert([{ name, email, phone: phone || null }])
        .select();
        
      if (error) throw error;
      
      // Reset form
      setName('');
      setEmail('');
      setPhone('');
      setShowAddForm(false);
      
      // Refresh customer list
      fetchCustomers();
      
    } catch (err) {
      console.error('Error adding customer:', err);
      setFormError('顧客の追加中にエラーが発生しました');
    } finally {
      setFormLoading(false);
    }
  };

  const columns = [
    {
      header: '名前',
      accessor: (customer: Customer) => customer.name,
    },
    {
      header: 'メールアドレス',
      accessor: (customer: Customer) => customer.email,
    },
    {
      header: '電話番号',
      accessor: (customer: Customer) => customer.phone || '未設定',
    },
    {
      header: '登録日',
      accessor: (customer: Customer) => {
        const date = new Date(customer.created_at);
        return date.toLocaleDateString('ja-JP');
      },
    },
  ];

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">顧客管理</h1>
        <Button onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'キャンセル' : '新規顧客追加'}
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {showAddForm && (
        <Card className="mb-6" title="新規顧客登録">
          <form onSubmit={handleAddCustomer}>
            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                {formError}
              </div>
            )}
            
            <Input
              id="name"
              label="名前"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            
            <Input
              id="email"
              label="メールアドレス"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            
            <Input
              id="phone"
              label="電話番号"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            
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
          data={customers}
          keyExtractor={(item) => item.id}
          emptyMessage="顧客データがありません"
        />
      )}
    </Layout>
  );
};

export default Customers;
