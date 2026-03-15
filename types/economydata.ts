// Basis-Struktur für jeden Datenpunkt
interface EconomicMetric {
  value: number;
  unit: 'currency' | 'currency_per_hour' | 'currency_per_year' | 'currency_per_sqm' | 'percent' | 'index_points';
  label: string;
}

// Die Map-Strukturen für die Kategorien
type MetricMap = Record<string, EconomicMetric>;

interface EconomicDataSchema {
  metadata: {
    region_code: string;
    region_name: string;
    year: number;
    currency: string;
  };
  economic_metrics: {
    labor_market: MetricMap;
    cost_of_living: MetricMap;
    macro_economics: MetricMap;
    [key: string]: MetricMap; // Ermöglicht das Hinzufügen weiterer Kategorien
  };
}