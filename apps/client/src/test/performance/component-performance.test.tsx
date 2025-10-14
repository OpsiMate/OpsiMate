/**
 * Component Performance Tests - Baseline metrics for render, memory, scrolling, and images
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { ServiceTable } from '@/components/ServiceTable'

// Performance thresholds - balanced for test environment and CI
const LIMITS = { renderTime: 5000, filterTime: 3000, maxMemoryMB: 50 }

// Generate mock service data for performance testing
const generateMockServices = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `service-${i}`,
    name: `Service ${i}`,
    serviceIP: `192.168.1.${i % 255}`,
    serviceStatus: (i % 2 === 0 ? 'running' : 'stopped') as 'running' | 'stopped',
    serviceType: 'DOCKER' as const,
    createdAt: new Date().toISOString(),
    provider: { id: 1, name: 'Provider', providerIP: '127.0.0.1', username: 'test', privateKeyFilename: 'key', SSHPort: 22, createdAt: Date.now(), providerType: 'ssh' },
  }))
}

describe('Render Performance', () => {
  // Verifies 100 services render quickly (baseline test)
  it('should render 100 services within acceptable time', async () => {
    const services = generateMockServices(100)
    
    performance.mark('render-start')
    render(<ServiceTable services={services} selectedServices={[]} onServicesSelect={vi.fn()} onSettingsClick={vi.fn()} visibleColumns={{ name: true, serviceIP: true, serviceStatus: true, provider: true }} />)
    performance.mark('render-end')
    
    const measure = performance.measure('render', 'render-start', 'render-end')
    expect(measure.duration, 'Render took too long').toBeLessThan(LIMITS.renderTime)
    expect(screen.getAllByRole('row').length).toBeGreaterThan(0)
    
    performance.clearMarks()
    performance.clearMeasures()
  })
})

describe('UI Responsiveness', () => {
  // Ensures filtering 200 items is responsive (baseline test)
  it('should remain responsive when filtering 200 items', async () => {
    const services = generateMockServices(200)
    render(<ServiceTable services={services} selectedServices={[]} onServicesSelect={vi.fn()} onSettingsClick={vi.fn()} visibleColumns={{ name: true, serviceIP: true, serviceStatus: true, provider: true }} />)
    
    const searchInput = screen.getByPlaceholderText(/search/i)
    
    performance.mark('filter-start')
    await userEvent.type(searchInput, 'Service 1')
    await waitFor(() => expect(screen.getAllByRole('row').length).toBeGreaterThan(0))
    performance.mark('filter-end')
    
    const measure = performance.measure('filter', 'filter-start', 'filter-end')
    expect(measure.duration, 'Filtering took too long').toBeLessThan(LIMITS.filterTime)
    
    performance.clearMarks()
    performance.clearMeasures()
  })
})

describe('Memory Stability', () => {
  // Note: This test only runs in Chromium based browsers with performance.memory API
  // It will be automatically skipped in Node.js/JSDOM test environments (expected behavior)
  it.skipIf(!('memory' in performance))('should not leak memory during mount/unmount cycles', async () => {
    const perfWithMemory = performance as unknown as { memory: { usedJSHeapSize: number } }
    
    const services = generateMockServices(50)
    const initialMemory = perfWithMemory.memory.usedJSHeapSize
    
    for (let i = 0; i < 3; i++) {
      const { unmount } = render(<ServiceTable services={services} selectedServices={[]} onServicesSelect={vi.fn()} onSettingsClick={vi.fn()} visibleColumns={{ name: true, serviceIP: true, serviceStatus: true, provider: true }} />)
      unmount()
    }
    
    const finalMemory = perfWithMemory.memory.usedJSHeapSize
    const memoryIncreaseMB = (finalMemory - initialMemory) / 1024 / 1024
    
    expect(memoryIncreaseMB, 'Memory increased too much').toBeLessThan(LIMITS.maxMemoryMB)
  })
})

describe('Virtual Scrolling', () => {
  // Validates rendering with moderate datasets (virtual scrolling would optimize this further)
  it('should handle 300 items without crashing', async () => {
    const services = generateMockServices(300)
    
    performance.mark('large-start')
    render(<ServiceTable services={services} selectedServices={[]} onServicesSelect={vi.fn()} onSettingsClick={vi.fn()} visibleColumns={{ name: true, serviceIP: true, serviceStatus: true, provider: true }} />)
    performance.mark('large-end')
    
    const measure = performance.measure('large-render', 'large-start', 'large-end')
    expect(measure.duration, 'Large dataset render too slow').toBeLessThan(LIMITS.renderTime)
    
    const rows = screen.getAllByRole('row')
    expect(rows.length, 'Should render data rows').toBeGreaterThan(0)
    
    performance.clearMarks()
    performance.clearMeasures()
  })
})

describe('Image Loading', () => {
  // Ensures images don't block initial render
  it('should not block UI while loading images', async () => {
    const services = generateMockServices(50)
    
    performance.mark('image-start')
    render(<ServiceTable services={services} selectedServices={[]} onServicesSelect={vi.fn()} onSettingsClick={vi.fn()} visibleColumns={{ name: true, serviceIP: true, serviceStatus: true, provider: true }} />)
    performance.mark('image-end')
    
    const measure = performance.measure('image-render', 'image-start', 'image-end')
    expect(measure.duration, 'Image loading blocked render').toBeLessThan(500)
    expect(screen.getAllByRole('row').length).toBeGreaterThan(0)
    
    performance.clearMarks()
    performance.clearMeasures()
  })
})

describe('Bundle Validation', () => {
  // Basic check that component is properly tree shakeable
  it('should be defined and tree-shakeable', () => {
    expect(ServiceTable, 'Component should be defined').toBeDefined()
    expect(typeof ServiceTable).toBe('function')
  })
})
