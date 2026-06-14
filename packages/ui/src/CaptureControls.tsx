// Capture controls: a still-image button and a record/stop toggle. Presentational;
// the viewer supplies the canvas and capture handlers.

export interface CaptureControlsProps {
  readonly recording: boolean;
  readonly onCaptureStill: () => void;
  readonly onToggleRecording: () => void;
}

export function CaptureControls(props: CaptureControlsProps): JSX.Element {
  return (
    <div className="bessel-capture" role="group" aria-label="Capture">
      <button type="button" onClick={props.onCaptureStill} data-testid="capture-still">
        Capture image
      </button>
      <button
        type="button"
        onClick={props.onToggleRecording}
        aria-pressed={props.recording}
        data-testid="capture-record"
      >
        {props.recording ? 'Stop recording' : 'Record video'}
      </button>
    </div>
  );
}
