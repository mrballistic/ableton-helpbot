import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

// Mock fetch globally
global.fetch = vi.fn();

function createFetchResponse(data) {
  return { json: () => new Promise((resolve) => resolve(data)), ok: true };
}

describe('App Integration', () => {
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

  describe('Initialization Flow', () => {
    it('completes full initialization process', async () => {
      const progressStates = [
        { status: 'initializing', isInitializing: true, progress: 'Loading PDFs...' },
        { status: 'initializing', isInitializing: true, progress: 'Processing text...' },
        { status: 'initializing', isInitializing: true, progress: 'Creating embeddings...' },
        { status: 'ready', isInitializing: false, progress: '' }
      ];

      let currentState = 0;
      fetch.mockImplementation((url) => {
        if (url.includes('/api/health')) {
          return Promise.resolve(createFetchResponse(progressStates[currentState++ % progressStates.length]));
        }
        return Promise.resolve(createFetchResponse({}));
      });

      render(<App />);

      // Verify initialization states
      await waitFor(() => {
        expect(screen.getByText('Loading PDFs...')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Processing text...')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Creating embeddings...')).toBeInTheDocument();
      });

      // Verify ready state
      await waitFor(() => {
        expect(screen.queryByText('Initializing Documentation Assistant')).not.toBeInTheDocument();
        expect(screen.getByPlaceholderText('Ask a question about Ableton...')).toBeEnabled();
      });
    });
  });

  describe('Chat Flow', () => {
    it('completes full chat interaction flow', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Ask a question about Ableton...')).toBeEnabled();
      });

      // Mock chat response
      fetch.mockImplementationOnce(() => 
        Promise.resolve(createFetchResponse({
          response: 'Session View is a workspace in Ableton Live.',
          context: [
            { content: 'Session View is where you create and experiment with musical ideas.', metadata: {} },
            { content: 'You can trigger clips and scenes in Session View.', metadata: {} }
          ]
        }))
      );

      // Type and send message
      const input = screen.getByPlaceholderText('Ask a question about Ableton...');
      await user.type(input, 'What is Session View?');
      await user.click(screen.getByRole('button', { name: 'Send message' }));

      // Verify loading state
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(input).toBeDisabled();

      // Verify response
      await waitFor(() => {
        expect(screen.getByText('Session View is a workspace in Ableton Live.')).toBeInTheDocument();
      });

      // Verify context
      await user.click(screen.getByText('Show source'));
      expect(screen.getByText('Session View is where you create and experiment with musical ideas.')).toBeInTheDocument();
      expect(screen.getByText('You can trigger clips and scenes in Session View.')).toBeInTheDocument();

      // Verify ready for next interaction
      expect(input).toBeEnabled();
      expect(input).toHaveFocus();
    });

    it('handles error states gracefully', async () => {
      const user = userEvent.setup();
      render(<App />);

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Ask a question about Ableton...')).toBeEnabled();
      });

      // Mock error response
      fetch.mockImplementationOnce(() => Promise.reject(new Error('Server error')));

      // Type and send message
      await user.type(screen.getByPlaceholderText('Ask a question about Ableton...'), 'Test message');
      await user.click(screen.getByRole('button', { name: 'Send message' }));

      // Verify error handling
      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(/Failed to generate response/);
      });

      // Verify recovery
      expect(screen.getByPlaceholderText('Ask a question about Ableton...')).toBeEnabled();
    });
  });
});
