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

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex flex-col items-center justify-center gap-1 rounded-md p-2 hover:bg-gray-100"
        aria-label="Menu"
      >
        <span className="block h-0.5 w-6 bg-gray-700" />
        <span className="block h-0.5 w-6 bg-gray-700" />
        <span className="block h-0.5 w-6 bg-gray-700" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-md border bg-white shadow-lg">
            <nav className="py-1">
              <button
                onClick={handleHomeClick}
                className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                Home
              </button>
              <button
                onClick={handleVersionClick}
                className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
              >
                Version
              </button>
            </nav>
          </div>
        </>
      )}
    </div>
  );
};
