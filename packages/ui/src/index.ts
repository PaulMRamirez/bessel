// @bessel/ui: React components, panels, and controls. Phase 0 ships the minimal
// timeline and camera controls; Phase 1 and 2 add the object browser, settings,
// readouts, keyboard shortcuts, timeline annotations, and capture controls.

export { TimelineControls, type TimelineControlsProps } from './TimelineControls.tsx';
export { ViewControls, type ViewControlsProps } from './ViewControls.tsx';
export { ReadoutPanel, type ReadoutPanelProps, type Readouts } from './ReadoutPanel.tsx';
export {
  SettingsPanel,
  type SettingsPanelProps,
  type VisualizationSettings,
  type SettingKey,
} from './SettingsPanel.tsx';
export { ObjectBrowser, type ObjectBrowserProps, type CatalogEntry } from './ObjectBrowser.tsx';
export { KeyboardHelp, type KeyboardHelpProps } from './KeyboardHelp.tsx';
export { useKeyboardShortcuts } from './useKeyboardShortcuts.ts';
export {
  KEYMAP,
  resolveAction,
  isEditableTarget,
  type KeyboardAction,
  type KeyBinding,
} from './keymap.ts';
export { CaptureControls, type CaptureControlsProps } from './CaptureControls.tsx';
export {
  captureStill,
  startRecording,
  downloadBlob,
  CaptureError,
  type Recorder,
} from './capture.ts';
