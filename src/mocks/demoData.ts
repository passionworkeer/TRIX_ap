import type { Session, User } from '@supabase/supabase-js';
import { IMAGES } from '../constants';
import type { Profile, FriendLatestMessage } from '../config/supabase';
import type { MallItem, PointsBalance } from '../types/mall';
import type { UserStats } from '../services/userStatsService';

export const DEMO_AUTH_STORAGE_KEY = 'trix_demo_auth';
export const DEMO_PROFILE_STORAGE_KEY = 'trix_demo_profile';
export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';
export const DEMO_EMAIL = 'demo@trix.app';

export interface DemoPointTransaction {
  id: string;
  created_at: string;
  transaction_type: string;
  points_change: number;
  description: string;
  balance_after: number;
}

export interface DemoChatMessage {
  id: string;
  sender: 'user' | 'friend';
  text: string;
  createdAt: string;
}

export interface DemoRecommendedUser {
  id: string;
  username: string;
  display_name: string;
  email: string;
  bio: string | null;
}

const createDemoProfile = (): Profile => ({
  id: DEMO_USER_ID,
  username: 'TRIX Demo',
  email: DEMO_EMAIL,
  full_name: 'TRIX Demo User',
  display_name: 'TRIX Demo',
  avatar_url: IMAGES.WIZARD_BOY_LOGIN,
  bio: 'Offline-friendly MVP account with mock social data.',
  points: 268,
  days_active: 12,
  interaction_count: 48,
  total_study_time: 540,
  current_streak: 6,
  is_studying: true,
  last_active_at: new Date().toISOString(),
  created_at: '2026-03-01T09:00:00.000Z',
  updated_at: new Date().toISOString(),
});

function normalizeDemoProfile(profile: Profile): Profile {
  const baseProfile = createDemoProfile();

  return {
    ...baseProfile,
    ...profile,
    id: DEMO_USER_ID,
    email: DEMO_EMAIL,
    username: profile.username ?? baseProfile.username,
    full_name: profile.full_name ?? baseProfile.full_name,
    display_name: profile.display_name ?? baseProfile.display_name,
    avatar_url: profile.avatar_url ?? baseProfile.avatar_url,
    bio: profile.bio ?? baseProfile.bio,
    last_active_at: profile.last_active_at ?? baseProfile.last_active_at,
    created_at: profile.created_at ?? baseProfile.created_at,
    updated_at: profile.updated_at ?? baseProfile.updated_at,
  };
}

export const buildDemoUser = (): User => ({
  id: DEMO_USER_ID,
  email: DEMO_EMAIL,
  aud: 'authenticated',
  created_at: '2026-03-01T09:00:00.000Z',
  app_metadata: {
    provider: 'email',
    providers: ['email'],
  },
  user_metadata: {
    username: 'TRIX Demo',
    full_name: 'TRIX Demo User',
  },
});

export const buildDemoSession = (): Session => ({
  access_token: 'demo-access-token',
  refresh_token: 'demo-refresh-token',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  token_type: 'bearer',
  user: buildDemoUser(),
});

export function isDemoModeEnabled(): boolean {
  return localStorage.getItem(DEMO_AUTH_STORAGE_KEY) === 'true';
}

export function setDemoModeEnabled(enabled: boolean): void {
  if (enabled) {
    localStorage.setItem(DEMO_AUTH_STORAGE_KEY, 'true');
    return;
  }

  localStorage.removeItem(DEMO_AUTH_STORAGE_KEY);
  localStorage.removeItem(DEMO_PROFILE_STORAGE_KEY);
}

