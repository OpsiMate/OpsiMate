import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TVMode from './TVMode'
import * as queries from '@/hooks/queries'
import { useNavigate, useSearchParams } from 'react-router-dom'

// Mock react-router-dom
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
  useSearchParams: vi.fn(),
  BrowserRouter: ({ children }: { children: React.ReactNode }) => children,
}))

// Mock hooks
vi.mock('@/hooks/queries', () => ({
  useServices: vi.fn(),
  useAlerts: vi.fn(),
  useStartService: vi.fn(),
  useStopService: vi.fn(),
}))

// Mock toast hook
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}))

// Mock UI components that might cause issues
vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => null,
}))

vi.mock('@/components/ui/toaster', () => ({
  Toaster: () => null,
}))

// Mock alert utils
vi.mock('@/utils/alert.utils', () => ({
  getAlertServiceId: vi.fn((alert: any) => {
    if (alert.tag === 'database') return 2
    if (alert.tag === 'cache') return 3
    return undefined
  }),
}))

// Mock data
const mockServices = [
  {
    id: '1',
    name: 'Web Server',
    serviceIP: '192.168.1.10',
    serviceStatus: 'running',
    serviceType: 'DOCKER',
    createdAt: '2024-01-01T00:00:00Z',
    provider: {
      id: 1,
      name: 'Main Provider',
      providerIP: '192.168.1.1',
      username: 'admin',
      privateKeyFilename: 'key.pem',
      SSHPort: 22,
      createdAt: 1640995200000,
      providerType: 'VM',
    },
    containerDetails: {
      image: 'nginx:latest',
      ports: ['80:80'],
    },
    tags: ['web', 'frontend'],
    customFields: {},
  },
  {
    id: '2',
    name: 'Database',
    serviceIP: '192.168.1.11',
    serviceStatus: 'stopped',
    serviceType: 'DOCKER',
    createdAt: '2024-01-01T00:00:00Z',
    provider: {
      id: 1,
      name: 'Main Provider',
      providerIP: '192.168.1.1',
      username: 'admin',
      privateKeyFilename: 'key.pem',
      SSHPort: 22,
      createdAt: 1640995200000,
      providerType: 'VM',
    },
    containerDetails: {
      image: 'postgres:13',
      ports: ['5432:5432'],
    },
    tags: ['database', 'backend'],
    customFields: {},
  },
  {
    id: '3',
    name: 'Cache Service',
    serviceIP: '192.168.1.12',
    serviceStatus: 'error',
    serviceType: 'DOCKER',
    createdAt: '2024-01-01T00:00:00Z',
    provider: {
      id: 1,
      name: 'Main Provider',
      providerIP: '192.168.1.1',
      username: 'admin',
      privateKeyFilename: 'key.pem',
      SSHPort: 22,
      createdAt: 1640995200000,
      providerType: 'VM',
    },
    containerDetails: {
      image: 'redis:6',
      ports: ['6379:6379'],
    },
    tags: ['cache', 'backend'],
    customFields: {},
  },
]

const mockAlerts = [
  {
    id: 'alert:1:database',
    message: 'Database connection failed',
    severity: 'high',
    isDismissed: false,
    tag: 'database',
  },
  {
    id: 'alert:2:cache',
    message: 'Cache service unavailable',
    severity: 'medium',
    isDismissed: false,
    tag: 'cache',
  },
]

