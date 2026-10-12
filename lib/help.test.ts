import assert from "node:assert/strict";
import { test } from "node:test";

import { helpTopic } from "./help.ts";

test("every screen gets its own topic", () => {
  assert.equal(helpTopic("/"), "dashboard");
  assert.equal(helpTopic("/search"), "search");
  assert.equal(helpTopic("/drafts"), "drafts");
  assert.equal(helpTopic("/drafts/20f12b27-5815"), "draft");
  assert.equal(helpTopic("/recipes/new"), "newRecipe");
  assert.equal(helpTopic("/recipes/zurek"), "recipe");
  assert.equal(helpTopic("/recipes/zurek/edit"), "editRecipe");
  assert.equal(helpTopic("/settings"), "settings");
});

test("a recipe slug is not mistaken for the new-recipe screen, and vice versa", () => {
  assert.equal(helpTopic("/recipes/new/edit"), "editRecipe");
  assert.equal(helpTopic("/recipes/newcastle-pie"), "recipe");
});

test("anything else is lost, not guessed", () => {
  assert.equal(helpTopic("/recipes"), "lost");
  assert.equal(helpTopic("/settings/extra"), "lost");
  assert.equal(helpTopic("/nope"), "lost");
});
