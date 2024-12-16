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
        return Promise.resolve(createFetchResponse({ isInitializing: false }));
      }
      return Promise.resolve(createFetchResponse({}));
    });
  });

  it('renders the header with title and icon', () => {
    render(<App />);
    expect(screen.getByText('Ableton Documentation Assistant')).toBeInTheDocument();
    // Check if the SmartToy icon is rendered (by its SVG role)
    expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();
  });

  it('shows initialization modal when isInitializing is true', async () => {
    fetch.mockImplementationOnce(() => 
      Promise.resolve(createFetchResponse({ isInitializing: true }))
    );

    render(<App />);
    
    await waitFor(() => {
      expect(screen.getByText('Initializing Documentation Assistant')).toBeInTheDocument();
    });
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
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
      expect(screen.getByText('Failed to generate response. Please ensure the server is running.')).toBeInTheDocument();
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
        response: 'Test response'
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

  it('handles Enter key press to send message', async () => {
    const user = userEvent.setup();
    render(<App />);

    // Wait for initialization check
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Ask a question about Ableton...')).toBeEnabled();
    });

    // Mock the chat endpoint
    fetch.mockImplementationOnce(() => 
      Promise.resolve(createFetchResponse({
        response: 'Test response'
      }))
    );

    // Type message and press Enter
    const input = screen.getByPlaceholderText('Ask a question about Ableton...');
    await user.type(input, 'Test message{Enter}');

    // Verify message was sent
    await waitFor(() => {
      expect(screen.getByText('Test message')).toBeInTheDocument();
      expect(screen.getByText('Test response')).toBeInTheDocument();
    });
  });
});
