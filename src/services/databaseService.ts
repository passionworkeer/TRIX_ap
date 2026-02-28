// Re-export ClawbotHistoryMessage type for backward compatibility
export type { ClawbotHistoryMessage } from './clawbotHistoryService';

// Re-export friend service functions for backward compatibility
export {
  getNotificationDisplayContent,
  addFriend,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  getFriends,
  getFriendById,
  updateFriendStatus,
  updateFriendStudyStatus,
} from './friendService';

// Re-export chat service functions for backward compatibility
export {
  getChatHistory,
  sendMessage,
  sendMessageWithMedia,
  markMessagesAsRead,
  clearChatHistory,
  getUnreadCounts,
  getTotalUnreadCount,
  subscribeToChatMessages,
  subscribeToUnreadCounts,
} from './chatService';

// Re-export notification service functions for backward compatibility
export {
  getNotifications,
  markNotificationAsRead,
  deleteNotification,
  getUnreadNotificationCount,
  subscribeToNotifications,
  getMails,
  markMailAsRead,
  deleteMail,
  getUnreadMailCount,
} from './notificationService';

// Re-export study session service functions for backward compatibility
export {
  getStudySessions,
  createStudySession,
  getTodayStudyTime,
} from './studySessionService';
