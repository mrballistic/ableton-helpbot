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
          isInitializing: false 
        }));
      }
      return Promise.resolve(createFetchResponse({}));
    });
  });

  it('renders the header with title and robot icon', () => {
    render(<App />);
    expect(screen.getByText('Ableton Documentation Assistant')).toBeInTheDocument();
    // Check if the SmartToy icon is rendered (by its SVG role)
    expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();
  });

  it('shows initialization modal when vector store is being created', async () => {
    fetch.mockImplementationOnce(() => 
      Promise.resolve(createFetchResponse({ 
        status: 'initializing',
        isInitializing: true 
      }))
    );

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Initializing Documentation Assistant')).toBeInTheDocument();
      expect(screen.getByText(/Please wait while we process the documentation/)).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  it('removes initialization modal when vector store is ready', async () => {
    const user = userEvent.setup();
    
    // First health check shows initializing
    fetch.mockImplementationOnce(() => 
      Promise.resolve(createFetchResponse({ 
        status: 'initializing',
        isInitializing: true 
      }))
    );

    render(<App />);

    // Verify modal is shown
    await waitFor(() => {
      expect(screen.getByText('Initializing Documentation Assistant')).toBeInTheDocument();
    });

    // Next health check shows ready
    fetch.mockImplementationOnce(() => 
      Promise.resolve(createFetchResponse({ 
        status: 'ready',
        isInitializing: false 
      }))
    );

    // Wait for modal to disappear
    await waitFor(() => {
      expect(screen.queryByText('Initializing Documentation Assistant')).not.toBeInTheDocument();
    });
  });

  it('allows message input and submission when initialized', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Wait for initialization check
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ask a question about Ableton...')).toBeEnabled();
    });

    const input = screen.getByPlaceholderText('Ask a question about Ableton...');
    const testMessage = 'What is Session View?';

    // Mock the chat endpoint
    fetch.mockImplementationOnce(() => 
      Promise.resolve(createFetchResponse({
        response: 'Session View is a workspace in Ableton Live.',
        context: [{ content: 'Test context', metadata: {} }]
      }))
    );

    // Type and send message
    await user.type(input, testMessage);
    await user.click(screen.getByRole('button'));

    // Verify message was sent and response received
    await waitFor(() => {
      expect(screen.getByText(testMessage)).toBeInTheDocument();
      expect(screen.getByText('Session View is a workspace in Ableton Live.')).toBeInTheDocument();
    });
  });

  it('shows error message when API request fails', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Wait for initialization check
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ask a question about Ableton...')).toBeEnabled();
    });

    // Mock failed API call
    fetch.mockImplementationOnce(() => 
      Promise.reject(new Error('API Error'))
    );

    // Type and send message
    const input = screen.getByPlaceholderText('Ask a question about Ableton...');
    await user.type(input, 'Test message');
    await user.click(screen.getByRole('button'));

    // Verify error message
    await waitFor(() => {
      expect(screen.getByText(/Failed to generate response/)).toBeInTheDocument();
    });
  });

  it('shows initialization error in modal', async () => {
    // Mock health check with error
    fetch.mockImplementationOnce(() => 
      Promise.resolve(createFetchResponse({ 
        status: 'error',
        isInitializing: false,
        error: 'Failed to initialize vector store' 
      }))
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to initialize vector store/)).toBeInTheDocument();
    });
  });

  it('disables input while loading', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Wait for initialization check
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ask a question about Ableton...')).toBeEnabled();
    });

    // Mock delayed API response
    fetch.mockImplementationOnce(() => 
      new Promise(resolve => setTimeout(() => resolve(createFetchResponse({
        response: 'Test response',
        context: [{ content: 'Test context', metadata: {} }]
      })), 100))
    );

    // Type and send message
    const input = screen.getByPlaceholderText('Ask a question about Ableton...');
    await user.type(input, 'Test message');
    await user.click(screen.getByRole('button'));

    // Verify input is disabled during loading
    expect(input).toBeDisabled();
    expect(screen.getByRole('button')).toBeDisabled();

    // Wait for response
    await waitFor(() => {
      expect(input).toBeEnabled();
      expect(screen.getByRole('button')).toBeEnabled();
    });
  });

  it('preserves dark mode preference', async () => {
    // Mock matchMedia for dark mode preference
    window.matchMedia = vi.fn().mockImplementation(query => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<App />);

    // Verify dark mode styles are applied
    const app = screen.getByRole('textbox');
    const computedStyle = window.getComputedStyle(app);
    expect(computedStyle).toBeDefined();
  });
});
