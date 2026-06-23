import express from 'express';
import { ObjectId } from 'mongodb';
import { getDb } from '../db.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(authMiddleware);

// ─── GET /api/parcelles ──────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const parcelles = await db.collection('parcelles')
      .find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(parcelles.map(p => ({ ...p, _id: p._id.toString() })));
  } catch (err) {
    console.error('[GET PARCELLES ERROR]', err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── POST /api/parcelles ─────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const {
      intitule, wilayaId, wilayaName, superficie, acquisitionDate,
      cultures, irrigationMethod, soilType, latitude, longitude,
    } = req.body;

    if (!intitule || !intitule.trim()) {
      return res.status(400).json({ error: 'Le nom de la parcelle est obligatoire.' });
    }
    if (!superficie || parseFloat(superficie) <= 0) {
      return res.status(400).json({ error: 'La superficie doit être supérieure à 0.' });
    }

    const parcelle = {
      userId: req.user.userId,
      intitule: intitule.trim(),
      wilayaId: wilayaId || null,
      wilayaName: wilayaName || null,
      superficie: parseFloat(superficie),
      acquisitionDate: acquisitionDate || null,
      cultures: Array.isArray(cultures) ? cultures : [],
      irrigationMethod: irrigationMethod || null,
      soilType: soilType || null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const db = getDb();
    const result = await db.collection('parcelles').insertOne(parcelle);
    res.status(201).json({ ...parcelle, _id: result.insertedId.toString() });
  } catch (err) {
    console.error('[CREATE PARCELLE ERROR]', err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── PUT /api/parcelles/:id ──────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID invalide.' });

    const {
      intitule, wilayaId, wilayaName, superficie, acquisitionDate,
      cultures, irrigationMethod, soilType, latitude, longitude,
    } = req.body;

    const updates = { updatedAt: new Date() };
    if (intitule !== undefined) updates.intitule = intitule.trim();
    if (wilayaId !== undefined) updates.wilayaId = wilayaId;
    if (wilayaName !== undefined) updates.wilayaName = wilayaName;
    if (superficie !== undefined) updates.superficie = parseFloat(superficie);
    if (acquisitionDate !== undefined) updates.acquisitionDate = acquisitionDate;
    if (cultures !== undefined) updates.cultures = Array.isArray(cultures) ? cultures : [];
    if (irrigationMethod !== undefined) updates.irrigationMethod = irrigationMethod;
    if (soilType !== undefined) updates.soilType = soilType;
    if (latitude !== undefined) updates.latitude = latitude ? parseFloat(latitude) : null;
    if (longitude !== undefined) updates.longitude = longitude ? parseFloat(longitude) : null;

    const db = getDb();
    const result = await db.collection('parcelles').updateOne(
      { _id: new ObjectId(id), userId: req.user.userId },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Parcelle introuvable.' });
    }

    res.json({ message: 'Parcelle mise à jour.', updates });
  } catch (err) {
    console.error('[UPDATE PARCELLE ERROR]', err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// ─── DELETE /api/parcelles/:id ───────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ error: 'ID invalide.' });

    const db = getDb();
    const result = await db.collection('parcelles').deleteOne(
      { _id: new ObjectId(id), userId: req.user.userId }
    );

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Parcelle introuvable.' });
    }

    res.json({ message: 'Parcelle supprimée.' });
  } catch (err) {
    console.error('[DELETE PARCELLE ERROR]', err.message);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

export default router;
