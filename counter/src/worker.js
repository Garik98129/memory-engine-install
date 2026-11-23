// The setup counter's Worker (memory-engine, docs/DESIGN_PHASE3.md §5a, «The counter»). The main
// module exports its handler and nothing else — workerd refuses one that exports constants or other
// functions («Incorrect type for map entry»); the logic is in src/counter.js.
import { handle } from "./counter.js";

export default {
  fetch(request, env) {
    return handle(request, env);
  },
};
