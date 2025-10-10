import React from "react";
import ReactDOM from "react-dom";
import { ArrowUp } from "lucide-react";

const SCROLL_DURATION = 480; // ms

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function animateScroll(
  element: HTMLElement | Window,
  to = 0,
  duration = SCROLL_DURATION,
) {
  const isWindow = element === window;
  const start = isWindow
    ? window.scrollY || window.pageYOffset || 0
    : (element as HTMLElement).scrollTop;
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
      window.scrollTo({ top: 0, behavior: "smooth" as ScrollBehavior });
    } else {
      (el as HTMLElement).scrollTo({
        top: 0,
        behavior: "smooth" as ScrollBehavior,
      });
    }
    return true;
  } catch {
    return false;
  }
}

function findScrollableElements(): Array<HTMLElement | Window> {
  const results: Array<HTMLElement | Window> = [];

  if (typeof document !== "undefined") {
    if (document.scrollingElement)
      results.push(document.scrollingElement as HTMLElement);
    else results.push(window);
  } else {
    results.push(window);
  }

  const all = Array.from(document.querySelectorAll<HTMLElement>("*"));
  for (const el of all) {
    const style = window.getComputedStyle(el);
    const overflowY = style.overflowY;
    if (
      (overflowY === "auto" ||
        overflowY === "scroll" ||
        overflowY === "overlay" ||
        overflowY === "visible") &&
      el.scrollHeight > el.clientHeight + 1
    ) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        results.push(el);
      }
    }
  }

  const uniq = Array.from(new Set(results)).sort((a, b) => {
    const depth = (node: HTMLElement | Window) => {
      let d = 0;
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

function scrollAllToTop() {
  const containers = findScrollableElements();
  for (const c of containers) {
    const pos =
      c === window
        ? window.scrollY || window.pageYOffset || 0
        : (c as HTMLElement).scrollTop;
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
