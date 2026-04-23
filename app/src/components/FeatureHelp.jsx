import React, { useState } from 'react';
import {
  Modal,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  StructuredListWrapper,
  StructuredListHead,
  StructuredListRow,
  StructuredListCell,
  StructuredListBody,
  Tag,
  Accordion,
  AccordionItem
} from '@carbon/react';
import {
  Keyboard,
  Search,
  Filter,
  ChartLine,
  CheckmarkOutline,
  Information
} from '@carbon/icons-react';

/**
 * FeatureHelp Component
 * Comprehensive documentation for all application features
 * Includes keyboard shortcuts, command palette, filters, and more
 */
const FeatureHelp = ({ open, onClose }) => {
  const [selectedTab, setSelectedTab] = useState(0);

  const keyboardShortcuts = [
    {
      category: 'Global',
      shortcuts: [
        { keys: ['Ctrl', 'K'], description: 'Open Command Palette', mac: ['⌘', 'K'] },
        { keys: ['Ctrl', 'Shift', 'K'], description: 'Open Keyboard Shortcuts Help', mac: ['⌘', '⇧', 'K'] },
        { keys: ['Ctrl', '/'], description: 'Toggle Sidebar', mac: ['⌘', '/'] },
        { keys: ['Esc'], description: 'Close Modals/Dialogs', mac: ['Esc'] }
      ]
    },
    {
      category: 'Build Management',
      shortcuts: [
        { keys: ['Ctrl', 'N'], description: 'Create New Build', mac: ['⌘', 'N'] },
        { keys: ['Ctrl', 'F'], description: 'Focus Search', mac: ['⌘', 'F'] },
        { keys: ['Ctrl', 'E'], description: 'Export Builds', mac: ['⌘', 'E'] },
        { keys: ['Ctrl', 'R'], description: 'Refresh Data', mac: ['⌘', 'R'] },
        { keys: ['Ctrl', 'A'], description: 'Select All Builds', mac: ['⌘', 'A'] }
      ]
    },
    {
      category: 'Navigation',
      shortcuts: [
        { keys: ['Ctrl', '1'], description: 'Go to Home', mac: ['⌘', '1'] },
        { keys: ['Ctrl', '2'], description: 'Go to Build Management', mac: ['⌘', '2'] },
        { keys: ['Ctrl', '3'], description: 'Go to User Management', mac: ['⌘', '3'] },
        { keys: ['Ctrl', '4'], description: 'Go to Analytics', mac: ['⌘', '4'] },
        { keys: ['Ctrl', '5'], description: 'Go to System Logs', mac: ['⌘', '5'] }
      ]
    }
  ];

  const commandPaletteFeatures = [
    {
      title: 'Quick Navigation',
      description: 'Jump to any page instantly by typing its name',
      examples: ['Type "builds" to go to Build Management', 'Type "users" to go to User Management']
    },
    {
      title: 'Quick Actions',
      description: 'Execute common actions without navigating',
      examples: ['Type "new build" to create a build', 'Type "export" to export data']
    },
    {
      title: 'Search History',
      description: 'Recently used commands appear at the top for quick access',
      examples: ['Your last 10 commands are saved', 'Clear history from settings']
    },
    {
      title: 'Fuzzy Search',
      description: 'Find commands even with partial or misspelled text',
      examples: ['Type "bld" to find "Build Management"', 'Type "usr" to find "User Management"']
    }
  ];

  const filterPresetFeatures = [
    {
      title: 'Save Custom Filters',
      description: 'Save your frequently used filter combinations for quick access',
      steps: [
        'Apply filters in Build Management',
        'Click "Save Preset" button',
        'Name your preset',
        'Access it anytime from the preset dropdown'
      ]
    },
    {
      title: 'Manage Presets',
      description: 'Edit, rename, or delete your saved filter presets',
      steps: [
        'Click "Manage Presets" button',
        'View all your saved presets',
        'Edit or delete as needed',
        'Presets are saved locally in your browser'
      ]
    },
    {
      title: 'Quick Apply',
      description: 'Apply saved presets with a single click',
      steps: [
        'Open preset dropdown',
        'Click on any preset name',
        'Filters are applied instantly',
        'Modify and save as new preset if needed'
      ]
    }
  ];

  const bulkActionsFeatures = [
    {
      action: 'Select Multiple Builds',
      description: 'Use checkboxes to select multiple builds at once',
      icon: <CheckmarkOutline size={20} />
    },
    {
      action: 'Bulk Export',
      description: 'Export multiple selected builds to JSON format',
      icon: <ChartLine size={20} />
    },
    {
      action: 'Bulk Status Update',
      description: 'Update status for multiple builds simultaneously (Admin only)',
      icon: <Information size={20} />
    },
    {
      action: 'Select All',
      description: 'Use Ctrl+A or "Select All" button to select all visible builds',
      icon: <CheckmarkOutline size={20} />
    }
  ];

  const advancedFilteringFeatures = [
    {
      filter: 'Status Filter',
      description: 'Filter builds by their current status',
      usage: 'Select one or multiple statuses from the dropdown'
    },
    {
      filter: 'Date Range Filter',
      description: 'Filter builds created within a specific date range',
      usage: 'Use the date picker to select start and end dates'
    },
    {
      filter: 'Creator Filter',
      description: 'Filter builds by the user who created them',
      usage: 'Select from the list of users'
    },
    {
      filter: 'Search',
      description: 'Search builds by name or description',
      usage: 'Type in the search box to filter results in real-time'
    },
    {
      filter: 'Combined Filters',
      description: 'Use multiple filters together for precise results',
      usage: 'All active filters work together (AND logic)'
    }
  ];

  const dataVisualizationFeatures = [
    {
      feature: 'Build Statistics Dashboard',
      description: 'View real-time statistics about your builds',
      details: [
        'Total builds count',
        'Active builds count',
        'Completed builds count',
        'Status distribution'
      ]
    },
    {
      feature: 'Status Distribution Chart',
      description: 'Visual representation of builds by status',
      details: [
        'Donut chart in Analytics page',
        'Color-coded by status',
        'Interactive tooltips',
        'Export as PNG/JPG/CSV'
      ]
    },
    {
      feature: 'User Role Distribution',
      description: 'Bar chart showing users by role',
      details: [
        'Grouped bar chart',
        'Shows role distribution',
        'Interactive and exportable'
      ]
    }
  ];

  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

  const renderKeyCombo = (keys, macKeys) => {
    const keysToRender = isMac && macKeys ? macKeys : keys;
    return (
      <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
        {keysToRender.map((key, index) => (
          <React.Fragment key={index}>
            <Tag type="gray" size="sm">{key}</Tag>
            {index < keysToRender.length - 1 && <span>+</span>}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onRequestClose={onClose}
      modalHeading="Feature Documentation & Help"
      passiveModal
      size="lg"
    >
      <Tabs selectedIndex={selectedTab} onChange={({ selectedIndex }) => setSelectedTab(selectedIndex)}>
        <TabList aria-label="Feature help tabs" contained>
          <Tab renderIcon={Keyboard}>Keyboard Shortcuts</Tab>
          <Tab renderIcon={Search}>Command Palette</Tab>
          <Tab renderIcon={Filter}>Filters & Presets</Tab>
          <Tab renderIcon={ChartLine}>Data Visualization</Tab>
          <Tab renderIcon={CheckmarkOutline}>Bulk Actions</Tab>
        </TabList>
        <TabPanels>
          {/* Keyboard Shortcuts Tab */}
          <TabPanel>
            <div style={{ padding: '1rem 0' }}>
              <p style={{ marginBottom: '1rem' }}>
                Use keyboard shortcuts to navigate and perform actions quickly. 
                {isMac ? ' Mac shortcuts are shown.' : ' Windows/Linux shortcuts are shown.'}
              </p>
              {keyboardShortcuts.map((category, idx) => (
                <div key={idx} style={{ marginBottom: '2rem' }}>
                  <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>
                    {category.category}
                  </h4>
                  <StructuredListWrapper>
                    <StructuredListHead>
                      <StructuredListRow head>
                        <StructuredListCell head>Shortcut</StructuredListCell>
                        <StructuredListCell head>Action</StructuredListCell>
                      </StructuredListRow>
                    </StructuredListHead>
                    <StructuredListBody>
                      {category.shortcuts.map((shortcut, sIdx) => (
                        <StructuredListRow key={sIdx}>
                          <StructuredListCell>
                            {renderKeyCombo(shortcut.keys, shortcut.mac)}
                          </StructuredListCell>
                          <StructuredListCell>{shortcut.description}</StructuredListCell>
                        </StructuredListRow>
                      ))}
                    </StructuredListBody>
                  </StructuredListWrapper>
                </div>
              ))}
            </div>
          </TabPanel>

          {/* Command Palette Tab */}
          <TabPanel>
            <div style={{ padding: '1rem 0' }}>
              <p style={{ marginBottom: '1rem' }}>
                The Command Palette (Ctrl+K or ⌘K) provides quick access to all application features.
              </p>
              <Accordion>
                {commandPaletteFeatures.map((feature, idx) => (
                  <AccordionItem key={idx} title={feature.title}>
                    <p style={{ marginBottom: '0.5rem' }}>{feature.description}</p>
                    <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
                      {feature.examples.map((example, eIdx) => (
                        <li key={eIdx} style={{ marginBottom: '0.25rem' }}>{example}</li>
                      ))}
                    </ul>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </TabPanel>

          {/* Filters & Presets Tab */}
          <TabPanel>
            <div style={{ padding: '1rem 0' }}>
              <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>
                Advanced Filtering
              </h4>
              <StructuredListWrapper style={{ marginBottom: '2rem' }}>
                <StructuredListHead>
                  <StructuredListRow head>
                    <StructuredListCell head>Filter Type</StructuredListCell>
                    <StructuredListCell head>Description</StructuredListCell>
                    <StructuredListCell head>Usage</StructuredListCell>
                  </StructuredListRow>
                </StructuredListHead>
                <StructuredListBody>
                  {advancedFilteringFeatures.map((filter, idx) => (
                    <StructuredListRow key={idx}>
                      <StructuredListCell><strong>{filter.filter}</strong></StructuredListCell>
                      <StructuredListCell>{filter.description}</StructuredListCell>
                      <StructuredListCell>{filter.usage}</StructuredListCell>
                    </StructuredListRow>
                  ))}
                </StructuredListBody>
              </StructuredListWrapper>

              <h4 style={{ marginBottom: '1rem', fontSize: '1rem', fontWeight: 600 }}>
                Filter Presets
              </h4>
              <Accordion>
                {filterPresetFeatures.map((feature, idx) => (
                  <AccordionItem key={idx} title={feature.title}>
                    <p style={{ marginBottom: '0.5rem' }}>{feature.description}</p>
                    <ol style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
                      {feature.steps.map((step, sIdx) => (
                        <li key={sIdx} style={{ marginBottom: '0.25rem' }}>{step}</li>
                      ))}
                    </ol>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </TabPanel>

          {/* Data Visualization Tab */}
          <TabPanel>
            <div style={{ padding: '1rem 0' }}>
              <p style={{ marginBottom: '1rem' }}>
                Visualize your data with interactive charts and statistics dashboards.
              </p>
              <Accordion>
                {dataVisualizationFeatures.map((feature, idx) => (
                  <AccordionItem key={idx} title={feature.feature}>
                    <p style={{ marginBottom: '0.5rem' }}>{feature.description}</p>
                    <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
                      {feature.details.map((detail, dIdx) => (
                        <li key={dIdx} style={{ marginBottom: '0.25rem' }}>{detail}</li>
                      ))}
                    </ul>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </TabPanel>

          {/* Bulk Actions Tab */}
          <TabPanel>
            <div style={{ padding: '1rem 0' }}>
              <p style={{ marginBottom: '1rem' }}>
                Perform actions on multiple builds at once to save time and improve efficiency.
              </p>
              <StructuredListWrapper>
                <StructuredListHead>
                  <StructuredListRow head>
                    <StructuredListCell head style={{ width: '3rem' }}></StructuredListCell>
                    <StructuredListCell head>Action</StructuredListCell>
                    <StructuredListCell head>Description</StructuredListCell>
                  </StructuredListRow>
                </StructuredListHead>
                <StructuredListBody>
                  {bulkActionsFeatures.map((feature, idx) => (
                    <StructuredListRow key={idx}>
                      <StructuredListCell>{feature.icon}</StructuredListCell>
                      <StructuredListCell><strong>{feature.action}</strong></StructuredListCell>
                      <StructuredListCell>{feature.description}</StructuredListCell>
                    </StructuredListRow>
                  ))}
                </StructuredListBody>
              </StructuredListWrapper>
            </div>
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Modal>
  );
};

export default FeatureHelp;
