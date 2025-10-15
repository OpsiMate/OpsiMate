import React, { useState, useEffect } from 'react';
// The import for 'lucide-react' has been removed to eliminate the external dependency.

// NOTE: These are placeholder URLs. Please replace them with the official OpsiMate links.
const SLACK_URL = "https://opsimate.slack.com/join/signup";
const GITHUB_URL = "https://github.com/opsimate/opsimate";

/**
 * Inline SVG for MessageSquare (Slack/Chat icon)
 * This component replaces the dependency on 'lucide-react'
 */
const MessageSquareIcon = ({ className = "w-5 h-5" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
);

/**
 * Custom Button Component for Consistency
 */
const CommunityButton = ({ href, icon, text, primary = false }) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className={`
      flex items-center justify-center space-x-2 p-3 w-full rounded-xl transition duration-200 shadow-md
      text-sm font-semibold tracking-wide border-2
      
      ${
        primary
          ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 hover:border-indigo-700 shadow-indigo-500/50'
          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700 dark:hover:bg-gray-700 dark:hover:border-gray-600 dark:shadow-none'
      }
      
      focus:outline-none focus:ring-4 focus:ring-opacity-50 ${primary ? 'focus:ring-indigo-500' : 'focus:ring-gray-400'}
    `}
  >
    {icon}
    <span>{text}</span>
  </a>
);

/**
 * Main Application Component
 */
const App = () => {
  // Simple state to toggle dark mode for demonstration
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    // Apply dark class to HTML element for full Tailwind dark mode effect
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(prev => !prev);

  return (
    <div className={`min-h-screen ${isDarkMode ? 'bg-gray-900' : 'bg-gray-100'} font-sans p-4 flex justify-center items-center transition duration-300`}>
      
      {/* Main Content Card */}
      <div 
        className="
          bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 md:p-8 w-full max-w-md 
          flex flex-col space-y-6 transform transition duration-500 ease-in-out
        "
      >
        
        {/* Header and Dark Mode Toggle */}
        <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            OpsiMate App
          </h1>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:ring-2 ring-indigo-500 transition"
            aria-label="Toggle Dark Mode"
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        </div>

        {/* Placeholder Menu Content */}
        <div className="space-y-3 text-gray-600 dark:text-gray-400 flex-grow">
          <p className="font-medium text-lg dark:text-gray-300">Welcome, Admin!</p>
          <ul className="list-disc list-inside space-y-1 pl-4">
            <li>Dashboard</li>
            <li>Settings</li>
            <li>Documentation</li>
            <li>Release Notes</li>
          </ul>
          <p className="pt-4 text-sm">
            This is where the main application menu items or quick navigation links would be. 
            The community buttons are strategically placed at the bottom for visibility.
          </p>
        </div>

        {/* Community Engagement Buttons (As requested) */}
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700 space-y-3">
          <p className="text-xs text-center font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Join Our Community
          </p>
          
          {/* Slack Button */}
          <CommunityButton
            href={SLACK_URL}
            icon={<MessageSquareIcon className="w-5 h-5" />}
            text="Join Our Slack 🤝"
            primary={true} 
          />
          
          {/* GitHub Button */}
          <CommunityButton
            href={GITHUB_URL}
            icon={<span>⭐</span>}
            text="Star us on GitHub"
            primary={false} 
          />
        </div>
      </div>
    </div>
  );
};

export default App;
