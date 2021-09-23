import { handler } from "./index.js";

const result = await handler({}, {});
console.log("Result=", { result });
