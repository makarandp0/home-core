"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiResponse = void 0;
const zod_1 = require("zod");
const apiResponse = (data) => zod_1.z.object({
    ok: zod_1.z.boolean(),
    data: data.optional(),
    error: zod_1.z.string().optional(),
});
exports.apiResponse = apiResponse;
