import { 
  Box, 
  List,
  ListItem,
  TextField,
  IconButton,
  CircularProgress,
  Stack
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ChatBubble from './ChatBubble';

const ChatInterface = ({ 
  messages, 
  input, 
  loading, 
  isInitializing, 
  messagesEndRef,
  inputRef,
  onInputChange,
  onKeyPress,
  onSend 
}) => (
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
          onSend();
        }}
      >
        <TextField
          fullWidth
          variant="outlined"
          placeholder={isInitializing ? "Initializing..." : "Ask a question about Ableton..."}
          value={input}
          onChange={onInputChange}
          onKeyPress={onKeyPress}
          multiline
          maxRows={4}
          size="small"
          disabled={loading || isInitializing}
          inputRef={inputRef}
          aria-label="Message input"
        />
        <IconButton 
          color="primary"
          onClick={onSend}
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
);

export default ChatInterface;
