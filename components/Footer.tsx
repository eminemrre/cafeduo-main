import React from 'react';
import { Instagram, Twitter, Mail } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-black text-gray-400 py-12 border-t border-gray-900">
      <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
        
        <div className="text-center md:text-left">
           <span className="font-pixel text-2xl text-white block mb-2">CAFE<span className="text-slate-500">DUO</span></span>
           <p className="text-sm">© 2025 Tüm hakları saklıdır.</p>
        </div>

        <div className="flex space-x-6">
            <a href="#" className="hover:text-white transition-colors transform hover:scale-110">
                <Instagram size={24} />
            </a>
            <a href="#" className="hover:text-white transition-colors transform hover:scale-110">
                <Twitter size={24} />
            </a>
            <a href="#" className="hover:text-white transition-colors transform hover:scale-110">
                <Mail size={24} />
            </a>
        </div>
      </div>
    </footer>
  );
};