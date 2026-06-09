const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/config', (_req, res) => {
    const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!googleMapsApiKey) {
        return res.status(500).json({ error: 'GOOGLE_MAPS_API_KEY is not configured' });
    }
    res.json({ googleMapsApiKey });
});

// Create database connection pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
});

app.get('/api/pois', async (req, res) => {
    try {
        const { west, east, south, north, minPrice, maxPrice } = req.query;

        if (!west || !east || !south || !north) {
            return res.status(400).json({ error: 'Missing boundary parameters (west, east, south, north)' });
        }

        // MySQL SRID 4326 expects WKT as (latitude longitude), not (lng lat)
        const wktEnvelope = `POLYGON((${south} ${west}, ${south} ${east}, ${north} ${east}, ${north} ${west}, ${south} ${west}))`;

        let query = `
            SELECT
                id, name, price, property_type,
                ST_X(location) AS lat,
                ST_Y(location) AS lng
            FROM points_of_interest
            WHERE ST_Within(location, ST_GeomFromText(?, 4326))
        `;

        const queryParams = [wktEnvelope];

        if (minPrice) {
            query += ' AND price >= ?';
            queryParams.push(Number(minPrice));
        }
        if (maxPrice) {
            query += ' AND price <= ?';
            queryParams.push(Number(maxPrice));
        }

        const [rows] = await pool.query(query, queryParams);
        res.json(rows);
    } catch (error) {
        console.error('Database error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`WebGIS API running on port ${PORT}`);
});
