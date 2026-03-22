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
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-2 bg-white border-b shadow-sm">
        <h1 className="text-base font-bold tracking-tight">TaxLawEvaluator</h1>
        {scoreBreakdown && (
          <Badge variant={scoreBreakdown.totalScore >= 90 ? 'default' : 'secondary'}>
            Score: {scoreBreakdown.totalScore}
          </Badge>
        )}
        <div className="flex-1" />
        {isLoading ? (
          <span className="text-sm text-gray-500">Loading...</span>
        ) : isAuthenticated && user ? (
          <div className="flex items-center gap-2">
            <Badge variant="outline">{user.role === 'admin' ? 'Admin' : 'User'}</Badge>
            <span className="text-sm text-gray-700">{user.username}</span>
            <Button size="sm" variant="ghost" onClick={() => void logout()}>
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
              className="h-8 text-xs border rounded px-2 w-24 focus:outline-none focus:ring-1"
            />
            <input
              type="password"
              placeholder="Password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              className="h-8 text-xs border rounded px-2 w-24 focus:outline-none focus:ring-1"
            />
            <Button size="sm" type="submit" disabled={!loginUsername || !loginPassword}>
              Login
            </Button>
            {loginError && <span className="text-xs text-red-500">{loginError}</span>}
          </form>
        )}
        {isAuthenticated && user?.role === 'admin' && (
          <Button size="sm" variant="outline" onClick={() => setShowEvalEditor(true)}>
            Benchmark Editor
          </Button>
        )}
      </header>

      {/* Three-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Scenario Panel */}
        <aside className="w-64 flex-shrink-0 bg-white border-r p-4 overflow-y-auto">
          <ScenarioSelector />
          <VariableOverrides />
        </aside>

        {/* Center: Node Graph Canvas */}
        <main className="flex-1 overflow-hidden p-2">
          <GraphEditor />
        </main>

        {/* Right: Score Panel */}
        <aside className="w-72 flex-shrink-0 bg-white border-l p-4 overflow-y-auto">
          <ScoreDisplay />
        </aside>
      </div>
      {showEvalEditor && <EvalGraphEditor open={true} onClose={() => setShowEvalEditor(false)} />}
    </div>
  );
}
