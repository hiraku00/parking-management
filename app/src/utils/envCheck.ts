// 環境変数チェック用ユーティリティ
export const checkEnvVariables = () => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const monthlyFee = import.meta.env.VITE_MONTHLY_PARKING_FEE;

  console.log('環境変数チェック:');
  console.log('VITE_SUPABASE_URL:', supabaseUrl ? '設定済み' : '未設定');
  console.log('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '設定済み' : '未設定');
  console.log('VITE_MONTHLY_PARKING_FEE:', monthlyFee || '未設定');

  return {
    supabaseUrl: !!supabaseUrl,
    supabaseAnonKey: !!supabaseAnonKey,
    monthlyFee: !!monthlyFee
  };
};
