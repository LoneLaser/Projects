import React from 'react';
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  AppBar,
  CssBaseline,
  Divider,
  Avatar,
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import CodeIcon from '@mui/icons-material/Code';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ScheduleIcon from '@mui/icons-material/Schedule';
import EmailIcon from '@mui/icons-material/Email';
import HistoryIcon from '@mui/icons-material/History';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import InsightsIcon from '@mui/icons-material/Insights';
import { useAppStore } from '../../store';

const DRAWER_WIDTH = 260;

const tabs = [
  { label: 'Data Sources', icon: <StorageIcon fontSize="small" /> },
  { label: 'Queries', icon: <CodeIcon fontSize="small" /> },
  { label: 'Reports', icon: <DashboardIcon fontSize="small" /> },
  { label: 'Scheduler', icon: <ScheduleIcon fontSize="small" /> },
  { label: 'Distribution', icon: <EmailIcon fontSize="small" /> },
  { label: 'History', icon: <HistoryIcon fontSize="small" /> },
  { label: 'AI Assistant', icon: <AutoAwesomeIcon fontSize="small" /> },
];

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const activeTab = useAppStore((s) => s.activeTab);
  const setActiveTab = useAppStore((s) => s.setActiveTab);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <CssBaseline />

      {/* ── Top AppBar ── */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <Toolbar sx={{ gap: 1.5 }}>
          <Avatar
            sx={{
              width: 36,
              height: 36,
              background: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <InsightsIcon sx={{ fontSize: 20 }} />
          </Avatar>
          <Typography
            variant="h6"
            noWrap
            sx={{
              fontWeight: 700,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(to right, #fff 0%, rgba(255,255,255,0.85) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Data Report Generator
          </Typography>
        </Toolbar>
      </AppBar>

      {/* ── Sidebar ── */}
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            border: 'none',
            bgcolor: '#ffffff',
            boxShadow: '1px 0 0 #e2e8f0',
          },
        }}
      >
        <Toolbar />
        <Box sx={{ px: 1, py: 2, flex: 1 }}>
          <Typography
            variant="overline"
            sx={{
              px: 2,
              mb: 1,
              display: 'block',
              color: 'text.secondary',
              fontSize: '0.68rem',
              fontWeight: 700,
              letterSpacing: '0.1em',
            }}
          >
            Navigation
          </Typography>
          <List className="sidebar-nav" disablePadding>
            {tabs.map((tab, index) => (
              <ListItemButton
                key={tab.label}
                selected={activeTab === index}
                onClick={() => setActiveTab(index)}
                sx={{ mb: 0.25 }}
              >
                <ListItemIcon>{tab.icon}</ListItemIcon>
                <ListItemText
                  primary={tab.label}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: activeTab === index ? 600 : 400,
                  }}
                />
              </ListItemButton>
            ))}
          </List>
        </Box>

        {/* Sidebar footer */}
        <Divider />
        <Box sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
            v1.0.0
          </Typography>
        </Box>
      </Drawer>

      {/* ── Main Content ── */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 4 },
          maxWidth: '100%',
          overflow: 'auto',
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
