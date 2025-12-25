import { useNavigate } from 'react-router-dom';
import { Upload, FileText, Settings, Info } from 'lucide-react';

interface QuickLink {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
}

export function HomePage() {
  const navigate = useNavigate();

  const quickLinks: QuickLink[] = [
    {
      title: 'Upload',
      description: 'Add new documents',
      icon: <Upload className="w-6 h-6" />,
      path: '/upload',
      color: 'bg-blue-500 dark:bg-blue-600',
    },
    {
      title: 'Documents',
      description: 'View your files',
      icon: <FileText className="w-6 h-6" />,
      path: '/documents',
      color: 'bg-emerald-500 dark:bg-emerald-600',
    },
    {
      title: 'Settings',
      description: 'Configure options',
      icon: <Settings className="w-6 h-6" />,
      path: '/settings',
      color: 'bg-purple-500 dark:bg-purple-600',
    },
    {
      title: 'Version',
      description: 'System information',
      icon: <Info className="w-6 h-6" />,
      path: '/version',
      color: 'bg-amber-500 dark:bg-amber-600',
    },
  ];

  return (
    <div className="min-h-[60vh] px-4 py-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
            Welcome
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Your home dashboard
          </p>
        </div>

        {/* Quick Navigation Grid */}
        <div className="grid grid-cols-2 gap-4">
          {quickLinks.map((link) => (
            <button
              key={link.path}
              onClick={() => navigate(link.path)}
              className="group flex flex-col items-center p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-lg transition-all duration-200 text-left"
            >
              <div
                className={`${link.color} p-3 rounded-full text-white mb-4 group-hover:scale-110 transition-transform duration-200`}
              >
                {link.icon}
              </div>
              <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-1">
                {link.title}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                {link.description}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
