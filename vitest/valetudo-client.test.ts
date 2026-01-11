import { vi, describe, beforeEach, it, expect } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';

import { ValetudoClient, MapData, MapLayer, CachedMapLayers } from '../src/valetudo-client.ts';

const mockLog = {
  fatal: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  notice: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
} as unknown as AnsiLogger;

describe('ValetudoClient', () => {
  let client: ValetudoClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new ValetudoClient('192.168.1.100', mockLog);
  });

  describe('constructor', () => {
    it('should create a client with the correct base URL', () => {
      const testClient = new ValetudoClient('192.168.1.200', mockLog);
      expect(testClient).toBeInstanceOf(ValetudoClient);
    });
  });

  describe('findSegmentAtPositionCached', () => {
    const createCachedLayers = (segments: Partial<MapLayer>[]): CachedMapLayers => ({
      layers: segments.map((s, i) => ({
        __class: 'MapLayer',
        type: 'segment',
        pixels: [],
        compressedPixels: [],
        metaData: { segmentId: `segment_${i}`, ...s.metaData },
        dimensions: s.dimensions || {
          x: { min: 0, max: 100, mid: 50, avg: 50 },
          y: { min: 0, max: 100, mid: 50, avg: 50 },
          pixelCount: 10000,
        },
      })) as MapLayer[],
      size: { x: 1000, y: 1000 },
      pixelSize: 5,
      timestamp: Date.now(),
      version: 1,
    });

    it('should find a segment containing the given position', () => {
      const cachedLayers = createCachedLayers([
        {
          metaData: { segmentId: 'kitchen' },
          dimensions: {
            x: { min: 200, max: 300, mid: 250, avg: 250 },
            y: { min: 100, max: 200, mid: 150, avg: 150 },
            pixelCount: 10000,
          },
        },
      ]);

      const segment = client.findSegmentAtPositionCached(cachedLayers, 250, 150);
      expect(segment).not.toBeNull();
      expect(segment?.metaData.segmentId).toBe('kitchen');
    });

    it('should select closest segment when position is in overlapping bounds', () => {
      const cachedLayers = createCachedLayers([
        {
          metaData: { segmentId: 'room_a' },
          dimensions: {
            x: { min: 0, max: 150, mid: 75, avg: 75 },
            y: { min: 0, max: 100, mid: 50, avg: 50 },
            pixelCount: 10000,
          },
        },
        {
          metaData: { segmentId: 'room_b' },
          dimensions: {
            x: { min: 50, max: 200, mid: 125, avg: 125 },
            y: { min: 0, max: 100, mid: 50, avg: 50 },
            pixelCount: 10000,
          },
        },
      ]);

      // Position 70, 50 is closer to room_a's midpoint (75, 50) than room_b's (125, 50)
      const segment = client.findSegmentAtPositionCached(cachedLayers, 70, 50);
      expect(segment?.metaData.segmentId).toBe('room_a');
    });

    it('should return null if position is not within any segment', () => {
      const cachedLayers = createCachedLayers([
        {
          metaData: { segmentId: 'only_room' },
          dimensions: {
            x: { min: 0, max: 100, mid: 50, avg: 50 },
            y: { min: 0, max: 100, mid: 50, avg: 50 },
            pixelCount: 10000,
          },
        },
      ]);

      const segment = client.findSegmentAtPositionCached(cachedLayers, 999, 999);
      expect(segment).toBeNull();
    });
  });

  describe('createCachedLayers', () => {
    it('should create cached layers from map data', () => {
      const mapData: MapData = {
        __class: 'ValetudoMap',
        metaData: { version: 5 },
        size: { x: 2000, y: 1500 },
        pixelSize: 5,
        layers: [
          {
            __class: 'MapLayer',
            type: 'segment',
            pixels: [1, 2, 3],
            compressedPixels: [],
            metaData: { segmentId: 'test' },
            dimensions: {
              x: { min: 0, max: 100, mid: 50, avg: 50 },
              y: { min: 0, max: 100, mid: 50, avg: 50 },
              pixelCount: 100,
            },
          },
        ],
        entities: [],
      };

      const cached = client.createCachedLayers(mapData);

      expect(cached.version).toBe(5);
      expect(cached.size).toEqual({ x: 2000, y: 1500 });
      expect(cached.pixelSize).toBe(5);
      expect(cached.layers).toHaveLength(1);
      expect(cached.timestamp).toBeGreaterThan(0);
    });
  });
});
