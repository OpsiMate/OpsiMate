import { LogEntry, LogLevel } from '@OpsiMate/shared';

/**
 * Parses a raw log line into a structured LogEntry
 */
export function parseLogLine(rawLine: string, source?: string): LogEntry {
    const trimmedLine = rawLine.trim();
    if (!trimmedLine) {
        throw new Error('Empty log line');
    }

    const entry: LogEntry = {
        id: generateLogId(),
        timestamp: extractTimestamp(trimmedLine) || new Date().toISOString(),
        level: extractLogLevel(trimmedLine),
        message: extractMessage(trimmedLine),
        source: source,
        metadata: {}
    };

    return entry;
}

/**
 * Generates a unique ID for a log entry
 */
function generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Extracts timestamp from log line (handles various formats)
 */
function extractTimestamp(line: string): string | null {
    // ISO 8601 timestamp
    const isoMatch = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z?)/);
    if (isoMatch) {
        return new Date(isoMatch[1]).toISOString();
    }

    // Docker logs format: 2024-01-01T12:00:00.000000000Z
    const dockerMatch = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{9}Z)/);
    if (dockerMatch) {
        return new Date(dockerMatch[1]).toISOString();
    }

    // Systemd journal format: Jan 01 12:00:00
    const journalMatch = line.match(/^(\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2})/);
    if (journalMatch) {
        const currentYear = new Date().getFullYear();
        const dateStr = `${currentYear} ${journalMatch[1]}`;
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate.toISOString();
        }
    }

    // Syslog format: 2024-01-01 12:00:00
    const syslogMatch = line.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
    if (syslogMatch) {
        return new Date(syslogMatch[1]).toISOString();
    }

    return null;
}

/**
 * Extracts log level from log line
 */
function extractLogLevel(line: string): LogLevel {
    const upperLine = line.toUpperCase();
    
    // Check for explicit log levels
    if (upperLine.includes('ERROR') || upperLine.includes('ERR')) return LogLevel.ERROR;
    if (upperLine.includes('FATAL') || upperLine.includes('CRITICAL')) return LogLevel.FATAL;
    if (upperLine.includes('WARN') || upperLine.includes('WARNING')) return LogLevel.WARN;
    if (upperLine.includes('INFO')) return LogLevel.INFO;
    if (upperLine.includes('DEBUG')) return LogLevel.DEBUG;
    if (upperLine.includes('TRACE')) return LogLevel.TRACE;

    // Check for common error indicators
    if (upperLine.includes('EXCEPTION') || upperLine.includes('FAILED') || 
        upperLine.includes('ERROR:') || upperLine.includes('[ERROR]')) {
        return LogLevel.ERROR;
    }

    // Check for common warning indicators
    if (upperLine.includes('DEPRECATED') || upperLine.includes('WARNING:') || 
        upperLine.includes('[WARN]') || upperLine.includes('CAUTION')) {
        return LogLevel.WARN;
    }

    // Default to info level
    return LogLevel.INFO;
}

/**
 * Extracts the actual message from log line (removes timestamp and level prefixes)
 */
function extractMessage(line: string): string {
    let message = line;

    // Remove timestamp prefixes
    message = message.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3,9})?Z?\s*/, '');
    message = message.replace(/^\w{3}\s+\d{1,2}\s+\d{2}:\d{2}:\d{2}\s+\S+\s*/, '');
    message = message.replace(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s*/, '');

    // Remove log level prefixes
    message = message.replace(/^\[(ERROR|WARN|INFO|DEBUG|TRACE|FATAL)\]\s*/i, '');
    message = message.replace(/^(ERROR|WARN|INFO|DEBUG|TRACE|FATAL):\s*/i, '');

    return message.trim() || line.trim();
}

/**
 * Filters log entries based on provided criteria
 */
export function filterLogEntries(
    entries: LogEntry[], 
    filters: {
        levels?: LogLevel[];
        searchText?: string;
        since?: string;
        until?: string;
        source?: string;
    }
): LogEntry[] {
    return entries.filter(entry => {
        // Filter by log levels
        if (filters.levels && filters.levels.length > 0) {
            if (!filters.levels.includes(entry.level)) {
                return false;
            }
        }

        // Filter by search text
        if (filters.searchText) {
            const searchLower = filters.searchText.toLowerCase();
            if (!entry.message.toLowerCase().includes(searchLower) &&
                !(entry.source?.toLowerCase().includes(searchLower))) {
                return false;
            }
        }

        // Filter by source
        if (filters.source && entry.source !== filters.source) {
            return false;
        }

        // Filter by time range
        const entryTime = new Date(entry.timestamp).getTime();
        
        if (filters.since) {
            const sinceTime = parseTimeFilter(filters.since).getTime();
            if (entryTime < sinceTime) {
                return false;
            }
        }

        if (filters.until) {
            const untilTime = parseTimeFilter(filters.until).getTime();
            if (entryTime > untilTime) {
                return false;
            }
        }

        return true;
    });
}

/**
 * Parses time filter strings like "1h", "24h", "2024-01-01T12:00:00Z"
 */
function parseTimeFilter(timeStr: string): Date {
    if (!timeStr || typeof timeStr !== 'string') {
        return new Date();
    }

    // Check if it's an ISO date string
    const isoDate = new Date(timeStr);
    if (!isNaN(isoDate.getTime())) {
        return isoDate;
    }

    // Parse relative time strings
    const relativeMatch = timeStr.match(/^(\d+)([smhdw])$/);
    if (relativeMatch) {
        const [, amount, unit] = relativeMatch;
        const now = new Date();
        const amountNum = parseInt(amount);

        if (isNaN(amountNum) || amountNum < 0) {
            return new Date();
        }

        switch (unit) {
            case 's': return new Date(now.getTime() - amountNum * 1000);
            case 'm': return new Date(now.getTime() - amountNum * 60 * 1000);
            case 'h': return new Date(now.getTime() - amountNum * 60 * 60 * 1000);
            case 'd': return new Date(now.getTime() - amountNum * 24 * 60 * 60 * 1000);
            case 'w': return new Date(now.getTime() - amountNum * 7 * 24 * 60 * 60 * 1000);
        }
    }

    // Default to current time if parsing fails
    return new Date();
}

/**
 * Sorts log entries by timestamp (newest first by default)
 */
export function sortLogEntries(entries: LogEntry[], ascending = false): LogEntry[] {
    return entries.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return ascending ? timeA - timeB : timeB - timeA;
    });
}
