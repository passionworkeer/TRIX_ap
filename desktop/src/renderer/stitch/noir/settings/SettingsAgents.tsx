import { DarkCard } from '../components/DarkCard';
import { DarkButton } from '../components/DarkButton';
import type { SettingsSharedState } from './SettingsContainer';

export function SettingsAgents(props: SettingsSharedState) {
  const { runCommand, runningCommand } = props;

  return (
    <div style={{ maxWidth: 720 }}>
      <DarkCard elevation="low">
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1', marginBottom: 12 }}>
          Agent 管理
        </div>
        <p style={{ fontSize: 12, color: '#919191', marginBottom: 14 }}>
          查看和切换 AI Agent/模型
        </p>
        <DarkButton
          label="列出 Agents"
          onClick={() => runCommand('agents list', 'Agent 列表')}
          variant="outline"
          size="md"
          disabled={runningCommand}
        />
      </DarkCard>
    </div>
  );
}
