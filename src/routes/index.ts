import { Router } from "express";
import { IRESTResponse } from "../interfaces/route";
import { APIRouter } from "./api";

export let MainRouter = Router();

MainRouter.use((req, res: IRESTResponse, next) => {
    res.RESTSend = (value: any) => {
        res.json({ status: "success", payload: value });
    };
    res.RESTFail = (message: any) => {
        res.json({ status: "failed", payload: message });
    };
    res.RESTEnd = () => {
        res.json({ status: "success" });
    };
    next();
});

MainRouter.use("/api", APIRouter);
