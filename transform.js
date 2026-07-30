const fs = require('fs');
const path = require('path');

const newPlayerPath = path.join(__dirname, 'NewPlayer/src/components/VideoPlayer.tsx');
const lessonPlayerPath = path.join(__dirname, 'src/components/Study/LessonPlayer.tsx');

const newPlayerSrc = fs.readFileSync(newPlayerPath, 'utf8');

// 1. Extract imports from NewPlayer (excluding lucide-react which we will redefine)
let importsMatch = newPlayerSrc.match(/import[\s\S]*?from ['"][^'"]+['"];/g);
let imports = importsMatch.filter(m => !m.includes('lucide-react') && !m.includes('VideoPlayer') && !m.includes('SOURCES')).join('\n');

// Add lucide-react imports that LessonPlayer needs
imports += `\nimport { Lock, FileText, Video as VideoIcon } from "lucide-react";\n`;
imports += `\nimport VideoWatermark from "@/components/ContentProtection/VideoWatermark";\n`;
imports += `\nimport styles from "./LessonPlayer.module.css";\n`;

// 2. Extract FloatingTag
const floatingTagMatch = newPlayerSrc.match(/\/\/ Floating Tag Component[\s\S]*?(?=\/\/ =+)/);
let floatingTag = floatingTagMatch ? floatingTagMatch[0] : '';

// 3. Extract polyfills
const polyfillsMatch = newPlayerSrc.match(/export function applyYoutubePolyfills\(\) {[\s\S]*?(?=\/\/ =+)/);
let polyfills = polyfillsMatch ? polyfillsMatch[0] : '';

// 4. Extract InternalPlayer and UI components (excluding VimeoVideo)
const internalPlayerMatch = newPlayerSrc.match(/\/\/ =+\r?\n\/\/ InternalPlayer[\s\S]*?(?=\/\/ =+\r?\n\/\/ Multi-Source Wrapper Player)/);
let internalPlayerCode = internalPlayerMatch ? internalPlayerMatch[0] : '';

// Remove VimeoVideo component definition
internalPlayerCode = internalPlayerCode.replace(/function VimeoVideo\([^)]*\)\s*{[\s\S]*?}\n\n/g, '');

// Remove Vimeo type and rendering logic from InternalPlayer
internalPlayerCode = internalPlayerCode.replace(/type\s*===\s*'vimeo'\s*\?\s*\(\s*<VimeoVideo[^>]*>\s*\)\s*:\s*/g, '');
internalPlayerCode = internalPlayerCode.replace(/type\s*===\s*'vimeo'/g, 'false');

// 5. Replace the PlayerCore in LessonPlayer.tsx with InternalPlayer
const oldLessonPlayerSrc = fs.readFileSync(lessonPlayerPath, 'utf8');

// Extract the LessonPlayerProps interface
const propsMatch = oldLessonPlayerSrc.match(/interface LessonPlayerProps {[\s\S]*?}/);
let propsInterface = propsMatch ? propsMatch[0] : '';

// Extract the LessonPlayer export function
const exportMatch = oldLessonPlayerSrc.match(/\/\/ ─── Main Export ───[\s\S]*/);
let lessonPlayerExport = exportMatch ? exportMatch[0] : '';

// Modify LessonPlayer export to remove vimeo and use InternalPlayer instead of PlayerCore
lessonPlayerExport = lessonPlayerExport.replace(/const getVimeoId[\s\S]*?};/g, '');
lessonPlayerExport = lessonPlayerExport.replace(/if\s*\([\s\S]*?vimeo[\s\S]*?return raw;\s*}/g, 'return raw;');

// Replace PlayerCore invocation with InternalPlayer
lessonPlayerExport = lessonPlayerExport.replace(/<PlayerCore[\s\S]*?\/>/g, 
`<InternalPlayer src={playerSrc} type={lesson.type === 'youtube' ? 'youtube' : 'selfhosted'} poster={posterUrl}>
                <FloatingTag label={lesson.type === 'youtube' ? 'YouTube' : 'Self-Hosted'} title={lesson.title} />
            </InternalPlayer>`);

// Compose final file content
const finalContent = `"use client";

${imports}

${propsInterface}

${floatingTag}

${polyfills}

${internalPlayerCode}

${lessonPlayerExport}
`;

fs.writeFileSync(lessonPlayerPath, finalContent, 'utf8');
console.log('Successfully transformed LessonPlayer.tsx');
