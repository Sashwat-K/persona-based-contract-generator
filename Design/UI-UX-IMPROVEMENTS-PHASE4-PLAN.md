# UI/UX Improvements - Phase 4 Implementation Plan

## Overview
Phase 4 focuses on advanced productivity features, user customization, and enhanced data visualization to create a more personalized and efficient user experience.

---

## 1. Command Palette

### 1.1 Overview
**Priority:** High  
**Complexity:** High  
**Impact:** Significant productivity boost for power users

A universal command palette (Ctrl+K) that provides quick access to all application actions through fuzzy search.

### 1.2 Features

#### Core Functionality
- **Fuzzy search** for all available actions
- **Recent actions** history (last 10 actions)
- **Contextual suggestions** based on current view
- **Keyboard-first** interaction
- **Action categories** (Navigation, Build Actions, User Actions, Settings)
- **Quick preview** of action results

#### Action Types
```javascript
const COMMAND_PALETTE_ACTIONS = {
  navigation: [
    { id: 'nav-home', label: 'Go to Home', icon: Home, action: () => navigate('/') },
    { id: 'nav-builds', label: 'Go to Build Management', icon: Build, action: () => navigate('/builds') },
    { id: 'nav-users', label: 'Go to User Management', icon: User, action: () => navigate('/users'), roles: ['ADMIN'] },
    { id: 'nav-logs', label: 'Go to System Logs', icon: Document, action: () => navigate('/logs'), roles: ['ADMIN', 'AUDITOR'] },
    { id: 'nav-settings', label: 'Go to Settings', icon: Settings, action: () => navigate('/settings') },
  ],
  
  buildActions: [
    { id: 'build-new', label: 'Create New Build', icon: Add, action: () => openNewBuildModal(), roles: ['ADMIN', 'AUDITOR'] },
    { id: 'build-export', label: 'Export Current Build', icon: Download, action: () => exportBuild(), context: 'build-details' },
    { id: 'build-refresh', label: 'Refresh Builds', icon: Renew, action: () => refreshBuilds(), context: 'builds' },
    { id: 'build-filter', label: 'Toggle Filters', icon: Filter, action: () => toggleFilters(), context: 'builds' },
  ],
  
  userActions: [
    { id: 'user-new', label: 'Create New User', icon: UserAdd, action: () => openNewUserModal(), roles: ['ADMIN'] },
    { id: 'user-profile', label: 'View My Profile', icon: User, action: () => navigate('/account') },
    { id: 'user-logout', label: 'Logout', icon: Logout, action: () => logout() },
  ],
  
  settings: [
    { id: 'settings-theme', label: 'Toggle Theme', icon: Light, action: () => toggleTheme() },
    { id: 'settings-shortcuts', label: 'View Keyboard Shortcuts', icon: Keyboard, action: () => showShortcuts() },
  ],
  
  help: [
    { id: 'help-docs', label: 'Open Documentation', icon: Book, action: () => openDocs() },
    { id: 'help-support', label: 'Contact Support', icon: Email, action: () => openSupport() },
  ]
};
```

### 1.3 Implementation Strategy

#### Component Structure
```
CommandPalette/
├── CommandPalette.jsx          # Main component
├── CommandPaletteInput.jsx     # Search input with fuzzy matching
├── CommandPaletteResults.jsx   # Results list with keyboard navigation
├── CommandPaletteItem.jsx      # Individual action item
└── useCommandPalette.js        # Hook for state management
```

#### Fuzzy Search Implementation
```javascript
import Fuse from 'fuse.js';

const useFuzzySearch = (items, searchTerm) => {
  const fuse = useMemo(() => new Fuse(items, {
    keys: ['label', 'keywords'],
    threshold: 0.3,
    includeScore: true,
  }), [items]);

  return useMemo(() => {
    if (!searchTerm) return items;
    return fuse.search(searchTerm).map(result => result.item);
  }, [fuse, searchTerm, items]);
};
```

