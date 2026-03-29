import React, { useEffect, useState } from 'react';
import type { DiagramEngine } from '@projectstorm/react-diagrams';
import { Button } from '../ui/button.js';
import { Minus, Plus, RotateCcw } from 'lucide-react';

interface ZoomControlsProps {
  engine: DiagramEngine;
}

const MIN_ZOOM = 20;    // 20%
const MAX_ZOOM = 200;   // 200%
const ZOOM_STEP = 10;   // 10%

export function ZoomControls({ engine }: ZoomControlsProps): React.ReactElement {
  const [zoomLevel, setZoomLevel] = useState(() =>
    engine.getModel().getZoomLevel()
  );

  // Keep zoom level in sync with engine (in case of external changes)
  useEffect(() => {
    const model = engine.getModel();
    const interval = setInterval(() => {
      const currentZoom = model.getZoomLevel();
      if (Math.abs(currentZoom - zoomLevel) > 0.001) {
        setZoomLevel(currentZoom);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [engine, zoomLevel]);

  const handleZoomIn = (): void => {
    const model = engine.getModel();
    const newZoom = Math.min(MAX_ZOOM, zoomLevel + ZOOM_STEP);
    model.setZoomLevel(newZoom);
    setZoomLevel(newZoom);
    engine.repaintCanvas();
  };

  const handleZoomOut = (): void => {
    const model = engine.getModel();
    const newZoom = Math.max(MIN_ZOOM, zoomLevel - ZOOM_STEP);
    model.setZoomLevel(newZoom);
    setZoomLevel(newZoom);
    engine.repaintCanvas();
  };

  const handleReset = (): void => {
    const model = engine.getModel();
    model.setZoomLevel(100);
    setZoomLevel(100);
    engine.repaintCanvas();
  };

  const canZoomIn = zoomLevel < MAX_ZOOM;
  const canZoomOut = zoomLevel > MIN_ZOOM;

  return (
    <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-card border border-border rounded-lg shadow-md p-1.5" data-testid="zoom-controls">
      <Button
        size="icon"
        variant="ghost"
        onClick={handleZoomOut}
        disabled={!canZoomOut}
        className="h-8 w-8"
        title="Zoom out"
        data-testid="zoom-out-button"
      >
        <Minus size={16} />
      </Button>

      <span className="text-sm font-mono w-12 text-center text-foreground" data-testid="zoom-level-display">
        {Math.round(zoomLevel)}%
      </span>

      <Button
        size="icon"
        variant="ghost"
        onClick={handleZoomIn}
        disabled={!canZoomIn}
        className="h-8 w-8"
        title="Zoom in"
        data-testid="zoom-in-button"
      >
        <Plus size={16} />
      </Button>

      <div className="w-px h-6 bg-border mx-1" />

      <Button
        size="icon"
        variant="ghost"
        onClick={handleReset}
        disabled={zoomLevel === 100}
        className="h-8 w-8"
        title="Reset to 100%"
        data-testid="zoom-reset-button"
      >
        <RotateCcw size={16} />
      </Button>
    </div>
  );
}
