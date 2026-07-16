const fs = require('fs');
const path = require('path');

const mappings = {
  'library-view.js': 'initHolonetLibraryView',
  'nexus.js': 'initHolonetNexus',
  'report-cycle.js': 'initHolonetReportCycle',
  'account.js': 'initHolonetAccount',
  'admin.js': 'initHolonetAdmin',
  'archive-map.js': 'initHolonetArchiveMap',
  'council-floor.js': 'initHolonetCouncilFloor',
  'cots.js': 'initHolonetCots',
  'personnel.js': 'initHolonetPersonnel',
  'registry-directory.js': 'initHolonetRegistryDirectory',
  'group-timeline.js': 'initHolonetGroupTimeline',
  'division-hub.js': 'initHolonetDivisionHub',
  'division-section.js': 'initHolonetDivisionSection'
};

const dir = 'c:/Users/Owen/OneDrive/Documents/Visual Studio Code/holonet/modules/client';

for (const [file, windowProp] of Object.entries(mappings)) {
  const filePath = path.join(dir, file);
  if (!fs.existsSync(filePath)) continue;
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix the double if(readyState) wrapper introduced earlier
  const regex = /if\s*\(document\.readyState\s*===\s*"loading"\)\s*\{\s*if\s*\(document\.readyState\s*===\s*"loading"\)\s*\{([\s\S]*?)\}\s*else\s*\{([\s\S]*?)\}\s*\}\s*else\s*\{([\s\S]*?)\}/g;
  content = content.replace(regex, 'if (document.readyState === "loading") {$1} else {$2}');

  // Make sure we have the window assignment
  const assignment = 'window.' + windowProp + ' = ';
  if (!content.includes(assignment)) {
    // extract the function name from the DOMContentLoaded call
    const match = content.match(/document\.addEventListener\("DOMContentLoaded",\s*([a-zA-Z0-9_]+)\)/);
    if (match) {
      const funcName = match[1];
      const codeToInsert = '\nwindow.' + windowProp + ' = ' + funcName + ';\n';
      // insert right before the if (document.readyState
      content = content.replace(/if\s*\(document\.readyState\s*===\s*"loading"\)/, codeToInsert + 'if (document.readyState === "loading")');
    }
  }
  
  fs.writeFileSync(filePath, content);
  console.log('Processed ' + file);
}
