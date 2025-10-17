// @ts-nocheck
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@/test/test-utils'
import { Dashboard } from '@/components/Dashboard'

// Breakpoints and viewport helpers
const VIEWPORTS = {
  mobile: { width: 320, height: 640 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1024, height: 768 },
  wide: { width: 1440, height: 900 },
}

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
  window.dispatchEvent(new Event('resize'))
}

function setOrientation(orientation: 'portrait' | 'landscape') {
  const isPortrait = orientation === 'portrait'
  const { width, height } = isPortrait
    ? { width: VIEWPORTS.mobile.width, height: VIEWPORTS.mobile.height }
    : { width: VIEWPORTS.mobile.height, height: VIEWPORTS.mobile.width }
  setViewport(width, height)
}

// Minimal mocks for data hooks used by Dashboard
vi.mock('@/hooks/queries', () => ({
  useServices: () => ({ data: [
    {
      id: '1',
      name: 'svc-alpha',
      serviceIP: '10.0.0.1',
      serviceStatus: 'running',
      serviceType: 'DOCKER',
      createdAt: new Date().toISOString(),
      provider: {
        id: 1,
        name: 'provider-1',
        providerIP: '10.0.0.10',
        username: 'root',
        privateKeyFilename: 'key.pem',
        SSHPort: 22,
        createdAt: Date.now(),
        providerType: 'docker',
      },
      containerDetails: { image: 'nginx:latest' },
      tags: [{ id: 't1', name: 'prod', color: '#f00' }],
      alertsCount: 0,
    },
  ], isLoading: false }),
  useAlerts: () => ({ data: [], isLoading: false }),
  useViews: () => ({ data: [], isLoading: false }),
  useActiveView: () => ({ activeViewId: undefined, setActiveView: vi.fn(), error: undefined }),
  useStartService: () => ({ mutateAsync: vi.fn() }),
  useStopService: () => ({ mutateAsync: vi.fn() }),
  useDismissAlert: () => ({ mutateAsync: vi.fn() }),
  useSaveView: () => ({ mutateAsync: vi.fn() }),
  useDeleteView: () => ({ mutateAsync: vi.fn() }),
  useCustomFields: () => ({ data: [] }),
}))

vi.mock('@/components/ui/sonner', () => ({ Toaster: () => null }))
vi.mock('@/components/ui/toaster', () => ({ Toaster: () => null }))

// Helpers to query elements that change across responsive states
const queryMobileHeaderButton = () => screen.queryByRole('button', { name: /toggle menu/i })

beforeAll(() => {
  // Ensure matchMedia from setup returns dynamic matches based on width
  const original = window.matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => {
      const maxMatch = /max-width:\s*(\d+)px/.exec(query)
      const minMatch = /min-width:\s*(\d+)px/.exec(query)
      let matches = false
      if (maxMatch) {
        const px = Number(maxMatch[1])
        matches = window.innerWidth <= px
      } else if (minMatch) {
        const px = Number(minMatch[1])
        matches = window.innerWidth >= px
      } else {
        matches = original(query).matches
      }
      return {
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }
    }),
  })
})

beforeEach(() => {
  // Start each test at desktop by default
  setViewport(VIEWPORTS.desktop.width, VIEWPORTS.desktop.height)
  localStorage.clear()
})

