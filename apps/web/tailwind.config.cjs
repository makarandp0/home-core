// Tailwind config for the web app, extending the shared preset
module.exports = {
  presets: [require('@home/tailwind-config/tailwind.config')],
  content: ['./index.html', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
};
