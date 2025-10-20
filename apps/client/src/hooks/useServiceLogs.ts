import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { providerApi } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface UseServiceLogsOptions {
  serviceId: string | undefined;
}

interface UseServiceLogsReturn {
  logs: string[];
  filteredLogs: string[];
  loading: boolean;
  error: string | null;
  searchKeyword: string;
  timeFilter: "all" | "30m" | "1h" | "6h" | "12h" | "24h" | "custom";
  customTimeRange: { start: string; end: string } | null;
  showCustomTimeDialog: boolean;
  setSearchKeyword: (keyword: string) => void;
  setTimeFilter: (filter: "all" | "30m" | "1h" | "6h" | "12h" | "24h" | "custom") => void;
  setCustomTimeRange: (range: { start: string; end: string } | null) => void;
  setShowCustomTimeDialog: (show: boolean) => void;
  fetchLogs: () => Promise<void>;
  copyLogsToClipboard: () => Promise<void>;
  highlightLog: (log: string) => string;
}

// helper function to format date to local datetime-local input format
export const formatDateTimeLocal = (date: Date): string => {
  return format(date, "yyyy-MM-dd'T'HH:mm");
};

export function useServiceLogs({ serviceId }: UseServiceLogsOptions): UseServiceLogsReturn {
  const { toast } = useToast();
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const previousServiceIdRef = useRef<string | undefined>(serviceId);
  const requestIdRef = useRef(0);

  const [searchKeyword, setSearchKeyword] = useState("");
  const [timeFilter, setTimeFilter] = useState<"all" | "30m" | "1h" | "6h" | "12h" | "24h" | "custom">("all");
  const [customTimeRange, setCustomTimeRange] = useState<{ start: string; end: string } | null>(null);
  const [showCustomTimeDialog, setShowCustomTimeDialog] = useState(false);

  // reset search and logs when service changes
  useEffect(() => {
    if (serviceId !== previousServiceIdRef.current) {
      setSearchKeyword("");
      setLogs([]);
      previousServiceIdRef.current = serviceId;
    }
  }, [serviceId]);

  // fetch logs function
  const fetchLogs = useCallback(async () => {
    if (!serviceId) return;

    // prevent stale writes from older requests
    requestIdRef.current += 1;
    const currentRequestId = requestIdRef.current;

    setLoading(true);
    setError(null);
    try {
      const response = await providerApi.getServiceLogs(parseInt(serviceId));

      if (currentRequestId !== requestIdRef.current) return;

      if (response.success && response.data) {
        setLogs(response.data);
      } else {
        setError(response.error || "Failed to fetch logs");
        toast({
          title: "Error fetching logs",
          description: response.error || "Failed to fetch logs",
          variant: "destructive",
        });
      }
    } catch (err) {
      // ignore errors if a newer request was made
      if (currentRequestId !== requestIdRef.current) return;

      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred";
      setError(errorMessage);
      toast({
        title: "Error fetching logs",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      // only update loading if this is still the current request
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [serviceId, toast]);

  // filter logs based on search keyword and time filter
  const filteredLogs = useMemo(() => {
    if (!logs.length) return [];

    let filtered = [...logs];

    // apply keyword search
    if (searchKeyword.trim()) {
      const keywords = searchKeyword.toLowerCase().trim().split(/\s+/);

      filtered = filtered.filter((log) => {
        const logLower = log.toLowerCase();

        // fuzzy search: match if all keywords appear in the log
        return keywords.every((keyword) => {
          // check for exact substring match
          if (logLower.includes(keyword)) return true;

          // fuzzy matching for keywords longer than 3 characters
          if (keyword.length > 3) {
            let keywordIdx = 0;
            for (let i = 0; i < logLower.length && keywordIdx < keyword.length; i++) {
              if (logLower[i] === keyword[keywordIdx]) {
                keywordIdx++;
              }
            }
            return keywordIdx === keyword.length;
          }

          return false;
        });
      });
    }

    // apply time filter
    if (timeFilter !== "all") {
      if (timeFilter === "custom" && customTimeRange) {
        const startTime = new Date(customTimeRange.start);
        const endTime = new Date(customTimeRange.end);

        filtered = filtered.filter((log) => {
          return filterLogByTimeRange(log, startTime, endTime);
        });
      } else {
        const now = new Date();
        let cutoffTime: Date;

        switch (timeFilter) {
          case "30m":
            cutoffTime = new Date(now.getTime() - 30 * 60 * 1000);
            break;
          case "1h":
            cutoffTime = new Date(now.getTime() - 60 * 60 * 1000);
            break;
          case "6h":
            cutoffTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
            break;
          case "12h":
            cutoffTime = new Date(now.getTime() - 12 * 60 * 60 * 1000);
            break;
          case "24h":
            cutoffTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            break;
          default:
            return filtered;
        }

        filtered = filtered.filter((log) => {
          return filterLogByTimeRange(log, cutoffTime, null);
        });
      }
    }

    return filtered;
  }, [logs, searchKeyword, timeFilter, customTimeRange]);

  // copy filtered logs to clipboard
  const copyLogsToClipboard = useCallback(async () => {
    if (filteredLogs.length === 0) return;

    try {
      const logsText = filteredLogs.join("\n");
      await navigator.clipboard.writeText(logsText);

      toast({
        title: "Logs copied",
        description: `${filteredLogs.length} logs copied to clipboard`,
        variant: "default",
      });
    } catch (err) {
      toast({
        title: "Copy failed",
        description: "Failed to copy logs to clipboard",
        variant: "destructive",
      });
    }
  }, [filteredLogs, toast]);

  // escape special regex characters
  const escapeRegExp = useCallback((str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }, []);

  // highlight search keyword in logs
  const highlightLog = useCallback(
    (log: string) => {
      if (!searchKeyword.trim()) return log;

      // split by whitespace to highlight individual keywords
      const keywords = searchKeyword.toLowerCase().trim().split(/\s+/);
      let result = log;
      
      keywords.forEach((keyword) => {
        const escapedKeyword = escapeRegExp(keyword);
        const regex = new RegExp(`(${escapedKeyword})`, "gi");
        result = result.replace(regex, "⚡$1⚡");
      });
      
      return result;
    },
    [searchKeyword, escapeRegExp]
  );

  // fetch logs on mount and when serviceId changes
  useEffect(() => {
    fetchLogs();
  }, [serviceId, fetchLogs]);

  return {
    logs,
    filteredLogs,
    loading,
    error,
    searchKeyword,
    timeFilter,
    customTimeRange,
    showCustomTimeDialog,
    setSearchKeyword,
    setTimeFilter,
    setCustomTimeRange,
    setShowCustomTimeDialog,
    fetchLogs,
    copyLogsToClipboard,
    highlightLog,
  };
}

// helper function to filter logs by time range
function filterLogByTimeRange(log: string, startTime: Date, endTime: Date | null): boolean {
  // format 1: [YYYY-MM-DD HH:MM:SS] (ISO with brackets)
  let match = log.match(/\[(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})\]/);
  if (match) {
    const logTime = new Date(match[1]);
    return endTime ? logTime >= startTime && logTime <= endTime : logTime >= startTime;
  }

  // format 2: systemd/journalctl format (Month DD HH:MM:SS)
  match = log.match(/(\w{3})\s+(\d{1,2})\s(\d{2}):(\d{2}):(\d{2})/);
  if (match) {
    const monthMap: { [key: string]: number } = {
      Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
      Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11
    };
    
    const month = monthMap[match[1]];
    const day = parseInt(match[2]);
    const hour = parseInt(match[3]);
    const minute = parseInt(match[4]);
    const second = parseInt(match[5]);
    
    if (month !== undefined) {
      const currentYear = new Date().getFullYear();
      const logTime = new Date(currentYear, month, day, hour, minute, second);
      
      // if parsed date is in future, it's likely from previous year
      if (logTime > new Date()) {
        logTime.setFullYear(currentYear - 1);
      }
      
      return endTime ? logTime >= startTime && logTime <= endTime : logTime >= startTime;
    }
  }

  // format 3: ISO format without brackets (YYYY-MM-DDTHH:MM:SS)
  match = log.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
  if (match) {
    const logTime = new Date(match[1]);
    return endTime ? logTime >= startTime && logTime <= endTime : logTime >= startTime;
  }

  // format 4: try to parse any timestamp-like pattern (fallback)
  match = log.match(/(\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2})|(\d{2}:\d{2}:\d{2})/);
  if (match) {
    const timeStr = match[1] || match[2];
    if (timeStr) {
      try {
        const logTime = new Date(timeStr);
        if (!isNaN(logTime.getTime())) {
          return endTime ? logTime >= startTime && logTime <= endTime : logTime >= startTime;
        }
      } catch (e) {
        // invalid date, include log by default
      }
    }
  }

  return true; // include logs without recognizable timestamp
}

