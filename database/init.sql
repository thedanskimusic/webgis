-- Create the database
CREATE DATABASE IF NOT EXISTS webgis_demo;
USE webgis_demo;

-- Create the Points of Interest table
CREATE TABLE IF NOT EXISTS points_of_interest (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    property_type VARCHAR(50),
    location POINT NOT NULL SRID 4326,
    SPATIAL INDEX(location)
);

-- Seed dummy real estate data (SRID 4326 WKT order: latitude longitude)
INSERT INTO points_of_interest (name, price, property_type, location) VALUES
('Luxury Downtown Condo', 750000.00, 'condo', ST_GeomFromText('POINT(37.7749 -122.4194)', 4326)),
('Charming Suburban House', 520000.00, 'house', ST_GeomFromText('POINT(37.7630 -122.4312)', 4326)),
('Modern Studio Apartment', 310000.00, 'apartment', ST_GeomFromText('POINT(37.7858 -122.4089)', 4326)),
('Spacious Family Home', 890000.00, 'house', ST_GeomFromText('POINT(37.7499 -122.4483)', 4326));
