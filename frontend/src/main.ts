import './style.css';
import { MarkerClusterer } from '@googlemaps/markerclusterer';

interface Poi {
  id: number;
  name: string;
  price: number;
  property_type: string;
  lat: number | string;
  lng: number | string;
}

interface PoiApiResponse {
  total: number;
  exceeded: boolean;
  limit: number;
  results: Poi[];
}

interface Cluster {
  count: number;
  position: google.maps.LatLng;
}

const API_BASE = 'http://localhost:3000';
let map: google.maps.Map | null = null;
let markers: google.maps.Marker[] = [];
let markerClustererInstance: MarkerClusterer | null = null;
let currentPois: Poi[] = [];
let activePoiId: number | null = null;
let activeInfoWindow: google.maps.InfoWindow | null = null;

// Splash screen state and logs configuration
let isMapReady = false;
let isMinDelayPassed = false;
const LOGS = [
  'System boot initiated...',
  'Connecting to spatial database...',
  'Establishing spatial R-tree index...',
  'Sydney viewport buffer loaded.',
  'Ready.'
];

const minPriceInput = document.getElementById('minPrice') as HTMLInputElement | null;
const maxPriceInput = document.getElementById('maxPrice') as HTMLInputElement | null;
const applyFiltersBtn = document.getElementById('applyFilters') as HTMLButtonElement | null;
const poiListContainer = document.getElementById('poi-list') as HTMLDivElement | null;
const mapLoader = document.getElementById('map-loader') as HTMLDivElement | null;
const mapOverflow = document.getElementById('map-overflow') as HTMLDivElement | null;
const splashLogsContainer = document.getElementById('splash-logs') as HTMLDivElement | null;
const splashScreenElement = document.getElementById('splash-screen') as HTMLDivElement | null;

function startSplashLogs(): void {
  if (!splashLogsContainer) return;
  let logIndex = 0;

  function addLog(): void {
    if (logIndex >= LOGS.length) return;
    const line = document.createElement('div');
    line.className = 'log-line';
    line.innerHTML = `> ${LOGS[logIndex]}`;
    splashLogsContainer?.appendChild(line);
    logIndex++;
    setTimeout(addLog, 450);
  }

  setTimeout(addLog, 200);
}

function dismissSplashScreen(): void {
  if (isMapReady && isMinDelayPassed) {
    if (splashScreenElement) {
      splashScreenElement.classList.add('fade-out');
      setTimeout(() => splashScreenElement.remove(), 800); // Clean up DOM after fade
    }
  }
}

// Glowing red circular SVG marker
const svgIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <defs>
    <radialGradient id="rg" cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
      <stop offset="0%" style="stop-color:#990000;stop-opacity:1" />
      <stop offset="70%" style="stop-color:#3d0000;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#ff1a1a;stop-opacity:1" />
    </radialGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="3" result="blur" />
      <feComponentTransfer in="blur" result="brightBlur">
        <feFuncA type="linear" slope="1.5"/>
      </feComponentTransfer>
      <feMerge>
        <feMergeNode in="brightBlur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <circle cx="24" cy="24" r="18" fill="url(#rg)" stroke="#ff3333" stroke-width="2" filter="url(#glow)" />
</svg>
`;

// Custom cluster renderer matching the retro red theme
const clusterRenderer = {
  render({ count, position }: Cluster): google.maps.Marker {
    let size = 42;
    if (count > 50) size = 50;
    if (count > 250) size = 58;

    const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <radialGradient id="crg_${count}" cx="50%" cy="50%" r="50%">
          <stop offset="0%" style="stop-color:#b30000;stop-opacity:0.9" />
          <stop offset="70%" style="stop-color:#3d0000;stop-opacity:0.95" />
          <stop offset="100%" style="stop-color:#ff1a1a;stop-opacity:1" />
        </radialGradient>
        <filter id="cglow_${count}" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 4}" fill="url(#crg_${count})" stroke="#ff3333" stroke-width="2.5" filter="url(#cglow_${count})" />
    </svg>
    `;

    return new google.maps.Marker({
      position,
      icon: {
        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(size / 2, size / 2),
        labelOrigin: new google.maps.Point(size / 2, size / 2)
      },
      label: {
        text: String(count),
        color: '#ffffff',
        fontSize: '11px',
        fontWeight: 'bold',
        fontFamily: '"Share Tech Mono", Courier New, monospace'
      },
      zIndex: google.maps.Marker.MAX_ZINDEX + 1
    });
  }
};

