#!/usr/bin/env node
import fs from "node:fs";
const p=JSON.parse(fs.readFileSync("config/assessment-retry-policy.json","utf8"));
if(p.version!==1) throw new Error("retry policy version must be 1");
for(const [name,rule] of Object.entries(p.default||{})){
  if(!["practice","mock_test","official_attempt"].includes(name)) throw new Error("invalid retry mode: "+name);
  if(rule.maxAttempts!==null && (!Number.isInteger(rule.maxAttempts)||rule.maxAttempts<1)) throw new Error("invalid maxAttempts: "+name);
  if(!Number.isInteger(rule.cooldownSeconds)||rule.cooldownSeconds<0) throw new Error("invalid cooldownSeconds: "+name);
}
for(const [id,rule] of Object.entries(p.overrides||{})){
  if(rule.maxAttempts!==null && (!Number.isInteger(rule.maxAttempts)||rule.maxAttempts<1)) throw new Error("invalid override maxAttempts: "+id);
}
console.log("ASSESSMENT RETRY POLICY: VALID");
