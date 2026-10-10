#!/usr/bin/env node
import fs from "node:fs";
const s=fs.readFileSync("scripts/promote-assessment.mjs","utf8");
if(!s.includes("Direct draft -> published promotion is forbidden")) throw new Error("missing direct-publish guard");
if(!s.includes('if(a.status!=="reviewed") throw new Error("Only reviewed assessments may transition to published")')) throw new Error("missing reviewed-state guard");
if(!s.includes('if(!audit||audit.decision!=="approved_for_publication") throw new Error("Publication audit decision must be approved_for_publication")')) throw new Error("missing publication approval guard");
console.log("CONTROLLED ASSESSMENT PROMOTION: VALID");
