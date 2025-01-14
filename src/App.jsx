import { useState, useEffect, useRef } from 'react';
let ipcRenderer;
if (window.electron) {
  ipcRenderer = window.electron.ipcRenderer;
}
import { 
  Container, 
  Stack, 
  Typography,
  Alert,
  Snackbar,
  ThemeProvider,
  createTheme,
  CssBaseline,
  useMediaQuery,
} from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ChatInterface from './components/ChatInterface';
import InitializationModal from './components/InitializationModal';
import VisuallyHidden from './helpers/VisuallyHidden';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initProgress, setInitProgress] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  
  // Detect if user prefers dark mode
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  
  // Create theme based on user preference
  const theme = createTheme({
    palette: {
      mode: prefersDarkMode ? 'dark' : 'light',
      primary: {
        main: '#2196f3',
      },
      background: {
        default: prefersDarkMode ? '#121212' : '#f5f5f5',
        paper: prefersDarkMode ? '#1e1e1e' : '#ffffff',
      },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 20,
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 20,
          },
        },
      },
    },
  });
  
  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  // Initialize and listen for progress updates
  useEffect(() => {
    if (ipcRenderer) {
      const checkHealth = async () => {
        try {
          const health = await ipcRenderer.invoke('health-check');
          setIsInitializing(health.isInitializing);
          setInitProgress(health.progress || '');
          if (health.error) {
            setError(health.error);
          }
        } catch (err) {
          console.error('Error checking health:', err);
          setError('Failed to initialize');
        }
      };

      // Listen for progress updates
      const progressHandler = (_, progress) => {
        setInitProgress(progress);
      };
      
      ipcRenderer.on('initialization-progress', progressHandler);
      
      // Initial health check and start initialization
      checkHealth();
      ipcRenderer.invoke('initialize').catch(err => {
        console.error('Error during initialization:', err);
        setError('Failed to initialize');
      });
      
      // Cleanup
      return () => {
        ipcRenderer.removeListener('initialization-progress', progressHandler);
      };
    } else {
      // Dev mode without Electron
      setIsInitializing(false);
    }
  }, []);
  
  const handleSend = async () => {
    if (!input.trim() || loading || isInitializing) return;
    
    const userMessage = input.trim();
    setInput('');
    
    // Add user message
    const newMessages = [
      ...messages,
      { text: userMessage, sender: 'user' }
    ];
    setMessages(newMessages);
    
    // Generate response
    setLoading(true);
    setError(null);
    
    try {
      if (ipcRenderer) {
        const data = await ipcRenderer.invoke('chat', userMessage);
        setMessages([
          ...newMessages,
          { 
            text: data.response, 
            sender: 'bot',
            context: data.context 
          }
        ]);
      } else {
        // Dev mode mock response
        setMessages([
          ...newMessages,
          { 
            text: "This is a development mode response. Electron IPC is not available.", 
            sender: 'bot'
          }
        ]);
      }
    } catch (err) {
      console.error('Error generating response:', err);
      setError('Failed to generate response. Please ensure the server is running.');
    } finally {
      setLoading(false);
      // Focus back to input after response
      inputRef.current?.focus();
    }
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container 
        maxWidth="md" 
        sx={{ 
          height: '100vh',
          py: 2,
          display: 'flex',
          flexDirection: 'column'
        }}
        role="main"
        aria-label="Ableton Documentation Assistant Chat Interface"
      >
        <Stack 
          direction="row" 
          alignItems="center" 
          spacing={1}
          component="header"
          sx={{ 
            p: 2,
            bgcolor: 'background.paper',
            borderRadius: 2,
            mb: 2,
            boxShadow: 1
          }}
        >
          <SmartToyIcon 
            aria-hidden="true"
            sx={{ color: 'primary.main' }}
          />
          <Typography variant="h5" component="h1">
            Ableton Documentation Assistant
          </Typography>
        </Stack>
        
        <ChatInterface 
          messages={messages}
          input={input}
          loading={loading}
          isInitializing={isInitializing}
          messagesEndRef={messagesEndRef}
          inputRef={inputRef}
          onInputChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          onSend={handleSend}
        />
        
        <InitializationModal 
          open={isInitializing}
          progress={initProgress}
        />
        
        <Snackbar 
          open={!!error} 
          autoHideDuration={6000} 
          onClose={() => setError(null)}
        >
          <Alert 
            severity="error" 
            onClose={() => setError(null)}
            role="alert"
          >
            {error}
          </Alert>
        </Snackbar>
        
        <VisuallyHidden>
          <div role="status" aria-live="polite">
            {loading ? 'Processing your request...' : ''}
            {isInitializing ? initProgress || 'Initializing the documentation assistant...' : ''}
          </div>
        </VisuallyHidden>
      </Container>
    </ThemeProvider>
  );
};

export default App;
