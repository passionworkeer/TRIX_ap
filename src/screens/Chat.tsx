import React from 'react';
import { Search, UserPlus, Camera, MessageSquare, Square, Send, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { IMAGES } from '../constants';
import { motion } from 'framer-motion';
import Avatar from '../components/Avatar';
import { AppRoutes } from '../types';

// Mock Data for Quick Add
const QUICK_ADD_USERS = [
  { id: 'qa1', name: 'Sarah Miller', username: 'sarah_m', avatar: '' },
  { id: 'qa2', name: 'Mike Chen', username: 'mike_c99', avatar: '' },
  { id: 'qa3', name: 'Jenny Wilson', username: 'j_wilson', avatar: '' },
  { id: 'qa4', name: 'Tom Hardy', username: 'tomh_official', avatar: '' },
  { id: 'qa5', name: 'Lisa Wang', username: 'lisa_wang', avatar: '' },
];

// Mock Data for Chats
const CHATS = [
  {
    id: 'clawbot',
    name: 'TRIX Bot',
    avatar: IMAGES.WIZARD_BOY,
    status: { type: 'chat', text: 'Tap to chat', time: ' 1m', color: 'text-blue-500', fill: true },
    showCamera: true
  },
  {
    id: 'elara',
    name: 'Alice Cooper',
    avatar: IMAGES.FRIEND_1,
    status: { type: 'snap', text: 'New Snap', time: ' 2m', color: 'text-red-500', fill: true },
    showCamera: false
  },
  {
    id: 'kael',
    name: 'Bob Smith',
    avatar: IMAGES.FRIEND_2,
    status: { type: 'received', text: 'Received', time: ' 2h', color: 'text-purple-500', fill: false },
    showCamera: true
  },
  {
    id: 'ghost',
    name: 'Carol Danvers',
    avatar: IMAGES.FRIEND_3,
    status: { type: 'opened', text: 'Opened', time: ' 4h', color: 'text-gray-400', fill: false },
    showCamera: true
  },
  {
    id: 'david',
    name: 'David Lee',
    avatar: '',
    status: { type: 'sent', text: 'Sent', time: ' 5h', color: 'text-gray-400', fill: false },
    showCamera: true
  },
  {
    id: 'emma',
    name: 'Emma Watson',
    avatar: '',
    status: { type: 'screenshot', text: 'Screenshot!', time: ' 1d', color: 'text-red-500', fill: false },
    showCamera: true
  },
  {
    id: 'frank',
    name: 'Frank Ocean',
    avatar: '',
    status: { type: 'chat', text: 'Tap to chat', time: ' 1d', color: 'text-blue-500', fill: true },
    showCamera: true
  },
  {
    id: 'grace',
    name: 'Grace Hopper',
    avatar: '',
    status: { type: 'snap', text: 'New Snap', time: ' 2d', color: 'text-red-500', fill: true },
    showCamera: true
  },
  {
    id: 'harry',
    name: 'Harry Potter',
    avatar: '',
    status: { type: 'received', text: 'Received', time: ' 3d', color: 'text-purple-500', fill: false },
    showCamera: true
  }
];

const StatusIcon = ({ type, color, fill }: { type: string, color: string, fill: boolean }) => {
  const iconClass = `${color} ${fill ? 'fill-current' : ''}`;
  
  switch(type) {
    case 'chat':
      return <MessageSquare size={14} className={iconClass} strokeWidth={2.5} />;
    case 'snap':
      return <Square size={14} className={iconClass} strokeWidth={0} />;
    case 'received':
      return <Square size={14} className={`${color} fill-none border-2 border-current rounded-[2px]`} strokeWidth={2.5} />;
    case 'opened':
      return <Square size={14} className={`${color} border-2 border-current rounded-[2px]`} strokeWidth={2.5} />; // Hollow square
    case 'sent':
      return <Send size={14} className={iconClass} strokeWidth={2.5} />;
    case 'screenshot':
      return <RotateCcw size={14} className={iconClass} strokeWidth={2.5} />;
    default:
      return <Square size={14} className={iconClass} />;
  }
};

const Chat: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className='h-screen w-full bg-white flex flex-col relative'>
       {/* 1. Header */}
       <header className='px-4 py-3 bg-white flex justify-between items-center sticky top-0 z-10 w-full'>
          {/* Left: Avatar (Small Profile) */}
          <div className='w-10 h-10 rounded-full bg-gray-200 overflow-hidden shadow-sm' onClick={() => navigate('/profile')}>
             <Avatar name='Me' size='md' className='w-full h-full object-cover' />
          </div>

          {/* Center: Title */}
          <h1 className='text-xl font-bold text-black tracking-wide font-sans'>Chat</h1>

          {/* Right: Actions */}
          <div className='flex items-center gap-4'>
             <div className='w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer'>
                <UserPlus size={20} className='text-gray-800' strokeWidth={2.5} />
             </div>
             <div className='w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors cursor-pointer'>
                <Search size={22} className='text-gray-800' strokeWidth={2.5} />
             </div>
          </div>
       </header>

       {/* Scrollable Content */}
       <div className='flex-1 overflow-y-auto w-full no-scrollbar'>
          
          {/* 2. Quick Add Section */}
          <div className='py-4 bg-white border-b border-gray-100'>
             <div className='px-4 mb-2'>
                <h3 className='text-[13px] font-bold text-gray-900 uppercase tracking-wide'>Quick Add</h3>
             </div>
             <div className='flex overflow-x-auto px-4 pb-2 gap-3 no-scrollbar snap-x'>
                {QUICK_ADD_USERS.map((user) => (
                  <div key={user.id} className='min-w-[130px] p-3 bg-white rounded-lg border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] flex flex-col items-center relative snap-start'>
                     <button className='absolute top-1 right-1 text-gray-300 hover:text-gray-500 p-1'>
                        <span className='sr-only'>Dismiss</span>
                        <svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><line x1='18' y1='6' x2='6' y2='18'></line><line x1='6' y1='6' x2='18' y2='18'></line></svg>
                     </button>
                     <div className='mb-2'>
                        <Avatar name={user.name} size='md' />
                     </div>
                     <span className='text-[13px] font-bold text-black truncate w-full text-center leading-tight'>{user.name}</span>
                     <span className='text-[11px] text-gray-400 truncate w-full text-center mb-3 leading-tight'>{user.username}</span>
                     <button className='w-full py-1 bg-gray-100 hover:bg-gray-200 rounded-full text-[12px] font-bold text-black transition-colors'>
                        + Add
                     </button>
                  </div>
                ))}
             </div>
          </div>

          {/* 3. Chat List */}
          <div className='flex flex-col w-full'>
            {CHATS.map((chat) => (
               <motion.div 
                 key={chat.id}
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 className='flex items-center px-4 py-3 w-full hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer'
                 onClick={() => {
                   if (chat.id === 'clawbot') {
                     navigate(AppRoutes.CHAT_DETAIL, { 
                        state: { 
                          name: chat.name, 
                          avatar: chat.avatar, 
                          isBot: true, 
                          friendId: chat.id 
                        } 
                     });
                   } else {
                     navigate(AppRoutes.CHAT_DETAIL, { 
                        state: { 
                          name: chat.name, 
                          avatar: chat.avatar, 
                          isBot: false, 
                          friendId: chat.id 
                        } 
                     });
                   }
                 }}
               >
                  {/* Left: Huge Avatar */}
                  <div className='relative mr-3 flex-shrink-0'>
                     <Avatar name={chat.name} avatar={chat.avatar} size='lg' className='w-[52px] h-[52px]' />
                  </div>

                  {/* Middle: Name & Status */}
                  <div className='flex-1 min-w-0 pr-2'>
                     <h3 className='text-[16px] font-bold text-gray-900 leading-tight mb-0.5 truncate font-sans'>
                        {chat.name}
                     </h3>
                     <div className='flex items-center gap-1.5'>
                        <StatusIcon type={chat.status.type} color={chat.status.color} fill={chat.status.fill} />
                        <span className={`text-[13px] font-medium truncate ${chat.status.type.includes('snap') || chat.status.type === 'chat' ? chat.status.color : 'text-gray-400'}`}>
                           {chat.status.text} <span className='text-gray-300 mx-0.5'>•</span> <span className='text-gray-400'>{chat.status.time}</span>
                        </span>
                     </div>
                  </div>

                  {/* Right: Camera or Time */}
                  <div className='flex-shrink-0 pl-2 border-l border-transparent'>
                     {chat.showCamera ? (
                        <div className='w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-100 transition-colors'>
                            <Camera size={20} className='text-gray-400' />
                        </div>
                     ) : (
                        <div className='px-2'>
                        </div>
                     )}
                  </div>
               </motion.div>
            ))}
          </div>
       </div>
    </div>
  );
};

export default Chat;
