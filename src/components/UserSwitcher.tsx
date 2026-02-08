import React, { useState } from 'react';
import { Users, LogOut } from 'lucide-react';

interface UserSwitcherProps {
  onUserChange: (userId: string, userName: string) => void;
}

const UserSwitcher: React.FC<UserSwitcherProps> = ({ onUserChange }) => {
  const [currentUser, setCurrentUser] = useState<'user1' | 'user2'>('user1');

  const users = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      name: '我',
      key: 'user1' as const,
      color: 'from-blue-500 to-purple-600'
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      name: '测试好友',
      key: 'user2' as const,
      color: 'from-green-500 to-teal-600'
    }
  ];

  const handleSwitch = (userKey: 'user1' | 'user2') => {
    const user = users.find(u => u.key === userKey);
    if (user) {
      setCurrentUser(userKey);
      onUserChange(user.id, user.name);
      
      // 存储到 localStorage
      localStorage.setItem('current_user_id', user.id);
      localStorage.setItem('current_user_name', user.name);
      
      // 刷新页面以应用新用户
      window.location.reload();
    }
  };

  const activeUser = users.find(u => u.key === currentUser);

  return (
    <div className="fixed bottom-20 right-4 z-50">
      <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl rounded-2xl shadow-2xl p-4 border border-slate-200/50 dark:border-slate-700/50">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${activeUser?.color} flex items-center justify-center`}>
            <Users className="text-white" size={20} />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">当前用户</div>
            <div className="text-sm font-bold text-slate-800 dark:text-white">{activeUser?.name}</div>
          </div>
        </div>

        <div className="space-y-2">
          {users.map(user => (
            <button
              key={user.key}
              onClick={() => handleSwitch(user.key)}
              disabled={user.key === currentUser}
              className={`
                w-full px-3 py-2 rounded-lg text-sm font-medium transition-all
                flex items-center gap-2
                ${user.key === currentUser
                  ? `bg-gradient-to-r ${user.color} text-white shadow-lg`
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }
              `}
            >
              {user.key === currentUser && <LogOut size={14} className="rotate-180" />}
              <span>{user.name}</span>
            </button>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            💡 切换用户以测试双向消息
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSwitcher;
