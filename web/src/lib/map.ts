/**
 * Build-time US map geometry.
 *
 * The projection runs at build time and the result is inlined as static SVG path
 * data, so the published page ships no mapping library, makes no network request,
 * and needs no token or account. us-atlas is public-domain TopoJSON derived from
 * US Census Bureau cartographic boundary files, vendored through npm.
 *
 * The map is decoration layered over a real list. Every club is reachable from
 * the text list below it; the pins are a second route to the same pages, never
 * the only one.
 */

import { geoAlbersUsa, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
// Imported rather than read from disk so the bundler inlines it: the built page
// carries the geometry it needs and touches no filesystem path at runtime.
import topologyJson from 'us-atlas/states-10m.json';

export const MAP_WIDTH = 960;
export const MAP_HEIGHT = 600;

export interface MapPin {
  slug: string;
  label: string;
  school: string;
  x: number;
  y: number;
  precision: 'campus' | 'city';
}

export interface MapGeometry {
  /** Filled state shapes. */
  states: string;
  /** Interior borders, drawn thin over the fill. */
  borders: string;
}

let cachedGeometry: MapGeometry | null = null;

function projection() {
  return geoAlbersUsa().scale(1280).translate([MAP_WIDTH / 2, MAP_HEIGHT / 2]);
}

export function buildGeometry(): MapGeometry {
  if (cachedGeometry) return cachedGeometry;

  const topology = topologyJson as unknown as Topology;
  const statesObject = topology.objects['states'] as GeometryCollection;
  const path = geoPath(projection());

  const states = feature(topology, statesObject);
  const borders = mesh(topology, statesObject, (a, b) => a !== b);

  cachedGeometry = {
    states: path(states) ?? '',
    borders: path(borders) ?? '',
  };
  return cachedGeometry;
}

/**
 * Project a club's coordinates into the SVG viewBox.
 *
 * Returns null when the point falls outside the Albers USA projection's domain —
 * d3 returns null there rather than a nonsense coordinate, and so do we, so the
 * club drops to the list rather than being pinned to the wrong place.
 */
export function projectPin(input: {
  slug: string;
  school: string;
  label: string;
  lat: number;
  lng: number;
  precision: 'campus' | 'city';
}): MapPin | null {
  const projected = projection()([input.lng, input.lat]);
  if (!projected) return null;
  const [x, y] = projected;
  return {
    slug: input.slug,
    school: input.school,
    label: input.label,
    precision: input.precision,
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
  };
}
