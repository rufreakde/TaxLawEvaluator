import { render, screen, fireEvent } from '@testing-library/react';
import { ZoomControls } from './ZoomControls';
import { createEngine } from '@projectstorm/react-diagrams';

describe('ZoomControls', () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine({ registerDefaultZoomCanvasAction: false });
  });

  it('renders initial zoom at 100%', () => {
    engine.getModel().setZoomLevel(100);
    render(<ZoomControls engine={engine} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('renders custom zoom level', () => {
    engine.getModel().setZoomLevel(150);
    render(<ZoomControls engine={engine} />);
    expect(screen.getByText('150%')).toBeInTheDocument();
  });

  it('zooms in by 10% when + button is clicked', () => {
    engine.getModel().setZoomLevel(100);
    render(<ZoomControls engine={engine} />);
    fireEvent.click(screen.getByTitle('Zoom in'));
    expect(engine.getModel().getZoomLevel()).toBe(110);
  });

  it('zooms out by 10% when - button is clicked', () => {
    engine.getModel().setZoomLevel(100);
    render(<ZoomControls engine={engine} />);
    fireEvent.click(screen.getByTitle('Zoom out'));
    expect(engine.getModel().getZoomLevel()).toBe(90);
  });

  it('resets to 100% when reset button is clicked', () => {
    engine.getModel().setZoomLevel(150);
    render(<ZoomControls engine={engine} />);
    fireEvent.click(screen.getByTitle('Reset to 100%'));
    expect(engine.getModel().getZoomLevel()).toBe(100);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('disables zoom in button at max zoom (200%)', () => {
    engine.getModel().setZoomLevel(200);
    render(<ZoomControls engine={engine} />);
    expect(screen.getByTitle('Zoom in')).toBeDisabled();
  });

  it('disables zoom out button at min zoom (20%)', () => {
    engine.getModel().setZoomLevel(20);
    render(<ZoomControls engine={engine} />);
    expect(screen.getByTitle('Zoom out')).toBeDisabled();
  });

  it('disables reset button when at 100%', () => {
    engine.getModel().setZoomLevel(100);
    render(<ZoomControls engine={engine} />);
    expect(screen.getByTitle('Reset to 100%')).toBeDisabled();
  });

  it('does not zoom above 200%', () => {
    engine.getModel().setZoomLevel(195);
    render(<ZoomControls engine={engine} />);
    fireEvent.click(screen.getByTitle('Zoom in'));
    expect(engine.getModel().getZoomLevel()).toBe(200);
  });

  it('does not zoom below 20%', () => {
    engine.getModel().setZoomLevel(25);
    render(<ZoomControls engine={engine} />);
    fireEvent.click(screen.getByTitle('Zoom out'));
    expect(engine.getModel().getZoomLevel()).toBe(20);
  });

  it('calls engine.repaintCanvas after zoom in', () => {
    engine.getModel().setZoomLevel(1.0);
    const repaintSpy = jest.spyOn(engine, 'repaintCanvas');
    render(<ZoomControls engine={engine} />);
    fireEvent.click(screen.getByTitle('Zoom in'));
    expect(repaintSpy).toHaveBeenCalled();
    repaintSpy.mockRestore();
  });

  it('calls engine.repaintCanvas after zoom out', () => {
    engine.getModel().setZoomLevel(1.0);
    const repaintSpy = jest.spyOn(engine, 'repaintCanvas');
    render(<ZoomControls engine={engine} />);
    fireEvent.click(screen.getByTitle('Zoom out'));
    expect(repaintSpy).toHaveBeenCalled();
    repaintSpy.mockRestore();
  });

  it('calls engine.repaintCanvas after reset', () => {
    engine.getModel().setZoomLevel(1.5);
    const repaintSpy = jest.spyOn(engine, 'repaintCanvas');
    render(<ZoomControls engine={engine} />);
    fireEvent.click(screen.getByTitle('Reset to 100%'));
    expect(repaintSpy).toHaveBeenCalled();
    repaintSpy.mockRestore();
  });
});
