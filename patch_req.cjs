const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const regex = /const requestAction = \(type: string, payload\?: any\) => \{[\s\S]*?executeAction\(\{ type, payload \}\);\n    \}\n  \};/;
const newCode = `const requestAction = (type: string, payload?: any) => {
    let lessensRestrictions = false;
    
    if (['remove_site', 'remove_keyword', 'delete_schedule', 'add_whitelist'].includes(type)) {
      lessensRestrictions = true;
    } else if (type === 'toggle_schedule') {
      const schedule = schedules.find(s => s.id === payload.id);
      if (schedule && schedule.isActive) lessensRestrictions = true;
    }

    if (isStandaloneActive && lessensRestrictions) {
      return; 
    }
    
    if (password && lessensRestrictions) {
      setVerifyAction({ type, payload });
    } else {
      executeAction({ type, payload });
    }
  };`;

code = code.replace(regex, newCode);
fs.writeFileSync('src/App.tsx', code);
