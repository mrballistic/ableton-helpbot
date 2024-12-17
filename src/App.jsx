import { useState, useEffect, useRef } from 'react';
import { 
  Container, 
  Paper, 
  TextField, 
  Box, 
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert,
  Snackbar,
  ThemeProvider,
  createTheme,
  CssBaseline,
  useMediaQuery,
  Modal,
  LinearProgress,
  Stack
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { grey } from '@mui/material/colors';

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

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Detect if user prefers dark mode
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  // Create theme based on user preference
  const theme = createTheme({
    palette: {
      mode: prefersDarkMode ? 'dark' : 'light',
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
        { text: data.response, sender: 'bot' }
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
        sx={{ height: '100vh', py: 2 }}
        role="main"
        aria-label="Ableton Documentation Assistant Chat Interface"
      >
        <Paper 
          elevation={3} 
          sx={{ 
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column',
            bgcolor: 'background.paper'
          }}
        >
          <Stack 
            direction="row" 
            alignItems="center" 
            spacing={1}
            component="header"
            sx={{ 
              p: 2, 
              bgcolor: 'primary.main', 
              color: 'primary.contrastText',
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4
            }}
          >
            <SmartToyIcon aria-hidden="true" />
            <Typography variant="h5" component="h1">
              Ableton Documentation Assistant
            </Typography>
          </Stack>

          <List 
            sx={{ 
              flexGrow: 1, 
              overflow: 'auto', 
              p: 2,
              display: 'flex',
              flexDirection: 'column'
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
                  justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start',
                  mb: 1
                }}
                aria-label={`${message.sender === 'user' ? 'You' : 'Assistant'}: ${message.text}`}
              >
                <Paper
                  elevation={1}
                  sx={{
                    maxWidth: '70%',
                    p: 2,
                    bgcolor: message.sender === 'user' ? 'primary.main' : 'background.default',
                    color: message.sender === 'user' ? 'primary.contrastText' : 'text.primary'
                  }}
                >
                  <ListItemText 
                    primary={message.text}
                    sx={{
                      '& .MuiListItemText-primary': {
                        whiteSpace: 'pre-wrap',
                      },
                    }}
                  />
                </Paper>
              </ListItem>
            ))}
            {loading && (
              <Box 
                sx={{ display: 'flex', justifyContent: 'center', my: 2 }}
                role="status"
                aria-label="Loading response"
              >
                <CircularProgress />
              </Box>
            )}
            <div ref={messagesEndRef} tabIndex={-1} />
          </List>

          <Box 
            component="footer" 
            sx={{ p: 2, bgcolor: 'grey.800', borderTop: 1, borderColor: 'grey.600' }}
            role="complementary"
          >
            <Box 
              sx={{ display: 'flex', gap: 1 }}
              role="form"
              aria-label="Message input form"
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
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: 'background.default',
                  },
                }}
              />
              <IconButton 
                color="primary" 
                onClick={handleSend}
                disabled={loading || !input.trim() || isInitializing}
                aria-label="Send message"
              >
                <SendIcon />
              </IconButton>
            </Box>
          </Box>
        </Paper>

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
              Please wait while we process the documentation and create embeddings. This may take awhile...
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

        {/* Announcer for screen readers */}
        <VisuallyHidden>
          <div role="status" aria-live="polite">
            {loading ? 'Processing your request...' : ''}
            {isInitializing ? 'Initializing the documentation assistant...' : ''}
          </div>
        </VisuallyHidden>
      </Container>
    </ThemeProvider>
  );
}

export default App;
