"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthSchema = void 0;
const zod_1 = require("zod");
exports.HealthSchema = zod_1.z.object({
    ok: zod_1.z.boolean(),
});
