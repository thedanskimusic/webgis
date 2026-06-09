USE webgis_demo;

DELETE FROM points_of_interest;

INSERT INTO points_of_interest (name, price, property_type, location) VALUES
('Luxury Downtown Condo', 750000.00, 'condo', ST_GeomFromText('POINT(37.7749 -122.4194)', 4326)),
('Charming Suburban House', 520000.00, 'house', ST_GeomFromText('POINT(37.7630 -122.4312)', 4326)),
('Modern Studio Apartment', 310000.00, 'apartment', ST_GeomFromText('POINT(37.7858 -122.4089)', 4326)),
('Spacious Family Home', 890000.00, 'house', ST_GeomFromText('POINT(37.7499 -122.4483)', 4326));
