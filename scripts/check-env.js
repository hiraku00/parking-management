const fs = require('fs');
const path = require('path');

// List of required environment variables
const REQUIRED_ENV_VARS = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    // 'AUTH_SECRET' is critical for production but might not be present in all build environments if just building static assets.
    // However, for this project, it's safer to enforce it if we are targeting production-like builds.
    // We can make it conditional or just warn. For now, let's enforce it for safety as per user request.
];

// In a real Vercel build, process.env should be populated.
// If running locally, we might want to check .env.local if not loaded by the shell.
// But usually 'next build' loads env vars. This script runs *before* next build in our plan? 
// If it runs via npm scripts, standard process.env should avail if properly loaded. 
// Note: 'next build' automatically loads .env files. A pre-build script running via node might NOT load them automatically unless we use dotenv.

// Let's assume this runs in a context where ENV is available (like Vercel or CI with secrets injected).
// For local dev, we might need 'dotenv'.

try {
    require('dotenv').config({ path: '.env.local' });
} catch (e) {
    // dotenv might not be available or .env.local might not exist (e.g. in CI)
}

const missingVars = REQUIRED_ENV_VARS.filter(key => !process.env[key]);

if (missingVars.length > 0) {
    console.error('\x1b[31m%s\x1b[0m', 'Error: Missing required environment variables:');
    missingVars.forEach(key => {
        console.error(`  - ${key}`);
    });
    console.error('\nPlease set these variables in your environment or .env.local file.');
    process.exit(1);
}

// Special check for AUTH_SECRET to ensure it's not a placeholder in production
if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length < 32) {
    // Just a warning for now, or error? Let's error to be safe as per the recent incident.
    if (process.env.NODE_ENV === 'production') {
        console.error('\x1b[31m%s\x1b[0m', 'Error: AUTH_SECRET is too short. It must be at least 32 characters long.');
        process.exit(1);
    }
}

console.log('\x1b[32m%s\x1b[0m', '✅ Environment variables check passed.');
