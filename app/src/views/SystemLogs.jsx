import React, { useState, useEffect } from 'react';
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
import systemLogService from '../services/systemLogService';
import { FullPageLoader } from '../components/LoadingSpinner';
// Live logs will be fetched securely.

const headers = [
  { key: 'timestamp', header: 'Timestamp' },
  { key: 'actor_email', header: 'Actor' },
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
  const [searchValue, setSearchValue] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const data = await systemLogService.getSystemLogs(200, 0);
        // Format the ISO timestamps to localized strings for display
        const formattedData = data.map(log => ({
          ...log,
          timestamp: new Date(log.timestamp).toLocaleString()
        }));
        setLogs(formattedData);
      } catch (error) {
        console.error("Failed to load system logs:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, []);

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
  };

  if (isLoading) {
    return <FullPageLoader description="Loading system logs..." />;
  }

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


