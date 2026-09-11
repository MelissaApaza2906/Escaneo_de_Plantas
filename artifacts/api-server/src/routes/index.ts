import { Router, type IRouter } from "express";
import healthRouter from "./health";
import plantIdentifyRouter from "./plant-identify";

const router: IRouter = Router();

router.use(healthRouter);
router.use(plantIdentifyRouter);

export default router;
