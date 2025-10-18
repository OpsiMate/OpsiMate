import { renderHook, act } from "@testing-library/react"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { TOAST_REMOVE_DELAY } from "./use-toast"

describe("useToast hook", () => {
  beforeEach(() => {
    // Reset module state between tests so memoryState, listeners, count, timeouts don't leak
    vi.resetModules()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("creates toast notifications with correct properties and exposes onOpenChange", async () => {
    const mod = await import("./use-toast")
    const { useToast, toast } = mod

    const { result } = renderHook(() => useToast())

    let created: ReturnType<typeof toast> | undefined
    act(() => {
      created = toast({
        title: "Test Title",
        description: "Test description",
      })
    })

    // After creation the hook state should include the new toast
    expect(result.current.toasts.length).toBeGreaterThanOrEqual(1)
    const t = result.current.toasts[0]

    expect(t).toBeDefined()
    expect(t.id).toBeDefined()
    expect(t.title).toBe("Test Title")
    expect(t.description).toBe("Test description")

    // onOpenChange should be provided so consumers can close the toast and trigger dismiss
    expect(typeof t.onOpenChange).toBe("function")

    // the returned controller matches the toast id
    expect(created).toBeDefined()
    expect(created!.id).toBe(t.id)
  })

  it("updates toast state correctly via update()", async () => {
    const mod = await import("./use-toast")
    const { useToast, toast } = mod

    const { result } = renderHook(() => useToast())

    let controller: ReturnType<typeof toast> | undefined
    act(() => {
      controller = toast({
        title: "Initial",
        description: "Desc",
      })
    })

    // Update the toast - include id to satisfy the expected shape
    act(() => {
      controller!.update({
        id: controller!.id,
        title: "Updated Title",
        description: "Updated Desc",
      })
    })

    expect(result.current.toasts[0].title).toBe("Updated Title")
    expect(result.current.toasts[0].description).toBe("Updated Desc")
  })

  it("respects toast queue limit (only latest kept)", async () => {
    const mod = await import("./use-toast")
    const { useToast, toast } = mod

    const { result } = renderHook(() => useToast())

    let t1: ReturnType<typeof toast>, t2: ReturnType<typeof toast>
    act(() => {
      t1 = toast({ title: "first" })
    })
    act(() => {
      t2 = toast({ title: "second" })
    })

    // The implementation uses TOAST_LIMIT = 1, so only the most recent toast should be kept
    expect(result.current.toasts.length).toBe(1)
    expect(result.current.toasts[0].title).toBe("second")
    // Ensure the previous id is not present
    expect(result.current.toasts.some((x) => x.id === t1!.id)).toBe(false)
    expect(result.current.toasts.some((x) => x.id === t2!.id)).toBe(true)
  })

  it("handles manual dismiss -> sets open false immediately and removes after delay", async () => {
    const mod = await import("./use-toast")
    const { useToast, toast } = mod

    const { result } = renderHook(() => useToast())

    let ctrl: ReturnType<typeof toast> | undefined
    act(() => {
      ctrl = toast({ title: "to-dismiss" })
    })

    // Initially open should be true
    expect(result.current.toasts[0].open).toBe(true)

    // Manual dismiss
    act(() => {
      ctrl!.dismiss()
    })

    // open should be false immediately after dismiss
    expect(result.current.toasts[0].open).toBe(false)

    // The hook schedules removal with a timeout (TOAST_REMOVE_DELAY = 1000 in module)
    // advance timers by that delay to simulate removal
    act(() => {
      vi.advanceTimersByTime(TOAST_REMOVE_DELAY)
    })

    // After the removal timeout the toast should be removed from state
    expect(result.current.toasts.find((t) => t.id === ctrl!.id)).toBeUndefined()
  })

  it("supports multiple dismiss (dismiss all) and cleans up timers", async () => {
    const mod = await import("./use-toast")
    const { useToast, toast } = mod

    const { result } = renderHook(() => useToast())

    let a: ReturnType<typeof toast> | undefined, b: ReturnType<typeof toast> | undefined
    act(() => {
      a = toast({ title: "a" })
    })
    act(() => {
      b = toast({ title: "b" })
    })

    // Due to TOAST_LIMIT = 1 the currently visible toast may be only the latest.
    // Find the visible toast and dismiss that one to assert dismiss behavior.
    const visible = result.current.toasts[0]
    expect(visible).toBeDefined()

    act(() => {
      const toDismiss = visible.id === b!.id ? b! : a!
      toDismiss.dismiss()
    })

    // The dismissed toast should still be present (marked closed) until removal timeout
    expect(result.current.toasts.some((t) => t.id === visible.id)).toBe(true)
    const ta = result.current.toasts.find((t) => t.id === visible.id)!
    expect(ta.open).toBe(false)

    // Dismiss all using the public dismiss helper (operate on a copy)
    act(() => {
      [...result.current.toasts].forEach((t) => {
        result.current.dismiss?.(t.id)
      })
    })

    // After dismissing all they should be marked closed
    result.current.toasts.forEach((t) => expect(t.open).toBe(false))

    // Advance timers to remove all toasts
    act(() => {
      vi.advanceTimersByTime(TOAST_REMOVE_DELAY)
    })

    expect(result.current.toasts.length).toBe(0)
  })
})