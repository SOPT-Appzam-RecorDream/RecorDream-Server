import { Router } from "express";
import { body } from "express-validator";
import NoticeController from "../controllers/NoticeController";
import auth from "../middleware/auth";

const router: Router = Router();

router.put("/:noticeId", [body("time").trim().notEmpty(), body("fcm_token").notEmpty()], NoticeController.updateNotice);

export default router;
