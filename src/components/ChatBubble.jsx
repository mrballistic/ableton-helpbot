import { useState } from 'react';
import { 
  Box, 
  Typography,
  Button,
  alpha,
  Collapse
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MarkdownIt from 'markdown-it';

const md = MarkdownIt({
  html: false,
  breaks: false,
  linkify: true,
  typographer: true,
  maxNesting: 100,
});

// Enable additional features
md.enable(['table', 'strikethrough']);

const ChatBubble = ({ message, isUser, context }) => {
  const [showContext, setShowContext] = useState(false);

  return (
    <Box
      sx={{
        maxWidth: '70%',
        minWidth: '100px',
        borderRadius: 3,
        position: 'relative',
        bgcolor: isUser ? 'primary.main' : theme => theme.palette.mode === 'dark' ? '#333' : '#f0f0f0',
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
            bgcolor: theme => theme.palette.mode === 'dark' ? '#333' : '#f0f0f0',
          })
        }
      }}
    >
      <Box 
        sx={{ 
          p: 1.5, 
          m: 1,
          whiteSpace: 'pre-wrap', 
          wordBreak: 'break-word',
          
          '& .markdown': {
            '& > *:first-child': {
              mt: 0
            },
            '& > *:last-child': {
              mb: 0
            },
            '& p': {
              m: 0,
              lineHeight: 1.2,
              fontSize: '0.9rem'
            },
            '& h1, & h2, & h3, & h4, & h5, & h6': {
              m: 0,
              lineHeight: 1.1,
              fontSize: theme => ({
                h1: '1.1rem',
                h2: '1rem',
                h3: '0.95rem',
                h4: '0.9rem',
                h5: '0.9rem',
                h6: '0.9rem'
              }),
              fontWeight: 'bold',
              '& + p, & + ul, & + ol': {
                mt: 0.25
              }
            },
            '& ul, & ol': {
              m: 0,
              pl: 2.5,
              fontSize: '0.9rem',
              '& li': {
                m: 0,
                pl: 0,
                pb: 0,
                display: 'list',
                lineHeight: 1.2,
                '& p': {
                  display: 'inline',
                  m: 0
                }
              }
            },
            '& code': {
              px: 0.5,
              py: 0.25,
              borderRadius: 0.5,
              bgcolor: alpha('#000', 0.1),
              fontFamily: 'monospace',
              fontSize: '0.875em'
            },
            '& pre': {
              m: 0,
              p: 0.75,
              borderRadius: 1,
              bgcolor: alpha('#000', 0.1),
              overflowX: 'auto',
              '& code': {
                p: 0,
                bgcolor: 'transparent'
              }
            },
            '& blockquote': {
              m: 0,
              pl: 1,
              borderLeft: 2,
              borderColor: 'divider',
              fontStyle: 'italic'
            },
            '& table': {
              borderCollapse: 'collapse',
              width: '100%',
              m: 0,
              '& th, & td': {
                border: 1,
                borderColor: 'divider',
                p: 0.5
              }
            },
            '& input[type="checkbox"]': {
              mr: 0.5
            },
            '& .task-list-item': {
              listStyle: 'none',
              pl: 0,
              '&::before': {
                display: 'none'
              }
            },
            '& del': {
              textDecoration: 'line-through'
            }
          }
            
        }}
      >
        {isUser ? (
          <Typography component="div" sx={{ m: 0, textIndent: 0 }}>
            {message}
          </Typography>
        ) : (
          <Box 
            className="markdown"
            dangerouslySetInnerHTML={{ __html: md.renderInline(message) }}
          />
        )}
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
              py: 0.5,
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
                p: 1.5,
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
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mb: index < context.length - 1 ? 0.5 : 0,
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

export default ChatBubble;
