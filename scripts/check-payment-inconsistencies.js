const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing environment variables');
    console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkPaymentInconsistencies() {
    console.log('🔍 Checking for payment amount inconsistencies...\n');

    // Fetch all payments with user profile data
    const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select(`
            id,
            user_id,
            amount,
            target_month,
            created_at,
            payment_method,
            profiles!inner(full_name, monthly_fee)
        `)
        .order('created_at', { ascending: false });

    if (paymentsError) {
        console.error('❌ Error fetching payments:', paymentsError.message);
        process.exit(1);
    }

    if (!payments || payments.length === 0) {
        console.log('ℹ️  No payments found in database.');
        return;
    }

    console.log(`📊 Total payments: ${payments.length}\n`);

    // Check for inconsistencies
    const inconsistencies = [];

    for (const payment of payments) {
        const recordedAmount = payment.amount;
        const correctAmount = payment.profiles.monthly_fee;

        if (recordedAmount !== correctAmount) {
            inconsistencies.push({
                paymentId: payment.id,
                contractorName: payment.profiles.full_name,
                targetMonth: payment.target_month,
                recordedAmount,
                correctAmount,
                difference: recordedAmount - correctAmount,
                paymentMethod: payment.payment_method,
                createdAt: payment.created_at,
            });
        }
    }

    // Report findings
    if (inconsistencies.length === 0) {
        console.log('✅ No inconsistencies found! All payment amounts match contractor monthly fees.');
        return;
    }

    console.log(`⚠️  Found ${inconsistencies.length} inconsistent payment(s):\n`);
    console.log('═'.repeat(100));

    inconsistencies.forEach((inc, index) => {
        console.log(`\n${index + 1}. Payment ID: ${inc.paymentId}`);
        console.log(`   Contractor: ${inc.contractorName}`);
        console.log(`   Target Month: ${inc.targetMonth}`);
        console.log(`   Payment Method: ${inc.paymentMethod}`);
        console.log(`   Created At: ${new Date(inc.createdAt).toLocaleString('ja-JP')}`);
        console.log(`   Recorded Amount: ¥${inc.recordedAmount.toLocaleString()}`);
        console.log(`   Correct Amount:  ¥${inc.correctAmount.toLocaleString()}`);
        console.log(`   Difference: ¥${inc.difference.toLocaleString()} ${inc.difference > 0 ? '(overpaid)' : '(underpaid)'}`);
    });

    console.log('\n' + '═'.repeat(100));
    console.log(`\n💡 To fix these inconsistencies, run: node scripts/fix-payment-inconsistencies.js`);
    console.log('⚠️  Always backup your database before running fix scripts!\n');

    // Summary statistics
    const totalDifference = inconsistencies.reduce((sum, inc) => sum + inc.difference, 0);
    console.log(`📈 Summary:`);
    console.log(`   Total inconsistencies: ${inconsistencies.length}`);
    console.log(`   Total difference: ¥${totalDifference.toLocaleString()}`);
}

checkPaymentInconsistencies().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
});
