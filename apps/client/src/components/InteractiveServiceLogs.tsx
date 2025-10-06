import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LogEntry } from '@OpsiMate/shared';

// Define LogLevel locally until import issue is resolved
enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn', 
  ERROR = 'error',
  FATAL = 'fatal',
  TRACE = 'trace',
}
import { useServiceLogs } from '@/hooks/queries/services/useServiceLogs';
import { 
  RefreshCw, 
  Search, 
  Download, 
  Copy, 
  Filter,
  ChevronDown,
  ChevronRight,
  Calendar,
  Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface InteractiveServiceLogsProps {
  serviceId: number;
  serviceName: string;
  className?: string;
}

const LOG_LEVELS = [
  { value: LogLevel.ERROR, label: 'Error', color: 'bg-red-500' },
  { value: LogLevel.WARN, label: 'Warning', color: 'bg-yellow-500' },
  { value: LogLevel.INFO, label: 'Info', color: 'bg-blue-500' },
  { value: LogLevel.DEBUG, label: 'Debug', color: 'bg-gray-500' },
  { value: LogLevel.TRACE, label: 'Trace', color: 'bg-purple-500' },
  { value: LogLevel.FATAL, label: 'Fatal', color: 'bg-red-900' },
];

const TIME_RANGES = [
  { value: '1h', label: 'Last Hour' },
  { value: '6h', label: 'Last 6 Hours' },
  { value: '24h', label: 'Last 24 Hours' },
  { value: '7d', label: 'Last 7 Days' },
];

export const InteractiveServiceLogs: React.FC<InteractiveServiceLogsProps> = ({
  serviceId,
  serviceName,
  className = ''
}) => {
  const { toast } = useToast();
  
  // Filter states
  const [searchText, setSearchText] = useState('');
  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>([]);
  const [timeRange, setTimeRange] = useState('24h');
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Build filters object
  const filters = useMemo(() => {
    const filterObj: any = {
      since: timeRange,
      limit: 500,
    };

    if (searchText.trim()) {
      filterObj.searchText = searchText.trim();
    }

    if (showOnlyErrors) {
      filterObj.levels = [LogLevel.ERROR, LogLevel.FATAL];
    } else if (selectedLevels.length > 0) {
      filterObj.levels = selectedLevels;
    }

    return filterObj;
  }, [searchText, selectedLevels, timeRange, showOnlyErrors]);

  // Fetch logs with filters
  const { 
    data: logs = [], 
    isLoading, 
    error, 
    refetch 
  } = useServiceLogs(serviceId, filters, {
    refetchInterval: autoRefresh ? 5000 : undefined,
  });

  // Handle level filter toggle
  const toggleLevel = useCallback((level: LogLevel) => {
    setSelectedLevels(prev => 
      prev.includes(level) 
        ? prev.filter(l => l !== level)
        : [...prev, level]
    );
  }, []);

  // Handle log expansion
  const toggleLogExpansion = useCallback((logId: string) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  }, []);

  // Handle copy log entry
  const copyLogEntry = useCallback((log: LogEntry) => {
    const logText = `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.source ? `[${log.source}] ` : ''}${log.message}`;
    navigator.clipboard.writeText(logText).then(() => {
      toast({
        title: 'Copied to clipboard',
        description: 'Log entry copied successfully',
      });
    }).catch(() => {
      toast({
        title: 'Copy failed',
        description: 'Failed to copy log entry to clipboard',
        variant: 'destructive',
      });
    });
  }, [toast]);

  // Handle download logs
  const downloadLogs = useCallback(() => {
    const logText = logs.map(log => 
      `[${log.timestamp}] [${log.level.toUpperCase()}] ${log.source ? `[${log.source}] ` : ''}${log.message}`
    ).join('\n');

    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${serviceName}-logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Download started',
      description: 'Log file download has started',
    });
  }, [logs, serviceName, toast]);

  // Get level config
  const getLevelConfig = (level: LogLevel) => 
    LOG_LEVELS.find(l => l.value === level) || { value: level, label: level, color: 'bg-gray-500' };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
    };
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Service Logs: {serviceName}</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={downloadLogs}
              disabled={logs.length === 0}
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filter Controls */}
        {showFilters && (
          <div className="space-y-3 pt-3 border-t">
            {/* Search */}
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search logs..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="h-8"
              />
            </div>

            {/* Time Range and Error Toggle */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Select value={timeRange} onValueChange={setTimeRange}>
                  <SelectTrigger className="w-32 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_RANGES.map(range => (
                      <SelectItem key={range.value} value={range.value}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="only-errors"
                  checked={showOnlyErrors}
                  onCheckedChange={setShowOnlyErrors}
                />
                <Label htmlFor="only-errors" className="text-sm">Show only errors</Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="auto-refresh"
                  checked={autoRefresh}
                  onCheckedChange={setAutoRefresh}
                />
                <Label htmlFor="auto-refresh" className="text-sm">Auto refresh</Label>
              </div>
            </div>

            {/* Log Level Badges */}
            {!showOnlyErrors && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Levels:</span>
                {LOG_LEVELS.map(level => (
                  <Badge
                    key={level.value}
                    variant={selectedLevels.includes(level.value) ? "default" : "outline"}
                    className={`cursor-pointer text-xs ${
                      selectedLevels.includes(level.value) ? level.color + ' text-white' : ''
                    }`}
                    onClick={() => toggleLevel(level.value)}
                  >
                    {level.label}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-0">
        {/* Status */}
        <div className="flex items-center justify-between mb-4 text-sm text-muted-foreground">
          <span>{logs.length} log entries</span>
          {autoRefresh && (
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Auto-refreshing every 5s</span>
            </div>
          )}
        </div>

        {/* Logs Display */}
        <ScrollArea className="h-[400px] w-full">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Loading logs...</span>
              </div>
            </div>
          ) : error ? (
            <div className="text-red-500 py-4 text-center">
              Error loading logs: {error instanceof Error ? error.message : 'Unknown error'}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center">
              No logs found for the current filters
            </div>
          ) : (
            <div className="space-y-2">
              {logs.map((log) => {
                const levelConfig = getLevelConfig(log.level);
                const { date, time } = formatTimestamp(log.timestamp);
                const isExpanded = expandedLogs.has(log.id || '');
                const showExpandButton = log.message.length > 200;

                return (
                  <div
                    key={log.id}
                    className="group border rounded-md p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Level Badge */}
                      <Badge
                        className={`${levelConfig.color} text-white text-xs min-w-[60px] justify-center`}
                      >
                        {levelConfig.label}
                      </Badge>

                      {/* Log Content */}
                      <div className="flex-1 min-w-0">
                        {/* Header */}
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-muted-foreground font-mono">
                            {date} {time}
                          </span>
                          {log.source && (
                            <Badge variant="outline" className="text-xs">
                              {log.source}
                            </Badge>
                          )}
                        </div>

                        {/* Message */}
                        <div className="font-mono text-sm">
                          {showExpandButton && !isExpanded ? (
                            <>
                              <span>{log.message.substring(0, 200)}...</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 px-1 ml-2"
                                onClick={() => toggleLogExpansion(log.id || '')}
                              >
                                <ChevronRight className="h-3 w-3" />
                                <span className="text-xs">Show more</span>
                              </Button>
                            </>
                          ) : (
                            <>
                              <span className="whitespace-pre-wrap">{log.message}</span>
                              {showExpandButton && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-1 ml-2"
                                  onClick={() => toggleLogExpansion(log.id || '')}
                                >
                                  <ChevronDown className="h-3 w-3" />
                                  <span className="text-xs">Show less</span>
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Copy Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => copyLogEntry(log)}
                        title="Copy log entry"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
