import { useState, useEffect, useRef } from 'react';
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
  
  // Check health endpoint periodically
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/health');
        const data = await response.json();
        setIsInitializing(data.isInitializing);
        setInitProgress(data.progress || '');
        if (data.error) {
          setError(data.error);
        }
      } catch (err) {
        console.error('Error checking health:', err);
        setError('Failed to connect to server');
      }
    };
    
    // Check immediately
    checkHealth();
    
    // Then check every 5 seconds
    const interval = setInterval(checkHealth, 5000);
    
    // Cleanup
    return () => clearInterval(interval);
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
      const response = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: userMessage }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to get response');
      }
      
      const data = await response.json();
      setMessages([
        ...newMessages,
        { 
          text: data.response, 
          sender: 'bot',
          context: data.context 
        }
      ]);
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
