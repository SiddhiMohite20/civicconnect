import { Router } from 'express';
import { query } from 'express-validator';
import { Organization } from '../models/Organization.js';
import { Category } from '../models/Category.js';
import { asyncHandler, validate, isId } from '../utils/http.js';

const router = Router();
// Public lookup data used by the registration and report forms.
router.get('/organizations', asyncHandler(async (_req, res) => {
  const orgs = await Organization.find({ isActive: true }).select('name jurisdictions').lean();
  res.json({ organizations: orgs.map((o) => ({ _id: o._id, name: o.name, jurisdictions: o.jurisdictions.filter((j) => j.isActive).map((j) => ({ _id: j._id, name: j.name })) })) });
}));
router.get('/categories', [query('organizationId').custom(isId)], validate, asyncHandler(async (req, res) => {
  res.json({ categories: await Category.find({ organization: req.query.organizationId, isActive: true }).select('name color').sort('name').lean() });
}));
export default router;
