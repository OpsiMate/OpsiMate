import { useState, useRef, useEffect } from "react";

interface UsePersistedSearchOptions {
  onSearchChange: (value: string) => void;
  persistKey?: string;
  debounceMs?: number;
}

interface UsePersistedSearchReturn {
  value: string;
  inputRef: React.RefObject<HTMLInputElement>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleClear: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

const STORAGE_KEY = "log-search-value";

export function usePersistedSearch({
  onSearchChange,
  persistKey = "default",
  debounceMs = 700,
}: UsePersistedSearchOptions): UsePersistedSearchReturn {
  const inputRef = useRef<HTMLInputElement>(null);
  // initialize with empty string, then load from session storage in useEffect
  const [value, setValue] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasTypingRef = useRef(false);
  // use ref for onSearchChange to avoid dependency issues
  const onSearchChangeRef = useRef(onSearchChange);

  // keep ref up to date
  useEffect(() => {
    onSearchChangeRef.current = onSearchChange;
  }, [onSearchChange]);

  // load persisted value on mount and when persistKey changes
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(`${STORAGE_KEY}-${persistKey}`);
      const loadedValue = stored || "";
      setValue(loadedValue);
      // emit the loaded value so parent component knows about it
      onSearchChangeRef.current(loadedValue);
    } catch {
      // ignore storage errors
      setValue("");
      onSearchChangeRef.current("");
    }
  }, [persistKey]);

  // save to session storage whenever value changes
  useEffect(() => {
    try {
      sessionStorage.setItem(`${STORAGE_KEY}-${persistKey}`, value);
      if (value) {
        wasTypingRef.current = true;
      }
    } catch {
      // ignore storage errors
    }
  }, [value, persistKey]);

  // focus input if user was typing
  useEffect(() => {
    if (wasTypingRef.current && inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  // handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // set new timer to trigger search after debounceMs
    timerRef.current = setTimeout(() => {
      onSearchChangeRef.current(newValue);
    }, debounceMs);
  };

  // handle clear button
  const handleClear = () => {
    setValue("");
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    onSearchChangeRef.current("");
  };

  // handle enter key
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      onSearchChangeRef.current(value);
    }
  };

  return {
    value,
    inputRef,
    handleChange,
    handleClear,
    handleKeyDown,
  };
}

