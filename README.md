# WebGIS Demo

Real estate map demo with Google Maps, a Node.js/Express API, and MySQL spatial queries.

## Project structure

```
webgis/
├── database/init.sql       # Schema + seed data
├── webgis-backend/         # Express API
│   ├── server.js
│   ├── .env.example
│   └── package.json
└── frontend/
    └── index.html          # Google Maps UI
```

## Setup

### 1. Database

Your shell is picking up a broken **MySQL 5.7 (2018)** client from `/usr/local/bin/mysql` that depends on OpenSSL 1.0. Use one of the options below instead.

#### Option A: Docker (recommended if you use Docker Desktop)

```bash
cd ~/code/webgis
docker compose up -d
```

Then set `webgis-backend/.env` to:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=webgis_root
DB_NAME=webgis_demo
```

The init script runs automatically on first container start.

#### Option B: Install a current MySQL via Homebrew

```bash
brew install mysql
brew services start mysql
/opt/homebrew/bin/mysql -u root < ~/code/webgis/database/init.sql
```

Use `/opt/homebrew/bin/mysql` (not the old `/usr/local/bin/mysql`). You may also want `/opt/homebrew/bin` earlier in your `PATH`.

If root has no password yet on a fresh install:

```bash
/opt/homebrew/bin/mysql -u root < ~/code/webgis/database/init.sql
```

### 2. Backend

```bash
cd webgis-backend
cp .env.example .env
# Edit .env with your MySQL credentials
npm install
npm start
```

API runs at `http://localhost:3000`.

### 3. Frontend

The Google Maps API key lives in `webgis-backend/.env` (not in HTML). The frontend fetches it from `GET /api/config` at runtime.

Add your key to `.env`:

```
GOOGLE_MAPS_API_KEY=your_actual_key_here
```

Restart the backend after editing `.env`. `.env` is gitignored and should not be committed.

Serve the frontend (do not open `index.html` directly — use a local server):

```bash
cd frontend
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

**Note:** The key is still sent to the browser (required for Google Maps). Keeping it in `.env` prevents committing it to git; for local dev you can leave referrer restrictions off or use "None" until deployment.

## API

`GET /api/config` — returns `{ googleMapsApiKey }` for the frontend.

`GET /api/pois?west=&east=&south=&north=&minPrice=&maxPrice=`

Returns POIs within the map bounding box, optionally filtered by price.