function setupMap(): void {
  const mapElement = document.getElementById('map');
  if (!mapElement) return;

  map = new google.maps.Map(mapElement, {
    center: { lat: -33.8688, lng: 151.2093 },
    zoom: 11,
    mapTypeId: 'roadmap'
  });

  map.addListener('idle', fetchPOIs);
}

function showError(message: string): void {
  if (poiListContainer) {
    poiListContainer.innerHTML = `<p style="color:#e74c3c;">${message}</p>`;
  }
}

async function loadGoogleMaps(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/api/config`);
    const config = await response.json();

    if (!response.ok) {
      showError(config.error || 'Failed to load map configuration.');
      return;
    }

    await new Promise<void>((resolve, reject) => {
      window.initMap = () => {
        setupMap();
        isMapReady = true;
        dismissSplashScreen();
        resolve();
      };

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.googleMapsApiKey)}&callback=initMap`;
      script.async = true;
      script.defer = true;
      script.onerror = () => reject(new Error('Failed to load Google Maps script'));
      document.head.appendChild(script);
    });
  } catch (err) {
    console.error('Error loading Google Maps:', err);
    showError('Could not load the map. Is the backend running with GOOGLE_MAPS_API_KEY set?');
  }
}

async function fetchPOIs(): Promise<void> {
  if (!map) return;

  const bounds = map.getBounds();
  if (!bounds) return;

  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  // Strip commas from inputs for backend query
  const minPrice = minPriceInput ? minPriceInput.value.replace(/,/g, '') : '0';
  const maxPrice = maxPriceInput ? maxPriceInput.value.replace(/,/g, '') : '1000000';

  const url = `${API_BASE}/api/pois?` +
              `west=${sw.lng()}&east=${ne.lng()}&south=${sw.lat()}&north=${ne.lat()}` +
              `&minPrice=${minPrice}&maxPrice=${maxPrice}`;

  // Show terminal scanning indicators
  if (mapLoader) mapLoader.style.display = 'block';
  if (poiListContainer) {
    poiListContainer.innerHTML = '<div class="terminal-loader">SCANNING GEOGRAPHIC VIEWPORT</div>';
  }

  try {
    const response = await fetch(url);
    const data: PoiApiResponse = await response.json();
    currentPois = data.results || [];

    if (data.exceeded) {
      if (mapOverflow) mapOverflow.style.display = 'block';
      updateMapMarkers([]);
      updateSidebarList(data);
    } else {
      if (mapOverflow) mapOverflow.style.display = 'none';
      updateMapMarkers(currentPois);
      updateSidebarList(data);
    }
  } catch (err) {
    console.error('Error updating WebGIS data layer:', err);
    showError('SCAN ERROR: Failed to query spatial database.');
  } finally {
    if (mapLoader) mapLoader.style.display = 'none';
  }
}

interface CustomMarker extends google.maps.Marker {
  poiId?: number;
}

function showPoiDetails(poiId: number, marker: google.maps.Marker): void {
  activePoiId = poiId;
  
  if (activeInfoWindow) {
    activeInfoWindow.close();
  }
  
  const poi = currentPois.find(p => p.id === poiId);
  if (!poi) return;

  const infoWindow = new google.maps.InfoWindow({
    content: `
    <div style="background: #140505; color: #ff9999; border: 1px solid #ff3333; padding: 10px; font-family: 'Share Tech Mono', monospace; font-size: 0.9rem; border-radius: 2px; box-shadow: 0 0 10px rgba(255, 51, 51, 0.5);">
      <strong style="color: #ff3333; font-size: 1rem; border-bottom: 1px solid #800000; display: block; margin-bottom: 5px; padding-bottom: 2px;">${poi.name}</strong>
      <div style="margin-bottom: 2px;">Price: <span style="color: #ffffff;">$${poi.price.toLocaleString()}</span></div>
      <div>Type: <span style="color: #ffffff; text-transform: uppercase;">${poi.property_type}</span></div>
    </div>
    `
  });

  if (map) infoWindow.open(map, marker);
  activeInfoWindow = infoWindow;

  // Clear active POI when user manually closes the InfoWindow
  infoWindow.addListener('closeclick', () => {
    if (activePoiId === poiId) {
      activePoiId = null;
    }
  });
}

