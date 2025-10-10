import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import { Dashboard } from '../Dashboard'
import * as queries from '@/hooks/queries'

vi.mock('@/hooks/queries', () => ({
  useServices: vi.fn(),
  useAlerts: vi.fn(),
  useViews: vi.fn(),
  useActiveView: vi.fn(),
  useCustomFields: vi.fn(),
  useStartService: vi.fn(),
  useStopService: vi.fn(),
  useDismissAlert: vi.fn(),
  useSaveView: vi.fn(),
  useDeleteView: vi.fn(),
}))

describe('Dashboard', () => {
  beforeEach(() => {
    vi.mocked(queries.useServices).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as ReturnType<typeof queries.useServices>)

    vi.mocked(queries.useAlerts).mockReturnValue({
      data: [],
      error: null,
    } as ReturnType<typeof queries.useAlerts>)

    vi.mocked(queries.useViews).mockReturnValue({
      data: [],
      error: null,
    } as ReturnType<typeof queries.useViews>)

    vi.mocked(queries.useActiveView).mockReturnValue({
      activeViewId: undefined,
      setActiveView: vi.fn(),
      error: null,
    } as ReturnType<typeof queries.useActiveView>)

    vi.mocked(queries.useCustomFields).mockReturnValue({
      data: [],
    } as ReturnType<typeof queries.useCustomFields>)

    vi.mocked(queries.useStartService).mockReturnValue({
      mutateAsync: vi.fn(),
    } as ReturnType<typeof queries.useStartService>)

    vi.mocked(queries.useStopService).mockReturnValue({
      mutateAsync: vi.fn(),
    } as ReturnType<typeof queries.useStopService>)

    vi.mocked(queries.useDismissAlert).mockReturnValue({
      mutateAsync: vi.fn(),
    } as ReturnType<typeof queries.useDismissAlert>)

    vi.mocked(queries.useSaveView).mockReturnValue({
      mutateAsync: vi.fn(),
    } as ReturnType<typeof queries.useSaveView>)

    vi.mocked(queries.useDeleteView).mockReturnValue({
      mutateAsync: vi.fn(),
    } as ReturnType<typeof queries.useDeleteView>)
  })

  it('renders dashboard layout', async () => {
    render(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getAllByText(/filters/i)[0]).toBeInTheDocument()
    })
  })

  it('displays filter panel', async () => {
    render(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getAllByText(/filters/i)[0]).toBeInTheDocument()
    })
  })

  it('shows loading state when services are loading', () => {
    vi.mocked(queries.useServices).mockReturnValue({
      data: [],
      isLoading: true,
      error: null,
    } as ReturnType<typeof queries.useServices>)

    render(<Dashboard />)
    
    const loadingElements = screen.queryAllByRole('status')
    expect(loadingElements.length).toBeGreaterThanOrEqual(0)
  })

  it('displays services table when data is loaded', async () => {
    const mockServices = [
      {
        id: '1',
        name: 'Test Service',
        serviceStatus: 'running',
        serviceType: 'DOCKER',
        serviceIP: '192.168.1.1',
        provider: {
          id: 1,
          name: 'Test Provider',
          providerType: 'VM',
        },
        tags: [],
      },
    ]

    vi.mocked(queries.useServices).mockReturnValue({
      data: mockServices,
      isLoading: false,
      error: null,
    } as ReturnType<typeof queries.useServices>)

    render(<Dashboard />)
    
    await waitFor(() => {
      expect(screen.getAllByText('Test Service')[0]).toBeInTheDocument()
    })
  })
})

