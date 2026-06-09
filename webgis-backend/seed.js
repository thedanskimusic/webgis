const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

function generatePoint() {
    const rand = Math.random();
    let lat, lng;
    
    if (rand < 0.40) {
        // Sydney Metro (40%)
        const r = Math.random() * 0.25;
        const theta = Math.random() * 2 * Math.PI;
        lat = -33.8688 + r * Math.sin(theta);
        lng = 151.2093 + r * Math.cos(theta);
    } else if (rand < 0.50) {
        // Newcastle Metro (10%)
        const r = Math.random() * 0.12;
        const theta = Math.random() * 2 * Math.PI;
        lat = -32.9283 + r * Math.sin(theta);
        lng = 151.7817 + r * Math.cos(theta);
    } else if (rand < 0.55) {
        // Wollongong Metro (5%)
        const r = Math.random() * 0.08;
        const theta = Math.random() * 2 * Math.PI;
        lat = -34.4278 + r * Math.sin(theta);
        lng = 150.8931 + r * Math.cos(theta);
    } else if (rand < 0.60) {
        // Canberra Metro (5%)
        const r = Math.random() * 0.08;
        const theta = Math.random() * 2 * Math.PI;
        lat = -35.2809 + r * Math.sin(theta);
        lng = 149.1300 + r * Math.cos(theta);
    } else {
        // Rest of NSW (40%), weighted towards the coast
        lat = -37.5 + Math.random() * (37.5 - 28.2);
        
        // Coastline at this latitude
        const max_lng = 150.0 + (lat + 37.5) * 0.4045;
        const min_lng = 141.0;
        
        // Power distribution to bias towards the east coast
        const bias = Math.pow(Math.random(), 0.3);
        lng = min_lng + (max_lng - min_lng) * bias;
    }
    
    // Pick property type
    const types = ['house', 'apartment', 'condo'];
    const propertyType = types[Math.floor(Math.random() * types.length)];
    
    // Pick name
    const adjectives = ['Beautiful', 'Spacious', 'Modern', 'Cozy', 'Stunning', 'Charming', 'Elegant', 'Sunlit', 'Quiet', 'Luxury'];
    const nouns = ['Family Home', 'Apartment', 'Studio', 'Condo', 'Townhouse', 'Terrace', 'Villa', 'Penthouse', 'Cottage', 'Residence'];
    const name = `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;
    
    // Price calculation
    let priceBase = 300000 + Math.random() * 1200000;
    if (rand < 0.40) {
        priceBase += 400000 + Math.random() * 1000000; // Sydney premium
    }
    const price = Math.round(priceBase / 5000) * 5000;
    
    return { name, price, propertyType, lat, lng };
}

async function run() {
    let conn;
    try {
        console.log('Connecting to database...');
        conn = await pool.getConnection();

        console.log('Clearing existing points of interest...');
        await conn.query('TRUNCATE TABLE points_of_interest');

        const totalRecords = 1000000;
        const batchSize = 10000;
        const numBatches = totalRecords / batchSize;

        console.log(`Starting generation & insertion of ${totalRecords.toLocaleString()} records...`);
        const startTime = Date.now();

        for (let batch = 0; batch < numBatches; batch++) {
            let sql = 'INSERT INTO points_of_interest (name, price, property_type, location) VALUES ';
            const values = [];
            const placeholders = [];

            for (let i = 0; i < batchSize; i++) {
                const p = generatePoint();
                placeholders.push('(?, ?, ?, ST_GeomFromText(?, 4326))');
                values.push(p.name, p.price, p.propertyType, `POINT(${p.lat} ${p.lng})`);
            }

            sql += placeholders.join(', ');
            await conn.execute(sql, values);

            if ((batch + 1) % 10 === 0 || batch === numBatches - 1) {
                const count = (batch + 1) * batchSize;
                const elapsed = (Date.now() - startTime) / 1000;
                const progressPercent = ((batch + 1) / numBatches * 100).toFixed(0);
                const rate = Math.round(count / elapsed);
                console.log(`Progress: ${count.toLocaleString()} / ${totalRecords.toLocaleString()} (${progressPercent}%) - Time elapsed: ${elapsed.toFixed(1)}s - Rate: ${rate.toLocaleString()} rows/s`);
            }
        }

        const totalTime = (Date.now() - startTime) / 1000;
        console.log(`Successfully completed seeding in ${totalTime.toFixed(2)} seconds!`);

    } catch (err) {
        console.error('Error during seeding:', err);
    } finally {
        if (conn) conn.release();
        await pool.end();
    }
}

run();
