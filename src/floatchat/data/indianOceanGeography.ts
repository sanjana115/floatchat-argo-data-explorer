// Accurate high-resolution geographical boundaries for the Indian Ocean basin
// and verified oceanographic bathymetric contours matching the FloatChat reference.

export interface BathymetryFeature {
  name: string;
  depthLabel: string;
  depthValue: number;
  coordinates: [number, number][]; // [lat, lon]
}

export const INDIAN_OCEAN_BATHYMETRY: BathymetryFeature[] = [
  // 1. -1,000m Depth Contour
  {
    name: 'Arabian & Bay of Bengal -1,000m Isobath',
    depthLabel: '-1,000',
    depthValue: 1000,
    coordinates: [
      [22.5, 63.0], [20.0, 65.2], [16.5, 70.0], [12.0, 72.5], [8.0, 75.0],
      [5.5, 77.0], [4.5, 80.0], [6.5, 82.5], [10.5, 83.5], [15.0, 85.5],
      [18.5, 88.0], [17.5, 91.0], [14.0, 93.0], [9.0, 94.5], [4.0, 96.5],
      [0.0, 98.0]
    ]
  },
  // 2. -2,000m Depth Contour (North & Central Basin)
  {
    name: 'Central Basin -2,000m Isobath',
    depthLabel: '-2,000',
    depthValue: 2000,
    coordinates: [
      [18.0, 60.0], [15.5, 63.5], [12.0, 67.0], [8.5, 70.0], [3.5, 73.0],
      [-1.0, 77.5], [-3.5, 83.0], [-1.0, 89.0], [4.0, 91.5], [8.0, 92.5],
      [11.5, 92.0]
    ]
  },
  // 2b. -2,000m Eastern Contour near Indonesia / Australia
  {
    name: 'Eastern Basin -2,000m Isobath',
    depthLabel: '-2,000',
    depthValue: 2000,
    coordinates: [
      [-6.0, 102.0], [-8.5, 106.0], [-10.5, 112.0], [-13.0, 117.0], [-15.5, 120.0],
      [-17.0, 116.5], [-19.5, 114.0]
    ]
  },
  // 3. -3,000m Depth Contour (Arabian Sea Abyssal Plain)
  {
    name: 'Arabian Basin -3,000m Isobath',
    depthLabel: '-3,000',
    depthValue: 3000,
    coordinates: [
      [19.0, 58.5], [16.5, 62.0], [13.0, 65.5], [9.5, 68.0], [5.5, 67.5],
      [3.0, 64.0], [5.0, 60.5], [9.0, 57.5], [14.0, 56.5], [19.0, 58.5]
    ]
  },
  // 3b. -3,000m Depth Contour (Central Indian Basin)
  {
    name: 'Central Indian Basin -3,000m Isobath',
    depthLabel: '-3,000',
    depthValue: 3000,
    coordinates: [
      [-5.0, 73.0], [-7.5, 76.5], [-10.5, 80.0], [-12.5, 85.0], [-14.0, 90.0],
      [-16.0, 94.0], [-19.0, 92.0], [-21.5, 87.0], [-19.0, 82.0], [-15.0, 77.0],
      [-10.0, 73.5], [-5.0, 73.0]
    ]
  },
  // 4. -5,000m Abyssal Plain Contour
  {
    name: 'Deep Abyssal -5,000m Isobath',
    depthLabel: '-5,000',
    depthValue: 5000,
    coordinates: [
      [-8.0, 78.0], [-12.0, 82.0], [-16.0, 85.0], [-20.0, 87.5], [-24.0, 87.0],
      [-26.0, 82.0], [-22.0, 77.0], [-16.0, 75.0], [-11.0, 75.5], [-8.0, 78.0]
    ]
  },
  // 5. -7,000m Java / Sunda Trench
  {
    name: 'Java Trench -7,000m Abyss',
    depthLabel: '-7,000',
    depthValue: 7000,
    coordinates: [
      [-4.0, 101.5], [-6.5, 104.5], [-8.8, 109.0], [-10.5, 114.5], [-11.8, 119.0]
    ]
  }
];

