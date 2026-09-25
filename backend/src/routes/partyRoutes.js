import express from 'express';
import { createParty, getPartyByCode, getPartyMessages } from '../controllers/partyController.js';

const router = express.Router();

router.post('/create', createParty);
router.get('/:code', getPartyByCode);
router.get('/:code/messages', getPartyMessages);

export default router;
