export function mealIllustrationMarkup(item) {
  const name = String(item ?? '').replace(/\([^)]*\)/g, '').toLowerCase();
  let illustration = '<circle cx="12" cy="12" r="7"/><path d="M8 12h8M12 8v8"/>';
  if (/(밥|볶음밥|비빔밥|주먹밥|rice)/i.test(name)) illustration = '<path d="M5 11h14v2a5 5 0 0 1-5 5h-4a5 5 0 0 1-5-5z"/><path d="M7 9c1.2-2 2.8-3 5-3s3.8 1 5 3"/>';
  else if (/(국|탕|찌개|전골|soup|stew)/i.test(name)) illustration = '<path d="M5 10h14v2a7 7 0 0 1-14 0z"/><path d="M8 7c0-1 1-1 1-2m3 2c0-1 1-1 1-2m3 2c0-1 1-1 1-2"/>';
  else if (/(불고기|제육|돈까스|치킨|닭|돼지|소고기|고기|meat|chicken|pork|beef)/i.test(name)) illustration = '<path d="M6 15c0-3 2-6 5-6 2 0 3 1 4 3l3 3-3 3-3-3c-2 1-4 1-6 0z"/><circle cx="15.5" cy="12" r="1"/>';
  else if (/(생선|고등어|연어|오징어|새우|fish|salmon|shrimp)/i.test(name)) illustration = '<path d="M4 12s3-5 8-5c3 0 5 2 7 5-2 3-4 5-7 5-5 0-8-5-8-5z"/><path d="m19 12 3-3v6z"/><circle cx="11" cy="11" r=".8"/>';
  else if (/(계란|달걀|메추리|egg)/i.test(name)) illustration = '<path d="M12 4c3 0 5 4 5 8a5 5 0 0 1-10 0c0-4 2-8 5-8z"/><path d="M10 13h4"/>';
  else if (/(김치|깍두기|겉절이|kimchi)/i.test(name)) illustration = '<path d="M7 5h10l-1 14H8z"/><path d="M9 8h6M9 12h6M9 16h6"/>';
  else if (/(사과|배|귤|바나나|포도|과일|apple|fruit)/i.test(name)) illustration = '<path d="M12 8c-4-3-7 1-6 5 1 5 4 7 6 3 2 4 5 2 6-3 1-4-2-8-6-5z"/><path d="M12 8c0-2 1-3 3-4"/>';
  else if (/(채소|나물|샐러드|브로콜리|야채|vegetable|salad)/i.test(name)) illustration = '<path d="M6 14c0-4 3-6 6-6s6 2 6 6v3H6z"/><path d="M12 8V5m0 0c-2 0-3-1-3-2m3 2c2 0 3-1 3-2"/>';
  return `<span class="meal-item__illustration" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">${illustration}</svg></span>`;
}
