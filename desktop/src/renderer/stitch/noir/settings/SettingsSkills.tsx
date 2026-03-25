import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, Download, Trash2, CheckCircle, XCircle, Zap, RefreshCw, Globe, AlertTriangle } from 'lucide-react';
import { DarkCard } from '../components/DarkCard';
import { DarkButton } from '../components/DarkButton';
import type { SettingsSharedState } from './SettingsContainer';
import type { SkillInfo, ClawHubSkill } from '../../../../types/electron';

const CATEGORIES = ['全部', 'AI', 'Developer', 'Writing', 'Platform', 'Media', 'Database', 'Special', 'Feishu'];

// Infer category from source / name keywords
function inferCategory(skill: SkillInfo): string {
  const src = skill.source || '';
  const name = skill.name.toLowerCase();
  const desc = skill.description.toLowerCase();
  if (src.includes('feishu') || name.startsWith('feishu')) return 'Feishu';
  if (/\b(agent|ai|gpt|claude|llm|agentic)\b/.test(name + desc)) return 'AI';
  if (/\b(github|git|code|dev|coding|api|docker|k8s|sql|db|sql)\b/.test(name + desc)) return 'Developer';
  if (/\b(write|author|blog|content|文案|写作)\b/.test(name + desc)) return 'Writing';
  if (/\b(media|video|audio|ffmpeg|subtitle|caption|clip)\b/.test(name + desc)) return 'Media';
  if (/\b(ppt|doc|docx|xlsx|excel|word|pdf|markdown|convert)\b/.test(name + desc)) return 'Developer';
  if (/\b(evomap|wxoffice|clawhub)\b/.test(name + desc)) return 'Platform';
  if (/\b(redis|postgres|prisma|sql|db)\b/.test(name + desc)) return 'Database';
  return 'Developer';
}

const CAT_COLORS: Record<string, string> = {
  AI: '#7c6af7', Developer: '#2563eb', Writing: '#16a34a',
  Platform: '#db2777', Media: '#ea580c', Database: '#0891b2', Feishu: '#4ade80', Special: '#9333ea',
};

