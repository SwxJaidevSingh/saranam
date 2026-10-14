import React from 'react';
import { Box, Button, Typography, Paper, List, ListItem, ListItemText } from '@mui/material';

const ConflictResolver = ({ suggestions, onResolve, onNext, onBack }) => {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="h6" gutterBottom>Conflict Resolution</Typography>
      
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography gutterBottom>
          Total Conflicts to Resolve: {suggestions?.total_conflicts || 0}
        </Typography>
        <List>
          {(suggestions?.suggestions || []).map((sugg, idx) => (
            <ListItem key={idx}>
              <ListItemText 
                primary={`Row ${sugg.row} Conflict`} 
                secondary={sugg.suggestions?.map(opt => `${opt.date} at ${opt.time}`).join(' or ')} 
              />
            </ListItem>
          ))}
        </List>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
        <Button onClick={onBack}>Back</Button>
        <Button onClick={onResolve} variant="outlined" color="warning">Auto-Resolve All</Button>
        <Button onClick={onNext} variant="contained">Next: Create</Button>
      </Box>
    </Box>
  );
};

export default ConflictResolver;