export function getDemoProfile(): Profile {
  const raw = localStorage.getItem(DEMO_PROFILE_STORAGE_KEY);
  if (!raw) {
    const profile = createDemoProfile();
    localStorage.setItem(DEMO_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    return profile;
  }

  try {
    const parsedProfile = JSON.parse(raw) as Profile;
    const normalizedProfile = normalizeDemoProfile(parsedProfile);

    if (JSON.stringify(parsedProfile) !== JSON.stringify(normalizedProfile)) {
      localStorage.setItem(DEMO_PROFILE_STORAGE_KEY, JSON.stringify(normalizedProfile));
    }

    return normalizedProfile;
  } catch {
    const profile = createDemoProfile();
    localStorage.setItem(DEMO_PROFILE_STORAGE_KEY, JSON.stringify(profile));
    return profile;
  }
}

export function updateDemoProfile(partial: Partial<Profile>): Profile {
  const nextProfile = {
    ...getDemoProfile(),
    ...partial,
    updated_at: new Date().toISOString(),
  } satisfies Profile;

  localStorage.setItem(DEMO_PROFILE_STORAGE_KEY, JSON.stringify(nextProfile));
  return nextProfile;
}

export const demoFriends: FriendLatestMessage[] = [
  {
    user_id: DEMO_USER_ID,
    friend_id: '00000000-0000-4000-8000-000000000101',
    name: 'Ava',
    avatar_url: IMAGES.WIZARD_BOY_LOGIN,
    status: 'online',
    bio: 'Reviewing networking notes and keeping the streak alive.',
    study_time: 95,
    is_studying: true,
    unread_count: 2,
    last_message: 'Want to review the API flow together tonight?',
    last_message_time: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
  },
  {
    user_id: DEMO_USER_ID,
    friend_id: '00000000-0000-4000-8000-000000000102',
    name: 'Leo',
    avatar_url: IMAGES.AVATAR_GIRL,
    status: 'away',
    bio: 'Shipping the campus map MVP before midnight.',
    study_time: 160,
    is_studying: false,
    unread_count: 0,
    last_message: 'The mock route data looks much better now.',
    last_message_time: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
  },
  {
    user_id: DEMO_USER_ID,
    friend_id: '00000000-0000-4000-8000-000000000103',
    name: 'Mia',
    avatar_url: IMAGES.FRIEND_2,
    status: 'busy',
    bio: 'Pomodoro mode on. Ping me after 9 PM.',
    study_time: 220,
    is_studying: true,
    unread_count: 1,
    last_message: 'I left some wardrobe ideas in the board.',
    last_message_time: new Date(Date.now() - 76 * 60 * 1000).toISOString(),
  },
];

export const demoRecommendedUsers: DemoRecommendedUser[] = [
  {
    id: '00000000-0000-4000-8000-000000000201',
    username: 'Nova',
    display_name: 'Nova Chen',
    email: 'nova@trix.app',
    bio: 'Designs cozy study rooms and pretty charts.',
  },
  {
    id: '00000000-0000-4000-8000-000000000202',
    username: 'Kai',
    display_name: 'Kai Zhou',
    email: 'kai@trix.app',
    bio: 'Frontend engineer, map nerd, and coffee addict.',
  },
  {
    id: '00000000-0000-4000-8000-000000000203',
    username: 'Rin',
    display_name: 'Rin Li',
    email: 'rin@trix.app',
    bio: 'Helps convert product ideas into MVP stories.',
  },
];

export const demoMallItems: MallItem[] = [
  {
    id: 'demo-item-hoodie',
    name: 'Aurora Hoodie',
    description: 'A soft gradient hoodie for late-night study sessions.',
    image: IMAGES.CLOTHES_CAPE,
    price: 88,
    category: 'clothing',
    isOwned: false,
  },
  {
    id: 'demo-item-cap',
    name: 'Focus Cap',
    description: 'A lightweight cap that gives the avatar a sharper look.',
    image: IMAGES.CLOTHES_HAT,
    price: 46,
    category: 'accessory',
    isOwned: true,
  },
  {
    id: 'demo-item-wand',
    name: 'Study Wand',
    description: 'A playful prop for the TRIX companion showcase.',
    image: IMAGES.CLOTHES_WAND,
    price: 120,
    category: 'prop',
    isOwned: false,
  },
];

export const demoPointsBalance: PointsBalance = {
  userId: DEMO_USER_ID,
  balance: 268,
  totalEarned: 420,
  totalSpent: 152,
  updatedAt: new Date().toISOString(),
};

export const demoUserStats: UserStats = {
  daysActive: 12,
  totalPoints: 268,
  interactions: 48,
  level: 3,
  nextLevelPoints: 500,
  pointsToNextLevel: 232,
};

export const demoPointTransactions: DemoPointTransaction[] = [
  {
    id: 'demo-tx-1',
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    transaction_type: 'study_complete',
    points_change: 24,
    description: 'Completed a 90-minute focus session.',
    balance_after: 268,
  },
  {
    id: 'demo-tx-2',
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    transaction_type: 'daily_login',
    points_change: 8,
    description: 'Daily check-in reward.',
    balance_after: 244,
  },
  {
    id: 'demo-tx-3',
    created_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    transaction_type: 'redeem',
    points_change: -46,
    description: 'Redeemed the Focus Cap in the mall.',
    balance_after: 236,
  },
];

export const demoChatMessagesByFriendId: Record<string, DemoChatMessage[]> = {
  '00000000-0000-4000-8000-000000000101': [
    {
      id: 'demo-msg-ava-1',
      sender: 'friend',
      text: 'I tuned the onboarding copy. Want to review the MVP flow once more?',
      createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    },
    {
      id: 'demo-msg-ava-2',
      sender: 'user',
      text: 'Yes, let’s make sure the demo path works without backend login.',
      createdAt: new Date(Date.now() - 41 * 60 * 1000).toISOString(),
    },
  ],
  '00000000-0000-4000-8000-000000000102': [
    {
      id: 'demo-msg-leo-1',
      sender: 'friend',
      text: 'SnapMap is topped up with mock friends now. It feels alive.',
      createdAt: new Date(Date.now() - 80 * 60 * 1000).toISOString(),
    },
  ],
  '00000000-0000-4000-8000-000000000103': [
    {
      id: 'demo-msg-mia-1',
      sender: 'friend',
      text: 'The points mall should support a fake purchase flow for the pitch.',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    },
  ],
};

export function createDemoReply(friendId: string, messageText: string): DemoChatMessage {
  const normalized = messageText.trim().toLowerCase();
  const content = normalized.includes('demo')
    ? 'Looks good. The demo route is stable and the mocks feel believable.'
    : normalized.includes('map')
      ? 'I can also help fill the map with a few more hotspots if you want.'
      : normalized.includes('mall')
        ? 'Nice, that purchase interaction will make the showcase feel real.'
        : 'Got it. I will keep polishing the MVP with you.';

  return {
    id: `demo-reply-${friendId}-${Date.now()}`,
    sender: 'friend',
    text: content,
    createdAt: new Date().toISOString(),
  };
}
