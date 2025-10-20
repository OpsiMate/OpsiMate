import React, { useEffect, useState } from 'react'
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '../test-utils'
import { Toaster } from '@/components/ui/toaster'
import type { ToastActionElement } from '@/components/ui/toast'
import { useToast } from '@/hooks/use-toast'
import { AlertsSection } from '@/components/AlertsSection'

// Lightweight mock WebSocket to simulate server push messages
class MockWebSocket {
  static instances: MockWebSocket[] = []
  onopen: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onclose: (() => void) | null = null
  readyState = 0

  constructor(url: string) {
    MockWebSocket.instances.push(this)
    setTimeout(() => {
      this.readyState = 1
      if (this.onopen) {
        this.onopen()
      }
    }, 0)
  }

  // helper for tests to simulate server -> client
  sendFromServer(payload: string) {
    if (this.onmessage) {
      this.onmessage({ data: payload })
    }
  }

  send() {
    // noop for tests
  }

  close() {
    this.readyState = 3
    if (this.onclose) {
      this.onclose()
    }
  }
}

// A few small test components that trigger toasts from different locations
function ComponentA() {
  const { toast } = useToast()
  return (
    <button onClick={() => toast({ title: 'A title', description: 'from A' })}>
      Trigger A
    </button>
  )
}

function ComponentB() {
  const { toast } = useToast()
  return (
    <button
      onClick={() =>
        toast({
          title: 'B destructive',
          description: 'from B',
          variant: 'destructive',
        })
      }
    >
      Trigger B
    </button>
  )
}

function ComponentWithAction({ onAction }: { onAction: () => void }) {
  const { toast } = useToast()

  return (
    <button
      onClick={() =>
        toast({
          title: 'Action toast',
          description: 'has action',
          action: (
            <button onClick={onAction} aria-label="retry-action">
              Retry
            </button>
          ) as unknown as ToastActionElement,
        })
      }
    >
      Trigger Action
    </button>
  )
}

// Component that listens to a websocket and shows toasts on messages
function RealTimeNotifier() {
  const { toast } = useToast()

  useEffect(() => {
  const WS = (window as unknown as { WebSocket: typeof MockWebSocket }).WebSocket
  const ws = new WS('wss://test')
    ws.onmessage = (ev: { data: string }) => {
      try {
        const payload = JSON.parse(ev.data)
        toast({ title: payload.title, description: payload.body })
      } catch (e) {
        // ignore
      }
    }

    return () => ws.close()
  }, [toast])

  return null
}

describe('notification system - integration', () => {
  beforeAll(() => {
    // replace window.WebSocket with our mock so components using it will connect to controllable instances
    vi.stubGlobal('WebSocket', MockWebSocket)
  })

  beforeEach(() => {
    MockWebSocket.instances = []
  })

  afterEach(() => {
    MockWebSocket.instances.forEach((i) => i.close())
  })

  afterAll(() => {
    // remove the stubbed WebSocket
    delete (globalThis as unknown as { WebSocket?: typeof MockWebSocket }).WebSocket
  })

  it('shows notifications triggered from different components', async () => {
    render(
      <>
        <Toaster />
        <ComponentA />
        <ComponentB />
      </>
    )

    fireEvent.click(screen.getByText('Trigger A'))
    await waitFor(() => expect(screen.getByText('A title')).toBeTruthy())

    fireEvent.click(screen.getByText('Trigger B'))
    await waitFor(() => expect(screen.getByText('B destructive')).toBeTruthy())
  })

  it('toast queue respects limit and dismiss works', async () => {
    render(
      <>
        <Toaster />
        <ComponentA />
        <ComponentB />
      </>
    )

    fireEvent.click(screen.getByText('Trigger A'))
    fireEvent.click(screen.getByText('Trigger B'))

    await waitFor(() => expect(screen.queryByText('A title')).toBeNull())
    expect(screen.getByText('B destructive')).toBeTruthy()

    const actionBtn = screen.getByText('B destructive')
    const root = actionBtn.closest('[data-state]')
    const closeBtn = root?.querySelector('button')
    if (closeBtn) {
      fireEvent.click(closeBtn)
      await waitFor(() => expect(root?.getAttribute('data-state')).toBe('closed'))
    }
  })

  it('alert notifications persist until dismissed and show toast on dismiss', async () => {
    function AlertsWrapper() {
        const [alerts, setAlerts] = useState([
          {
            id: '1',
            status: 'firing',
            tag: 'infrastructure',
            startsAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            alertUrl: '',
            alertName: 'High CPU',
            summary: 'cpu > 95%',
            runbookUrl: '',
            createdAt: new Date().toISOString(),
            isDismissed: false,
          },
        ])
      const handleDismiss = async (id: string) => {
        await Promise.resolve()
        setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, isDismissed: true } : a)))
      }

      return (
        <>
          <Toaster />
          <AlertsSection alerts={alerts} onAlertDismiss={handleDismiss} />
        </>
      )
    }

    render(<AlertsWrapper />)

    // initial alert should be visible
    expect(screen.getByText('High CPU')).toBeInTheDocument()
    const dismissButton = screen.getByTitle('Dismiss Alert') as HTMLElement
    fireEvent.click(dismissButton)
    await waitFor(() => expect(screen.getByText('Alert dismissed')).toBeInTheDocument())
    await waitFor(() => expect(screen.queryByText('High CPU')).toBeNull())
  })

  it('renders different notification types with distinct styling and actions work', async () => {
    const actionMock = vi.fn()

    render(
      <>
        <Toaster />
        <ComponentWithAction onAction={actionMock} />
        <ComponentB />
      </>
    )

    // create destructive toast and check it has destructive styling
    fireEvent.click(screen.getByText('Trigger B'))
    const destructiveTitle = await screen.findByText('B destructive')
    let n: HTMLElement | null = destructiveTitle as HTMLElement
    let found = false
    while (n && n !== document.body) {
      const cls = n.getAttribute && n.getAttribute('class')
      if (cls && cls.includes('destructive')) {
        found = true
        break
      }
      n = n.parentElement as HTMLElement | null
    }
    expect(found).toBe(true)

    // test action toast and clicking its action triggers provided callback
    fireEvent.click(screen.getByText('Trigger Action'))
    const actionToast = await screen.findByText('Action toast')
    // action button has aria-label retry-action
    const retry = await screen.findByLabelText('retry-action')
    fireEvent.click(retry)
    expect(actionMock).toHaveBeenCalled()
  })

  it('receives real-time notifications via websocket and shows toast', async () => {
    render(
      <>
        <Toaster />
        <RealTimeNotifier />
      </>
    )

    // Grab the mock websocket instance created by the component
    await waitFor(() => expect(MockWebSocket.instances.length).toBeGreaterThan(0))
    const ws = MockWebSocket.instances[0]

    act(() => {
      ws.sendFromServer(JSON.stringify({ title: 'RT Title', body: 'live update' }))
    })

    await waitFor(() => expect(screen.getByText('RT Title')).toBeInTheDocument())
    expect(screen.getByText('live update')).toBeInTheDocument()
  })

  it('provides accessible notification elements (aria-live / alerts present)', async () => {
    render(
      <>
        <Toaster />
        <ComponentA />
      </>
    )

    fireEvent.click(screen.getByText('Trigger A'))
    await waitFor(() => expect(screen.getByText('A title')).toBeInTheDocument())

    // check that there is at least one element on the page with an aria-live attribute
    const live = document.querySelector('[aria-live], [role="status"], [role="alert"]')
    expect(live).toBeTruthy()
  })
})
