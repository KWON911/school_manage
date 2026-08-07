const iconv = require('iconv-lite');

const SEARCH_URL = 'https://www.schoolinfo.go.kr/ei/ss/Pneiss_f01_l0.do';

function encodeEucKr(value) {
  return [...iconv.encode(value, 'euc-kr')]
    .map((byte) => `%${byte.toString(16).toUpperCase().padStart(2, '0')}`)
    .join('');
}

function createSchoolInfoSearchHandler() {
  return function handler(req, res) {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const name = typeof req.query?.name === 'string' ? req.query.name.trim() : '';
    if (!name) return res.status(400).json({ error: 'School name is required.' });

    const encoded = encodeEucKr(name);
    const location = `${SEARCH_URL}?SEARCH_KEYWORD=${encoded}&SEARCH_SCHUL_NM=${encoded}`;
    res.setHeader('Location', location);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(302).end();
  };
}

const handler = createSchoolInfoSearchHandler();

module.exports = handler;
module.exports.createSchoolInfoSearchHandler = createSchoolInfoSearchHandler;
module.exports.encodeEucKr = encodeEucKr;
