import assert from "node:assert/strict";
import { test } from "node:test";

import { ICON_GRIDS } from "./icons.ts";
import { PIXEL_SIZE } from "./pixel.ts";

test("every icon is 12×12 of '#' and '.'", () => {
  for (const [name, rows] of Object.entries(ICON_GRIDS)) {
    assert.equal(rows.length, PIXEL_SIZE, name);
    for (const row of rows) assert.match(row, /^[#.]{12}$/, name);
  }
});
