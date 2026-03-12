import type { Config } from 'tailwindcss'

const config: Config = {
    darkMode: ['class'],
    content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sans: [
  				'var(--font-sans)',
  				'system-ui',
  				'sans-serif'
  			],
  			mono: [
  				'var(--font-mono)',
  				'monospace'
  			],
  			display: [
  				'var(--font-display)',
  				'serif'
  			]
  		},
  		colors: {
  			bg: '#0a0a0f',
  			surface: '#111118',
  			surface2: '#16161f',
  			border: '#22222e',
  			border2: '#2d2d3d',
  			txt: '#e8e8f0',
  			muted: '#6b6b80',
  			accent: '#7c6af7',
  			teal: '#4fd8b4',
  			amber: '#f7a26a',
  			danger: '#f76a6a',
  			background: '#0a0a0f',
  			foreground: '#e8e8f0',
  			card: '#111118',
  			'card-foreground': '#e8e8f0',
  			popover: '#111118',
  			'popover-foreground': '#e8e8f0',
  			primary: '#7c6af7',
  			'primary-foreground': '#e8e8f0',
  			secondary: '#16161f',
  			'secondary-foreground': '#e8e8f0',
  			'muted-foreground': '#6b6b80',
  			'accent-foreground': '#e8e8f0',
  			destructive: '#f76a6a',
  			'destructive-foreground': '#e8e8f0',
  			input: '#22222e',
  			ring: '#7c6af7',
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		animation: {
  			'fade-in': 'fadeIn 0.3s ease',
  			'slide-in': 'slideIn 0.25s ease',
  			'pulse-dot': 'pulseDot 2s ease-in-out infinite'
  		},
  		keyframes: {
  			fadeIn: {
  				from: {
  					opacity: '0',
  					transform: 'translateY(8px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateY(0)'
  				}
  			},
  			slideIn: {
  				from: {
  					opacity: '0',
  					transform: 'translateX(-8px)'
  				},
  				to: {
  					opacity: '1',
  					transform: 'translateX(0)'
  				}
  			},
  			pulseDot: {
  				'0%,100%': {
  					opacity: '0.4',
  					transform: 'scale(0.8)'
  				},
  				'50%': {
  					opacity: '1',
  					transform: 'scale(1.1)'
  				}
  			}
  		}
  	}
  },
  plugins: [],
}

export default config
