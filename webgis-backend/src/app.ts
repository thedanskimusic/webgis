import express, { Request, Response } from 'express';
import mysql, { RowDataPacket } from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/config', (_req: Request, res: Response) => {
  const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!googleMapsApiKey) {
    return res
      .status(500)
      .json({ error: 'GOOGLE_MAPS_API_KEY is not configured' });
  }
  res.json({ googleMapsApiKey });
});

// Create database connection pool
export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

// Helper 1: Formats a bounding box into a standard MySQL SRID 4326 POLYGON WKT string
export function buildWktEnvelope(
  south: string,
  west: string,
  north: string,
  east: string
): string {
  return `POLYGON((${south} ${west}, ${south} ${east}, ${north} ${east}, ${north} ${west}, ${south} ${west}))`;
}

// Helper 2: Builds the SQL query and parameter array based on filters
interface QueryBuild {
  sql: string;
  params: (string | number)[];
}

export function buildPoiQuery(
  wktEnvelope: string,
  minPrice?: string,
  maxPrice?: string
): QueryBuild {
  let sql = `
        SELECT id, name, price, property_type,
               ST_X(location) AS lat,
               ST_Y(location) AS lng
        FROM points_of_interest
        WHERE MBRWithin(location, ST_GeomFromText(?, 4326))
    `;
  const params: (string | number)[] = [wktEnvelope];

  if (minPrice) {
    sql += ' AND price >= ?';
    params.push(Number(minPrice));
  }
  if (maxPrice) {
    sql += ' AND price <= ?';
    params.push(Number(maxPrice));
  }

  sql += ' LIMIT 2001';
  return { sql, params };
}

interface PoiQueryParams {
  west?: string;
  east?: string;
  south?: string;
  north?: string;
  minPrice?: string;
  maxPrice?: string;
}

export interface PoiRow extends RowDataPacket {
  id: number;
  name: string;
  price: number;
  property_type: string;
  lat: number;
  lng: number;
}

app.get(
  '/api/pois',
  async (req: Request<{}, {}, {}, PoiQueryParams>, res: Response) => {
    try {
      const { west, east, south, north, minPrice, maxPrice } = req.query;

      if (!west || !east || !south || !north) {
        return res
          .status(400)
          .json({
            error: 'Missing boundary parameters (west, east, south, north)'
          });
      }

      const wktEnvelope = buildWktEnvelope(south, west, north, east);
      const { sql, params } = buildPoiQuery(wktEnvelope, minPrice, maxPrice);

      const [rows] = await pool.query<PoiRow[]>(sql, params);

      const limit = 2000;
      const exceeded = rows.length > limit;

      let dataResult: PoiRow[] = [];
      let total = rows.length;

      if (exceeded) {
        dataResult = [];
        total = 2001; // Marker that it is > 2000
      } else {
        dataResult = rows;
      }

      res.json({
        total,
        exceeded,
        limit,
        results: dataResult
      });
    } catch (error) {
      console.error('Database error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default app;
