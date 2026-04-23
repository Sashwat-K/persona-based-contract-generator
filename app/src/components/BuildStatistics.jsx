import React, { useMemo } from 'react';
import { Tile, SkeletonText } from '@carbon/react';
import { 
  Checkmark, 
  InProgress, 
  WarningAlt, 
  Time,
  Catalog,
  User
} from '@carbon/icons-react';
import { BUILD_STATUS_CONFIG } from '../utils/constants';

/**
 * Build Statistics Component
 * Displays visual statistics and metrics for builds
 */
const BuildStatistics = ({ builds, loading = false }) => {
  // Calculate statistics
  const statistics = useMemo(() => {
    if (!builds || builds.length === 0) {
      return {
        total: 0,
        byStatus: {},
        completionRate: 0,
        avgTimeToComplete: 0,
        activeBuilds: 0,
        completedBuilds: 0,
        cancelledBuilds: 0,
        uniqueCreators: 0
      };
    }

    const stats = {
      total: builds.length,
      byStatus: {},
      completionRate: 0,
      avgTimeToComplete: 0,
      activeBuilds: 0,
      completedBuilds: 0,
      cancelledBuilds: 0,
      uniqueCreators: new Set()
    };

    // Count by status
    builds.forEach(build => {
      const status = (build.status || '').toUpperCase();
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

      // Track creators
      const creator = build.created_by || build.createdBy || 'Unknown';
      stats.uniqueCreators.add(creator);

      // Categorize builds
      if (status === 'CONTRACT_DOWNLOADED') {
        stats.completedBuilds++;
      } else if (status === 'CANCELLED') {
        stats.cancelledBuilds++;
      } else {
        stats.activeBuilds++;
      }
    });

    // Calculate completion rate
    if (stats.total > 0) {
      stats.completionRate = Math.round((stats.completedBuilds / stats.total) * 100);
    }

    // Calculate average time to complete (simplified - would need actual completion times)
    // For now, just show a placeholder
    stats.avgTimeToComplete = 0;

    stats.uniqueCreators = stats.uniqueCreators.size;

    return stats;
  }, [builds]);

  // Get status color
  const getStatusColor = (status) => {
    const config = BUILD_STATUS_CONFIG[status];
    return config?.kind || 'gray';
  };

  if (loading) {
    return (
      <div className="build-statistics">
        <div className="build-statistics__grid">
          {[1, 2, 3, 4].map(i => (
            <Tile key={i} className="build-statistics__card">
              <SkeletonText heading width="60%" />
              <SkeletonText width="40%" />
            </Tile>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="build-statistics">
      <div className="build-statistics__grid">
        {/* Total Builds */}
        <Tile className="build-statistics__card">
          <div className="build-statistics__card-icon build-statistics__card-icon--primary">
            <Catalog size={24} />
          </div>
          <div className="build-statistics__card-content">
            <div className="build-statistics__card-value">{statistics.total}</div>
            <div className="build-statistics__card-label">Total Builds</div>
          </div>
        </Tile>

        {/* Active Builds */}
        <Tile className="build-statistics__card">
          <div className="build-statistics__card-icon build-statistics__card-icon--info">
            <InProgress size={24} />
          </div>
          <div className="build-statistics__card-content">
            <div className="build-statistics__card-value">{statistics.activeBuilds}</div>
            <div className="build-statistics__card-label">Active Builds</div>
          </div>
        </Tile>

        {/* Cancelled Builds - Position 3 (top-right) */}
        <Tile className="build-statistics__card">
          <div className="build-statistics__card-icon build-statistics__card-icon--warning">
            <WarningAlt size={24} />
          </div>
          <div className="build-statistics__card-content">
            <div className="build-statistics__card-value">{statistics.cancelledBuilds}</div>
            <div className="build-statistics__card-label">Cancelled</div>
          </div>
        </Tile>

        {/* Status Breakdown - Position 4, spans 2×2 */}
        <Tile className="build-statistics__card build-statistics__card--wide">
          <div className="build-statistics__card-header">
            <div className="build-statistics__card-icon build-statistics__card-icon--neutral">
              <Time size={24} />
            </div>
            <div className="build-statistics__card-title">Status Breakdown</div>
          </div>
          <div className="build-statistics__status-list">
            {Object.entries(statistics.byStatus)
              .sort((a, b) => b[1] - a[1])
              .map(([status, count]) => {
                const config = BUILD_STATUS_CONFIG[status];
                const percentage = statistics.total > 0
                  ? Math.round((count / statistics.total) * 100)
                  : 0;
                const colorKind = getStatusColor(status);
                
                // Debug: log status and color
                console.log('Status:', status, 'Color:', colorKind, 'Percentage:', percentage);
                
                return (
                  <div key={status} className="build-statistics__status-item">
                    <div className="build-statistics__status-info">
                      <span className="build-statistics__status-label">
                        {config?.label || status}
                      </span>
                      <span className="build-statistics__status-count">
                        {count} ({percentage}%)
                      </span>
                    </div>
                    <div className="build-statistics__status-bar">
                      <div
                        className={`build-statistics__status-bar-fill build-statistics__status-bar-fill--${colorKind}`}
                        style={{
                          width: `${percentage}%`
                        }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </Tile>

        {/* Completed Builds - Position 6 (bottom-right) */}
        <Tile className="build-statistics__card">
          <div className="build-statistics__card-icon build-statistics__card-icon--success">
            <Checkmark size={24} />
          </div>
          <div className="build-statistics__card-content">
            <div className="build-statistics__card-value">{statistics.completedBuilds}</div>
            <div className="build-statistics__card-label">Completed</div>
            {statistics.total > 0 && (
              <div className="build-statistics__card-meta">
                {statistics.completionRate}% completion rate
              </div>
            )}
          </div>
        </Tile>

        {/* Unique Creators - Position 7 (third row, left) */}
        <Tile className="build-statistics__card">
          <div className="build-statistics__card-icon build-statistics__card-icon--secondary">
            <User size={24} />
          </div>
          <div className="build-statistics__card-content">
            <div className="build-statistics__card-value">{statistics.uniqueCreators}</div>
            <div className="build-statistics__card-label">Unique Creators</div>
          </div>
        </Tile>
      </div>
    </div>
  );
};

export default BuildStatistics;
