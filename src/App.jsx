import { useState, useEffect, useRef } from 'react';
import { 
  Container, 
  Box, 
  Typography,
  IconButton,
  List,
  ListItem,
  TextField,
  CircularProgress,
  Alert,
  Snackbar,
  ThemeProvider,
  createTheme,
  CssBaseline,
  useMediaQuery,
  Modal,
  LinearProgress,
  Stack,
  alpha,
  Collapse,
  Button
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

// Create a visually hidden component for screen readers
const VisuallyHidden = ({ children }) => (
  <span
    style={{
      border: 0,
      clip: 'rect(0 0 0 0)',
      height: '1px',
      margin: '-1px',
      overflow: 'hidden',
      padding: 0,
      position: 'absolute',
      width: '1px',
      whiteSpace: 'nowrap',
      wordWrap: 'normal',
    }}
  >
    {children}
  </span>
);

// Chat bubble component
const ChatBubble = ({ message, isUser, context }) => {
  const [showContext, setShowContext] = useState(false);

  return (
    <Box
      sx={{
        maxWidth: '70%',
        minWidth: '100px',
        borderRadius: 3,
        position: 'relative',
        bgcolor: isUser ? 'primary.main' : theme => theme.palette.mode === 'dark' ? '#333333'  : '#f0f0f0',
        color: isUser ? 'primary.contrastText' : 'text.primary',
        boxShadow: theme => theme.palette.mode === 'dark' ? 'none' : '0 1px 2px rgba(0,0,0,0.1)',
        overflow: 'visible',
        '&::before': {
          content: '""',
          position: 'absolute',
          width: '12px',
          height: '12px',
          transform: 'rotate(45deg)',
          top: '20px',
          ...(isUser ? {
            right: '-6px',
            bgcolor: 'primary.main',
          } : {
            left: '-6px',
            bgcolor: theme => theme.palette.mode === 'dark' ? '#333333' : '#f0f0f0',
          })
        }
      }}
    >
      <Box sx={{ p: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        <Typography
          component="div"
          sx={{
            m: 0,
            textIndent: 0,
            '& p': {
              m: 0,
              textIndent: 0
            }
          }}
        >
          {message}
        </Typography>
      </Box>

      {!isUser && context && context.length > 0 && (
        <>
          <Button
            onClick={() => setShowContext(!showContext)}
            fullWidth
            size="small"
            sx={{
              borderTop: 1,
              borderColor: 'divider',
              borderRadius: 0,
              textTransform: 'none',
              color: 'text.secondary',
              '&:hover': {
                bgcolor: alpha('#000', 0.05)
              }
            }}
            endIcon={showContext ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          >
            {showContext ? 'Hide source' : 'Show source'}
          </Button>
          <Collapse in={showContext}>
            <Box
              sx={{
                p: 2,
                borderTop: 1,
                borderColor: 'divider',
                bgcolor: theme => theme.palette.mode === 'dark' 
                  ? alpha(theme.palette.background.default, 0.3) 
                  : alpha(theme.palette.background.paper, 0.5),
              }}
            >
              {context.map((item, index) => (
                <Typography
                  key={index}
                  component="div"
                  color="text.secondary"
                  sx={{
                    mb: index < context.length - 1 ? 1 : 0,
                    fontSize: '0.875rem',
                    fontFamily: 'monospace',
                    m: 0,
                    textIndent: 0,
                    '& p': {
                      m: 0,
                      textIndent: 0
                    }
                  }}
                >
                  {item.content}
                </Typography>
              ))}
            </Box>
          </Collapse>
        </>
      )}
    </Box>
  );
};

function App() {
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

        <Box
          sx={{
            flexGrow: 1,
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <List 
            sx={{ 
              flexGrow: 1, 
              overflow: 'auto', 
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 2
            }}
            aria-label="Chat messages"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {messages.map((message, index) => (
              <ListItem
                key={index}
                sx={{
                  display: 'flex',
                  justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start',
                  px: 2,
                  py: 0
                }}
                aria-label={`${message.sender === 'user' ? 'You' : 'Assistant'}: ${message.text}`}
              >
                <ChatBubble 
                  message={message.text} 
                  isUser={message.sender === 'user'}
                  context={message.context}
                />
              </ListItem>
            ))}
            {loading && (
              <Box 
                sx={{ 
                  display: 'flex',
                  justifyContent: 'center',
                  my: 2
                }}
                role="status"
                aria-label="Loading response"
              >
                <CircularProgress size={24} />
              </Box>
            )}
            <div ref={messagesEndRef} tabIndex={-1} />
          </List>

          <Box 
            component="footer" 
            sx={{ 
              p: 2,
              borderTop: 1,
              borderColor: 'divider',
              bgcolor: theme => theme.palette.mode === 'dark' ? 'background.paper' : 'background.default'
            }}
            role="complementary"
          >
            <Stack 
              direction="row" 
              spacing={1}
              component="form"
              role="form"
              aria-label="Message input form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
            >
              <TextField
                fullWidth
                variant="outlined"
                placeholder={isInitializing ? "Initializing..." : "Ask a question about Ableton..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                multiline
                maxRows={4}
                size="small"
                disabled={loading || isInitializing}
                inputRef={inputRef}
                aria-label="Message input"
              />
              <IconButton 
                color="primary"
                onClick={handleSend}
                disabled={loading || !input.trim() || isInitializing}
                aria-label="Send message"
                sx={{
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                  },
                  '&.Mui-disabled': {
                    bgcolor: 'action.disabledBackground',
                  }
                }}
              >
                <SendIcon />
              </IconButton>
            </Stack>
          </Box>
        </Box>

        <Modal
          open={isInitializing}
          aria-labelledby="initialization-modal-title"
          aria-describedby="initialization-modal-description"
        >
          <Box sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 400,
            bgcolor: 'background.paper',
            boxShadow: 24,
            p: 4,
            borderRadius: 2,
          }}>
            <Typography id="initialization-modal-title" variant="h6" component="h2" gutterBottom>
              Initializing Documentation Assistant
            </Typography>
            <Typography id="initialization-modal-description" sx={{ mt: 2, mb: 3 }}>
              {initProgress || 'Please wait while we process the documentation...'}
            </Typography>
            <LinearProgress aria-label="Initialization progress" />
          </Box>
        </Modal>

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
}

export default App;
