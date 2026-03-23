import { DarkCard } from '../components/DarkCard';
import { DarkButton } from '../components/DarkButton';
import type { SettingsSharedState } from './SettingsContainer';

export function SettingsBackups(props: SettingsSharedState) {
  const { runCommand, runningCommand } = props;

  return (
    <div style={{ maxWidth: 720 }}>
      <DarkCard elevation="low">
        <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1', marginBottom: 12 }}>
          配置备份与回滚
        </div>
        <p style={{ fontSize: 12, color: '#919191', marginBottom: 14 }}>
          管理配置备份，恢复到之前的版本
        </p>
        <DarkButton
          label="列出备份"
          onClick={() => runCommand('backup list', '备份列表')}
          variant="outline"
          size="md"
          disabled={runningCommand}
        />
      </DarkCard>
    </div>
  );
}
