import { X } from "lucide-react";
import { usePersistedSearch } from "../hooks/usePersistedSearch";

interface LogSearchInputProps {
  onSearchChange: (value: string) => void;
  placeholder?: string;
  persistKey?: string;
}

export const LogSearchInput = ({ onSearchChange, placeholder = "Search logs...", persistKey = "default" }: LogSearchInputProps) => {
  const { value, inputRef, handleChange, handleClear, handleKeyDown } = usePersistedSearch({
    onSearchChange,
    persistKey,
    debounceMs: 700,
  });

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
