# WebGIS Demo

Real estate map demo with Google Maps, a Node.js/Express API in TypeScript, and MySQL spatial queries.

## Project Structure

```
webgis/
├── database/
│   └── init.sql            # Schema initialization script
├── webgis-backend/         # Express API (TypeScript)
│   ├── src/
│   │   ├── app.ts          # Express app logic and routes
│   │   ├── server.ts       # Server entry point (port binding)
│   │   ├── seed.ts         # Database seeder (1,000,000 NSW POIs)
│   │   └── app.test.ts     # Vitest unit test suite
│   ├── .env.example
│   ├── tsconfig.json       # TypeScript configuration
│   └── package.json
└── frontend/
    ├── index.html          # Cyberpunk Map UI & Splash Screen
    └── favicon.png         # Retro globe favicon
```

## Setup

### 1. Database Setup

To spin up a local MySQL instance pre-configured for the spatial database:

#### Option A: Docker (Recommended)

Make sure Docker Desktop is running, then start the container:

```bash
docker compose up -d
```

This starts a MySQL instance on port `3306` and automatically runs `database/init.sql` to initialize the `webgis_demo` database and schema.

#### Option B: Local MySQL (Homebrew)

If running MySQL locally (using Homebrew on macOS):

```bash
brew install mysql
brew services start mysql
mysql -u root < database/init.sql
```

### 2. Environment Configuration

Copy the example environment file inside the backend directory:

```bash
cd webgis-backend
cp .env.example .env
```

Edit the `.env` file with your MySQL connection details and your Google Maps API key (the API key is fetched dynamically by the frontend to prevent exposing it in source files):

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=webgis_root
DB_NAME=webgis_demo
GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

### 3. Install Dependencies & Seed Database

Install the Node.js dependencies:

```bash
npm install
```

To populate the database with **1,000,000 realistic real estate listings** distributed across Sydney and New South Wales:

```bash
npm run seed
```

*Note: The seeder inserts records in batches of 10,000. Generating and writing all 1,000,000 listings to the database takes approximately 4–5 minutes.*

### 4. Running the Application

#### Run the Backend

To start the backend in development watch mode with hot-reloading:

```bash
npm run dev
```

The server runs at `http://localhost:3000`. 

For production deployment, you can build and run the compiled TypeScript files:

```bash
npm run build
npm start
```

#### Run the Frontend

The frontend must be served locally (rather than opened directly from the filesystem). Run a local web server:

```bash
cd ../frontend
python3 -m http.server 8080
```

Open `http://localhost:8080` in your web browser. You will see the retro cyberpunk boot splash screen play while the system initializes the Sydney maps view.

### 5. Running Tests

To run the Vitest backend unit test suite:

```bash
cd ../webgis-backend
npm run test
```

## API Endpoint Reference

* **`GET /api/config`**: Returns `{ googleMapsApiKey }` to the frontend.
* **`GET /api/pois`**: Queries spatial database POIs inside a bounding box.
  * **Parameters**: `west`, `east`, `south`, `north` (bounds), `minPrice`, `maxPrice` (optional filters).
  * **Behavior**: Returns uniform spatial samples up to a limit of `2,000` POIs. If the matching records exceed `2,000`, it returns `exceeded: true` to flag overflow.
