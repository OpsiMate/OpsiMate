import React, { useEffect, useState } from 'react';
import { AuditLog } from '@OpsiMate/shared';
import {
  getActionBadgeProps,
  formatRelativeTime,
  parseUTCDate,
  RenderLogDetails,
} from './AuditLogTable.utils';
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

const PAGE_SIZE = 20;

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
