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
  Button,
  Modal,
  InlineNotification,
  Tag,
} from '@carbon/react';
import {
  UserMultiple,
  CheckmarkFilled,
  WarningAlt,
  Renew
} from '@carbon/icons-react';
import assignmentService from '../services/assignmentService';
import sectionService from '../services/sectionService';
import buildService from '../services/buildService';
import { formatDate } from '../utils/formatters';

/**
 * BuildAssignments Component
 * Manages user-to-build-to-role assignments for two-layer access control
 * Features: Assignment table, creation dialog, deletion, validation
 */
const BuildAssignments = ({ buildId, buildStatus, userRole, onStatusUpdate }) => {
  const [assignments, setAssignments] = useState([]);
  const [sections, setSections] = useState([]);
  const [auditEvents, setAuditEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const canManageBuilds = userRole === 'ADMIN' || userRole === 'AUDITOR';
  const normalizedBuildStatus = String(buildStatus || '').toUpperCase();
  const canCancelBuild = canManageBuilds && !['FINALIZED', 'CONTRACT_DOWNLOADED', 'CANCELLED'].includes(normalizedBuildStatus);

  useEffect(() => {
    loadAssignments();
  }, [buildId]);

  const loadAssignments = async () => {
    setLoading(true);
    setError(null);

    try {
      const [data, sectionData, eventData] = await Promise.all([
        assignmentService.getBuildAssignments(buildId),
        sectionService.getSections(buildId).catch(() => []),
        buildService.getAuditEvents(buildId).catch(() => []),
      ]);
      setAssignments(data);
      setSections(sectionData);
      setAuditEvents(Array.isArray(eventData) ? eventData : []);
    } catch (err) {
      setError(`Failed to load assignments: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBuild = async () => {
    if (!canCancelBuild || cancelling) return;

    setCancelling(true);
    setError(null);
    setSuccess(null);
    try {
      await buildService.cancelBuild(buildId);
      onStatusUpdate?.('CANCELLED');
      setShowCancelModal(false);
      setSuccess('Build cancelled successfully.');
      await loadAssignments();
    } catch (err) {
      setError(`Failed to cancel build: ${err.message}`);
    } finally {
      setCancelling(false);
    }
  };

  const getRoleTag = (role) => {
    const roleConfig = {
      SOLUTION_PROVIDER: { type: 'blue', label: 'Solution Provider' },
      DATA_OWNER: { type: 'green', label: 'Data Owner' },
      AUDITOR: { type: 'purple', label: 'Auditor' },
      ENV_OPERATOR: { type: 'teal', label: 'Environment Operator' },
      ADMIN: { type: 'red', label: 'Administrator' }
    };

    const config = roleConfig[role] || { type: 'gray', label: role };
    return <Tag type={config.type}>{config.label}</Tag>;
  };

  const getAssignmentStatus = (assignment) => {
    const role = assignment.role_name;
    const hasSubmittedSection = sections.some(s => s.persona_role === role);

    if (role === 'SOLUTION_PROVIDER' || role === 'DATA_OWNER') {
      if (hasSubmittedSection) {
        return <Tag type="green" renderIcon={CheckmarkFilled}>Submitted</Tag>;
      }
      return <Tag type="gray" renderIcon={WarningAlt}>Pending</Tag>;
    }

    if (role === 'AUDITOR') {
      if (['FINALIZED', 'CONTRACT_DOWNLOADED', 'CONTRACT_ASSEMBLED'].includes(normalizedBuildStatus)) {
        return <Tag type="green" renderIcon={CheckmarkFilled}>Completed (3/3)</Tag>;
      }
      if (['ATTESTATION_KEY_REGISTERED', 'AUDITOR_KEYS_REGISTERED'].includes(normalizedBuildStatus)) {
        return <Tag type="teal" renderIcon={WarningAlt}>Finalise Contract (2/3)</Tag>;
      }
      if (normalizedBuildStatus === 'ENVIRONMENT_STAGED') {
        return <Tag type="purple" renderIcon={WarningAlt}>Add Attestation Key (1/3)</Tag>;
      }
      if (['SIGNING_KEY_REGISTERED', 'WORKLOAD_SUBMITTED'].includes(normalizedBuildStatus)) {
        return <Tag type="blue">Waiting for Environment (1/3)</Tag>;
      }
      if (normalizedBuildStatus === 'CREATED') {
        return <Tag type="purple" renderIcon={WarningAlt}>Add Signing Key (0/3)</Tag>;
      }
      if (normalizedBuildStatus === 'CANCELLED') {
        return <Tag type="red">Cancelled</Tag>;
      }
      return <Tag type="gray" renderIcon={WarningAlt}>Pending</Tag>;
    }

    if (role === 'ENV_OPERATOR') {
      const downloadedByAssignee = auditEvents.some(
        (e) => e.event_type === 'CONTRACT_DOWNLOADED' && e.actor_user_id === assignment.user_id
      );
      if (downloadedByAssignee) {
        return <Tag type="green" renderIcon={CheckmarkFilled}>Downloaded</Tag>;
      }
      return <Tag type="teal">Assigned</Tag>;
    }

    return <Tag type="gray">Assigned</Tag>;
  };

  const getAssignmentSummary = () => {
    const summary = {
      SOLUTION_PROVIDER: 0,
      DATA_OWNER: 0,
      AUDITOR: 0,
      ENV_OPERATOR: 0
    };

    assignments.forEach(a => {
      const role = a.role_name;
      if (summary.hasOwnProperty(role)) {
        summary[role]++;
      }
    });

    return summary;
  };

  const headers = [
    { key: 'user_name', header: 'User' },
    { key: 'user_email', header: 'Email' },
    { key: 'persona_role', header: 'Role' },
    { key: 'status', header: 'Status' },
    { key: 'assigned_at', header: 'Assigned At' }
  ];

  const roleOrder = ['ADMIN', 'AUDITOR', 'SOLUTION_PROVIDER', 'DATA_OWNER', 'ENV_OPERATOR', 'VIEWER'];

  const rows = assignments
    .slice()
    .sort((a, b) => {
      const ai = roleOrder.indexOf(a.role_name);
      const bi = roleOrder.indexOf(b.role_name);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    })
    .map((assignment, index) => ({
    id: `${assignment.user_id}-${assignment.role_name}-${index}`,
    user_name: assignment.user_name,
    user_email: assignment.user_email,
    persona_role: getRoleTag(assignment.role_name),
    status: getAssignmentStatus(assignment),
    assigned_at: assignment.assigned_at
      ? formatDate(assignment.assigned_at, { second: '2-digit', timeZoneName: 'short' })
      : 'N/A'
  }));

  const summary = getAssignmentSummary();

  return (
    <div className="build-assignments">
      {error && (
        <InlineNotification
          kind="error"
          title="Error"
          subtitle={error}
          onCloseButtonClick={() => setError(null)}
          lowContrast
        />
      )}

      {success && (
        <InlineNotification
          kind="success"
          title="Success"
          subtitle={success}
          onCloseButtonClick={() => setSuccess(null)}
          lowContrast
        />
      )}


      <div className="build-assignments__summary">
        <div className="build-assignments__summary-item">
          <UserMultiple size={20} />
          <span className="build-assignments__summary-label">Total Assignments:</span>
          <span className="build-assignments__summary-value">{assignments.length}</span>
        </div>
        <div className="build-assignments__summary-item">
          <span className="build-assignments__summary-label">Auditors:</span>
          <span className="build-assignments__summary-value">{summary.AUDITOR}</span>
        </div>
        <div className="build-assignments__summary-item">
          <span className="build-assignments__summary-label">Solution Providers:</span>
          <span className="build-assignments__summary-value">{summary.SOLUTION_PROVIDER}</span>
        </div>
        <div className="build-assignments__summary-item">
          <span className="build-assignments__summary-label">Data Owners:</span>
          <span className="build-assignments__summary-value">{summary.DATA_OWNER}</span>
        </div>
        <div className="build-assignments__summary-item">
          <span className="build-assignments__summary-label">Env Operators:</span>
          <span className="build-assignments__summary-value">{summary.ENV_OPERATOR}</span>
        </div>
      </div>

      <div className="build-assignments__actions">
        <Button
          kind="tertiary"
          size="md"
          renderIcon={Renew}
          onClick={loadAssignments}
          disabled={loading}
        >
          Refresh
        </Button>
        {canManageBuilds && (
          <Button
            kind="danger--tertiary"
            size="md"
            onClick={() => setShowCancelModal(true)}
            disabled={!canCancelBuild || cancelling}
          >
            Cancel Build
          </Button>
        )}
      </div>

      <DataTable rows={rows} headers={headers}>
        {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
          <TableContainer title="Build Assignments" description="User-to-role assignments for this build">
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
                      <TableCell key={cell.id}>{cell.value}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>

      {assignments.length === 0 && !loading && (
        <div className="build-assignments__empty-state">
          <UserMultiple size={48} />
          <h4>No Assignments Yet</h4>
          <p>No role assignments are currently configured for this build.</p>
        </div>
      )}

      <Modal
        open={showCancelModal}
        danger
        modalHeading="Cancel Build"
        primaryButtonText={cancelling ? 'Cancelling...' : 'Cancel Build'}
        secondaryButtonText="Close"
        onRequestSubmit={handleCancelBuild}
        onSecondarySubmit={() => setShowCancelModal(false)}
        onRequestClose={() => setShowCancelModal(false)}
        primaryButtonDisabled={cancelling || !canCancelBuild}
      >
        <p>
          This action will cancel the build and stop any further stage submissions.
          This cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

export default BuildAssignments;
