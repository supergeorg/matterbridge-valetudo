import path from 'node:path';

import { vi, describe, beforeEach, afterAll, it, expect } from 'vitest';
import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { MatterbridgeEndpoint, PlatformConfig, PlatformMatterbridge, SystemInformation } from 'matterbridge';
import { VendorId } from 'matterbridge/matter';

import { ValetudoPlatform } from '../src/module.ts';

const mockLog = {
  fatal: vi.fn((message: string, ...parameters: unknown[]) => {}),
  error: vi.fn((message: string, ...parameters: unknown[]) => {}),
  warn: vi.fn((message: string, ...parameters: unknown[]) => {}),
  notice: vi.fn((message: string, ...parameters: unknown[]) => {}),
  info: vi.fn((message: string, ...parameters: unknown[]) => {}),
  debug: vi.fn((message: string, ...parameters: unknown[]) => {}),
} as unknown as AnsiLogger;

const mockMatterbridge: PlatformMatterbridge = {
  systemInformation: {
    ipv4Address: '192.168.1.1',
    ipv6Address: 'fd78:cbf8:4939:746:a96:8277:346f:416e',
    osRelease: 'x.y.z',
    nodeVersion: '22.10.0',
  } as unknown as SystemInformation,
  rootDirectory: path.join('vitest', 'ValetudoPlugin'),
  homeDirectory: path.join('vitest', 'ValetudoPlugin'),
  matterbridgeDirectory: path.join('vitest', 'ValetudoPlugin', '.matterbridge'),
  matterbridgePluginDirectory: path.join('vitest', 'ValetudoPlugin', 'Matterbridge'),
  matterbridgeCertDirectory: path.join('vitest', 'ValetudoPlugin', '.mattercert'),
  globalModulesDirectory: path.join('vitest', 'ValetudoPlugin', 'node_modules'),
  matterbridgeVersion: '3.4.0',
  matterbridgeLatestVersion: '3.4.0',
  matterbridgeDevVersion: '3.4.0',
  bridgeMode: 'bridge',
  restartMode: '',
  aggregatorVendorId: VendorId(0xfff1),
  aggregatorVendorName: 'Matterbridge',
  aggregatorProductId: 0x8000,
  aggregatorProductName: 'Matterbridge aggregator',
  // Mocked methods
  addBridgedEndpoint: vi.fn(async (pluginName: string, device: MatterbridgeEndpoint) => {}),
  removeBridgedEndpoint: vi.fn(async (pluginName: string, device: MatterbridgeEndpoint) => {}),
  removeAllBridgedEndpoints: vi.fn(async (pluginName: string) => {}),
} as unknown as PlatformMatterbridge;

const mockConfig: PlatformConfig = {
  name: 'matterbridge-valetudo',
  type: 'DynamicPlatform',
  version: '1.0.0',
  debug: false,
  unregisterOnShutdown: false,
};

vi.spyOn(AnsiLogger.prototype, 'log').mockImplementation(() => {});

describe('Matterbridge Valetudo Plugin', () => {
  let instance: ValetudoPlatform;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('should throw an error if matterbridge is not the required version', async () => {
    mockMatterbridge.matterbridgeVersion = '2.0.0'; // Simulate an older version
    expect(() => new ValetudoPlatform(mockMatterbridge, mockLog, mockConfig)).toThrow(
      'This plugin requires Matterbridge version >= "3.4.0". Please update Matterbridge from 2.0.0 to the latest version in the frontend.',
    );
    mockMatterbridge.matterbridgeVersion = '3.4.0';
  });

  it('should create an instance of the platform', async () => {
    instance = (await import('../src/module.ts')).default(mockMatterbridge, mockLog, mockConfig) as ValetudoPlatform;
    expect(instance).toBeInstanceOf(ValetudoPlatform);
    expect(instance.matterbridge).toBe(mockMatterbridge);
    expect(instance.log).toBe(mockLog);
    expect(instance.config).toBe(mockConfig);
    expect(instance.matterbridge.matterbridgeVersion).toBe('3.4.0');
    expect(mockLog.info).toHaveBeenCalledWith('Initializing platform for multi-vacuum support...');
  });

  it('should start', async () => {
    // onStart triggers mDNS discovery which can timeout, so we increase the timeout
    // With no vacuums configured and discovery enabled, it will attempt discovery
    await instance.onStart('Vitest');
    expect(mockLog.info).toHaveBeenCalledWith('onStart called with reason: Vitest');
  }, 30000);

  it('should configure', async () => {
    await instance.onConfigure();
    expect(mockLog.info).toHaveBeenCalledWith('onConfigure called');
  });

  it('should change logger level', async () => {
    await instance.onChangeLoggerLevel(LogLevel.DEBUG);
    expect(mockLog.info).toHaveBeenCalledWith('onChangeLoggerLevel called with: debug');
  });

  it('should shutdown', async () => {
    await instance.onShutdown('Vitest');
    expect(mockLog.info).toHaveBeenCalledWith('onShutdown called with reason: Vitest');
  });

  it('should shutdown with unregister', async () => {
    // Mock the unregisterOnShutdown behavior
    mockConfig.unregisterOnShutdown = true;
    await instance.onShutdown();
    expect(mockLog.info).toHaveBeenCalledWith('onShutdown called with reason: none');
    // Note: removeAllBridgedEndpoints is called on the platform base class internally
    mockConfig.unregisterOnShutdown = false;
  });
});
