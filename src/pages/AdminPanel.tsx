import React from 'react';

interface AdminProps {
  onBack: () => void;
}

const AdminPanel: React.FC<AdminProps> = ({ onBack }) => {
  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={onBack}
          className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-2xl font-bold"
        >
          ← ব্যাক
        </button>
        <h1 className="text-2xl font-black italic uppercase">Master Control</h1>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div className="bg-primary-600 p-6 rounded-[2rem] text-white">
          <p className="opacity-80">টোটাল মিরর ডাটা</p>
          <h2 className="text-4xl font-black">লোড হচ্ছে...</h2>
        </div>
        {/* এখানে আমরা পরে ডাটা টেবিল বসাবো */}
      </div>
    </div>
  );
};

export default AdminPanel;