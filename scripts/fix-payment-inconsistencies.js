const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const readline = require('readline');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Check if running in dry-run mode
const isDryRun = process.argv.includes('--dry-run');

async function promptConfirmation(message) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(message, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

async function fixPaymentInconsistencies() {
    console.log('🔧 Payment Inconsistency Fix Script\n');

    if (isDryRun) {
        console.log('🔍 Running in DRY-RUN mode (no changes will be made)\n');
    } else {
        console.log('⚠️  WARNING: This will modify production data!');
        console.log('⚠️  Make sure you have a database backup before proceeding.\n');

        const confirmed = await promptConfirmation('Do you want to continue? (y/n): ');
        if (!confirmed) {
            console.log('❌ Operation cancelled.');
            process.exit(0);
        }
        console.log('');
    }

    // Fetch all payments with user profile data
    const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select(`
            id,
            user_id,
            amount,
            target_month,
            profiles!inner(full_name, monthly_fee)
        `);

    if (paymentsError) {
        console.error('❌ Error fetching payments:', paymentsError.message);
        process.exit(1);
    }

    // Find inconsistencies
    const toFix = [];
    for (const payment of payments) {
        if (payment.amount !== payment.profiles.monthly_fee) {
            toFix.push({
                id: payment.id,
                contractorName: payment.profiles.full_name,
                targetMonth: payment.target_month,
                oldAmount: payment.amount,
                newAmount: payment.profiles.monthly_fee,
            });
        }
    }

    if (toFix.length === 0) {
        console.log('✅ No inconsistencies found. Nothing to fix!');
        return;
    }

    console.log(`Found ${toFix.length} payment(s) to fix:\n`);
    toFix.forEach((item, index) => {
        console.log(`${index + 1}. ${item.contractorName} - ${item.targetMonth}`);
        console.log(`   ¥${item.oldAmount.toLocaleString()} → ¥${item.newAmount.toLocaleString()}`);
    });

    if (isDryRun) {
        console.log('\n🔍 DRY-RUN: No changes were made.');
        console.log('💡 To apply these fixes, run: node scripts/fix-payment-inconsistencies.js');
        return;
    }

    console.log('\n🔄 Applying fixes...');
    let successCount = 0;
    let errorCount = 0;

    for (const item of toFix) {
        const { error } = await supabase
            .from('payments')
            .update({ amount: item.newAmount })
            .eq('id', item.id);

        if (error) {
            console.error(`❌ Failed to update payment ${item.id}:`, error.message);
            errorCount++;
        } else {
            console.log(`✅ Updated payment ${item.id} (${item.contractorName} - ${item.targetMonth})`);
            successCount++;
        }
    }

    console.log('\n' + '═'.repeat(60));
    console.log(`\n✅ Successfully updated: ${successCount}`);
    if (errorCount > 0) {
        console.log(`❌ Failed: ${errorCount}`);
    }
    console.log('\n💡 Run check-payment-inconsistencies.js to verify the fixes.');
}

fixPaymentInconsistencies().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
});
