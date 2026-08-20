function parseM3U(content) {
  const lines = content.replace(/\r/g, '').split('\n');
  const channels = [];
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === '#EXTM3U') continue;

    if (trimmed.startsWith('#EXTINF:')) {
      current = parseExtInf(trimmed);
    } else if (!trimmed.startsWith('#') && current) {
      current.url = trimmed;
      channels.push(current);
      current = null;
    }
  }

  return channels;
}

function parseExtInf(line) {
  const tvgId   = extractAttr(line, 'tvg-id');
  const tvgName = extractAttr(line, 'tvg-name');
  const logo    = extractAttr(line, 'tvg-logo');
  const group   = extractAttr(line, 'group-title') || 'Général';

  const commaIdx = line.lastIndexOf(',');
  const nameFromLine = commaIdx !== -1 ? line.slice(commaIdx + 1).trim() : '';
  const name = nameFromLine || tvgName || 'Chaîne inconnue';

  return { name, logo, group, tvgId, url: '' };
}

function extractAttr(str, attr) {
  const match = str.match(new RegExp(`${attr}="([^"]*)"`, 'i'));
  return match ? match[1].trim() : '';
}

module.exports = { parseM3U };