#### Recent Actions Storage
```javascript
const useRecentActions = () => {
  const [recentActions, setRecentActions] = useState(() => {
    const stored = localStorage.getItem('recent_actions');
    return stored ? JSON.parse(stored) : [];
  });

  const addRecentAction = useCallback((actionId) => {
    setRecentActions(prev => {
      const updated = [actionId, ...prev.filter(id => id !== actionId)].slice(0, 10);
      localStorage.setItem('recent_actions', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return { recentActions, addRecentAction };
};
```

### 1.4 UI Design

```javascript
<Modal
  open={isOpen}
  onRequestClose={onClose}
  passiveModal
  className="command-palette"
  size="md"
>
  <div className="command-palette__container">
    <Search
      placeholder="Type a command or search..."
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      autoFocus
      size="lg"
    />
    
    <div className="command-palette__results">
      {recentActions.length > 0 && !searchTerm && (
        <div className="command-palette__section">
          <h4 className="command-palette__section-title">Recent</h4>
          {recentActions.map(action => (
            <CommandPaletteItem key={action.id} action={action} />
          ))}
        </div>
      )}
      
      {filteredActions.map(category => (
        <div key={category.name} className="command-palette__section">
          <h4 className="command-palette__section-title">{category.name}</h4>
          {category.actions.map(action => (
            <CommandPaletteItem 
              key={action.id} 
              action={action}
              isSelected={selectedIndex === action.index}
            />
          ))}
        </div>
      ))}
    </div>
    
    <div className="command-palette__footer">
      <Tag size="sm">↑↓</Tag> Navigate
      <Tag size="sm">Enter</Tag> Execute
      <Tag size="sm">Esc</Tag> Close
    </div>
  </div>
</Modal>
```

### 1.5 Keyboard Navigation

```javascript
const useCommandPaletteNavigation = (actions, onExecute) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleKeyDown = useCallback((e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, actions.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (actions[selectedIndex]) {
          onExecute(actions[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [selectedIndex, actions, onExecute]);

  return { selectedIndex, handleKeyDown };
};
```

---

## 2. Saved Filter Presets

### 2.1 Overview
**Priority:** Medium  
**Complexity:** Medium  
**Impact:** Improved efficiency for users with common filter patterns

Allow users to save and quickly apply custom filter combinations.

### 2.2 Features

#### Core Functionality
- **Save current filters** with custom names
- **Quick filter switching** from dropdown
- **Edit existing presets**
- **Delete presets**
- **Set default preset** per view
- **Export/import presets** (future)

