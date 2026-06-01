const fs = require('fs');
const path = require('path');

// This script switches the Prisma schema for Vercel/Railway deployment
if (process.env.VERCEL || process.env.DATABASE_URL || process.env.RAILWAY_ENVIRONMENT) {
    console.log('Detected production environment. Switching to PostgreSQL schema...');
    try {
        const source = path.join(__dirname, '../server/prisma/schema.prod.prisma');
        const dest = path.join(__dirname, '../server/prisma/schema.prisma');

        if (fs.existsSync(source)) {
            fs.copyFileSync(source, dest);
            console.log('✅ Updated server/prisma/schema.prisma to use PostgreSQL provider.');
        } else {
            console.error('❌ server/prisma/schema.prod.prisma not found!');
            process.exit(1);
        }
    } catch (error) {
        console.error('Failed to switch schema:', error);
        process.exit(1);
    }
} else {
    console.log('Not production environment. Keeping SQLite schema for local development.');
}
