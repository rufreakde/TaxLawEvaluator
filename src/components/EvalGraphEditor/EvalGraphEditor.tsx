import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore.js';
import { Button } from '../ui/button.js';
import { Badge } from '../ui/badge.js';

interface EvalGraphEditorProps {
  open: boolean;
  onClose: () => void;
}

export function EvalGraphEditor({ open, onClose }: EvalGraphEditorProps): React.ReactElement | null {
  const { taxConfigs } = useAppStore();
  const [name, setName] = useState('');
  const [taxConfigId, setTaxConfigId] = useState<number | ''>('');
  const [sinks, setSinks] = useState<Array<{ id: number; outputId: string; referenceRule: string; label: string }>>([]);
  const [nextId, setNextId] = useState(1);

  useEffect(() => {
    if (open) {
      // Reset state when opening
      setName('');
      setTaxConfigId('');
      setSinks([]);
      setNextId(1);
    }
  }, [open]);

  const handleAddSink = () => {
    setSinks([...sinks, { id: nextId, outputId: '', referenceRule: '', label: '' }]);
    setNextId(nextId + 1);
  };

  const handleRemoveSink = (id: number) => {
    setSinks(sinks.filter((s) => s.id !== id));
  };

  const handleSinkChange = (id: number, field: string, value: string) => {
    setSinks(sinks.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const handleSave = async () => {
    if (!name || !taxConfigId || sinks.length === 0) return;
    try {
      const response = await fetch('/api/v1/eval-graphs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name,
          tax_config_id: taxConfigId,
          nodes: sinks.map((s) => ({ outputId: s.outputId, referenceRule: s.referenceRule, label: s.label, x: 100, y: 100 + sinks.indexOf(s) * 120 })),
          links: [],
        }),
      });
      if (response.ok) {
        onClose();
      } else {
        alert('Failed to save eval graph');
      }
    } catch {
      alert('Error saving eval graph');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">Evaluation Benchmark Editor</h2>
          <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Benchmark Name</label>
            <input
              type="text"
              className="w-full border rounded p-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Target Score 2025"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tax Config</label>
            <select
              className="w-full border rounded p-2"
              value={taxConfigId}
              onChange={(e) => setTaxConfigId(e.target.value ? Number(e.target.value) : '')}
            >
              <option value="">Select tax config…</option>
              {taxConfigs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.region} — {t.schema_version} {t.is_template === 1 ? '(Template)' : '(Custom)'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium">Benchmark Sinks</label>
              <Button size="sm" variant="outline" onClick={handleAddSink}>+ Add Sink</Button>
            </div>
            {sinks.length === 0 && <p className="text-xs text-gray-500">No sinks defined. Add a sink to set a benchmark target.</p>}
            <div className="space-y-2">
              {sinks.map((sink) => (
                <div key={sink.id} className="border rounded p-2 flex items-center gap-2">
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Output ID"
                      className="border rounded px-2 py-1 text-sm"
                      value={sink.outputId}
                      onChange={(e) => handleSinkChange(sink.id, 'outputId', e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Reference Rule"
                      className="border rounded px-2 py-1 text-sm"
                      value={sink.referenceRule}
                      onChange={(e) => handleSinkChange(sink.id, 'referenceRule', e.target.value)}
                    />
                    <input
                      type="text"
                      placeholder="Label"
                      className="border rounded px-2 py-1 text-sm"
                      value={sink.label}
                      onChange={(e) => handleSinkChange(sink.id, 'label', e.target.value)}
                    />
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => handleRemoveSink(sink.id)} className="h-8 w-8 p-0">✕</Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={!name || !taxConfigId || sinks.length === 0}>
              Save Benchmark
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
