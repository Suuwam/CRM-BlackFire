export const PLATFORMS = [
  { id: 'linkedin',  label: 'LinkedIn',  color: '#0a66c2', bg: '#0a66c2' },
  { id: 'instagram', label: 'Instagram', color: '#e1306c', bg: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' },
  { id: 'facebook',  label: 'Facebook',  color: '#1877f2', bg: '#1877f2' },
  { id: 'tiktok',    label: 'TikTok',    color: '#ffffff', bg: '#000000' },
  { id: 'x',         label: 'X (Twitter)', color: '#ffffff', bg: '#0f1419' },
];

export default function SocialIcon({ id, size = 14, style = {} }) {
  switch (id) {
    case 'linkedin':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" style={style}>
          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
        </svg>
      );
    case 'instagram':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={style}>
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
        </svg>
      );
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" style={style}>
          <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H7.5v-3H10V9.5C10 7.01 11.49 5.65 13.75 5.65c1.08 0 2.2.19 2.2.19v2.42h-1.24c-1.23 0-1.62.77-1.62 1.56V12h2.77l-.44 3h-2.33v6.8c4.56-.93 8-4.96 8-9.8z"/>
        </svg>
      );
    case 'tiktok':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" style={style}>
          <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-1-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.82.56-1.36 1.48-1.42 2.47-.11 1.25.47 2.49 1.46 3.14.97.66 2.27.7 3.3.17 1.05-.51 1.76-1.57 1.83-2.74.06-2.52.02-5.04.03-7.56V.02z"/>
        </svg>
      );
    case 'x':
      return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" style={style}>
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      );
    default:
      return null;
  }
}
