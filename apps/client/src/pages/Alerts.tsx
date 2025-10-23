import { DashboardLayout } from '@/components/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useAlerts, useDismissAlert, useUndismissAlert } from '@/hooks/queries/alerts';
import { useServices } from '@/hooks/queries/services';
import { useToast } from '@/hooks/use-toast';
import { getAlertServiceId } from '@/utils/alert.utils.ts';
import { Alert } from '@OpsiMate/shared';
import { ExternalLink, RotateCcw, X } from 'lucide-react';
import { useMemo, useState } from 'react';

const Alerts = () => {
  const { data: alerts = [], isLoading } = useAlerts();
  const dismissAlertMutation = useDismissAlert();
  const undismissAlertMutation = useUndismissAlert();
  const { toast } = useToast();
  const [search, setSearch] = useState('');

  const { data: services = [] } = useServices();

  const serviceNameById = useMemo(
    () => Object.fromEntries(services.map(s => [s.id, s.name])),
    [services]
  );
  const filteredAlerts = useMemo(() => {
    if (!search.trim()) return alerts;
    const lower = search.toLowerCase();
    return alerts.filter(
      (a: Alert) =>
        a.alertName.toLowerCase().includes(lower) ||
        a.status.toLowerCase().includes(lower) ||
        (a.summary && a.summary.toLowerCase().includes(lower)) ||
        a.tag.toLowerCase().includes(lower)
    );
  }, [alerts, search]);

  const handleDismissAlert = async (alertId: string) => {
    try {
      await dismissAlertMutation.mutateAsync(alertId);
      toast({
        title: 'Alert dismissed',
        description: 'The alert has been marked as dismissed.',
      });
    } catch (error) {
      toast({
        title: 'Error dismissing alert',
        description: 'Failed to dismiss alert',
        variant: 'destructive',
      });
    }
  };
  const renderServiceName = (a: Alert) => {
    const sid = getAlertServiceId(a);
    if (!sid) return <span className='text-muted-foreground'>-</span>;
    return serviceNameById[sid] ?? `#${sid}`;
  };

  const handleUndismissAlert = async (alertId: string) => {
    try {
      await undismissAlertMutation.mutateAsync(alertId);
      toast({
        title: 'Alert undismissed',
        description: 'The alert has been reactivated.',
      });
    } catch (error) {
      toast({
        title: 'Error undismissing alert',
        description: 'Failed to undismiss alert',
        variant: 'destructive',
      });
    }
  };
  const getStatusBadge = (alert: Alert) => {
    if (alert.isDismissed) {
      return <Badge variant='secondary'>dismissed</Badge>;
    }

    return <Badge variant='destructive'>firing</Badge>;
  };

  return (
    <DashboardLayout>
      <div className='flex flex-col h-full p-6 gap-6 max-w-7xl mx-auto'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Alerts</h1>
          <p className='text-muted-foreground mt-1'>All system alerts</p>
        </div>
        <div className='bg-card rounded-lg border shadow-sm p-6 flex flex-col gap-4'>
          <div className='flex items-center gap-4'>
            <Input
              placeholder='Search alerts...'
              value={search}
              onChange={e => setSearch(e.target.value)}
              className='max-w-xs'
            />
          </div>
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className='text-center py-8'>
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredAlerts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className='text-center py-8 text-muted-foreground'>
                      No alerts found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAlerts.map(alert => (
                    <TableRow key={alert.id}>
                      <TableCell className='font-medium'>{alert.alertName}</TableCell>
                      <TableCell>{getStatusBadge(alert)}</TableCell>
                      <TableCell>
                        <Badge variant='outline'>{alert.tag}</Badge>
                      </TableCell>
                      <TableCell className='max-w-xs truncate'>{alert.summary || '-'}</TableCell>
                      <TableCell>{new Date(alert.startsAt).toLocaleString()}</TableCell>
                      <TableCell>{renderServiceName(alert)}</TableCell>
                      <TableCell>
                        <div className='flex items-center gap-1'>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-7 w-7 p-0 text-muted-foreground hover:bg-accent'
                            title='Open Runbook'
                            onClick={() =>
                              window.open(alert.runbookUrl, '_blank', 'noopener,noreferrer')
                            }
                            disabled={!alert.runbookUrl}
                          >
                            <span className='sr-only'>Open Runbook</span>
                            📖
                          </Button>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-7 w-7 p-0 text-muted-foreground hover:bg-accent'
                            title='View in Grafana'
                            onClick={() =>
                              window.open(alert.alertUrl, '_blank', 'noopener,noreferrer')
                            }
                            disabled={!alert.alertUrl}
                          >
                            <ExternalLink className='h-4 w-4' />
                          </Button>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='h-7 w-7 p-0 text-muted-foreground hover:bg-accent'
                            title={alert.isDismissed ? 'Undismiss Alert' : 'Dismiss Alert'}
                            onClick={() =>
                              alert.isDismissed
                                ? handleUndismissAlert(alert.id)
                                : handleDismissAlert(alert.id)
                            }
                            disabled={
                              dismissAlertMutation.isPending || undismissAlertMutation.isPending
                            }
                          >
                            {dismissAlertMutation.isPending || undismissAlertMutation.isPending ? (
                              <div className='h-3 w-3 rounded-full border-2 border-t-transparent animate-spin' />
                            ) : alert.isDismissed ? (
                              <RotateCcw className='h-4 w-4' />
                            ) : (
                              <X className='h-4 w-4' />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Alerts;