function updateMapMarkers(pois: Poi[]): void {
  markers.forEach(marker => marker.setMap(null));
  markers = [];

  if (markerClustererInstance) {
    markerClustererInstance.clearMarkers();
  }

  const markerIcon = {
    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgIcon),
    scaledSize: new google.maps.Size(42, 42),
    anchor: new google.maps.Point(21, 21),
    labelOrigin: new google.maps.Point(21, 21)
  };

  let activeMarkerToOpen: google.maps.Marker | null = null;

  pois.forEach(poi => {
    const marker: CustomMarker = new google.maps.Marker({
      position: { lat: Number(poi.lat), lng: Number(poi.lng) },
      icon: markerIcon,
      title: poi.name,
      label: {
        text: `$${(poi.price / 1000).toFixed(0)}k`,
        color: '#ffffff',
        fontSize: '10px',
        fontWeight: 'bold',
        fontFamily: '"Share Tech Mono", Courier New, monospace'
      }
    });

    marker.poiId = poi.id;

    marker.addListener('click', () => {
      showPoiDetails(poi.id, marker);
    });

    markers.push(marker);

    if (activePoiId === poi.id) {
      activeMarkerToOpen = marker;
    }
  });

  // Initialize or update marker clusterer
  if (map) {
    if (!markerClustererInstance) {
      markerClustererInstance = new MarkerClusterer({
        map: map,
        markers: markers,
        renderer: clusterRenderer
      });
    } else {
      markerClustererInstance.addMarkers(markers);
    }
  }

  // Re-open details after markers are drawn and added to map/clusterer
  if (activeMarkerToOpen) {
    setTimeout(() => {
      if (activePoiId !== null && activeMarkerToOpen !== null) {
        showPoiDetails(activePoiId, activeMarkerToOpen);
      }
    }, 10);
  }
}

function updateSidebarList(data: PoiApiResponse): void {
  if (!poiListContainer) return;
  poiListContainer.innerHTML = '';

  const pois = data.results || [];
  const total = data.total || 0;
  const limit = data.limit || 500;

  const summaryHeader = document.querySelector('#listings-summary h3');
  if (summaryHeader) {
    if (data.exceeded) {
      summaryHeader.innerHTML = `Visible Listings <span style="font-size: 0.8rem; color: #ff3333;">(OVERFLOW)</span>`;
    } else if (total > limit) {
      summaryHeader.innerHTML = `Visible Listings <span style="font-size: 0.8rem; color: #f1c40f;">(Showing ${limit} of ${total.toLocaleString()})</span>`;
    } else {
      summaryHeader.innerHTML = `Visible Listings <span style="font-size: 0.8rem; color: #2ecc71;">(${total.toLocaleString()} found)</span>`;
    }
  }

  if (data.exceeded) {
    poiListContainer.innerHTML = `
      <div style="color: #ff3333; border: 1px dashed #800000; padding: 15px; background: #1f0808; text-align: center; text-transform: uppercase; line-height: 1.4;">
        [ SYSTEM OVERFLOW ]<br>
        2,000+ matches found.<br>
        Zoom in or filter by price to scan listings.
      </div>
    `;
    return;
  }

  if (pois.length === 0) {
    poiListContainer.innerHTML = '<p style="color:#bdc3c7;">No properties in this view window.</p>';
    return;
  }

  pois.forEach(poi => {
    const item = document.createElement('div');
    item.className = 'poi-item';
    item.style.cursor = 'pointer';
    item.innerHTML = `<strong>${poi.name}</strong><br>$${poi.price.toLocaleString()} (${poi.property_type})`;
    
    item.addEventListener('click', () => {
      const marker = markers.find((m: CustomMarker) => m.poiId === poi.id);
      if (marker && map) {
        map.panTo(marker.getPosition() as google.maps.LatLng);
        showPoiDetails(poi.id, marker);
      }
    });

    poiListContainer.appendChild(item);
  });
}

// Setup comma-separated dynamic number formatting on input
function formatNumberInput(e: Event): void {
  const input = e.target as HTMLInputElement;
  let val = input.value.replace(/[^0-9]/g, '');
  if (val === '') {
    input.value = '';
    return;
  }
  input.value = Number(val).toLocaleString();
}

// Attach event listeners and load page configuration
if (applyFiltersBtn) {
  applyFiltersBtn.addEventListener('click', fetchPOIs);
}
if (minPriceInput) {
  minPriceInput.addEventListener('input', formatNumberInput);
}
if (maxPriceInput) {
  maxPriceInput.addEventListener('input', formatNumberInput);
}

// Initialize splash screen sequence
startSplashLogs();
setTimeout(() => {
  isMinDelayPassed = true;
  dismissSplashScreen();
}, 2800);

loadGoogleMaps();

declare global {
  interface Window {
    initMap: () => void;
  }
}
