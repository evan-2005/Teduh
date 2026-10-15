// SHARED CONTRACT. Only Evan edits this file, on `main`.
// Teammates: need a new field? Message Evan, then `git pull origin main`.

export type DataSource = 'surveyed' | 'estimated' | 'ai-confirmed' | 'missing';
export type TimeSlot = '09:00' | '12:00' | '14:00' | '17:00';
export type CanopyMode = 'now' | 'future';
export type MapMode = 'before' | 'after' | 'swipe';

export interface PathNode { id: string; lat: number; lng: number; label?: string }

export interface PathSegment {
  id: string;
  from: string;                       // PathNode.id
  to: string;                         // PathNode.id
  lengthM?: number;                   // computed from coords if absent
  widthM: number;                     // footpath width, used by fabrication
  shade: Record<TimeSlot, number>;    // 0..1 fraction shaded, survey snapshot
  shadeSource: DataSource;
  accessible: boolean;                // false = blocked, excluded from routing
  notes?: string;
}

export type DestinationKind = 'home' | 'school' | 'bus-stop' | 'shops' | 'clinic' | 'park';
export interface Destination { id: string; nodeId: string; name: string; kind: DestinationKind }

export interface Journey {
  id: string;
  originId: string;                   // Destination.id (kind 'home')
  destinationId: string;              // Destination.id
  dailyTrips: number;
  tripsSource: DataSource;
}

export type InterventionType = 'tree' | 'shelter';
export type Feasibility = 'approved' | 'likely' | 'needs-check';

export interface Intervention {
  id: string;
  type: InterventionType;
  name: string;
  segmentIds: string[];               // segments it shades
  installCost: number;                // MYR
  annualMaintenance: number;          // MYR / year
  shadeNow: number;                   // 0..1 shade on day 1
  shadeFuture: number;                // 0..1 shade at maturity
  yearsToMature: number;              // shelter 0, tree ~5–8
  feasibility: Feasibility;
  costSource: DataSource;
}

export interface Scenario {
  budget: number;
  time: TimeSlot;
  canopy: CanopyMode;
  canopyYear: number;                 // 0..10, drives growth slider
  detourLimit: number;                // 0.25 = up to 25% longer than shortest
  priorityWeights: Record<string, number>; // Destination.id -> multiplier (default 1)
  selectedInterventionIds: string[];
  mapMode: MapMode;
}

export interface RouteResult {
  journeyId: string;
  segmentIds: string[];
  lengthM: number;
  walkMin: number;
  sunMin: number;
  longestExposedM: number;
}

export interface JourneyComparison { journeyId: string; before: RouteResult; after: RouteResult }

export interface PlanResult {
  interventionIds: string[];
  installCost: number;
  annualMaintenance: number;
  sunMinutesAvoidedPerDay: number;    // Σ trips × weight × (sunBefore − sunAfter)
  journeys: JourneyComparison[];
  journeysImproved: string[];
  contributions: Record<string, number>; // interventionId -> marginal minutes avoided
}

// ---- Fabrication (Teammate A implements, contract fixed here) ----
export interface BomLine { item: string; qty: number; unit: string; unitCost: number; total: number }
export interface FabricationSpec {
  interventionId: string;
  type: InterventionType;
  dimensions: Record<string, number>; // e.g. lengthM, widthM, heightM, modules
  bom: BomLine[];
  totalCost: number;
  assumptions: string[];
  disclaimer: string;
  elevationSvg?: string;
}

// ---- Unit costs (data/unit-costs.json; Teammate C owns the values, A consumes) ----
export interface UnitCostItem { label: string; unit: string; unitCost: number }
export interface SpeciesSuggestion {
  name: string;
  matureCanopyM: number;
  yearsToMature: number;
  verify: true;                       // always "verify with landscape team"
}
export interface UnitCosts {
  currency: 'MYR';
  costSource: DataSource;
  contingencyRate: number;            // 0.1 = 10%
  items: Record<string, UnitCostItem>; // keys: see data/unit-costs.json
  speciesSuggestions: SpeciesSuggestion[];
}

// ---- AI scan (Teammate B implements, contract fixed here) ----
export interface ShadeScanResult {
  segmentId: string;
  shadeFraction: number;              // 0..1
  shadeSources: string[];             // e.g. ['tree canopy', 'shop awning']
  obstacles: string[];                // e.g. ['parked motorcycle on path']
  confidence: 'low' | 'medium' | 'high';
  notes: string;
  isMock: boolean;
}
export interface ShadeOverride { segmentId: string; time: TimeSlot; shade: number; source: 'ai-confirmed' }

// ---- Datasets (shape of data/*.json) ----
export interface Neighbourhood {
  nodes: PathNode[];
  segments: PathSegment[];
  destinations: Destination[];
}
