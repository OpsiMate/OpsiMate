// src/components/ScrollToTopButton.tsx
import React from "react";
import ReactDOM from "react-dom";
import { ArrowUp } from "lucide-react";

/**
 * Always-visible ScrollToTop button that:
 * - Renders in a portal so it's never clipped
 * - Smooth-scrolls window + all visible scrollable elements to top
 * - Uses a JS fallback animation when native smooth isn't supported
 */

const SCROLL_DURATION = 480; // ms

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function animateScroll(element: HTMLElement | Window, to = 0, duration = SCROLL_DURATION) {
  // If window, read/write via scrollY/pageYOffset
  const isWindow = element === window;
  const start = isWindow ? window.scrollY || window.pageYOffset || 0 : (element as HTMLElement).scrollTop;
  const change = start - to;
  if (change <= 0) return;

  const startTime = performance.now();

  function step(now: number) {
    const elapsed = Math.min(1, (now - startTime) / duration);
    const t = easeOutCubic(elapsed);
    const current = Math.round(start - change * t);
    if (isWindow) {
      window.scrollTo(0, current);
    } else {
      (element as HTMLElement).scrollTop = current;
    }

    if (elapsed < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function tryNativeSmoothScroll(el: HTMLElement | Window) {
  try {
    if (el === window) {
      // Some browsers support behavior on window
      window.scrollTo({ top: 0, behavior: "smooth" as ScrollBehavior });
    } else {
      (el as HTMLElement).scrollTo({ top: 0, behavior: "smooth" as ScrollBehavior });
    }
    return true;
  } catch {
    return false;
  }
}

/** Find all visible scrollable elements on the page (plus document.scrollingElement). */
function findScrollableElements(): Array<HTMLElement | Window> {
  const results: Array<HTMLElement | Window> = [];

  // Add window / document.scrollingElement first
  if (typeof document !== "undefined") {
    if (document.scrollingElement) results.push(document.scrollingElement as HTMLElement);
    else results.push(window);
  } else {
    results.push(window);
  }

  // Candidate elements: those with overflow-y set to scroll/auto/overlay AND scrollHeight>clientHeight
  const all = Array.from(document.querySelectorAll<HTMLElement>("*"));
  for (const el of all) {
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    if ((overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay" || overflowY === "visible") 
        && el.scrollHeight > el.clientHeight + 1) {
      // ensure visible (not display:none and in document)
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        results.push(el);
      }
    }
  }

  // Deduplicate, keep unique references, prefer deeper elements first
  const uniq = Array.from(new Set(results)).sort((a, b) => {
    // If both elements, prefer deeper (larger depth)
    const depth = (node: HTMLElement | Window) => {
      let d = 0;
      // Only HTMLElement has parentElement
      while (node && (node as HTMLElement).parentElement) {
        d++;
        node = (node as HTMLElement).parentElement as HTMLElement;
      }
      return d;
    };
    if (a === window) return 1;
    if (b === window) return -1;
    return depth(b) - depth(a);
  });

  return uniq;
}

/** Scroll all detected containers to top (tries native smooth then falls back). */
function scrollAllToTop() {
  const containers = findScrollableElements();
  for (const c of containers) {
    // if it's already at top, skip
    const pos = c === window ? (window.scrollY || window.pageYOffset || 0) : (c as HTMLElement).scrollTop;
    if (pos <= 0) continue;

    const usedNative = tryNativeSmoothScroll(c);
    if (!usedNative) {
      animateScroll(c, 0, SCROLL_DURATION);
    }
  }
}

const ScrollToTopButton: React.FC<{ right?: string; bottom?: string }> = ({
  right = "22px",
  bottom = "22px",
}) => {
  if (typeof document === "undefined") return null;

  const button = (
    <button
      aria-label="Scroll to top"
      title="Scroll to top"
      onClick={(e) => {
        e.preventDefault();
        scrollAllToTop();
      }}
      
      style={{
        right,
        bottom,
        WebkitTapHighlightColor: "transparent",
      }}
className="fixed z-[999999] p-3 rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 transition-transform transform hover:scale-105 active:scale-95 bg-slate-800/80 text-white"
    >
      <ArrowUp size={18} />
    </button>
  );

  return ReactDOM.createPortal(button, document.body);
};

export default ScrollToTopButton;
