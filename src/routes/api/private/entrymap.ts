import { Router } from "express";
import { Entry } from "../../../schemas/entry";
import { EntryMap } from "../../../schemas/entryMap";
import { validateOne } from "../../../utils";
import { extendQuery, normalizeValidatorError, PaginationGuard, RESTWarp } from "../util";

export const privateEntrymapRouter = Router();

privateEntrymapRouter.get("/", RESTWarp(async (req, res) => {
    req.checkQuery("id", "Invalid query: ID").isString();
    const errors = req.validationErrors();
    if (errors) {
        throw new Error(normalizeValidatorError(errors));
    }
    const map = await EntryMap.findOne({ to: req.query.entry, from: req.query.id });
    if (!map) { throw new Error("Not found"); }
    return res.RESTSend(map);
}));

privateEntrymapRouter.post("/", RESTWarp(async (req, res) => {
    if (!req.admin) { throw new Error("Access denied"); }
    req.checkQuery("id", "Invalid query: ID").isString();
    req.checkBody("admin", "Invalid body: admin").isBoolean();
    const errors = req.validationErrors();
    if (errors) {
        throw new Error(normalizeValidatorError(errors));
    }
    let map = await EntryMap.findOne({ to: req.query.entry, from: req.query.id });
    if (!map) {
        if (!await validateOne(Entry, req.query.id)) { throw new Error("Entry not found"); }
        map = new EntryMap();
        map.from = req.query.id;
        map.to = req.query.entry;
    }
    map.admin = req.body.admin;
    await map.save();
    return res.RESTEnd();
}));

privateEntrymapRouter.delete("/", RESTWarp(async (req, res) => {
    if (!req.admin) { throw new Error("Access denied"); }
    req.checkQuery("id", "Invalid query: ID").isString();
    const errors = req.validationErrors();
    if (errors) {
        throw new Error(normalizeValidatorError(errors));
    }
    const map = await EntryMap.findOne({ to: req.query.entry, from: req.query.id });
    if (!map) { throw new Error("Not found"); }
    await map.remove();
    return res.RESTEnd();
}));

privateEntrymapRouter.get("/count", RESTWarp(async (req, res) => {
    let query = EntryMap.find().where("to").equals(req.query.entry);
    query = extendQuery(query, req.query.control);
    return res.RESTSend(await query.countDocuments());
}));

privateEntrymapRouter.get("/list", PaginationGuard, RESTWarp(async (req, res) => {
    let query = EntryMap.find().where("to").equals(req.query.entry);
    query = extendQuery(query, req.query.control);
    const result = await query.skip(req.pagination.skip).limit(req.pagination.limit);
    return res.RESTSend(result);
}));
