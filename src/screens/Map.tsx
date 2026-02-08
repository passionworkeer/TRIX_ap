import React, { useState } from 'react';
import { MapPin, Navigation, ZoomIn, ZoomOut, Search, Coffee, Utensils, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { IMAGES } from '../constants';

// POI Data (Mock points of interest)
interface POI {
  id: string;
  name: string;
  type: 'food' | 'cafe' | 'landmark';
  description: string;
  x: number;
  y: number;
  rating: number;
  image?: string;
}

const MOCK_POIS: POI[] = [
  { id: '1', name: 'Cyber Cafe', type: 'cafe', description: 'Best latte in the grid', x: 45, y: 35, rating: 4.8 },
  { id: '2', name: 'Neon Noodle Bar', type: 'food', description: 'Spicy ramen & energy drinks', x: 65, y: 55, rating: 4.5 },
  { id: '3', name: 'Virtual Plaza', type: 'landmark', description: 'Meeting point for explorers', x: 50, y: 50, rating: 5.0 },
  { id: '4', name: 'Pixel Burger', type: 'food', description: 'Quick bites, retro vibes', x: 30, y: 70, rating: 4.2 },
];

const MapScreen: React.FC = () => {
  const [selectedPOI, setSelectedPOI] = useState<POI | null>(null);

  return (
    <div className="relative h-screen flex flex-col bg-slate-100 dark:bg-slate-900 overflow-hidden font-sans">
      {/* Search Header */}
      <div className="absolute top-12 left-4 right-4 z-30">
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-1.5 rounded-full shadow-2xl border border-white/20 flex items-center gap-3 pr-2">
          <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
            <Search size={18} />
          </div>
          <input 
            type="text" 
            placeholder="Search location..." 
            className="flex-1 bg-transparent border-none outline-none text-sm dark:text-white placeholder:text-slate-400 font-medium"
          />
           <button className="w-9 h-9 rounded-full bg-slate-800 text-white flex items-center justify-center hover:bg-black transition-colors">
              <Navigation size={14} className="fill-current" />
           </button>
        </div>
      </div>

      {/* Map Content */}
      <div className="flex-1 relative overflow-hidden bg-[#e5e5e5] cursor-grab active:cursor-grabbing">
        
        {/* Map Image Layer */}
        <div className="absolute inset-0 w-full h-full">
            <img 
              src={IMAGES.MAP || "/assets/map.png"} 
              alt="Map Background" 
              className="w-full h-full object-cover select-none pointer-events-none scale-110"
            />
            {/* Overlay Gradient for depth */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-100/50 via-transparent to-slate-100/20 pointer-events-none mix-blend-multiply"></div>
        </div>
        
        {/* Interactive POI Markers */}
        {MOCK_POIS.map((poi) => (
          <motion.button
            key={poi.id}
            className="absolute z-20 group -translate-x-1/2 -translate-y-1/2 focus:outline-none"
            style={{ left: `${poi.x}%`, top: `${poi.y}%` }}
            whileHover={{ scale: 1.1, zIndex: 30 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedPOI(poi)}
          >
             <div className={`relative flex flex-col items-center transition-all duration-300 ${
                 selectedPOI?.id === poi.id ? 'scale-110' : 'scale-100'
             }`}>
                {/* Marker Pin */}
                <div className={`
                    w-12 h-12 rounded-full shadow-2xl flex items-center justify-center border-[3px] border-white transition-colors duration-300 relative z-10
                    ${selectedPOI?.id === poi.id 
                       ? 'bg-slate-800 text-white shadow-slate-900/40' 
                       : 'bg-white text-slate-700 shadow-slate-400/30 group-hover:bg-slate-50'
                    }
                `}>
                   {poi.type === 'food' && <Utensils size={20} />}
                   {poi.type === 'cafe' && <Coffee size={20} />}
                   {poi.type === 'landmark' && <MapPin size={20} />}
                </div>
                
                {/* Triangle Pointer */}
                <div className={`
                   w-4 h-4 rotate-45 transform -translate-y-2.5 rounded-sm border-r-[3px] border-b-[3px] border-white
                   ${selectedPOI?.id === poi.id ? 'bg-slate-800' : 'bg-white'}
                `}></div>

                {/* Pulse Ring (behind) */}
                 {selectedPOI?.id === poi.id && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[calc(50%+6px)] w-12 h-12 bg-slate-400/30 rounded-full animate-ping -z-10"></div>
                 )}
                
                {/* Simple Label (Hover Only) */}
                <div className="absolute top-full mt-1 bg-white/90 backdrop-blur px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-1 group-hover:translate-y-0 pointer-events-none whitespace-nowrap">
                   {poi.name}
                </div>
             </div>
          </motion.button>
        ))}

        {/* User Location User (Static) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 w-32 h-32 flex items-center justify-center">
             <div className="w-16 h-16 bg-blue-500/10 rounded-full animate-ping absolute"></div>
             <div className="w-4 h-4 bg-sky-500 rounded-full border-[3px] border-white shadow-lg relative z-20"></div>
             <div className="w-12 h-12 bg-gradient-to-t from-sky-500/20 to-transparent absolute transform rounded-full -bottom-1"></div>
        </div>

      </div>

      {/* POI Detail Card (Bottom Sheet) */}
      <AnimatePresence>
        {selectedPOI && (
          <motion.div 
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="absolute bottom-24 left-4 right-4 z-40"
          >
             <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-[32px] p-5 shadow-2xl border border-white/40 dark:border-white/10 relative overflow-hidden">
                
                {/* Close Button */}
                <button 
                  onClick={(e) => { e.stopPropagation(); setSelectedPOI(null); }}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center transition-colors text-slate-500"
                >
                   <X size={16} />
                </button>

                <div className="flex gap-5">
                   {/* Icon Box */}
                   <div className={`
                      w-20 h-20 rounded-[24px] flex items-center justify-center shrink-0
                      ${selectedPOI.type === 'food' ? 'bg-orange-100 text-orange-500' : ''}
                      ${selectedPOI.type === 'cafe' ? 'bg-amber-100 text-amber-600' : ''}
                      ${selectedPOI.type === 'landmark' ? 'bg-indigo-100 text-indigo-600' : ''}
                   `}>
                      {selectedPOI.type === 'food' && <Utensils size={32} />}
                      {selectedPOI.type === 'cafe' && <Coffee size={32} />}
                      {selectedPOI.type === 'landmark' && <MapPin size={32} />}
                   </div>

                   <div className="flex-1 min-w-0 pt-1">
                      <div className="flex justify-between items-start pr-8">
                         <div>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white leading-tight mb-1">{selectedPOI.name}</h3>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{selectedPOI.type} · 0.8km away</p>
                         </div>
                      </div>
                      
                      <p className="text-sm text-slate-600 dark:text-slate-300 mt-3 leading-relaxed line-clamp-2">
                         {selectedPOI.description}
                      </p>

                      <div className="flex items-center gap-3 mt-4">
                         <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-100">
                            <div className="text-[10px] grid grid-cols-5 gap-0.5">
                               {[1,2,3,4,5].map(star => (
                                 <div key={star} className={`w-1.5 h-1.5 rounded-full ${star <= Math.round(selectedPOI.rating) ? 'bg-yellow-400' : 'bg-slate-200'}`}></div>
                               ))}
                            </div>
                            <span className="text-xs font-bold text-yellow-700 ml-1">{selectedPOI.rating}</span>
                         </div>
                         <button className="flex-1 bg-black text-white text-xs font-bold py-2.5 rounded-xl shadow-lg shadow-slate-200/50 hover:bg-slate-800 transition-colors">
                            Navigate
                         </button>
                      </div>
                   </div>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Side Controls */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-30 pointer-events-none">
         <div className="pointer-events-auto flex flex-col gap-3">
            <button className="w-11 h-11 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl shadow-slate-200/50 border border-white/60 flex items-center justify-center text-slate-600 hover:text-cyan-600 hover:scale-105 transition-all">
               <ZoomIn size={20} />
            </button>
            <button className="w-11 h-11 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl shadow-slate-200/50 border border-white/60 flex items-center justify-center text-slate-600 hover:text-cyan-600 hover:scale-105 transition-all">
               <ZoomOut size={20} />
            </button>
         </div>
         
         <div className="h-8"></div>
         
         <div className="pointer-events-auto flex flex-col gap-3">
             <button className="w-11 h-11 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl shadow-slate-200/50 border border-white/60 flex items-center justify-center text-slate-600 hover:text-cyan-600 hover:scale-105 transition-all">
               <Navigation size={20} />
            </button>
             <button className="w-11 h-11 bg-white/90 backdrop-blur-md rounded-2xl shadow-xl shadow-slate-200/50 border border-white/60 flex items-center justify-center text-slate-600 hover:text-cyan-600 hover:scale-105 transition-all">
               <Info size={20} />
            </button>
         </div>
      </div>

    </div>
  );
};

export default MapScreen;
