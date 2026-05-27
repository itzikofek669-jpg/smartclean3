const fs = require('fs');
const path = 'C:/Users/itzik/Downloads/5/5/smartclean3/app/profile.tsx';
let c = fs.readFileSync(path, 'utf8');

// 1. Remove bank from PAY_ICONS
c = c.replace(
  `const PAY_ICONS: Record<string, string> = { bit: '📱', cash: '💵', paybox: '💜', bank: '🏦' };`,
  `const PAY_ICONS: Record<string, string> = { bit: '📱', cash: '💵', paybox: '💜' };`
);

// 2. Fix paySheetTab type
c = c.replace(
  `useState<'bit'|'paybox'|'bank'>('bit')`,
  `useState<'bit'|'paybox'>('bit')`
);

// 3. Fix default tab selection - remove bank case
c = c.replace(
  `const defaultTab = b.payment === 'paybox' ? 'paybox' : b.payment === 'bank' ? 'bank' : 'bit';`,
  `const defaultTab = b.payment === 'paybox' ? 'paybox' : 'bit';`
);

// 4. Remove bank from edit profile payment options
c = c.replace(
  `{ key: 'bank', label: '🏦 ' + t.payBank }`,
  ``
);
// clean up trailing comma/space
c = c.replace(`{ key: 'paybox', label: '💜 ' + t.payPaybox }, ,`, `{ key: 'paybox', label: '💜 ' + t.payPaybox }`);

// 5. Remove bank from all payment label display chains
const bankLabel = `b.payment === 'bank' ? t.payBank : `;
c = c.split(bankLabel).join('');

const bankLabel2 = `pendingConfirmBooking.payment === 'bank' ? t.payBank : `;
c = c.split(bankLabel2).join('');

const bankLabel3 = `confirmedBookingView.payment === 'bank' ? t.payBank : `;
c = c.split(bankLabel3).join('');

const bankLabel4 = `req.paymentMethod === 'bank' ? t.payBank : `;
c = c.split(bankLabel4).join('');

// 6. Remove the entire bank paySheet section
const bankSectionStart = `            {/* ── העברה בנקאית ── */}
            {paySheetTab === 'bank' && (`;
const bankSectionEndMarker = `            )}

`;
const startIdx = c.indexOf(bankSectionStart);
if (startIdx !== -1) {
  // find matching closing paren/brace
  let depth = 0;
  let i = startIdx + bankSectionStart.length;
  let foundEnd = -1;
  for (; i < c.length; i++) {
    if (c[i] === '(') depth++;
    if (c[i] === ')') {
      if (depth === 0) { foundEnd = i; break; }
      depth--;
    }
  }
  if (foundEnd !== -1) {
    // find next newline after closing paren
    const endLine = c.indexOf('\n', foundEnd) + 1;
    c = c.slice(0, startIdx) + c.slice(endLine);
  }
}

// 7. Remove bank tab button from paySheet tabs
// Look for the bank tab button in the tabs row
c = c.replace(/\s*<TouchableOpacity[^>]*onPress=\{[^}]*setPaySheetTab\('bank'\)[^}]*\}[^/]*\/TouchableOpacity>/g, '');
c = c.replace(/\s*<TouchableOpacity[^>]*\n[^>]*onPress=\{[^\}]*setPaySheetTab\('bank'\)[^\}]*\}[\s\S]*?<\/TouchableOpacity>/g, '');

fs.writeFileSync(path, c, 'utf8');
console.log('Done');
