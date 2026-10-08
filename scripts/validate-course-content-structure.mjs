import fs from "node:fs";
import path from "node:path";

const root=process.cwd();
const coursesRoot=path.join(root,"content","courses");
if(!fs.existsSync(coursesRoot)){console.log("COURSE STRUCTURE: NO COURSE DIRECTORY");process.exit(0);}

const errors=[];
const readJson=(p)=>JSON.parse(fs.readFileSync(p,"utf8"));
const exists=(p)=>fs.existsSync(path.join(root,p));

for(const courseDirName of fs.readdirSync(coursesRoot)){
  const courseDir=path.join(coursesRoot,courseDirName);
  if(!fs.statSync(courseDir).isDirectory()) continue;
  const manifestPath=path.join(courseDir,"manifest.json");
  const courseMapPath=path.join(courseDir,"course-map.json");
  const moduleMapPath=path.join(courseDir,"module-map.json");
  if(!fs.existsSync(manifestPath)) { errors.push(courseDirName+": missing manifest.json"); continue; }
  if(!fs.existsSync(courseMapPath)) errors.push(courseDirName+": missing course-map.json");
  if(!fs.existsSync(moduleMapPath)) errors.push(courseDirName+": missing module-map.json");
  const manifest=readJson(manifestPath);
  if(manifest.domain!=="course") errors.push(courseDirName+": manifest domain must be course");
  if(manifest.locator?.course!==courseDirName) errors.push(courseDirName+": manifest locator.course mismatch");
  const packages=manifest.assets?.authoringPackages||[];
  if(!Array.isArray(packages)||packages.length===0) errors.push(courseDirName+": manifest must reference authoring packages");

  let courseMap=null,moduleMap=null;
  if(fs.existsSync(courseMapPath)) courseMap=readJson(courseMapPath);
  if(fs.existsSync(moduleMapPath)) moduleMap=readJson(moduleMapPath);
  const seenLessons=new Set();
  let expectedModuleSeq=1;
  for(const mod of (courseMap?.modules||[])){
    if(mod.sequence!==expectedModuleSeq) errors.push(courseDirName+": course-map module sequence must be contiguous");
    expectedModuleSeq++;
    let expectedLessonSeq=1;
    for(const lesson of (mod.lessons||[])){
      if(seenLessons.has(lesson.lessonId)) errors.push(courseDirName+": duplicate lessonId "+lesson.lessonId);
      seenLessons.add(lesson.lessonId);
      if(lesson.sequence!==expectedLessonSeq) errors.push(courseDirName+": lesson sequence gap in "+mod.moduleId);
      expectedLessonSeq++;
      if(!lesson.package || !exists(lesson.package)) errors.push(courseDirName+": missing lesson package "+lesson.package);
    }
  }
  const mapLessonIds=new Set((courseMap?.modules||[]).flatMap(m=>(m.lessons||[]).map(l=>l.lessonId)));
  for(const p of packages){
    if(!exists(p)) errors.push(courseDirName+": manifest package missing "+p);
    else {
      const pkg=readJson(path.join(root,p));
      if(pkg.locator?.course!==courseDirName) errors.push(courseDirName+": package course mismatch "+p);
      if(!mapLessonIds.has(pkg.locator?.lesson)) errors.push(courseDirName+": package lesson not present in course-map "+p);
    }
  }
  for(const lessonId of mapLessonIds){
    const matched=packages.some(p=>exists(p)&&readJson(path.join(root,p)).locator?.lesson===lessonId);
    if(!matched) errors.push(courseDirName+": course-map lesson missing from manifest assets "+lessonId);
  }
  const moduleIds=new Set((courseMap?.modules||[]).map(m=>m.moduleId));
  for(const mod of (moduleMap?.modules||[])){
    if(!moduleIds.has(mod.moduleId)) errors.push(courseDirName+": module-map references unknown module "+mod.moduleId);
    for(const lessonId of (mod.lessons||[])) if(!mapLessonIds.has(lessonId)) errors.push(courseDirName+": module-map references unknown lesson "+lessonId);
  }
  console.log("CHECKED: "+courseDirName+" | "+mapLessonIds.size+" lessons | "+packages.length+" packages");
}
if(errors.length){console.error(errors.map(e=>"- "+e).join("\n"));process.exit(1);}
console.log("COURSE STRUCTURE: PASS");