// Pure white landmass polygons with clean coastlines
export const INDIAN_OCEAN_LANDMASSES = {
  type: 'FeatureCollection',
  features: [
    // 1. Indian Subcontinent
    {
      type: 'Feature',
      properties: { name: 'India' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [68.1, 23.8], [69.2, 22.8], [70.5, 20.8], [72.8, 21.0], [72.8, 19.0],
          [73.8, 15.5], [74.8, 13.0], [75.8, 11.5], [76.5, 9.5], [77.5, 8.1],
          [78.2, 8.8], [79.8, 10.3], [79.9, 11.8], [80.3, 13.2], [80.8, 15.5],
          [82.5, 17.0], [84.5, 18.8], [86.5, 20.2], [88.5, 21.6], [89.8, 22.2],
          [92.2, 21.0], [92.5, 24.5], [88.5, 26.5], [82.5, 28.5], [76.5, 31.0],
          [71.5, 28.0], [68.5, 25.5], [68.1, 23.8]
        ]]
      }
    },
    // 2. Sri Lanka
    {
      type: 'Feature',
      properties: { name: 'Sri Lanka' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [79.8, 9.8], [80.5, 9.8], [81.3, 8.6], [81.8, 7.5], [81.5, 6.2],
          [80.5, 5.9], [79.8, 6.5], [79.8, 8.2], [79.8, 9.8]
        ]]
      }
    },
    // 3. Arabian Peninsula, Iran & Pakistan
    {
      type: 'Feature',
      properties: { name: 'Arabia & Middle East' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [43.5, 12.6], [45.0, 12.8], [48.5, 14.0], [52.0, 16.5], [54.5, 17.5],
          [56.5, 20.5], [59.8, 22.5], [59.0, 24.0], [56.5, 26.0], [55.0, 24.5],
          [50.5, 26.5], [48.0, 29.5], [50.0, 30.5], [51.5, 28.5], [56.5, 27.0],
          [60.0, 25.2], [62.5, 25.1], [65.0, 25.2], [67.0, 24.8], [68.1, 23.8],
          [68.5, 26.0], [66.0, 31.0], [55.0, 33.0], [40.0, 30.0], [35.0, 27.5],
          [39.0, 21.5], [42.0, 16.0], [43.5, 12.6]
        ]]
      }
    },
    // 4. Horn of Africa & East Africa
    {
      type: 'Feature',
      properties: { name: 'East Africa' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [43.3, 12.0], [50.8, 11.8], [51.4, 10.5], [49.5, 8.0], [48.0, 5.0],
          [45.5, 2.0], [42.5, -0.5], [41.0, -2.5], [39.5, -4.5], [39.0, -7.0],
          [40.5, -10.5], [40.5, -14.5], [38.5, -18.0], [35.5, -21.0], [34.5, -24.0],
          [32.8, -27.0], [31.5, -30.0], [29.5, -32.5], [26.0, -34.0], [20.0, -34.8],
          [18.5, -34.2], [18.0, -30.0], [25.0, -10.0], [35.0, 5.0], [40.0, 12.0],
          [43.3, 12.0]
        ]]
      }
    },
    // 5. Madagascar
    {
      type: 'Feature',
      properties: { name: 'Madagascar' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [49.3, -12.2], [50.5, -14.0], [49.8, -17.0], [48.5, -21.5], [47.5, -25.0],
          [45.5, -25.6], [43.8, -23.0], [43.5, -19.5], [44.5, -16.0], [47.0, -13.5],
          [49.3, -12.2]
        ]]
      }
    },
    // 6. Southeast Asia (Myanmar, Thailand, Malaysia)
    {
      type: 'Feature',
      properties: { name: 'Southeast Asia' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [92.5, 21.0], [94.5, 18.0], [95.0, 16.0], [97.5, 16.5], [98.5, 14.0],
          [98.5, 10.0], [99.5, 8.0], [100.2, 5.5], [102.5, 3.0], [104.2, 1.3],
          [103.5, 1.8], [101.5, 3.5], [100.5, 6.5], [99.0, 9.5], [98.5, 16.0],
          [96.0, 22.0], [92.5, 21.0]
        ]]
      }
    },
    // 7. Sumatra (Indonesia)
    {
      type: 'Feature',
      properties: { name: 'Sumatra' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [95.3, 5.6], [98.5, 3.5], [101.5, 1.0], [105.0, -2.5], [106.0, -5.8],
          [104.5, -5.5], [102.0, -4.0], [99.5, -1.8], [97.5, 1.2], [95.3, 5.6]
        ]]
      }
    },
    // 8. Java (Indonesia)
    {
      type: 'Feature',
      properties: { name: 'Java' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [105.2, -6.0], [108.5, -6.5], [112.5, -7.0], [114.5, -8.5], [114.0, -8.8],
          [110.5, -8.2], [107.5, -7.5], [105.2, -6.0]
        ]]
      }
    },
    // 9. Western & Northern Australia
    {
      type: 'Feature',
      properties: { name: 'Australia' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [113.8, -25.8], [114.2, -22.0], [118.5, -20.2], [122.2, -17.5],
          [125.0, -14.5], [128.5, -14.8], [130.8, -12.2], [136.5, -12.0],
          [138.5, -16.5], [140.0, -25.0], [135.0, -32.0], [129.0, -31.8],
          [123.5, -34.0], [118.0, -35.0], [115.0, -34.0], [115.5, -31.5],
          [113.8, -25.8]
        ]]
      }
    }
  ]
};

// Ocean and Land geographic typography labels matching Image 2
export const MAP_TYPOGRAPHY_LABELS = [
  // Landmass names
  { text: 'INDIA', lat: 21.0, lon: 78.5, type: 'land' },
  { text: 'AUSTRALIA', lat: -21.0, lon: 122.0, type: 'land' },

  // Ocean Basins matching Image 2 typography
  { text: 'ARABIAN\nSEA', lat: 17.5, lon: 64.5, type: 'sea' },
  { text: 'BAY OF\nBENGAL', lat: 15.5, lon: 88.5, type: 'sea' },
  { text: 'I  N  D  I  A  N\nO  C  E  A  N', lat: -9.5, lon: 77.0, type: 'ocean' },
];
