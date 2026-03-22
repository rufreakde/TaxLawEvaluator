import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/appStore.js';
import { Button } from '../ui/button.js';
import { Badge } from '../ui/badge.js';
import {
  Select,
  SelectContent,
 SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select.js';
import { Card } from '../ui/card.js';
import { Plus, Trash2, Target, Save, X } from 'lucide-react';

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
    <div className="fixed inset-0 bg-background flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl rounded-xl">
        <div className="sticky top-0 bg-card border-b p-4 flex justify-between items-center z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
              <Target className="w-4 h-4 text-[hsl(var(--accent))]" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Evaluation Benchmark Editor</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <span className="w-1 h-4 rounded-full bg-[hsl(var(--primary))]" />
                Benchmark Name
              </label>
              <input
                type="text"
                className="w-full h-10 text-sm border border-border rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground placeholder:text-muted-foreground/50"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Target Score 2025"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <span className="w-1 h-4 rounded-full bg-[hsl(var(--primary))]" />
                Tax Configuration
              </label>
              <Select value={taxConfigId} onValueChange={(v) => setTaxConfigId(v ? Number(v) : '')}>
                <SelectTrigger className="h-10 border-border bg-background">
                  <SelectValue placeholder="Select tax config…" />
                </SelectTrigger>
                <SelectContent>
                  {taxConfigs.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)} className="text-sm">
                      <div className="flex items-center gap-2">
                        <span>{t.region}</span>
                        <span className="text-xs text-muted-foreground">({t.schema_version})</span>
                        {t.is_template === 1 && (
                          <Badge variant="secondary" className="text-[10px] h-4">Template</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Sinks */}
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <span className="w-1 h-4 rounded-full bg-[hsl(var(--primary))]" />
                  Benchmark Sinks
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Define output metrics and their target values
                </p>
              </div>
              <Button size="sm" onClick={handleAddSink} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Add Sink
              </Button>
            </div>

            {sinks.length === 0 ? (
              <div className="py-8 px-4 border-2 border-dashed border-border rounded-lg text-center">
                <p className="text-sm text-muted-foreground">No sinks defined yet. Add a sink to set benchmark targets for your evaluation.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sinks.map((sink, index) => (
                  <div
                    key={sink.id}
                    className="group border border-border rounded-lg p-3 bg-card hover:bg-muted transition-all"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="outline" className="gap-1 text-xs">
                        <span className="font-mono text-[hsl(var(--accent))]">#{index + 1}</span>
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveSink(sink.id)}
                        className="h-7 w-7 p-0 ml-auto text-muted-foreground hover:text-destructive hover:bg-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Output ID</label>
                        <input
                          type="text"
                          placeholder="e.g. state_income"
                          className="w-full h-9 text-sm border border-border rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground placeholder:text-muted-foreground/50"
                          value={sink.outputId}
                          onChange={(e) => handleSinkChange(sink.id, 'outputId', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Reference Rule</label>
                        <input
                          type="text"
                          placeholder="e.g. total_tax"
                          className="w-full h-9 text-sm border border-border rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground placeholder:text-muted-foreground/50"
                          value={sink.referenceRule}
                          onChange={(e) => handleSinkChange(sink.id, 'referenceRule', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Label</label>
                        <input
                          type="text"
                          placeholder="e.g. Total Revenue"
                          className="w-full h-9 text-sm border border-border rounded-lg px-2 focus:outline-none focus:ring-2 focus:ring-ring bg-background text-foreground placeholder:text-muted-foreground/50"
                          value={sink.label}
                          onChange={(e) => handleSinkChange(sink.id, 'label', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" onClick={onClose} className="min-w-[100px]">
              <X className="w-4 h-4 mr-1.5" />
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!name || !taxConfigId || sinks.length === 0}
              className="min-w-[120px] gap-1.5"
            >
              <Save className="w-4 h-4" />
              Save Benchmark
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
