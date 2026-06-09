import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app, { pool } from './app';

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
        { id: 1, name: 'House 1', price: 500000, property_type: 'house', lat: -33.8, lng: 151.2 }
      ];

      // Mock database query output
      vi.mocked(pool.query).mockResolvedValueOnce([mockRows, []]);

      const res = await request(app)
        .get('/api/pois')
        .query({ west: '151.1', east: '151.3', south: '-33.9', north: '-33.7' });

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
      const mockRows = Array(2001).fill({ id: 1, name: 'House', price: 500000 });

      vi.mocked(pool.query).mockResolvedValueOnce([mockRows, []]);

      const res = await request(app)
        .get('/api/pois')
        .query({ west: '151.1', east: '151.3', south: '-33.9', north: '-33.7' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        total: 2001,
        exceeded: true,
        limit: 2000,
        results: []
      });
    });
  });
});
