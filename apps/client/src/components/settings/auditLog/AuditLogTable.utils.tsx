import { AuditActionType } from '@OpsiMate/shared';

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

export const getActionBadgeProps = (action: AuditActionType) => {
  return actionBadgeProps[action] ?? { variant: 'outline', className: '' };
};

// Helper to parse SQLite UTC timestamp as ISO 8601
export function parseUTCDate(dateString: string) {
  return new Date(dateString.replace(' ', 'T') + 'Z');
}

export function formatRelativeTime(dateString: string) {
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

function parseLogDetails(details: string) {
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

export function RenderLogDetails(props: { details: string }) {
  const details = parseLogDetails(props.details);
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
