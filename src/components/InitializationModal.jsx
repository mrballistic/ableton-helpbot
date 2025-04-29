import { 
  Box, 
  Typography,
  Modal,
  LinearProgress,
  Alert,
  Button,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import ErrorIcon from '@mui/icons-material/Error';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import TerminalIcon from '@mui/icons-material/Terminal';
import SyncIcon from '@mui/icons-material/Sync';
import InfoIcon from '@mui/icons-material/Info';

const InitializationModal = ({ open, progress }) => {
  const [chromaStatus, setChromaStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRetryEnabled, setAutoRetryEnabled] = useState(false);
  const retryIntervalRef = useRef(null);

  useEffect(() => {
    if (open) {
      fetchChromaStatus();
    }
  }, [open]);

  // Set up automatic retry when enabled
  useEffect(() => {
    if (autoRetryEnabled && !chromaStatus?.available) {
      // Set up interval to check ChromaDB status every 5 seconds
      retryIntervalRef.current = setInterval(fetchChromaStatus, 5000);
      
      // Clean up interval when component unmounts or status changes
      return () => {
        if (retryIntervalRef.current) {
          clearInterval(retryIntervalRef.current);
        }
      };
    }
  }, [autoRetryEnabled, chromaStatus?.available]);

  // Clear retry interval when ChromaDB becomes available
  useEffect(() => {
    if (chromaStatus?.available && retryIntervalRef.current) {
      clearInterval(retryIntervalRef.current);
      retryIntervalRef.current = null;
      setAutoRetryEnabled(false);
    }
  }, [chromaStatus?.available]);

  const fetchChromaStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/chromadb-status');
      if (response.ok) {
        const data = await response.json();
        setChromaStatus(data);
      } else {
        console.error('Failed to fetch ChromaDB status');
        setChromaStatus({ 
          available: false, 
          error: 'Failed to fetch status',
          troubleshooting: {
            suggestions: [
              "Server might be down or restarting",
              "Network connectivity issues"
            ]
          },
          diagnostics: {
            chromaHost: 'localhost',
            serverPort: 'unknown'
          }
        });
      }
    } catch (error) {
      console.error('Error fetching ChromaDB status:', error);
      setChromaStatus({ 
        available: false, 
        error: error.message,
        troubleshooting: {
          suggestions: [
            "Server might be down or restarting",
            "Network connectivity issues"
          ]
        },
        diagnostics: {
          chromaHost: 'localhost',
          serverPort: 'unknown'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRetryConnection = () => {
    fetchChromaStatus();
  };

  const toggleAutoRetry = () => {
    setAutoRetryEnabled(prev => !prev);
  };

  // Helper function to render troubleshooting steps
  const renderTroubleshootingSteps = () => {
    if (!chromaStatus?.troubleshooting?.suggestions) return null;
    
    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" color="error" gutterBottom>
          Troubleshooting Steps:
        </Typography>
        <List dense>
          {chromaStatus.troubleshooting.suggestions.map((suggestion, index) => (
            <ListItem key={index}>
              <ListItemIcon>
                <ErrorIcon color="error" />
              </ListItemIcon>
              <ListItemText primary={suggestion} />
            </ListItem>
          ))}
          {chromaStatus.troubleshooting?.configuration && (
            <ListItem>
              <ListItemIcon>
                <InfoIcon color="info" />
              </ListItemIcon>
              <ListItemText 
                primary={`ChromaDB Config: ${chromaStatus.troubleshooting.configuration.configPath}`} 
              />
            </ListItem>
          )}
          <ListItem>
            <ListItemIcon>
              <TerminalIcon />
            </ListItemIcon>
            <ListItemText 
              primary="./start-chromadb.sh" 
              secondary="To start ChromaDB"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <TerminalIcon />
            </ListItemIcon>
            <ListItemText 
              primary="ps aux | grep chroma" 
              secondary="To check if ChromaDB is running"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <TerminalIcon />
            </ListItemIcon>
            <ListItemText 
              primary="cat logs/chromadb.log" 
              secondary="To check ChromaDB logs"
            />
          </ListItem>
        </List>
      </Box>
    );
  };

  // Helper function to render diagnostic information
  const renderDiagnostics = () => {
    if (!chromaStatus?.diagnostics) return null;
    
    const { diagnostics } = chromaStatus;
    
    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Diagnostic Information:
        </Typography>
        <List dense>
          <ListItem>
            <ListItemIcon>
              <InfoIcon color="info" />
            </ListItemIcon>
            <ListItemText 
              primary={`ChromaDB Host: ${diagnostics.chromaHost || 'N/A'}`} 
            />
          </ListItem>
          <ListItem>
            <ListItemIcon>
              <InfoIcon color="info" />
            </ListItemIcon>
            <ListItemText 
              primary={`ChromaDB Port: ${diagnostics.chromaPort || 'N/A'}`} 
            />
          </ListItem>
          {diagnostics.latency !== undefined && (
            <ListItem>
              <ListItemIcon>
                <InfoIcon color="info" />
              </ListItemIcon>
              <ListItemText 
                primary={`Last Response Time: ${diagnostics.latency.toFixed(2)}ms`} 
              />
            </ListItem>
          )}
          {diagnostics.connectionError && (
            <ListItem>
              <ListItemIcon>
                <ErrorIcon color="error" />
              </ListItemIcon>
              <ListItemText 
                primary="Connection Error" 
                secondary={diagnostics.connectionError}
              />
            </ListItem>
          )}
        </List>
      </Box>
    );
  };

  // Helper function to render reconnection status
  const renderReconnectionStatus = () => {
    if (!chromaStatus?.diagnostics?.reconnection) return null;
    
    const { reconnection } = chromaStatus.diagnostics;
    
    return (
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Reconnection Status:
        </Typography>
        <List dense>
          <ListItem>
            <ListItemIcon>
              {reconnection.isReconnecting ? <SyncIcon color="info" /> : <InfoIcon color="disabled" />}
            </ListItemIcon>
            <ListItemText 
              primary={reconnection.isReconnecting 
                ? `Auto-reconnecting: ${reconnection.reconnectionAttempts}/${reconnection.maxReconnectionAttempts} attempts` 
                : "Server is not attempting to reconnect"} 
            />
          </ListItem>
        </List>
      </Box>
    );
  };

  return (
    <Modal
      open={open}
      aria-labelledby="initialization-modal-title"
      aria-describedby="initialization-modal-description"
    >
      <Box sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 500,
        maxHeight: '80vh',
        overflow: 'auto',
        bgcolor: 'background.paper',
        boxShadow: 24,
        p: 4,
        borderRadius: 2,
      }}>
        <Typography id="initialization-modal-title" variant="h6" component="h2" gutterBottom>
          Initializing Documentation Assistant
        </Typography>
        
        <Typography id="initialization-modal-description" sx={{ mt: 2, mb: 3 }}>
          {progress || 'Please wait while we process the documentation...'}
        </Typography>
        
        <LinearProgress aria-label="Initialization progress" sx={{ mb: 3 }} />
        
        <Divider sx={{ my: 3 }} />
        
        <Typography variant="h6" gutterBottom>
          System Status
        </Typography>
        
        {loading ? (
          <Typography>Checking ChromaDB connection...</Typography>
        ) : chromaStatus ? (
          <>
            <Box sx={{ mb: 2 }}>
              {chromaStatus.available ? (
                <Alert severity="success" sx={{ mb: 2 }}>
                  ChromaDB is available on port {chromaStatus.diagnostics?.chromaPort || "unknown"}
                </Alert>
              ) : (
                <Alert severity="error" sx={{ mb: 2 }}>
                  ChromaDB is not available on port {chromaStatus.diagnostics?.chromaPort || "unknown"}
                </Alert>
              )}
            </Box>
            
            {chromaStatus.available && chromaStatus.collection && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Collection Status:</Typography>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      {chromaStatus.collection.exists ? <CheckCircleIcon color="success" /> : <WarningIcon color="warning" />}
                    </ListItemIcon>
                    <ListItemText 
                      primary={chromaStatus.collection.exists ? 
                        `Collection "${chromaStatus.collection.name}" exists with ${chromaStatus.collection.count} documents` : 
                        "No collection exists yet"
                      } 
                    />
                  </ListItem>
                </List>
              </Box>
            )}
            
            {/* Display diagnostic information */}
            {renderDiagnostics()}
            
            {/* Display reconnection status information */}
            {renderReconnectionStatus()}
            
            {/* Display troubleshooting steps when ChromaDB is not available */}
            {!chromaStatus.available && renderTroubleshootingSteps()}
            
            {/* Always show the retry buttons when ChromaDB is not available */}
            {!chromaStatus.available && (
              <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <Button 
                  variant="contained" 
                  color="primary" 
                  onClick={handleRetryConnection}
                >
                  Retry Connection
                </Button>
                <Button 
                  variant={autoRetryEnabled ? "contained" : "outlined"} 
                  color={autoRetryEnabled ? "success" : "primary"}
                  onClick={toggleAutoRetry}
                >
                  {autoRetryEnabled ? "Auto-retry Active" : "Enable Auto-retry"}
                </Button>
              </Box>
            )}
            
            {/* Show auto-retry notification */}
            {autoRetryEnabled && !chromaStatus.available && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Automatically retrying connection every 5 seconds...
              </Typography>
            )}
          </>
        ) : (
          <Alert severity="warning">
            Unable to check ChromaDB status
          </Alert>
        )}
      </Box>
    </Modal>
  );
};
InitializationModal.propTypes = {
  open: PropTypes.bool.isRequired,
  progress: PropTypes.string
};

export default InitializationModal;
