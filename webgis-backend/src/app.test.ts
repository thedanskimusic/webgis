import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app, { pool, buildWktEnvelope, buildPoiQuery } from './app';
import {
  generateCoordinates,
  generatePropertyNameAndType,
  generatePropertyPrice
} from './seed';

// Mock mysql2/promise connection pool
vi.mock('mysql2/promise', () => {
  const mockPool = {
    query: vi.fn(),
    execute: vi.fn(),
    getConnection: vi.fn(),
    end: vi.fn()
  };
  return {
    default: {
      createPool: () => mockPool
    }
  };
});

describe('WebGIS Backend API', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  describe('GET /api/config', () => {
    it('should return Google Maps API key if configured', async () => {
      process.env.GOOGLE_MAPS_API_KEY = 'TEST_GOOGLE_KEY';
      const res = await request(app).get('/api/config');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ googleMapsApiKey: 'TEST_GOOGLE_KEY' });
    });

    it('should return 500 error if key is missing', async () => {
      delete process.env.GOOGLE_MAPS_API_KEY;
      const res = await request(app).get('/api/config');
      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /api/pois', () => {
    it('should return 400 if boundary parameters are missing', async () => {
      const res = await request(app).get('/api/pois');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing boundary parameters');
    });

    it('should return data if total matches are under the limit (<= 2000)', async () => {
      const mockRows = [
        {
          id: 1,
          name: 'House 1',
          price: 500000,
          property_type: 'house',
          lat: -33.8,
          lng: 151.2
        }
      ];

      // Mock database query output
      vi.mocked(pool.query).mockResolvedValueOnce([mockRows, []]);

      const res = await request(app)
        .get('/api/pois')
        .query({
          west: '151.1',
          east: '151.3',
          south: '-33.9',
          north: '-33.7'
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        total: 1,
        exceeded: false,
        limit: 2000,
        results: mockRows
      });
      expect(pool.query).toHaveBeenCalledTimes(1);
    });

    it('should return empty results and exceeded true if total matches exceed the limit (> 2000)', async () => {
      // Mock database returning 2001 rows to trigger overflow check
      const mockRows = Array(2001).fill({
        id: 1,
        name: 'House',
        price: 500000
      });

      vi.mocked(pool.query).mockResolvedValueOnce([mockRows, []]);

      const res = await request(app)
        .get('/api/pois')
        .query({
          west: '151.1',
          east: '151.3',
          south: '-33.9',
          north: '-33.7'
        });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        total: 2001,
        exceeded: true,
        limit: 2000,
        results: []
      });
    });
  });

  describe('API Utility Helpers', () => {
    it('should build a valid WKT POLYGON envelope string', () => {
      const envelope = buildWktEnvelope('-33.9', '151.1', '-33.7', '151.3');
      expect(envelope).toBe(
        'POLYGON((-33.9 151.1, -33.9 151.3, -33.7 151.3, -33.7 151.1, -33.9 151.1))'
      );
    });

    it('should build correct POI query without price filters', () => {
      const { sql, params } = buildPoiQuery('POLYGON_STUB');
      expect(sql).toContain('SELECT id');
      expect(sql).toContain('LIMIT 2001');
      expect(sql).not.toContain('price >=');
      expect(params).toEqual(['POLYGON_STUB']);
    });

    it('should build correct POI query with price filters', () => {
      const { sql, params } = buildPoiQuery(
        'POLYGON_STUB',
        '500000',
        '1500000'
      );
      expect(sql).toContain('price >= ?');
      expect(sql).toContain('price <= ?');
      expect(params).toEqual(['POLYGON_STUB', 500000, 1500000]);
    });
  });

  describe('Seeder Utility Helpers', () => {
    it('should generate coordinates inside expected regional bounding zones', () => {
      // Test Sydney Metro (rand < 0.40)
      const sydney = generateCoordinates(0.2);
      expect(sydney.lat).toBeLessThan(-33.5);
      expect(sydney.lat).toBeGreaterThan(-34.2);
      expect(sydney.lng).toBeLessThan(151.6);
      expect(sydney.lng).toBeGreaterThan(150.8);

      // Test Newcastle Metro (0.40 <= rand < 0.50)
      const newcastle = generateCoordinates(0.45);
      expect(newcastle.lat).toBeLessThan(-32.7);
      expect(newcastle.lat).toBeGreaterThan(-33.1);
      expect(newcastle.lng).toBeLessThan(152.0);
      expect(newcastle.lng).toBeGreaterThan(151.5);
    });

    it('should select a valid property type and name category', () => {
      const meta = generatePropertyNameAndType();
      expect(meta).toHaveProperty('name');
      expect(meta).toHaveProperty('propertyType');
      expect(['house', 'apartment', 'condo']).toContain(meta.propertyType);
      expect(meta.name.split(' ').length).toBeGreaterThanOrEqual(2);
    });

    it('should calculate realistic price scales', () => {
      const sydneyPrice = generatePropertyPrice(0.1);
      const regionalPrice = generatePropertyPrice(0.9);

      expect(sydneyPrice).toBeGreaterThanOrEqual(300000);
      expect(regionalPrice).toBeGreaterThanOrEqual(300000);
      // Prices should be rounded to the nearest $5,000
      expect(sydneyPrice % 5000).toBe(0);
      expect(regionalPrice % 5000).toBe(0);
    });
  });
});
