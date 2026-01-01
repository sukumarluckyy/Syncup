import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, Users, ArrowRight } from 'lucide-react';
import { generateRoomId } from '../utils';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [joinId, setJoinId] = useState('');

  const handleCreateRoom = () => {
    const newRoomId = generateRoomId();
    navigate(`/room/${newRoomId}?role=host`);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinId.trim()) {
      navigate(`/room/${joinId.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-16 sm:py-24 flex flex-col items-center text-center">
      <div className="mb-8 relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-full blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
        <div className="relative bg-zinc-900 p-4 rounded-full border border-zinc-800 shadow-2xl">
          <Play size={48} className="text-indigo-500 fill-indigo-500 ml-1" />
        </div>
      </div>
      
      <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6">
        Listen together,<br /> 
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">
          no matter the distance.
        </span>
      </h1>
      
      <p className="max-w-2xl text-lg sm:text-xl text-zinc-400 mb-10 leading-relaxed">
        Create a room, share the link, and watch YouTube videos in perfect sync with your friends. 
        Real-time playback control for everyone to enjoy the beat at the same time.
      </p>

      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-lg">
        {/* Create Room */}
        <button
          onClick={handleCreateRoom}
          className="flex-1 group relative flex items-center justify-center gap-3 bg-white text-zinc-950 font-bold py-4 px-8 rounded-xl hover:bg-zinc-200 transition-all active:scale-95"
        >
          <Play size={20} className="fill-current" />
          <span>Start a Party</span>
          <span className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <ArrowRight size={16} />
          </span>
        </button>

        <div className="flex items-center justify-center text-zinc-600 font-medium">or</div>

        {/* Join Room Form */}
        <form onSubmit={handleJoinRoom} className="flex-1 relative group">
           <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
          <div className="relative flex bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden focus-within:border-indigo-500 transition-colors">
            <input
              type="text"
              placeholder="Enter Room Code"
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              className="flex-1 bg-transparent px-4 py-4 text-white placeholder-zinc-500 outline-none w-full"
            />
            <button 
              type="submit"
              disabled={!joinId}
              className="px-4 text-zinc-400 hover:text-white disabled:opacity-50 transition-colors"
            >
              <Users size={20} />
            </button>
          </div>
        </form>
      </div>

      <div className="mt-20 grid grid-cols-1 sm:grid-cols-3 gap-8 text-left max-w-4xl w-full">
        {[
          { title: 'Real-time Sync', desc: 'Advanced drift correction ensures everyone hears the beat at the exact same moment.' },
          { title: 'No Account Required', desc: 'Jump straight into the action. Just create a room and share the link.' },
          { title: 'Host Controls', desc: 'The host leads the way. Play, pause, and seek controls are automatically broadcast.' }
        ].map((feature, idx) => (
          <div key={idx} className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 hover:border-zinc-700 transition-colors">
            <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
            <p className="text-sm text-zinc-400">{feature.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;