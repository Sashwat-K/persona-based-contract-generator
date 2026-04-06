import React, { useState } from 'react';
import {
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Pagination,
  Tag,
  Button
} from '@carbon/react';
import { Download, Filter } from '@carbon/icons-react';

// Mock system audit logs - general system activities
const mockSystemLogs = [
  {
    id: '1',
    timestamp: '2024-04-06 11:30:15',
    user: 'admin@hpcr.com',
    action: 'USER_LOGIN',
    resource: 'Authentication System',
    ipAddress: '192.168.1.100',
    status: 'SUCCESS',
    details: 'Administrator logged in successfully'
  },
  {
    id: '2',
    timestamp: '2024-04-06 11:25:42',
    user: 'admin@hpcr.com',
    action: 'USER_CREATED',
    resource: 'User: sp@hpcr.com',
    ipAddress: '192.168.1.100',
    status: 'SUCCESS',
    details: 'Created new Service Provider user account'
  },
  {
    id: '3',
    timestamp: '2024-04-06 11:20:33',
    user: 'sp@hpcr.com',
    action: 'USER_LOGIN',
    resource: 'Authentication System',
    ipAddress: '192.168.1.105',
    status: 'SUCCESS',
    details: 'Service Provider logged in successfully'
  },
  {
    id: '4',
    timestamp: '2024-04-06 11:15:28',
    user: 'sp@hpcr.com',
    action: 'PUBLIC_KEY_REGISTERED',
    resource: 'User: sp@hpcr.com',
    ipAddress: '192.168.1.105',
    status: 'SUCCESS',
    details: 'Registered RSA-4096 public key, fingerprint: b2c3d4e5...fg67'
  },
  {
    id: '5',
    timestamp: '2024-04-06 11:10:15',
    user: 'auditor@hpcr.com',
    action: 'PASSWORD_CHANGED',
    resource: 'User: auditor@hpcr.com',
    ipAddress: '192.168.1.115',
    status: 'SUCCESS',
    details: 'User changed password successfully'
  },
  {
    id: '6',
    timestamp: '2024-04-06 11:05:42',
    user: 'admin@hpcr.com',
    action: 'ROLE_ASSIGNED',
    resource: 'User: do@hpcr.com',
    ipAddress: '192.168.1.100',
    status: 'SUCCESS',
    details: 'Assigned role: DATA_OWNER'
  },
  {
    id: '7',
    timestamp: '2024-04-06 11:00:18',
    user: 'unknown',
    action: 'USER_LOGIN',
    resource: 'Authentication System',
    ipAddress: '203.0.113.45',
    status: 'FAILED',
    details: 'Login attempt failed: Invalid credentials'
  },
  {
    id: '8',
    timestamp: '2024-04-06 10:55:33',
    user: 'eo@hpcr.com',
    action: 'KEY_ROTATION',
    resource: 'User: eo@hpcr.com',
    ipAddress: '192.168.1.120',
    status: 'SUCCESS',
    details: 'Generated new RSA-4096 key pair, old key invalidated'
  },
  {
    id: '9',
    timestamp: '2024-04-06 10:50:22',
    user: 'admin@hpcr.com',
    action: 'USER_DELETED',
    resource: 'User: test@hpcr.com',
    ipAddress: '192.168.1.100',
    status: 'SUCCESS',
    details: 'Deleted test user account'
  },
  {
    id: '10',
    timestamp: '2024-04-06 10:45:11',
    user: 'admin@hpcr.com',
    action: 'PASSWORD_RESET_FORCED',
    resource: 'User: eo@hpcr.com',
    ipAddress: '192.168.1.100',
    status: 'SUCCESS',
    details: 'Administrator forced password reset for user'
  },
  {
    id: '11',
    timestamp: '2024-04-06 10:40:05',
    user: 'do@hpcr.com',
    action: 'USER_LOGIN',
    resource: 'Authentication System',
    ipAddress: '192.168.1.110',
    status: 'SUCCESS',
    details: 'Data Owner logged in successfully'
  },
  {
    id: '12',
    timestamp: '2024-04-06 10:35:48',
    user: 'admin@hpcr.com',
    action: 'API_TOKEN_CREATED',
    resource: 'User: sp@hpcr.com',
    ipAddress: '192.168.1.100',
    status: 'SUCCESS',
    details: 'Created API token for automated workload submission'
  },
  {
    id: '13',
    timestamp: '2024-04-06 10:30:22',
    user: 'admin@hpcr.com',
    action: 'API_TOKEN_REVOKED',
    resource: 'User: old-sp@hpcr.com',
    ipAddress: '192.168.1.100',
    status: 'SUCCESS',
    details: 'Revoked API token due to security policy'
  },
  {
    id: '14',
    timestamp: '2024-04-06 10:25:15',
    user: 'system',
    action: 'KEY_EXPIRY_WARNING',
    resource: 'User: auditor@hpcr.com',
    ipAddress: 'N/A',
    status: 'WARNING',
    details: 'Public key expires in 7 days, rotation recommended'
  },
  {
    id: '15',
    timestamp: '2024-04-06 10:20:08',
    user: 'system',
    action: 'PASSWORD_EXPIRY_WARNING',
    resource: 'User: eo@hpcr.com',
    ipAddress: 'N/A',
    status: 'WARNING',
    details: 'Password expires in 3 days, change required'
  }
];

