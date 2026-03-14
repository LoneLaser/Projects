import React from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', p: 4 }}>
          <Paper sx={{ p: 4, maxWidth: 600, width: '100%' }}>
            <Typography variant="h5" color="error" gutterBottom>
              Application Error
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', mb: 2 }}>
              {this.state.error?.message}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', display: 'block', mb: 2 }}>
              {this.state.error?.stack}
            </Typography>
            <Button variant="contained" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </Paper>
        </Box>
      );
    }
    return this.props.children;
  }
}