export function SettingsSkills(_props: SettingsSharedState) {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('全部');
  const [installing, setInstalling] = useState<string | null>(null);
  const [uninstalling, setUninstalling] = useState<string | null>(null);
  const [installErrors, setInstallErrors] = useState<Record<string, string>>({});
  const [installSuccess, setInstallSuccess] = useState<Record<string, string>>({});
  const [browsing, setBrowsing] = useState(false);
  const [searchResults, setSearchResults] = useState<ClawHubSkill[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    try {
      const api = window.electronAPI;
      if (!api?.skillsListFull) {
        setSkills([]);
        return;
      }
      const result = await api.skillsListFull();
      if (result.success && result.data) {
        setSkills(result.data);
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSkills(); }, [loadSkills]);

  // Debounced search
  const handleSearchChange = useCallback((val: string) => {
    setSearchQuery(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!val.trim()) {
      setSearchResults([]);
      setSearchError(null);
      return;
    }
    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      const api = window.electronAPI;
      if (!api?.skillsSearch) { setSearchLoading(false); return; }
      const result = await api.skillsSearch(val);
      setSearchLoading(false);
      if (result.success) {
        setSearchResults(result.data ?? []);
        setSearchError(null);
      } else {
        setSearchError(result.error ?? '搜索失败');
        setSearchResults([]);
      }
    }, 600);
  }, []);

  // Refresh after install/uninstall
  const refresh = useCallback(async () => {
    await loadSkills();
    // Also clear install feedback
    setInstalling(null);
    setUninstalling(null);
  }, [loadSkills]);

  const handleInstall = useCallback(async (slug: string) => {
    setInstalling(slug);
    setInstallErrors(prev => { const n = { ...prev }; delete n[slug]; return n; });
    try {
      const api = window.electronAPI;
      if (!api?.skillsClawhubInstall) throw new Error('API 不可用');
      const result = await api.skillsClawhubInstall(slug);
      if (result.success) {
        setInstallSuccess(prev => ({ ...prev, [slug]: '安装成功' }));
        setTimeout(() => setInstallSuccess(prev => { const n = { ...prev }; delete n[slug]; return n; }), 3000);
        await refresh();
      } else {
        const err = result.stderr || '安装失败';
        setInstallErrors(prev => ({ ...prev, [slug]: err }));
      }
    } catch (err) {
      setInstallErrors(prev => ({ ...prev, [slug]: String(err) }));
    } finally {
      setInstalling(null);
    }
  }, [refresh]);

  const handleUninstall = useCallback(async (slug: string) => {
    setUninstalling(slug);
    try {
      const api = window.electronAPI;
      if (!api?.uninstallSkill) throw new Error('API 不可用');
      const result = await api.uninstallSkill(slug);
      if (result.success) {
        await refresh();
      }
    } catch { /* ignore */ } finally {
      setUninstalling(null);
    }
  }, [refresh]);

  const browseRemote = useCallback(async () => {
    setBrowsing(true);
    setSearchResults([]);
    setSearchError(null);
    const api = window.electronAPI;
    if (api?.skillsExplore) {
      const result = await api.skillsExplore();
      if (result.success) {
        setSearchResults(result.data ?? []);
      } else {
        setSearchError(result.error ?? '获取市场数据失败');
      }
    }
    setBrowsing(false);
  }, []);

  const filtered = useMemo(() => {
    return skills.filter(s => {
      const cat = inferCategory(s);
      const matchCat = category === '全部' || cat === category;
      const matchSearch = !search.trim() ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [skills, category, search]);

  const installedCount = skills.filter(s => s.installed).length;
  const readyCount = skills.filter(s => !s.missing && !s.bundled).length;

  if (loading) return <div style={{ color: '#919191', fontSize: 13 }}>加载中...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 880 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e5e2e1' }}>
            Skills Marketplace
          </div>
          <div style={{ fontSize: 12, color: '#919191', marginTop: 2 }}>
            {installedCount} 个已安装 · {readyCount} 个可用
          </div>
        </div>
        <DarkButton
          label="刷新"
          icon={<RefreshCw size={11} />}
          onClick={loadSkills}
          variant="ghost"
          size="sm"
          disabled={loading}
        />
      </div>

      {/* Search */}
      <div style={{ position: 'relative', flex: 1 }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#555', pointerEvents: 'none' }} />
        <input
          value={searchQuery}
          onChange={e => { setSearch(e.target.value); handleSearchChange(e.target.value); }}
          placeholder="搜索 skills，或按 Enter 从 ClawHub 搜索..."
          style={{
            width: '100%', paddingLeft: 32, background: '#0e0e0e',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
            padding: '7px 10px 7px 32px', color: '#e5e2e1', fontSize: 13,
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Remote search results or local browse */}
      {searchQuery.trim() ? (
        <div>
          <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>
            {searchLoading ? '正在搜索 ClawHub...' : `ClawHub 搜索结果 (${searchResults.length})`}
          </div>
          {searchError ? (
            <div style={{ color: '#ff6b6b', fontSize: 12 }}>{searchError}</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {searchResults.map(skill => (
                <RemoteSkillCard
                  key={skill.slug}
                  skill={skill}
                  onInstall={() => handleInstall(skill.slug)}
                  installing={installing === skill.slug}
                  installed={skills.some(s => s.name === skill.slug)}
                  error={installErrors[skill.slug]}
                  success={installSuccess[skill.slug]}
                />
              ))}
              {searchResults.length === 0 && !searchLoading && (
                <div style={{ color: '#555', fontSize: 12, gridColumn: '1/-1', textAlign: 'center', padding: '20px 0' }}>
                  未找到相关 skills
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Category Filter */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CATEGORIES.map(cat => (
              <div
                key={cat}
                onClick={() => setCategory(cat)}
                style={{
                  padding: '4px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  background: category === cat ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                  color: category === cat ? '#e5e2e1' : '#919191',
                  border: `1px solid ${category === cat ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  transition: 'all 0.15s',
                }}
              >
                {cat}
              </div>
            ))}
          </div>

          <div style={{ fontSize: 12, color: '#555' }}>
            共 {filtered.length} 个 skill
          </div>

          {/* Browse remote section */}
          {!browsing && searchResults.length === 0 && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <DarkButton
                label="浏览 ClawHub 市场"
                icon={<Globe size={11} />}
                onClick={browseRemote}
                variant="outline"
                size="sm"
              />
              <span style={{ fontSize: 11, color: '#555' }}>探索社区共享的 Skills</span>
            </div>
          )}
          {browsing && <div style={{ color: '#919191', fontSize: 12 }}>正在获取 ClawHub 市场...</div>}

          {/* Skill Cards Grid */}
          {filtered.length === 0 ? (
            <DarkCard elevation="low">
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#555', fontSize: 13 }}>
                未找到匹配的 skills
              </div>
            </DarkCard>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {filtered.map(skill => (
                <SkillCard
                  key={skill.name}
                  skill={skill}
                  category={inferCategory(skill)}
                  onInstall={() => handleInstall(skill.name)}
                  onUninstall={() => handleUninstall(skill.name)}
                  installing={installing === skill.name}
                  uninstalling={uninstalling === skill.name}
                  error={installErrors[skill.name]}
                  success={installSuccess[skill.name]}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Local skill card ─────────────────────────────────────────────────────────

interface SkillCardProps {
  skill: SkillInfo;
  category: string;
  onInstall: () => void;
  onUninstall: () => void;
  installing: boolean;
  uninstalling: boolean;
  error?: string;
  success?: string;
}

function SkillCard({ skill, category, onInstall, onUninstall, installing, uninstalling, error, success }: SkillCardProps) {
  const catColor = CAT_COLORS[category] || '#919191';

  return (
    <div style={{
      background: '#1c1b1b', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14,
      padding: 16, display: 'flex', flexDirection: 'column', gap: 10, transition: 'all 0.15s',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: `${catColor}18`,
          border: `1px solid ${catColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Zap size={16} color={catColor} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e2e1' }}>{skill.name}</div>
          <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
            <span style={{
              padding: '2px 8px', borderRadius: 999, background: `${catColor}12`,
              border: `1px solid ${catColor}25`, fontSize: 10, color: catColor,
            }}>
              {category}
            </span>
            {skill.missing && (
              <span style={{
                padding: '2px 8px', borderRadius: 999, background: 'rgba(234,88,12,0.12)',
                border: '1px solid rgba(234,88,12,0.25)', fontSize: 10, color: '#ea580c',
              }}>
                缺依赖
              </span>
            )}
            {skill.bundled && (
              <span style={{
                padding: '2px 8px', borderRadius: 999, background: 'rgba(100,116,139,0.12)',
                border: '1px solid rgba(100,116,139,0.25)', fontSize: 10, color: '#64748b',
              }}>
                内置
              </span>
            )}
          </div>
        </div>
        <div style={{ flexShrink: 0 }}>
          {skill.installed && !skill.missing
            ? <CheckCircle size={18} color="#4ade80" />
            : <XCircle size={18} color={skill.missing ? '#ea580c' : '#555'} />
          }
        </div>
      </div>

      {/* Description */}
      <div style={{ fontSize: 12, color: '#919191', lineHeight: 1.5 }}>
        {skill.description || '暂无描述'}
      </div>

      {/* Source badge */}
      <div style={{ fontSize: 10, color: '#555' }}>
        来源: {skill.source}
      </div>

      {/* Error */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#ff6b6b' }}>
          <AlertTriangle size={11} />
          {error}
        </div>
      )}
      {success && (
        <div style={{ fontSize: 11, color: '#4ade80' }}>{success}</div>
      )}

      {/* Action */}
      <div>
        {skill.bundled ? (
          <span style={{ fontSize: 11, color: '#555' }}>内置 Skill，不可卸载</span>
        ) : skill.installed ? (
          <DarkButton
            label="卸载"
            icon={<Trash2 size={11} />}
            onClick={onUninstall}
            variant="ghost"
            size="sm"
            disabled={uninstalling}
            loading={uninstalling}
          />
        ) : (
          <DarkButton
            label={skill.missing ? '安装（缺依赖）' : '安装'}
            icon={<Download size={11} />}
            onClick={onInstall}
            variant="primary"
            size="sm"
            disabled={installing}
            loading={installing}
          />
        )}
      </div>
    </div>
  );
}

// ── Remote (ClawHub search) skill card ───────────────────────────────────────

interface RemoteSkillCardProps {
  skill: ClawHubSkill;
  onInstall: () => void;
  installing: boolean;
  installed: boolean;
  error?: string;
  success?: string;
}

function RemoteSkillCard({ skill, onInstall, installing, installed, error, success }: RemoteSkillCardProps) {
  return (
    <div style={{
      background: '#1c1b1b', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14,
      padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, background: 'rgba(100,116,139,0.12)',
          border: '1px solid rgba(100,116,139,0.2)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexShrink: 0,
        }}>
          <Globe size={16} color="#64748b" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e2e1' }}>{skill.name}</div>
          <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>{skill.slug}</div>
        </div>
        {installed && <CheckCircle size={18} color="#4ade80" />}
      </div>
      {skill.description && (
        <div style={{ fontSize: 12, color: '#919191', lineHeight: 1.5 }}>{skill.description}</div>
      )}
      {skill.score !== undefined && (
        <div style={{ fontSize: 10, color: '#555' }}>匹配度: {skill.score.toFixed(2)}</div>
      )}
      {error && <div style={{ fontSize: 11, color: '#ff6b6b' }}>{error}</div>}
      {success && <div style={{ fontSize: 11, color: '#4ade80' }}>{success}</div>}
      {installed ? (
        <span style={{ fontSize: 11, color: '#4ade80' }}>已安装</span>
      ) : (
        <DarkButton
          label="安装"
          icon={<Download size={11} />}
          onClick={onInstall}
          variant="primary"
          size="sm"
          disabled={installing}
          loading={installing}
        />
      )}
    </div>
  );
}
