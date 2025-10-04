import React, { useEffect, useState } from 'react';
import { AuditActionType, AuditLog } from '@OpsiMate/shared';
import { auditApi } from '../../../lib/api';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ErrorAlert } from '@/components/ErrorAlert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function parseDetails(details: string) {
  try {
    if (!details) return '';

    const obj = JSON.parse(details);
    const parsed: Record<string, string | number | boolean> = {};

    for (const key in obj) {
      const val = obj[key];
      if (!val) continue;

      if (
        typeof val === 'string' ||
        typeof val === 'number' ||
        typeof val === 'boolean'
      ) {
        parsed[key] = val;
      } else {
        parsed[key] = JSON.stringify(val);
      }
    }

    return parsed;
  } catch {
    return details;
  }
}

function RenderLogDetails(props: { details: string }) {
  const details = parseDetails(props.details);
  console.log(details);

  if (typeof details === 'string') return <pre>{details}</pre>;

  return (
    <ul>
      {Object.entries(details).map(([key, value]) => (
        <li key={key}>
          <strong>{key}:</strong> <span className='inline'>{value}</span>
        </li>
      ))}
    </ul>
  );
}

const PAGE_SIZE = 20;

// Helper to parse SQLite UTC timestamp as ISO 8601
function parseUTCDate(dateString: string) {
  return new Date(dateString.replace(' ', 'T') + 'Z');
}

function formatRelativeTime(dateString: string) {
  const now = new Date();
  const date = parseUTCDate(dateString);
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000); // in seconds
  if (diff < 60) return 'just now';
  if (diff < 3600)
    return `${Math.floor(diff / 60)} minute${Math.floor(diff / 60) === 1 ? '' : 's'} ago`;
  if (diff < 86400)
    return `${Math.floor(diff / 3600)} hour${Math.floor(diff / 3600) === 1 ? '' : 's'} ago`;
  if (diff < 604800)
    return `${Math.floor(diff / 86400)} day${Math.floor(diff / 86400) === 1 ? '' : 's'} ago`;
  return date.toLocaleDateString();
}

const actionBadgeProps: Record<
  AuditActionType,
  { variant: string; className: string }
> = {
  CREATE: {
    variant: 'secondary',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  UPDATE: {
    variant: 'secondary',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  DELETE: { variant: 'destructive', className: '' },
};

const getActionBadgeProps = (action: AuditActionType) => {
  return actionBadgeProps[action] ?? { variant: 'outline', className: '' };
};

export const AuditLogTable: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    auditApi.getAuditLogs(page, PAGE_SIZE).then((res) => {
      if (mounted) {
        if (res && Array.isArray(res.logs)) {
          setLogs(res.logs);
          setTotal(res.total || 0);
          setError(null);
        } else {
          setError(res?.error || 'Failed to fetch audit logs');
        }
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [page]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  if (loading)
    return <div className='py-8 text-center'>Loading audit logs...</div>;
  if (error) return <ErrorAlert message={error} className='mb-4' />;
  if (!logs.length)
    return (
      <div className='py-8 text-center text-muted-foreground'>
        No audit logs found.
      </div>
    );

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Resource</TableHead>
            <TableHead>Resource Name</TableHead>
            <TableHead>User</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => {
            const actionProps = getActionBadgeProps(log.actionType);
            return (
              <TableRow key={log.id}>
                <TableCell>
                  <span title={parseUTCDate(log.timestamp).toLocaleString()}>
                    {formatRelativeTime(log.timestamp)}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={actionProps.variant as any}
                    className={actionProps.className}
                  >
                    {log.actionType}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant='secondary'>{log.resourceType}</Badge>
                </TableCell>
                <TableCell>{log.resourceName || '-'}</TableCell>
                <TableCell>{log.userName || '-'}</TableCell>
                <TableCell>
                  <RenderLogDetails details={log.details} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {totalPages > 1 && (
        <div className='flex justify-end items-center gap-2 mt-4'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            &larr; Prev
          </Button>
          <span className='text-sm'>
            Page {page} of {totalPages}
          </span>
          <Button
            variant='outline'
            size='sm'
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next &rarr;
          </Button>
        </div>
      )}
    </div>
  );
};