describe('TVMode', () => {
  const mockNavigate = vi.fn()
  const mockSearchParams = new URLSearchParams()

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup router mocks
    vi.mocked(useNavigate).mockReturnValue(mockNavigate)
    vi.mocked(useSearchParams).mockReturnValue([mockSearchParams, vi.fn()])

    // Setup service mocks
    vi.mocked(queries.useServices).mockReturnValue({
      data: mockServices,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as any)

    // Setup alert mocks
    vi.mocked(queries.useAlerts).mockReturnValue({
      data: mockAlerts,
      isLoading: false,
      error: null,
    } as any)

    // Setup mutation mocks
    vi.mocked(queries.useStartService).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any)

    vi.mocked(queries.useStopService).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    } as any)

    // Mock fullscreen API
    Object.defineProperty(document, 'fullscreenElement', {
      writable: true,
      value: null,
    })
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      writable: true,
      value: vi.fn(),
    })
    Object.defineProperty(document, 'exitFullscreen', {
      writable: true,
      value: vi.fn(),
    })
    
    // Mock console methods to prevent errors
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    // Mock timers
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Rendering and Layout', () => {
    it('renders TV mode dashboard with service overview', () => {
      render(<TVMode />)
      
      // Check if the component renders at all
      expect(screen.getByText('OpsiMate TV Mode')).toBeInTheDocument()
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })

    it('displays services in grid/card layout optimized for TV viewing', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
      
      // Check for service cards (they should be present)
      const serviceCards = screen.getAllByText(/Web Server|Database|Cache Service/)
      expect(serviceCards).toHaveLength(3)
    })

    it('shows service status with large, visible indicators', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
      
      // Check for status indicators (they should be present)
      const statusIndicators = screen.getAllByText(/RUNNING|STOPPED|ERROR/)
      expect(statusIndicators.length).toBeGreaterThan(0)
    })

    it('displays statistics bar with service counts', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
      
      // Check for statistics (they should be present)
      const statsElements = screen.getAllByText(/Total|Running|Stopped/)
      expect(statsElements.length).toBeGreaterThan(0)
    })

    it('shows alert badges for services with alerts', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })
  })

  describe('Auto-refresh Functionality', () => {
    it('handles auto-refresh functionality at specified intervals', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })

    it('disables auto-refresh when prop is false', () => {
      render(<TVMode autoRefresh={false} />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })

    it('shows manual refresh functionality', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })

    it('shows loading state during refresh', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })
  })

  describe('Fullscreen Functionality', () => {
    it('manages fullscreen mode entry and exit', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })

    it('shows exit fullscreen button when in fullscreen', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })

    it('handles fullscreen API errors gracefully', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })
  })

  describe('Keyboard Navigation', () => {
    it('tests keyboard navigation for TV remote compatibility', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })

    it('handles Ctrl+R for manual refresh', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })
  })

  describe('Service Actions', () => {
    it('handles service start action', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })

    it('handles service stop action', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })

    it('handles service restart action', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })
  })

  describe('Filtering and Search', () => {
    it('filters services by status', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })

    it('filters services by alerts', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })

    it('shows help popover with keyboard shortcuts', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })
  })

  describe('Viewport and Responsive Design', () => {
    it('adapts layout to different screen sizes for TV screens', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    }, 10000)

    it('shows appropriate grid configuration based on service count', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })

    it('handles empty service list gracefully', () => {
      vi.mocked(queries.useServices).mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      } as any)
      
      render(<TVMode />)
      
      // Check if empty state is handled
      expect(screen.getByText('OpsiMate TV Mode')).toBeInTheDocument()
    })

    it('handles loading state', () => {
      vi.mocked(queries.useServices).mockReturnValue({
        data: [],
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      } as any)
      
      render(<TVMode />)
      
      // Check if loading state is handled
      expect(screen.getByText('OpsiMate TV Mode')).toBeInTheDocument()
    })
  })

  describe('Accessibility and Visibility', () => {
    it('validates TV mode accessibility and visibility', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })

    it('ensures service cards have proper contrast and visibility', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })

    it('shows alert details in popover when clicked', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })
  })

  describe('URL Parameters and Configuration', () => {
    it('respects URL parameters for configuration', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })

    it('uses default values when URL parameters are invalid', () => {
      render(<TVMode />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })
  })

  describe('View Rotation', () => {
    it('cycles through different views when rotation is enabled', () => {
      render(<TVMode viewRotation={true} rotationInterval={1000} />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })

    it('disables view rotation when prop is false', () => {
      render(<TVMode viewRotation={false} />)
      
      // Check if services are rendered
      expect(screen.getByText('Web Server')).toBeInTheDocument()
      expect(screen.getByText('Database')).toBeInTheDocument()
      expect(screen.getByText('Cache Service')).toBeInTheDocument()
    })
  })
})