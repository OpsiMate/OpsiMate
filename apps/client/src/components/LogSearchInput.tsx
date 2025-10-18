import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";

interface LogSearchInputProps {
  onSearchChange: (value: string) => void;
  placeholder?: string;
  persistKey?: string;
}

const STORAGE_KEY = 'log-search-value';

export const LogSearchInput = ({ onSearchChange, placeholder = "Search logs...", persistKey = 'default' }: LogSearchInputProps) => {
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

  useEffect(() => {
    if (wasTypingRef.current && inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // handle input change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // set new timer to trigger search after 700ms
    timerRef.current = setTimeout(() => {
      onSearchChangeRef.current(newValue);
    }, 700);
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
    if (e.key === 'Enter') {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      onSearchChangeRef.current(value);
    }
  };

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full h-7 px-2 pr-6 text-xs border border-border rounded bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        autoComplete="off"
        spellCheck="false"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded"
          aria-label="Clear search"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};
