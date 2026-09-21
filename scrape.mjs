import axios from "axios";             // retrieve static web html
import https from 'https';
import { chromium } from 'playwright'; // open web page inside a browser to manage js produced html
import * as cheerio from "cheerio";    // query in html
import fs from "node:fs"               // read/write files

// const parts = {
//   ethique_i: 1,
//   ethique_ii: 2,
//   ethique_iii: 3,
//   ethique_iv: 4,
//   ethique_v: 5
// };

function normalizeHref(href) {
  try {
    return decodeURIComponent(href);
  } catch {
    return href;
  }
}

function getPart(path) {
  const normalized = path
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const match = normalized.match(/ethique_(i{1,3}|iv|v)\b/);
  if (!match) return undefined;

  return {
    i: 1,
    ii: 2,
    iii: 3,
    iv: 4,
    v: 5
  }[match[1]];
}

function normalizeAnchor(anchor) {
  try {
    anchor = decodeURIComponent(anchor);
  } catch {}

  return anchor
    .replace(/^D\.C3\.A9finition/i, 'Définition')
    .replace(/^D\.?éfinition/i, 'Définition')
    .replace(/^D\.?éfinition/i, 'Définition');
}

function parseReference(input, part) {
  let anchor;

  if (typeof input === 'string') {
    anchor = input.trim();
  } else {
    const href = input.attr('href');
    if (!href || !href.includes('#')) return null;

    const normalizedHref = normalizeHref(href);
    const [path, rawAnchor] = normalizedHref.split('#');

    anchor = normalizeAnchor(rawAnchor);
    part = getPart(path);
  }

  anchor = anchor
    .trim()
    .replace(/[_\s]+/g, '_');

  let match;

  match = anchor.match(/^Proposition_(\d+)$/i);
  if (match) {
    return {
      type: 'proposition',
      number: Number(match[1]),
      ...(part !== undefined && { part })
    };
  }

  match = anchor.match(/^Définition_(\d+)$/i);
  if (match) {
    return {
      type: 'definition',
      number: Number(match[1]),
      ...(part !== undefined && { part })
    };
  }

  match = anchor.match(/^Définition_(\d+)$/i);
  if (match) {
    return {
      type: 'definition',
      number: Number(match[1]),
      ...(part !== undefined && { part })
    };
  }

  match = anchor.match(/^Définition_de_l'individu$/i);
  if (match) {
    return {
      type: 'definition_individual',
      number: Number(match[1]) ? Number(match[1]) : 1,
      ...(part !== undefined && { part })
    };
  }

  match = anchor.match(/^(\d+)$/i);
  if (match) {
    return {
      type: 'definition_affects',
      number: Number(match[1]),
      ...(part !== undefined && { part })
    };
  }

  match = anchor.match(/^Définition_générale_des_affects$/i);
  if (match) {
    return {
      type: 'definition_affects_general',
      ...(part !== undefined && { part })
    };
  }

  match = anchor.match(/^Corollaire(?:_(\d+))?_de_la_proposition_(\d+)$/i);
  if (match) {
    return {
      type: 'corollary',
      number: match[1] ? Number(match[1]) : 1,
      parent: {
        type: 'proposition',
        number: Number(match[2])
      },
      ...(part !== undefined && { part })
    };
  }

  match = anchor.match(
    /^Scolie(?:_(\d+))?_(?:de_la|du)_(proposition|lemme)_(\d+)$/i
  );
  if (match) {
    return {
      type: 'scolie',
      number: match[1] ? Number(match[1]) : 1,
      parent: {
        type: match[2].toLowerCase(),
        number: Number(match[3])
      },
      ...(part !== undefined && { part })
    };
  }

  match = anchor.match(
    /^Scolie(?:_(\d+))?_du_corollaire(?:_(\d+))?_(?:de_la|du)_(proposition|lemme)_(\d+)$/i
  );
  if (match) {
    return {
      type: 'scolie',
      number: Number(match[1]) ? Number(match[1]) : 1,
      parent: {
        type: "corollary",
        number: Number(match[2]) ? Number(match[2]) : 1,
        parent: {
          type: match[3].toLowerCase(),
          number: Number(match[4])
        }
      },
      ...(part !== undefined && { part })
    };
  }

  match = anchor.match(/^Axiome_(\d+)$/i);
  if (match) {
    return {
      type: 'axiom',
      number: Number(match[1]),
      ...(part !== undefined && { part })
    };
  }
  match = anchor.match(/^Axiome_(\d+)_sur_les_corps$/i);
  if (match) {
    return {
      type: 'axiom_on_bodies',
      number: Number(match[1]),
      ...(part !== undefined && { part })
    };
  }
  match = anchor.match(/^Axiome_(\d+)_sur_les_rapports_entre_les_corps$/i);
  if (match) {
    return {
      type: 'axiom_on_interactions_of_bodies',
      number: Number(match[1]),
      ...(part !== undefined && { part })
    };
  }

  match = anchor.match(/^Lemme_(\d+)$/i);
  if (match) {
    return {
      type: 'lemma',
      number: Number(match[1]),
      ...(part !== undefined && { part })
    };
  }

  match = anchor.match(/^Postulat_(\d+)$/i);
  if (match) {
    return {
      type: 'postulate',
      number: Number(match[1]),
      ...(part !== undefined && { part })
    };
  }

  match = anchor.match(/^Chapitre_(\d+)$/i);
  if (match) {
    return {
      type: 'chapter',
      number: Number(match[1]),
      ...(part !== undefined && { part })
    };
  }

  match = anchor.match(/^Appendice$/i);
  if (match) {
    return {
      type: 'appendix',
      ...(part !== undefined && { part })
    };
  }

  match = anchor.match(/^Préambule/i);
  if (match) {
    return {
      type: 'preambule',
      ...(part !== undefined && { part })
    };
  }

  match = anchor.match(/^Préface/i);
  if (match) {
    return {
      type: 'preface',
      ...(part !== undefined && { part })
    };
  }

  return {
    type: 'unknown'
  };
}



let url = [
	"https://spinozaetnous.org/wiki/%C3%89thique_I",
	"https://spinozaetnous.org/wiki/%C3%89thique_II",
	"https://spinozaetnous.org/wiki/%C3%89thique_III",
	"https://spinozaetnous.org/wiki/%C3%89thique_IV",
	"https://spinozaetnous.org/wiki/%C3%89thique_V"
];
const result = [];
for(var j=0;j<url.length;j++){
	const response = await axios.get(url[j], 
    { 
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        "Referer": "https://www.google.com/"
      } 
    });
    let part = j + 1;
	/////// Query HTML page ///////
	const $ = cheerio.load(response.data);
	$('span.mw-headline').each((_, headline) => {
		let references = [];
		const title = $(headline).text().trim();
		let tmp = parseReference(title,part);
		let text = $(headline).parent().next().text().split('\n')[0];
		const demonstration = [];

		let el = $(headline).parent().next().next();
		let flag = false;
		while (el.length) {
			if (el.find('.mw-headline').length){ 
				break;
			} else if (el.is('p') && (/Démonstration\s*:/.test(el.text()) || /Preuve\s*:/.test(el.text()))){
				demonstration.push(el.text().trim().split('\n')[0]);
			    // el.find('a').each((_, a) => {
			    // 	const reference = parseReference($(a));
			    // 	if (reference) references.push(reference);
	      		// });
	      		flag = true;
			} else if(flag) {
				demonstration[demonstration.length-1] = demonstration[demonstration.length-1] + ' ' + el.text().trim().split('\n')[0];
				// el.find('a').each((_, a) => {
			    // 	const reference = parseReference($(a));
			    // 	if (reference) references.push(reference);
	      		// });
			} else {
				text = text + ' ' + el.text().trim().split('\n')[0];
			}
			el.find('a').each((_, a) => {
		    	const reference = parseReference($(a));
		    	if (reference) references.push(reference);
      		});
			el = el.next();
		}

	  	result.push({
	    	type: tmp.type,
	    	number: tmp.number,
	    	...(tmp.parent && { parent: tmp.parent }),
	    	part,
	    	text,
	    	...(demonstration?.length > 0 && { demonstration }),
	    	...(references?.length > 0 && { references })
	  	});
	});
}

fs.writeFileSync(
  'data.js',
  `const data = ${JSON.stringify(result, null, 2)};\n\nexport default data;\n`,
  'utf8'
);

console.log(`Saved ${result.length} entries to data.js`);
