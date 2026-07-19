import { Router } from "express";

import { getUserById, updateAvailability } from "../controller/user.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();

router.get("/:id", getUserById);
router.patch("/:id/availability", requireAuth, updateAvailability);

export default router;
