import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import Stripe from 'https://esm.sh/stripe@12.0.0?target=deno';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2025-05-28',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_ANON_KEY') || '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''}`,
      },
    },
  }
);

serve(async (req) => {
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return new Response('No signature', { status: 400 });
  }

  try {
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET') || ''
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const contractorId = session.metadata?.contractor_id;
      const months = parseInt(session.metadata?.months || '1', 10);

      if (!contractorId) {
        throw new Error('Contractor ID not found in session metadata');
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1; // 現在の月

      // 契約者情報を取得
      const { data: contractor, error: contractorError } = await supabaseClient
        .from('contractors')
        .select('contract_start_year, contract_start_month, contract_end_year, contract_end_month, name')
        .eq('id', contractorId)
        .single();

      if (contractorError) {
        console.error('Contractor fetch error:', {
          timestamp: new Date().toISOString(),
          error: contractorError,
        });
        throw new Error('Failed to fetch contractor information');
      }

      // 支払い済みの月を取得
      const { data: paidMonths, error: paidError } = await supabaseClient
        .from('payments')
        .select('year, month')
        .eq('contractor_id', contractorId)
        .order('year', { ascending: true })
        .order('month', { ascending: true });

      if (paidError) {
        console.error('Paid months fetch error:', {
          timestamp: new Date().toISOString(),
          error: paidError,
        });
        throw new Error('Failed to fetch paid months');
      }

      // 支払い済みの月をセットに変換
      const paidMonthsSet = new Set(
        (paidMonths || []).map(m => `${m.year}-${m.month}`)
      );

      // 未払いの月を取得
      const unpaidMonths: { year: number; month: number }[] = [];
      const amount = session.amount_total || 0;

      // 契約期間内の月をチェック
      const startYear = contractor.contract_start_year;
      const startMonth = contractor.contract_start_month;
      const endYear = contractor.contract_end_year || year;
      const endMonth = contractor.contract_end_month || month;

      for (let y = startYear; y <= endYear; y++) {
        for (let m = (y === startYear ? startMonth : 1); m <= (y === endYear ? endMonth : 12); m++) {
          if (!paidMonthsSet.has(`${y}-${m}`)) {
            unpaidMonths.push({ year: y, month: m });
            if (unpaidMonths.length >= months) break;
          }
        }
        if (unpaidMonths.length >= months) break;
      }

      // 未払いの月が見つからない場合、エラー
      if (unpaidMonths.length === 0) {
        console.error('No unpaid months found:', {
          timestamp: new Date().toISOString(),
          paidMonths: paidMonths,
        });
        throw new Error('No unpaid months found');
      }

      // 未払いの月に対して支払いを処理
      for (const unpaidMonth of unpaidMonths) {
        const { error: paymentError } = await supabaseClient
          .from('payments')
          .insert({
            contractor_id: contractorId,
            amount: amount / months, // 月額を月数で割る
            year: unpaidMonth.year,
            month: unpaidMonth.month,
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: session.payment_intent,
            stripe_session_id: session.id,
          });

        if (paymentError) {
          console.error('Payment insert error:', {
            timestamp: new Date().toISOString(),
            error: paymentError,
            records: [{
              contractor_id: contractorId,
              amount: amount / months,
              year: unpaidMonth.year,
              month: unpaidMonth.month,
              paid_at: new Date().toISOString(),
              stripe_payment_intent_id: session.payment_intent,
              stripe_session_id: session.id,
            }],
          });
          throw new Error('Failed to save payment information');
        }
      }

      // 契約者名を取得
      const { data: contractorName, error: contractorNameError } = await supabaseClient
        .from('contractors')
        .select('name')
        .eq('id', contractorId)
        .single();

      if (contractorNameError) {
        console.error('Contractor fetch error:', {
          timestamp: new Date().toISOString(),
          error: contractorNameError,
        });
        throw new Error('Failed to fetch contractor information');
      }

      // 支払い完了後のリダイレクト先を設定
      const redirectUrl = `${Deno.env.get('SITE_URL')}/contractor/${encodeURIComponent(contractorName.name)}`;

      // 支払い完了後のリダイレクト先を返す
      return new Response(JSON.stringify({
        redirectUrl,
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook error:', {
      timestamp: new Date().toISOString(),
      error: err,
    });
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Unknown error occurred',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}, { auth: { enabled: false } });
