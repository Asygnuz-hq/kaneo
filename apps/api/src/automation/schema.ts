import { z } from "../openapi";

export const projectIdParam = z.object({ projectId: z.string() });

export const automationRuleParam = z.object({ id: z.string() });

// Both configs are validated per triggerType/actionType in
// validate-automation-rule.ts, not by this shape -- the body schema only
// needs to accept "some JSON object" here.
const configObject = z.record(z.string(), z.unknown()).default({});
// No .default() here on purpose: in an update, an absent field must stay
// `undefined` so the controller can tell "not provided, keep the existing
// value" apart from "provided as {}" (an explicit clear).
const configObjectOptional = z.record(z.string(), z.unknown()).optional();

export const createAutomationRuleBody = z.object({
  projectId: z.string(),
  name: z.string().min(1),
  triggerType: z.string(),
  triggerConfig: configObject,
  actionType: z.string(),
  actionConfig: configObject,
});

export const updateAutomationRuleBody = z.object({
  name: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  triggerType: z.string().optional(),
  triggerConfig: configObjectOptional,
  actionType: z.string().optional(),
  actionConfig: configObjectOptional,
});
