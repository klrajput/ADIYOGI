import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#7b1fa2',      // Deep spiritual purple
      light: '#a855f7',     // Lighter purple
      dark: '#4a148c',      // Darker purple
    },
    secondary: {
      main: '#d4af37',      // Golden/sandalwood color
      light: '#f7e98e',     // Light gold
      dark: '#b8860b',      // Dark gold
    },
    background: {
      default: '#f3e5f5',   // Light lavender background
      paper: '#ffffff',     // Pure white for cards
    },
    text: {
      primary: '#37474f',   // Soft dark gray
      secondary: '#546e7a', // Medium gray
    },
    success: {
      main: '#81c784',      // Soft green for positive states
      light: '#a5d6a7',
      dark: '#66bb6a',
    },
    warning: {
      main: '#ffb74d',      // Soft orange for warnings
      light: '#ffcc80',
      dark: '#ff9800',
    },
    error: {
      main: '#ef5350',      // Soft red for errors
      light: '#ef9a9a',
      dark: '#e53935',
    },
    info: {
      main: '#64b5f6',      // Soft blue for info
      light: '#90caf9',
      dark: '#42a5f5',
    },
  },
  typography: {
    fontFamily: "'Inter', 'Kalam', 'Cinzel', Arial, sans-serif",
    h1: {
      fontFamily: "'Cinzel', serif",
      fontWeight: 700,
      color: '#37474f',
    },
    h2: {
      fontFamily: "'Cinzel', serif",
      fontWeight: 600,
      color: '#37474f',
    },
    h3: {
      fontFamily: "'Cinzel', serif",
      fontWeight: 600,
      color: '#7b1fa2',
    },
    h4: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 700,
      color: '#7b1fa2',
    },
    h5: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 600,
      color: '#37474f',
    },
    h6: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 600,
      color: '#37474f',
    },
    body1: {
      fontFamily: "'Inter', sans-serif",
      lineHeight: 1.6,
      color: '#37474f',
    },
    body2: {
      fontFamily: "'Inter', sans-serif",
      lineHeight: 1.5,
      color: '#546e7a',
    },
    subtitle1: {
      fontFamily: "'Kalam', sans-serif",
      fontWeight: 500,
      color: '#7b1fa2',
    },
    subtitle2: {
      fontFamily: "'Kalam', sans-serif",
      fontWeight: 400,
      color: '#7b1fa2',
    },
    button: {
      fontFamily: "'Inter', sans-serif",
      fontWeight: 600,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 12,
  },
  spacing: 8,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '20px',
          textTransform: 'none',
          fontWeight: 600,
          padding: '10px 24px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
          },
        },
        contained: {
          background: 'linear-gradient(45deg, #7b1fa2, #a855f7)',
          color: '#ffffff',
          '&:hover': {
            background: 'linear-gradient(45deg, #a855f7, #7b1fa2)',
          },
        },
        outlined: {
          borderColor: '#7b1fa2',
          color: '#7b1fa2',
          '&:hover': {
            backgroundColor: 'rgba(123, 31, 162, 0.04)',
            borderColor: '#7b1fa2',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.05)',
          border: '1px solid rgba(212, 175, 55, 0.2)',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(10px)',
          transition: 'all 0.3s ease',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)',
          },
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          '&.hindi-text': {
            fontFamily: "'Kalam', sans-serif",
            color: '#7b1fa2',
          },
          '&.english-title': {
            fontFamily: "'Cinzel', serif",
            color: '#37474f',
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(250, 250, 250, 0.95)',
          color: '#37474f',
          boxShadow: '0 2px 20px rgba(0, 0, 0, 0.05)',
          backdropFilter: 'blur(10px)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            '& fieldset': {
              borderColor: 'rgba(212, 175, 55, 0.3)',
            },
            '&:hover fieldset': {
              borderColor: '#7b1fa2',
            },
            '&.Mui-focused fieldset': {
              borderColor: '#7b1fa2',
              boxShadow: '0 0 0 3px rgba(123, 31, 162, 0.1)',
            },
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: '16px',
          backgroundColor: 'rgba(129, 199, 132, 0.1)',
          color: '#388e3c',
          border: '1px solid rgba(129, 199, 132, 0.3)',
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: '12px',
          '&.MuiAlert-standardSuccess': {
            backgroundColor: 'rgba(129, 199, 132, 0.1)',
            color: '#388e3c',
            border: '1px solid rgba(129, 199, 132, 0.3)',
          },
          '&.MuiAlert-standardWarning': {
            backgroundColor: 'rgba(255, 183, 77, 0.1)',
            color: '#f57c00',
            border: '1px solid rgba(255, 183, 77, 0.3)',
          },
          '&.MuiAlert-standardError': {
            backgroundColor: 'rgba(239, 83, 80, 0.1)',
            color: '#d32f2f',
            border: '1px solid rgba(239, 83, 80, 0.3)',
          },
        },
      },
    },
  },
});
