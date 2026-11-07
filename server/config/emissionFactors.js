// Approximate emission factors in kg CO2e per unit.
// Sources: IPCC / DEFRA / CEA (India grid) averages, rounded. Adjust for your region.
const EMISSION_FACTORS = {
  transport: {
    car_petrol: { label: 'Car (petrol)', unit: 'km', factor: 0.192 },
    car_diesel: { label: 'Car (diesel)', unit: 'km', factor: 0.171 },
    car_electric: { label: 'Car (electric)', unit: 'km', factor: 0.053 },
    motorbike: { label: 'Motorbike / scooter', unit: 'km', factor: 0.103 },
    bus: { label: 'Bus', unit: 'km', factor: 0.105 },
    train: { label: 'Train / metro', unit: 'km', factor: 0.041 },
    flight_short: { label: 'Flight (short haul)', unit: 'km', factor: 0.255 },
    flight_long: { label: 'Flight (long haul)', unit: 'km', factor: 0.15 },
    bicycle: { label: 'Bicycle', unit: 'km', factor: 0 },
    walking: { label: 'Walking', unit: 'km', factor: 0 },
  },
  energy: {
    electricity: { label: 'Electricity', unit: 'kWh', factor: 0.716 },
    lpg: { label: 'LPG (cooking gas)', unit: 'kg', factor: 2.983 },
    natural_gas: { label: 'Natural gas (PNG)', unit: 'm³', factor: 2.02 },
    diesel_generator: { label: 'Diesel generator', unit: 'litre', factor: 2.68 },
    solar: { label: 'Solar (self-generated)', unit: 'kWh', factor: 0 },
  },
  waste: {
    landfill: { label: 'General waste (landfill)', unit: 'kg', factor: 0.587 },
    plastic: { label: 'Plastic waste (not recycled)', unit: 'kg', factor: 1.04 },
    food_waste: { label: 'Food waste (landfill)', unit: 'kg', factor: 0.7 },
    recycled: { label: 'Recycled waste', unit: 'kg', factor: 0.021 },
    composted: { label: 'Composted waste', unit: 'kg', factor: 0.01 },
  },
};

// Organisation footprint: office energy, fleet and business travel, office waste
const BUSINESS_FACTORS = {
  transport: {
    fleet_petrol: { label: 'Company car (petrol)', unit: 'km', factor: 0.192 },
    fleet_diesel: { label: 'Company van / truck (diesel)', unit: 'km', factor: 0.27 },
    biz_flight: { label: 'Business flight', unit: 'km', factor: 0.15 },
    biz_train: { label: 'Business train travel', unit: 'km', factor: 0.041 },
  },
  energy: {
    electricity: { label: 'Office electricity', unit: 'kWh', factor: 0.716 },
    diesel_generator: { label: 'Diesel generator', unit: 'litre', factor: 2.68 },
    natural_gas: { label: 'Natural gas (PNG)', unit: 'm³', factor: 2.02 },
    solar: { label: 'Solar (self-generated)', unit: 'kWh', factor: 0 },
  },
  waste: {
    landfill: { label: 'Office waste (landfill)', unit: 'kg', factor: 0.587 },
    plastic: { label: 'Plastic waste', unit: 'kg', factor: 1.04 },
    ewaste: { label: 'E-waste (not recycled)', unit: 'kg', factor: 1.5 },
    paper: { label: 'Paper used', unit: 'kg', factor: 0.92 },
    recycled: { label: 'Recycled waste', unit: 'kg', factor: 0.021 },
  },
};

const CATEGORIES = Object.keys(EMISSION_FACTORS);

// Business accounts log organisation activities; everyone else logs personal ones
const factorsFor = (user) => (user && user.role === 'business' ? BUSINESS_FACTORS : EMISSION_FACTORS);

function calculateCo2(category, type, quantity, factors = EMISSION_FACTORS) {
  const cat = factors[category];
  if (!cat || !cat[type]) return null;
  return Math.round(cat[type].factor * quantity * 1000) / 1000;
}

module.exports = { EMISSION_FACTORS, BUSINESS_FACTORS, CATEGORIES, factorsFor, calculateCo2 };
