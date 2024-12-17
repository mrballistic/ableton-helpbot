import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Mock fetch globally
global.fetch = vi.fn();

function createFetchResponse(data) {
  return { json: () => new Promise((resolve) => resolve(data)), ok: true };
}

describe('App', () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    fetch.mockReset();
    
    // Mock the health check endpoint
    fetch.mockImplementation((url) => {
      if (url.includes('/api/health')) {
        return Promise.resolve(createFetchResponse({ 
          status: 'ready',
          isInitializing: false,
          progress: ''
        }));
      }
      return Promise.resolve(createFetchResponse({}));
    });
  });

  it('renders the header with title and robot icon', () => {
    render(<App />);
    expect(screen.getByText('Ableton Documentation Assistant')).toBeInTheDocument();
    expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();
  });

  describe('Initialization States', () => {
    it('shows initialization modal with progress', async () => {
      const progressMessage = 'Processing PDF files: 50% complete';
      fetch.mockImplementationOnce(() => 
        Promise.resolve(createFetchResponse({ 
          status: 'initializing',
          isInitializing: true,
          progress: progressMessage
        }))
      );

      render(<App />);
      
      await waitFor(() => {
        expect(screen.getByText('Initializing Documentation Assistant')).toBeInTheDocument();
        expect(screen.getByText(progressMessage)).toBeInTheDocument();
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });
    });

    it('updates progress message in modal', async () => {
      const user = userEvent.setup();
      const progressMessages = [
        'Starting initialization...',
        'Processing PDF files...',
        'Generating embeddings: 50% complete...',
        'Initialization complete'
      ];
      
      let currentMessageIndex = 0;
      fetch.mockImplementation(() => 
        Promise.resolve(createFetchResponse({ 
          status: currentMessageIndex === progressMessages.length - 1 ? 'ready' : 'initializing',
          isInitializing: currentMessageIndex < progressMessages.length - 1,
          progress: progressMessages[currentMessageIndex++]
        }))
      );

      render(<App />);

      // Verify progress updates
      for (const message of progressMessages.slice(0, -1)) {
        await waitFor(() => {
          expect(screen.getByText(message)).toBeInTheDocument();
        });
      }

      // Verify modal closes after completion
      await waitFor(() => {
        expect(screen.queryByText('Initializing Documentation Assistant')).not.toBeInTheDocument();
      });
    });

    it('shows error state in modal', async () => {
      fetch.mockImplementationOnce(() => 
        Promise.resolve(createFetchResponse({ 
          status: 'error',
          isInitializing: false,
          error: 'Failed to initialize vector store',
          progress: 'Initialization failed'
        }))
      );

      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Failed to initialize vector store/)).toBeInTheDocument();
      });
    });
  });

  describe('Chat Functionality', () => {
    it('handles successful chat interaction', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Ask a question about Ableton...')).toBeEnabled();
      });

      const input = screen.getByPlaceholderText('Ask a question about Ableton...');
      const testMessage = 'What is Session View?';

      fetch.mockImplementationOnce(() => 
        Promise.resolve(createFetchResponse({
          response: 'Session View is a workspace in Ableton Live.',
          context: [{ content: 'Test context', metadata: {} }]
        }))
      );

      await user.type(input, testMessage);
      await user.click(screen.getByRole('button', { name: 'Send message' }));

      await waitFor(() => {
        expect(screen.getByText(testMessage)).toBeInTheDocument();
        expect(screen.getByText('Session View is a workspace in Ableton Live.')).toBeInTheDocument();
      });
    });

    it('shows loading state during chat', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Ask a question about Ableton...')).toBeEnabled();
      });

      fetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve(createFetchResponse({
          response: 'Test response',
          context: [{ content: 'Test context', metadata: {} }]
        })), 100))
      );

      const input = screen.getByPlaceholderText('Ask a question about Ableton...');
      await user.type(input, 'Test message');
      await user.click(screen.getByRole('button', { name: 'Send message' }));

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(input).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();

      await waitFor(() => {
        expect(input).toBeEnabled();
        expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled();
      });
    });

    it('handles chat errors', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Ask a question about Ableton...')).toBeEnabled();
      });

      fetch.mockImplementationOnce(() => Promise.reject(new Error('API Error')));

      const input = screen.getByPlaceholderText('Ask a question about Ableton...');
      await user.type(input, 'Test message');
      await user.click(screen.getByRole('button', { name: 'Send message' }));

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Failed to generate response/);
      });
    });
  });

  describe('Accessibility', () => {
    it('announces loading states to screen readers', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Ask a question about Ableton...')).toBeEnabled();
      });

      fetch.mockImplementationOnce(() => 
        new Promise(resolve => setTimeout(() => resolve(createFetchResponse({
          response: 'Test response'
        })), 100))
      );

      const input = screen.getByPlaceholderText('Ask a question about Ableton...');
      await user.type(input, 'Test message');
      await user.click(screen.getByRole('button', { name: 'Send message' }));

      expect(screen.getByText('Processing your request...')).toBeInTheDocument();
    });

    it('maintains focus management', async () => {
      const user = userEvent.setup();
      render(<App />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Ask a question about Ableton...')).toBeEnabled();
      });

      const input = screen.getByPlaceholderText('Ask a question about Ableton...');
      await user.type(input, 'Test message{Enter}');

      fetch.mockImplementationOnce(() => 
        Promise.resolve(createFetchResponse({
          response: 'Test response'
        }))
      );

      await waitFor(() => {
        expect(document.activeElement).toBe(input);
      });
    });
  });
});