const headers = [
  { key: 'timestamp', header: 'Timestamp' },
  { key: 'user', header: 'User' },
  { key: 'action', header: 'Action' },
  { key: 'resource', header: 'Resource' },
  { key: 'ipAddress', header: 'IP Address' },
  { key: 'status', header: 'Status' },
  { key: 'details', header: 'Details' }
];

const getStatusTagType = (status) => {
  switch (status) {
    case 'SUCCESS':
      return 'green';
    case 'FAILED':
      return 'red';
    case 'WARNING':
      return 'yellow';
    default:
      return 'gray';
  }
};

const SystemLogs = () => {
  const [searchValue, setSearchValue] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredLogs = mockSystemLogs.filter(log =>
    Object.values(log).some(value =>
      value && value.toString().toLowerCase().includes(searchValue.toLowerCase())
    )
  );

  const paginatedLogs = filteredLogs.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const handleExport = () => {
    const csv = [
      headers.map(h => h.header).join(','),
      ...filteredLogs.map(log =>
        headers.map(h => `"${log[h.key] || ''}"`).join(',')
      )
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-logs-${new Date().toISOString()}.csv`;
    a.click();
  };

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ marginBottom: '0.5rem' }}>System Logs</h1>
        <p style={{ color: 'var(--cds-text-secondary)' }}>
          System-wide audit logs for user activities, authentication, and administrative actions
        </p>
      </div>

      <DataTable rows={paginatedLogs} headers={headers}>
        {({
          rows,
          headers,
          getHeaderProps,
          getRowProps,
          getTableProps,
          getTableContainerProps
        }) => (
          <TableContainer
            {...getTableContainerProps()}
            title="System Activity Log"
            description="Chronological log of all system-level events and user activities"
          >
            <TableToolbar>
              <TableToolbarContent>
                <TableToolbarSearch
                  placeholder="Search system logs..."
                  onChange={(e) => setSearchValue(e.target.value)}
                />
                <Button
                  kind="ghost"
                  renderIcon={Filter}
                  iconDescription="Filter"
                >
                  Filter
                </Button>
                <Button
                  kind="primary"
                  renderIcon={Download}
                  onClick={handleExport}
                >
                  Export CSV
                </Button>
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map((header) => (
                    <TableHeader {...getHeaderProps({ header })} key={header.key}>
                      {header.header}
                    </TableHeader>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow {...getRowProps({ row })} key={row.id}>
                    {row.cells.map((cell) => (
                      <TableCell key={cell.id}>
                        {cell.info.header === 'status' ? (
                          <Tag type={getStatusTagType(cell.value)}>
                            {cell.value}
                          </Tag>
                        ) : (
                          cell.value
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>

      <Pagination
        page={page}
        pageSize={pageSize}
        pageSizes={[10, 20, 50, 100]}
        totalItems={filteredLogs.length}
        onChange={({ page, pageSize }) => {
          setPage(page);
          setPageSize(pageSize);
        }}
        style={{ marginTop: '1rem' }}
      />
    </div>
  );
};

export default SystemLogs;

// Made with Bob
