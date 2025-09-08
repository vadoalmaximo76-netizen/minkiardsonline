import { Router } from 'express';
import { replayManager } from '../replayManager';

const router = Router();

// Get match history
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const matches = await replayManager.getMatchHistory(limit);
    res.json(matches);
  } catch (error) {
    console.error('Error fetching match history:', error);
    res.status(500).json({ error: 'Failed to fetch match history' });
  }
});

// Get specific match details
router.get('/:matchId', async (req, res) => {
  try {
    const matchId = parseInt(req.params.matchId);
    const { match, events } = await replayManager.getMatchDetails(matchId);
    
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }
    
    res.json({ match, events });
  } catch (error) {
    console.error('Error fetching match details:', error);
    res.status(500).json({ error: 'Failed to fetch match details' });
  }
});

// Get replay data for a match
router.get('/:matchId/replay', async (req, res) => {
  try {
    const matchId = parseInt(req.params.matchId);
    const replayData = await replayManager.getReplayData(matchId);
    
    if (!replayData.match) {
      return res.status(404).json({ error: 'Match not found' });
    }
    
    res.json(replayData);
  } catch (error) {
    console.error('Error fetching replay data:', error);
    res.status(500).json({ error: 'Failed to fetch replay data' });
  }
});

export default router;