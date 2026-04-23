import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Dropdown,
  Modal,
  TextInput,
  TextArea,
  Stack,
  OverflowMenu,
  OverflowMenuItem,
  Tag
} from '@carbon/react';
import { Save, TrashCan, Edit } from '@carbon/icons-react';

/**
 * Filter Preset Manager Component
 * Allows users to save, load, edit, and delete filter presets
 */
const FilterPresetManager = ({ 
  currentFilters, 
  onApplyPreset,
  storageKey = 'filter_presets'
}) => {
  const [presets, setPresets] = useState([]);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');
  const [nameError, setNameError] = useState('');

  // Load presets from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPresets(Array.isArray(parsed) ? parsed : []);
      } catch (e) {
        console.error('Failed to parse filter presets:', e);
        setPresets([]);
      }
    }
  }, [storageKey]);

  // Save presets to localStorage whenever they change
  const savePresetsToStorage = useCallback((updatedPresets) => {
    localStorage.setItem(storageKey, JSON.stringify(updatedPresets));
    setPresets(updatedPresets);
  }, [storageKey]);

  // Validate preset name
  const validatePresetName = useCallback((name) => {
    if (!name.trim()) {
      return 'Preset name is required';
    }
    if (name.length < 3) {
      return 'Preset name must be at least 3 characters';
    }
    if (name.length > 50) {
      return 'Preset name must be less than 50 characters';
    }
    // Check for duplicate names (excluding current preset when editing)
    const isDuplicate = presets.some(p => 
      p.name.toLowerCase() === name.toLowerCase() && 
      (!selectedPreset || p.id !== selectedPreset.id)
    );
    if (isDuplicate) {
      return 'A preset with this name already exists';
    }
    return '';
  }, [presets, selectedPreset]);

  // Generate unique ID
  const generateId = () => {
    return `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Open save modal
  const handleOpenSaveModal = useCallback(() => {
    setPresetName('');
    setPresetDescription('');
    setNameError('');
    setSaveModalOpen(true);
  }, []);

  // Save new preset
  const handleSavePreset = useCallback(() => {
    const error = validatePresetName(presetName);
    if (error) {
      setNameError(error);
      return;
    }

    const newPreset = {
      id: generateId(),
      name: presetName.trim(),
      description: presetDescription.trim(),
      filters: currentFilters,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updatedPresets = [...presets, newPreset];
    savePresetsToStorage(updatedPresets);
    
    setSaveModalOpen(false);
    setPresetName('');
    setPresetDescription('');
    setNameError('');
  }, [presetName, presetDescription, currentFilters, presets, validatePresetName, savePresetsToStorage]);

  // Load preset
  const handleLoadPreset = useCallback((preset) => {
    if (preset && onApplyPreset) {
      onApplyPreset(preset.filters);
    }
  }, [onApplyPreset]);

  // Open edit modal
  const handleOpenEditModal = useCallback((preset) => {
    setSelectedPreset(preset);
    setPresetName(preset.name);
    setPresetDescription(preset.description || '');
    setNameError('');
    setEditModalOpen(true);
  }, []);

  // Update preset
  const handleUpdatePreset = useCallback(() => {
    const error = validatePresetName(presetName);
    if (error) {
      setNameError(error);
      return;
    }

    const updatedPresets = presets.map(p => 
      p.id === selectedPreset.id
        ? {
            ...p,
            name: presetName.trim(),
            description: presetDescription.trim(),
            updatedAt: new Date().toISOString()
          }
        : p
    );

    savePresetsToStorage(updatedPresets);
    
    setEditModalOpen(false);
    setSelectedPreset(null);
    setPresetName('');
    setPresetDescription('');
    setNameError('');
  }, [presetName, presetDescription, selectedPreset, presets, validatePresetName, savePresetsToStorage]);

  // Open delete modal
  const handleOpenDeleteModal = useCallback((preset) => {
    setSelectedPreset(preset);
    setDeleteModalOpen(true);
  }, []);

  // Delete preset
  const handleDeletePreset = useCallback(() => {
    const updatedPresets = presets.filter(p => p.id !== selectedPreset.id);
    savePresetsToStorage(updatedPresets);
    
    setDeleteModalOpen(false);
    setSelectedPreset(null);
  }, [selectedPreset, presets, savePresetsToStorage]);

  // Get filter summary
  const getFilterSummary = useCallback((filters) => {
    const parts = [];
    
    if (filters.selectedStatuses?.length > 0) {
      parts.push(`${filters.selectedStatuses.length} status(es)`);
    }
    if (filters.selectedCreator) {
      parts.push('Creator filter');
    }
    if (filters.dateRangePreset || (filters.customDateRange?.start || filters.customDateRange?.end)) {
      parts.push('Date range');
    }
    
    return parts.length > 0 ? parts.join(', ') : 'No filters';
  }, []);

  return (
    <div className="filter-preset-manager">
      <div className="filter-preset-manager__controls">
        <Dropdown
          id="preset-selector"
          titleText="Saved Filters"
          label={presets.length > 0 ? "Select a preset" : "No saved presets"}
          items={presets}
          itemToString={item => item?.name || ''}
          onChange={({ selectedItem }) => selectedItem && handleLoadPreset(selectedItem)}
          size="sm"
          disabled={presets.length === 0}
        />
        
        <Button
          kind="ghost"
          size="sm"
          renderIcon={Save}
          onClick={handleOpenSaveModal}
          iconDescription="Save current filters as preset"
        >
          Save Filters
        </Button>
      </div>

      {presets.length > 0 && (
        <div className="filter-preset-manager__list">
          {presets.map(preset => (
            <div key={preset.id} className="filter-preset-item">
              <div className="filter-preset-item__content">
                <button
                  className="filter-preset-item__button"
                  onClick={() => handleLoadPreset(preset)}
                  type="button"
                >
                  <span className="filter-preset-item__name">{preset.name}</span>
                  {preset.description && (
                    <span className="filter-preset-item__description">{preset.description}</span>
                  )}
                  <span className="filter-preset-item__summary">
                    {getFilterSummary(preset.filters)}
                  </span>
                </button>
              </div>
              <OverflowMenu size="sm" flipped>
                <OverflowMenuItem
                  itemText="Edit"
                  onClick={() => handleOpenEditModal(preset)}
                />
                <OverflowMenuItem
                  itemText="Delete"
                  isDelete
                  onClick={() => handleOpenDeleteModal(preset)}
                />
              </OverflowMenu>
            </div>
          ))}
        </div>
      )}

      {/* Save Preset Modal */}
      <Modal
        open={saveModalOpen}
        modalHeading="Save Filter Preset"
        modalLabel="Filter Presets"
        primaryButtonText="Save"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleSavePreset}
        onRequestClose={() => {
          setSaveModalOpen(false);
          setPresetName('');
          setPresetDescription('');
          setNameError('');
        }}
        size="sm"
        primaryButtonDisabled={!presetName.trim() || !!nameError}
      >
        <Stack gap={5}>
          <TextInput
            id="preset-name"
            labelText="Preset Name *"
            placeholder="e.g., Active Builds This Week"
            value={presetName}
            onChange={(e) => {
              setPresetName(e.target.value);
              if (nameError) {
                setNameError(validatePresetName(e.target.value));
              }
            }}
            onBlur={() => setNameError(validatePresetName(presetName))}
            invalid={!!nameError}
            invalidText={nameError}
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
            <h5 className="preset-preview__title">Current Filters:</h5>
            <p className="preset-preview__summary">{getFilterSummary(currentFilters)}</p>
          </div>
        </Stack>
      </Modal>

      {/* Edit Preset Modal */}
      <Modal
        open={editModalOpen}
        modalHeading="Edit Filter Preset"
        modalLabel="Filter Presets"
        primaryButtonText="Update"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleUpdatePreset}
        onRequestClose={() => {
          setEditModalOpen(false);
          setSelectedPreset(null);
          setPresetName('');
          setPresetDescription('');
          setNameError('');
        }}
        size="sm"
        primaryButtonDisabled={!presetName.trim() || !!nameError}
      >
        <Stack gap={5}>
          <TextInput
            id="edit-preset-name"
            labelText="Preset Name *"
            value={presetName}
            onChange={(e) => {
              setPresetName(e.target.value);
              if (nameError) {
                setNameError(validatePresetName(e.target.value));
              }
            }}
            onBlur={() => setNameError(validatePresetName(presetName))}
            invalid={!!nameError}
            invalidText={nameError}
            required
          />
          <TextArea
            id="edit-preset-description"
            labelText="Description (optional)"
            value={presetDescription}
            onChange={(e) => setPresetDescription(e.target.value)}
            rows={3}
          />
        </Stack>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteModalOpen}
        danger
        modalHeading="Delete Filter Preset"
        modalLabel="Filter Presets"
        primaryButtonText="Delete"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleDeletePreset}
        onRequestClose={() => {
          setDeleteModalOpen(false);
          setSelectedPreset(null);
        }}
        size="sm"
      >
        <p>
          Are you sure you want to delete the preset <strong>"{selectedPreset?.name}"</strong>?
        </p>
        <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#525252' }}>
          This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

export default FilterPresetManager;
