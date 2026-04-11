import React, { useState, useEffect, useCallback } from 'react';
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
import { Download, Renew } from '@carbon/icons-react';
import systemLogService from '../services/systemLogService';
import userService from '../services/userService';
import { FullPageLoader } from '../components/LoadingSpinner';
import { formatDate } from '../utils/formatters';
import { ErrorStatePanel } from '../components/StatePanel';

const headers = [
  { key: 'timestamp', header: 'Timestamp' },
  { key: 'actor_name', header: 'Actor' },
  { key: 'action', header: 'Action' },
  { key: 'resource', header: 'Resource' },
  { key: 'ip_address', header: 'IP Address' },
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
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [refreshing, setRefreshing] = useState(false);

  const loadLogs = useCallback(async ({ showLoader = false } = {}) => {
    try {
      if (showLoader) {
        setIsLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);
      const [data, users] = await Promise.all([
        systemLogService.getSystemLogs(200, 0),
        userService.listUsers().catch(() => [])
      ]);

      // Build email → full name lookup from the users list
      const emailToName = {};
      (users || []).forEach(u => {
        if (u.email) emailToName[u.email] = u.name || u.email;
      });

      const formattedData = data.map(log => ({
        ...log,
        timestamp: formatDate(log.timestamp),
        actor_name: emailToName[log.actor_email] || log.actor_email
      }));
      setLogs(formattedData);
    } catch (loadError) {
      console.error("Failed to load system logs:", loadError);
      setError(loadError.message || 'Failed to load system logs');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadLogs({ showLoader: true });
  }, [loadLogs]);

  const filteredLogs = logs.filter(log =>
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
    window.URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <FullPageLoader description="Loading system logs..." />;
  }

  if (error) {
    return (
      <div className="app-page">
        <ErrorStatePanel
          title="Failed to Load System Logs"
          description={error}
          action={<Button onClick={() => loadLogs({ showLoader: true })}>Retry</Button>}
        />
      </div>
    );
  }

  return (
    <div className="app-page">
      <div className="app-page__header">
        <div>
          <h1 className="app-page__title">System Logs</h1>
          <p className="app-page__subtitle">
            System-wide audit logs for user activities, authentication, and administrative actions
          </p>
        </div>
        <div className="app-page__actions">
          <Button
            kind="tertiary"
            size="md"
            renderIcon={Renew}
            onClick={() => loadLogs({ showLoader: false })}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
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
        className="system-logs-pagination"
      />
    </div>
  );
};

export default SystemLogs;
