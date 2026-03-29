import React, { useEffect, useState } from 'react';
import { ScenarioSelector } from './components/ScenarioPanel/ScenarioSelector.js';
import { VariableOverrides } from './components/ScenarioPanel/VariableOverrides.js';
import { ScoreDisplay } from './components/ScorePanel/ScoreDisplay.js';
import { GraphEditor } from './components/GraphEditor/GraphEditor.js';
import { EvalGraphEditor } from './components/EvalGraphEditor/EvalGraphEditor.js';
import { useAppStore } from './store/appStore.js';
import { useAuthStore } from './store/authStore.js';
import { Badge } from './components/ui/badge.js';
import { Button } from './components/ui/button.js';

export default function App(): React.ReactElement {
  const scoreBreakdown = useAppStore((s) => s.scoreBreakdown);
  const { user, isAuthenticated, isLoading, logout, fetchCurrentUser } = useAuthStore();
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showEvalEditor, setShowEvalEditor] = useState(false);

  useEffect(() => {
    fetchCurrentUser();
  }, [fetchCurrentUser]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    const success = await useAuthStore.getState().login(loginUsername, loginPassword);
    if (success) {
      setLoginUsername('');
      setLoginPassword('');
    } else {
      setLoginError('Invalid credentials');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2 border-b shadow-sm panel-transition bg-card">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shadow-sm">
            <span className="text-primary-foreground font-bold text-sm">TL</span>
          </div>
          <h1 className="text-base font-bold tracking-tight">TaxLawEvaluator</h1>
        </div>
        {scoreBreakdown && (
          <Badge variant={scoreBreakdown.totalScore >= 90 ? 'default' : 'secondary'} className="text-xs" data-testid="score-badge">
            Score: {scoreBreakdown.totalScore}
          </Badge>
        )}
        <div className="flex-1" />
        {isLoading ? (
          <span className="text-sm text-muted-foreground">Loading...</span>
        ) : isAuthenticated && user ? (
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{user.role === 'admin' ? 'Admin' : 'User'}</Badge>
            <span className="text-sm text-foreground">{user.username}</span>
            <Button size="sm" variant="ghost" type="button" onClick={() => void logout()} data-testid="logout-button">
              Logout
            </Button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Username"
              value={loginUsername}
              onChange={(e) => setLoginUsername(e.target.value)}
              data-testid="username-input"
              className="h-8 text-xs border rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-ring bg-secondary text-foreground placeholder:text-muted-foreground"
            />
            <input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              data-testid="password-input"
              className="h-8 text-xs border rounded-lg px-3 py-1 focus:outline-none focus:ring-2 focus:ring-ring bg-secondary text-foreground placeholder:text-muted-foreground"
            />
            <Button size="sm" type="submit" disabled={!loginUsername || !loginPassword} data-testid="login-button">
              Login
            </Button>
            {loginError && <span className="text-xs text-destructive" data-testid="login-error">{loginError}</span>}
          </form>
        )}
        {isAuthenticated && user?.role === 'admin' && (
          <Button size="sm" variant="outline" type="button" onClick={() => setShowEvalEditor(true)} data-testid="benchmark-editor-button">
            Benchmark Editor
          </Button>
        )}
      </header>

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Scenario Panel */}
        <aside className="w-64 flex-shrink-0 bg-card border-r p-4 overflow-y-auto panel-transition">
          <ScenarioSelector />
          <VariableOverrides />
        </aside>

        {/* Center: Node Graph Canvas */}
        <main className="flex-1 overflow-hidden p-3">
          <GraphEditor onOpenBenchmarkEditor={() => setShowEvalEditor(true)} />
        </main>

        {/* Right: Score Panel */}
        <aside className="w-72 flex-shrink-0 bg-card border-l p-4 overflow-y-auto panel-transition">
          <ScoreDisplay />
        </aside>
      </div>
      {showEvalEditor && <EvalGraphEditor open={true} onClose={() => setShowEvalEditor(false)} />}
    </div>
  );
}