#### Data Structure
```javascript
interface FilterPreset {
  id: string;
  name: string;
  description?: string;
  filters: {
    statuses: string[];
    creator: string;
    dateRange: {
      preset: string;
      custom?: { start: string; end: string };
    };
  };
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 2.3 Implementation

#### Preset Manager Component
```javascript
const FilterPresetManager = ({ currentFilters, onApplyPreset }) => {
  const [presets, setPresets] = useState([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');

  const savePreset = useCallback(() => {
    const preset = {
      id: generateId(),
      name: presetName,
      description: presetDescription,
      filters: currentFilters,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const updated = [...presets, preset];
    setPresets(updated);
    localStorage.setItem('filter_presets', JSON.stringify(updated));
    
    setSaveModalOpen(false);
    setPresetName('');
    setPresetDescription('');
  }, [presetName, presetDescription, currentFilters, presets]);

  const loadPreset = useCallback((presetId) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      onApplyPreset(preset.filters);
    }
  }, [presets, onApplyPreset]);

  const deletePreset = useCallback((presetId) => {
    const updated = presets.filter(p => p.id !== presetId);
    setPresets(updated);
    localStorage.setItem('filter_presets', JSON.stringify(updated));
  }, [presets]);

  return (
    <div className="filter-preset-manager">
      <Dropdown
        id="preset-selector"
        titleText="Saved Filters"
        label="Select a preset"
        items={presets}
        itemToString={item => item?.name || ''}
        onChange={({ selectedItem }) => loadPreset(selectedItem.id)}
        size="sm"
      />
      <Button
        kind="ghost"
        size="sm"
        onClick={() => setSaveModalOpen(true)}
        renderIcon={Save}
      >
        Save Current Filters
      </Button>
    </div>
  );
};
```

#### Save Preset Modal
```javascript
<Modal
  open={saveModalOpen}
  modalHeading="Save Filter Preset"
  primaryButtonText="Save"
  secondaryButtonText="Cancel"
  onRequestSubmit={savePreset}
  onRequestClose={() => setSaveModalOpen(false)}
  size="sm"
>
  <Stack gap={5}>
    <TextInput
      id="preset-name"
      labelText="Preset Name *"
      placeholder="e.g., Active Builds This Week"
      value={presetName}
      onChange={(e) => setPresetName(e.target.value)}
      required
    />
    <TextArea
      id="preset-description"
      labelText="Description (optional)"
      placeholder="Describe when to use this preset..."
      value={presetDescription}
      onChange={(e) => setPresetDescription(e.target.value)}
      rows={3}
    />
    <div className="preset-preview">
      <h5>Current Filters:</h5>
      <ul>
        {currentFilters.statuses.length > 0 && (
          <li>Status: {currentFilters.statuses.join(', ')}</li>
        )}
        {currentFilters.creator && (
          <li>Creator: {currentFilters.creator}</li>
        )}
        {currentFilters.dateRange.preset && (
          <li>Date Range: {currentFilters.dateRange.preset}</li>
        )}
      </ul>
    </div>
  </Stack>
</Modal>
```

---

## 3. Enhanced Data Visualization

### 3.1 Overview
**Priority:** Medium  
**Complexity:** Medium  
**Impact:** Better insights and decision-making

Enhance the AdminAnalytics view with interactive charts and real-time data.

### 3.2 Features

#### Dashboard Enhancements
- **Build status distribution** (pie chart)
- **Build creation timeline** (line chart)
- **User activity heatmap**
- **Average build completion time** (bar chart)
- **Real-time metrics** with auto-refresh
- **Export charts** as PNG/SVG

#### Chart Types
```javascript
import { PieChart, LineChart, BarChart, DonutChart } from '@carbon/charts-react';

const BuildStatusChart = ({ builds }) => {
  const data = useMemo(() => {
    const statusCounts = builds.reduce((acc, build) => {
      const status = build.status || 'UNKNOWN';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(statusCounts).map(([status, count]) => ({
      group: BUILD_STATUS_CONFIG[status]?.label || status,
      value: count
    }));
  }, [builds]);

  const options = {
    title: 'Build Status Distribution',
    resizable: true,
    height: '400px',
    pie: {
      alignment: 'center'
    },
    legend: {
      alignment: 'center'
    }
  };

  return <PieChart data={data} options={options} />;
};
```

#### Timeline Chart
```javascript
const BuildTimelineChart = ({ builds }) => {
  const data = useMemo(() => {
    const grouped = builds.reduce((acc, build) => {
      const date = new Date(build.created_at).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        group: 'Builds Created',
        date: new Date(date),
        value: count
      }));
  }, [builds]);

  const options = {
    title: 'Build Creation Timeline',
    axes: {
      bottom: {
        title: 'Date',
        mapsTo: 'date',
        scaleType: 'time'
      },
      left: {
        title: 'Number of Builds',
        mapsTo: 'value',
        scaleType: 'linear'
      }
    },
    curve: 'curveMonotoneX',
    height: '400px'
  };

  return <LineChart data={data} options={options} />;
};
```

### 3.3 Real-time Updates

```javascript
const useRealtimeMetrics = (refreshInterval = 30000) => {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const data = await analyticsService.getMetrics();
        setMetrics(data);
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  return { metrics, loading };
};
```

---

## 4. User Preferences System

### 4.1 Overview
**Priority:** Low  
**Complexity:** Low  
**Impact:** Personalized user experience

Allow users to customize their experience with persistent preferences.

### 4.2 Features

#### Preference Categories
```javascript
interface UserPreferences {
  display: {
    theme: 'light' | 'dark' | 'system';
    density: 'compact' | 'regular' | 'comfortable';
    language: string;
  };
  
  tables: {
    defaultPageSize: number;
    defaultSortColumn: string;
    defaultSortDirection: 'ASC' | 'DESC';
    visibleColumns: string[];
  };
  
  notifications: {
    enabled: boolean;
    sound: boolean;
    desktop: boolean;
  };
  
  accessibility: {
    highContrast: boolean;
    reducedMotion: boolean;
    screenReaderOptimized: boolean;
  };
}
```

#### Preferences Manager
```javascript
const useUserPreferences = () => {
  const [preferences, setPreferences] = useState(() => {
    const stored = localStorage.getItem('user_preferences');
    return stored ? JSON.parse(stored) : DEFAULT_PREFERENCES;
  });

  const updatePreference = useCallback((category, key, value) => {
    setPreferences(prev => {
      const updated = {
        ...prev,
        [category]: {
          ...prev[category],
          [key]: value
        }
      };
      localStorage.setItem('user_preferences', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return { preferences, updatePreference };
};
```

---

## 5. Advanced Table Features

### 5.1 Column Customization

#### Features
- **Show/hide columns**
- **Reorder columns** via drag-and-drop
- **Resize columns**
- **Pin columns** (left/right)
- **Save column configuration**

#### Implementation
```javascript
const ColumnCustomizer = ({ columns, onUpdate }) => {
  const [visibleColumns, setVisibleColumns] = useState(columns);
  const [columnOrder, setColumnOrder] = useState(columns.map(c => c.key));

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(columnOrder);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setColumnOrder(items);
    onUpdate({ order: items });
  };

  return (
    <Modal
      open={isOpen}
      modalHeading="Customize Columns"
      primaryButtonText="Apply"
      secondaryButtonText="Reset"
      onRequestSubmit={() => onUpdate({ visible: visibleColumns, order: columnOrder })}
    >
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="columns">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {columnOrder.map((key, index) => {
                const column = columns.find(c => c.key === key);
                return (
                  <Draggable key={key} draggableId={key} index={index}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        {...provided.dragHandleProps}
                        className="column-item"
                      >
                        <Checkbox
                          id={`col-${key}`}
                          labelText={column.header}
                          checked={visibleColumns.includes(key)}
                          onChange={(checked) => {
                            setVisibleColumns(prev =>
                              checked
                                ? [...prev, key]
                                : prev.filter(k => k !== key)
                            );
                          }}
                        />
                        <DragHandle />
                      </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </Modal>
  );
};
```

---

## 6. Implementation Priority

### Phase 4A (High Priority)
1. ✅ Command Palette
2. ✅ Saved Filter Presets

### Phase 4B (Medium Priority)
3. Enhanced Data Visualization
4. Column Customization

### Phase 4C (Low Priority - Future)
5. User Preferences System
6. Advanced Export Options

---

## 7. Dependencies

### New Packages Required
```json
{
  "fuse.js": "^7.0.0",
  "react-beautiful-dnd": "^13.1.1",
  "@carbon/charts": "^1.16.0",
  "@carbon/charts-react": "^1.16.0"
}
```

---

## 8. Success Metrics

### Productivity Metrics
- **Command Palette Usage:** 40% of power users adopt within first month
- **Filter Presets:** Average 3 presets saved per active user
- **Time Savings:** 30% reduction in repetitive navigation tasks

### User Satisfaction
- **Feature Adoption:** 60% of users try new features within first week
- **User Feedback:** Positive sentiment on productivity improvements
- **Support Tickets:** Reduction in "how do I..." questions

---

## 9. Testing Requirements

### Functional Testing
- [ ] Command palette search accuracy
- [ ] Filter preset save/load/delete
- [ ] Chart data accuracy
- [ ] Column customization persistence
- [ ] Keyboard navigation in command palette

### Performance Testing
- [ ] Command palette search performance (< 50ms)
- [ ] Chart rendering performance (< 200ms)
- [ ] Filter preset loading (< 100ms)

### Accessibility Testing
- [ ] Command palette keyboard navigation
- [ ] Screen reader announcements
- [ ] Chart accessibility (data tables)
- [ ] High contrast mode support

---

## 10. Next Steps

1. Review and approve Phase 4 plan
2. Install required dependencies
3. Begin implementation with Phase 4A (Command Palette)
4. Conduct user testing and gather feedback
5. Iterate based on feedback
6. Plan Phase 5 (if needed)

---

**Planning Date:** April 2026  
**Status:** 📋 Ready for Implementation  
**Estimated Completion:** 2-3 weeks