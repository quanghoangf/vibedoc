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
  			bg:       'rgb(var(--color-bg) / <alpha-value>)',
  			surface:  'rgb(var(--color-surface) / <alpha-value>)',
  			surface2: 'rgb(var(--color-surface2) / <alpha-value>)',
  			border:   'rgb(var(--color-border) / <alpha-value>)',
  			border2:  'rgb(var(--color-border2) / <alpha-value>)',
  			txt:      'rgb(var(--color-txt) / <alpha-value>)',
  			muted:    'rgb(var(--color-muted) / <alpha-value>)',
  			accent:   'rgb(var(--color-accent) / <alpha-value>)',
  			teal: '#4fd8b4',
  			amber: '#f7a26a',
  			danger: '#f76a6a',
  			background:             'rgb(var(--color-bg) / <alpha-value>)',
  			foreground:             'rgb(var(--color-txt) / <alpha-value>)',
  			card:                   'rgb(var(--color-surface) / <alpha-value>)',
  			'card-foreground':      'rgb(var(--color-txt) / <alpha-value>)',
  			popover:                'rgb(var(--color-surface) / <alpha-value>)',
  			'popover-foreground':   'rgb(var(--color-txt) / <alpha-value>)',
  			primary:                'rgb(var(--color-accent) / <alpha-value>)',
  			'primary-foreground':   'rgb(var(--color-txt) / <alpha-value>)',
  			secondary:              'rgb(var(--color-surface2) / <alpha-value>)',
  			'secondary-foreground': 'rgb(var(--color-txt) / <alpha-value>)',
  			'muted-foreground':     'rgb(var(--color-muted) / <alpha-value>)',
  			'accent-foreground':    'rgb(var(--color-txt) / <alpha-value>)',
  			destructive: '#f76a6a',
  			'destructive-foreground': '#e8e8f0',
  			input: 'rgb(var(--color-border) / <alpha-value>)',
  			ring:  'rgb(var(--color-accent) / <alpha-value>)',
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
