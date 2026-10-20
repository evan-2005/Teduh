import type { Destination, Journey } from '../types';
import { dataset } from './dataset';

export interface WalkPlace extends Destination {
  tripsPerDay: number;
}

/** Places that start or end a modelled walk, with the walks per day through them. */
export function walkPlaces(
  destinations: readonly Destination[],
  journeys: readonly Journey[],
  end: 'originId' | 'destinationId',
): WalkPlace[] {
  const trips = new Map<string, number>();
  journeys.forEach((j) => trips.set(j[end], (trips.get(j[end]) ?? 0) + j.dailyTrips));
  return destinations.filter((d) => trips.has(d.id)).map((d) => ({ ...d, tripsPerDay: trips.get(d.id) ?? 0 }));
}

/** Where people walk to: the places the priority weights apply to. */
export const walkTargets = walkPlaces(dataset.neighbourhood.destinations, dataset.journeys, 'destinationId');
/** Where walks start: stations and bus stops (homes only as a fallback). */
export const walkStarts = walkPlaces(dataset.neighbourhood.destinations, dataset.journeys, 'originId');
