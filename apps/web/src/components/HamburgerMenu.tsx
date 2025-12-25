import * as React from 'react';
import { useNavigate } from 'react-router-dom';

export const HamburgerMenu: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(false);
  const navigate = useNavigate();

  const handleHomeClick = () => {
    setIsOpen(false);
    navigate('/');
  };

  const handleVersionClick = () => {
    setIsOpen(false);
    navigate('/version');
  };

  const handleUploadClick = () => {
    setIsOpen(false);
    navigate('/upload');
  };

  const handleDocumentsClick = () => {
    setIsOpen(false);
    navigate('/documents');
  };

  const handleSettingsClick = () => {
    setIsOpen(false);
    navigate('/settings');
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex flex-col items-center justify-center gap-1 rounded-md p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
        aria-label="Menu"
      >
        <span className="block h-0.5 w-6 bg-gray-700 dark:bg-gray-300" />
        <span className="block h-0.5 w-6 bg-gray-700 dark:bg-gray-300" />
        <span className="block h-0.5 w-6 bg-gray-700 dark:bg-gray-300" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-md border dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
            <nav className="py-1">
              <button
                onClick={handleHomeClick}
                className="block w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Home
              </button>
              <button
                onClick={handleVersionClick}
                className="block w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Version
              </button>
              <button
                onClick={handleUploadClick}
                className="block w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Upload
              </button>
              <button
                onClick={handleDocumentsClick}
                className="block w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Documents
              </button>
              <button
                onClick={handleSettingsClick}
                className="block w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Settings
              </button>
            </nav>
          </div>
        </>
      )}
    </div>
  );
};
