import { 
  Box, 
  Typography,
  Modal,
  LinearProgress
} from '@mui/material';

const InitializationModal = ({ open, progress }) => (
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
        {progress || 'Please wait while we process the documentation...'}
      </Typography>
      <LinearProgress aria-label="Initialization progress" />
    </Box>
  </Modal>
);

export default InitializationModal;