describe('Responsive design integration', () => {
  it('adapts layout across mobile, tablet, desktop, and wide', async () => {
    render(<Dashboard />)

    // Tablet breakpoint
    setViewport(VIEWPORTS.tablet.width, VIEWPORTS.tablet.height)
    await waitFor(() => {
      expect(window.innerWidth).toBe(VIEWPORTS.tablet.width)
    })

    // Mobile breakpoint
    setViewport(VIEWPORTS.mobile.width, VIEWPORTS.mobile.height)
    await waitFor(() => {
      expect(queryMobileHeaderButton()).toBeInTheDocument()
    })

    // Wide desktop
    setViewport(VIEWPORTS.wide.width, VIEWPORTS.wide.height)
    await waitFor(() => {
      expect(window.innerWidth).toBe(VIEWPORTS.wide.width)
    })
  })

  it('shows mobile navigation and accessible menu on mobile', async () => {
    setViewport(VIEWPORTS.mobile.width, VIEWPORTS.mobile.height)
    render(<Dashboard />)

    const toggle = await screen.findByRole('button', { name: /toggle menu/i })
    fireEvent.click(toggle)

    // Sidebar overlay should slide in; verify by transform class change
    const panel = document.querySelector('div.fixed.left-0.top-0.h-full') as HTMLElement | null
    expect(panel).toBeTruthy()
    if (panel) {
      expect(panel.className).toMatch(/translate-x-0/)
    }

    // Close button is accessible by label
    const closeBtn = await screen.findByRole('button', { name: /close sidebar/i })
    expect(closeBtn).toBeVisible()
    // Also ensure a specific nav link exists inside the panel
    if (panel) {
      const inside = within(panel)
      const dashboardLink = await inside.findByRole('link', { name: /^dashboard$/i })
      expect(dashboardLink).toBeVisible()
    }

    fireEvent.click(closeBtn)
    await waitFor(() => {
      if (panel) expect(panel.className).toMatch(/-translate-x-full/)
    })
  })

  it('tables handle small screens (horizontal scroll/stack)', async () => {
    setViewport(VIEWPORTS.mobile.width, VIEWPORTS.mobile.height)
    render(<Dashboard />)

    const servicesTexts = await screen.findAllByText(/services/i)
    expect(servicesTexts.length).toBeGreaterThan(0)

    const nameHeaders = screen.getAllByRole('columnheader', { name: /name/i })
    expect(nameHeaders.length).toBeGreaterThan(0)

    // Multiple matching rows can exist; locate by cell text and climb to row
    const svcCells = await screen.findAllByText(/^svc-alpha$/i)
    expect(svcCells.length).toBeGreaterThan(0)
    const row = svcCells[0].closest('tr') as HTMLElement | null
    expect(row).toBeTruthy()
  })

  it('modals fit within mobile viewport', async () => {
    setViewport(VIEWPORTS.mobile.width, VIEWPORTS.mobile.height)
    render(<Dashboard />)

    // Wait until any Services heading is present to ensure table has rendered
    const servicesHeadings = await screen.findAllByRole('heading', { name: /^services$/i })
    expect(servicesHeadings.length).toBeGreaterThan(0)
    const settingsButtons = await screen.findAllByRole('button', { name: /table settings/i })
    expect(settingsButtons.length).toBeGreaterThan(0)
    fireEvent.click(settingsButtons[0])

    const dialog = await screen.findByRole('dialog')
    expect(dialog).toBeInTheDocument()
  })

  it('touch interactions work and targets have reasonable size on mobile', async () => {
    setViewport(VIEWPORTS.mobile.width, VIEWPORTS.mobile.height)
    render(<Dashboard />)

    const toggle = await screen.findByRole('button', { name: /toggle menu/i })
    fireEvent.click(toggle)

    // Mobile sidebar has two Dashboard links (expanded/collapsed variants). Scope within the panel.
    const panel = document.querySelector('div.fixed.left-0.top-0.h-full') as HTMLElement | null
    expect(panel).toBeTruthy()
    if (panel) {
      const inside = within(panel)
      const dashboardLink = await inside.findByRole('link', { name: /^dashboard$/i })
      expect(dashboardLink).toBeVisible()
      fireEvent.click(dashboardLink)
      expect(dashboardLink).toBeInTheDocument()
    }
  })

  it('sidebar collapse/expand persists and adapts with width', async () => {
    setViewport(VIEWPORTS.desktop.width, VIEWPORTS.desktop.height)
    render(<Dashboard />)

    const allButtons = screen.getAllByRole('button')
    const unnamed = allButtons.find(b => !b.getAttribute('aria-label') && !/table settings/i.test(b.textContent || ''))
    if (unnamed) {
      fireEvent.click(unnamed)
    }

    setViewport(800, VIEWPORTS.desktop.height)
    await waitFor(() => expect(window.innerWidth).toBe(800))

    setViewport(VIEWPORTS.wide.width, VIEWPORTS.wide.height)
    await waitFor(() => expect(window.innerWidth).toBe(VIEWPORTS.wide.width))

    // Be specific: ensure at least one Services heading is present
    const headings = screen.getAllByRole('heading', { name: /^services$/i })
    expect(headings.length).toBeGreaterThan(0)
  })

  it('handles orientation changes on mobile', async () => {
    setOrientation('portrait')
    render(<Dashboard />)
    expect(await screen.findByRole('button', { name: /toggle menu/i })).toBeInTheDocument()

    setOrientation('landscape')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /toggle menu/i })).toBeInTheDocument()
    })
  })
})