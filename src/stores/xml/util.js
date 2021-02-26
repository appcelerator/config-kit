import snooplogg from 'snooplogg';

const { log } = snooplogg('config-kit')('xml-util');
const { highlight } = snooplogg.styles;

export const dom = {
	ELEMENT_NODE:                1,
	ATTRIBUTE_NODE:              2,
	TEXT_NODE:                   3,
	CDATA_SECTION_NODE:          4,
	ENTITY_REFERENCE_NODE:       5,
	ENTITY_NODE:                 6,
	PROCESSING_INSTRUCTION_NODE: 7,
	COMMENT_NODE:                8,
	DOCUMENT_NODE:               9,
	DOCUMENT_TYPE_NODE:          10,
	DOCUMENT_FRAGMENT_NODE:      11,
	NOTATION_NODE:               12
};

dom.nodeTypes = {
	[dom.ELEMENT_NODE]:                'ELEMENT_NODE',
	[dom.ATTRIBUTE_NODE]:              'ATTRIBUTE_NODE',
	[dom.TEXT_NODE]:                   'TEXT_NODE',
	[dom.CDATA_SECTION_NODE]:          'CDATA_SECTION_NODE',
	[dom.ENTITY_REFERENCE_NODE]:       'ENTITY_REFERENCE_NODE',
	[dom.ENTITY_NODE]:                 'ENTITY_NODE',
	[dom.PROCESSING_INSTRUCTION_NODE]: 'PROCESSING_INSTRUCTION_NODE',
	[dom.COMMENT_NODE]:                'COMMENT_NODE',
	[dom.DOCUMENT_NODE]:               'DOCUMENT_NODE',
	[dom.DOCUMENT_TYPE_NODE]:          'DOCUMENT_TYPE_NODE',
	[dom.DOCUMENT_FRAGMENT_NODE]:      'DOCUMENT_FRAGMENT_NODE',
	[dom.NOTATION_NODE]:               'NOTATION_NODE'
};

/**
 * Parses and tries to cast a value into a JavaScript data type.
 *
 * @param {String} value - The value to attempt to cast.
 * @param {Symbol} [type] - A specific data type to consider when casting.
 * @returns {*}
 */
export function cast(value, type) {
	/* eslint-disable curly */
	if (value === undefined) return undefined;
	if (value === null || value === 'null') return null;
	if (value === true || value === 'true') return true;
	if (value === false || value === 'false') return false;
	if (type === 'boolean') return !!value;
	if (type === 'number' && typeof value === 'number') return value;
	if (typeof value === 'string') {
		value = value.trim();
		if (value !== '' && type !== 'string') {
			const num = value.startsWith('0x') ? value : Number(value);
			if ((type === undefined || type === 'number') && !isNaN(num)) return num;
		}
	}
	return value;
}

/**
 * Creates a DOM node, appends it to the parent along with the proper indentation.
 *
 * @param {String} name - The name of the DOM node tag.
 * @param {String|Number} value - The text value inside the tag.
 * @param {Object} parent - The parent DOM node to append the new node to.
 * @returns {Object}
 */
export function createDOMNode(name, value, parent) {
	const doc = (parent.ownerDocument || parent);
	const parentIndent = parent.previousSibling?.nodeType === dom.TEXT_NODE && parent.previousSibling.textContent.match(/[ \t]*$/)?.[0] || '';
	let postText;

	if (!parent.lastChild) {
		// detect indentation
		parent.appendChild(doc.createTextNode(`${doc.lineEnding}${parentIndent}${doc.indent}`));
		postText = doc.createTextNode(`${doc.lineEnding}${parentIndent}`);
	} else if (parent.lastChild.nodeType !== dom.TEXT_NODE) {
		parent.appendChild(doc.createTextNode(doc.lineEnding));
	} else {
		const ws = parent.lastChild.textContent.replace(/[ \t]+$/, '').replace(/[\r\n]$/, '');
		parent.lastChild.textContent = `${ws}${doc.lineEnding}${parentIndent}${doc.indent}`;
		postText = doc.createTextNode(`${doc.lineEnding}${parentIndent}`);
	}

	const node = doc.createElement(name);
	if (value && typeof value === 'object') {
		if (value['#text'] !== undefined) {
			node.appendChild(doc.createTextNode(String(value['#text'])));
		}
		for (const [ attr, val ] of Object.entries(value)) {
			if (attr[0] === '@' && val !== undefined) {
				node.setAttribute(attr.substring(1), String(val));
			}
		}
	} else if (value !== undefined) {
		node.appendChild(doc.createTextNode(String(value)));
	}
	parent.appendChild(node);

	if (postText) {
		parent.appendChild(postText);
	}

	return node;
}

const crRE   = /\r/g;
const crlfRE = /\r\n/g;
const lfRE   = /\n/g;

/**
 * Detects the line ending for the given string by counting the max occurences of each line ending
 * type. Order of precendence is `\r\n`, `\n`, and `\r`.
 *
 * @param {String} str - The string to analyze.
 * @returns {String}
 */
export function detectLineEndings(str) {
	const crlf = str.match(crlfRE)?.length || 0;
	const cr   = Math.max((str.match(crRE)?.length || 0) - crlf, 0);
	const lf   = Math.max((str.match(lfRE)?.length || 0) - crlf, 0);

	if (crlf && crlf >= lf && crlf >= cr) {
		return '\r\n';
	}

	return cr && cr > lf ? '\r' : '\n';
}

/**
 * Returns a map of child element DOM nodes.
 *
 * @param {*} domNode - The DOM node to analyze.
 * @returns {Object}
 */
export function getDOMNodeChildren(domNode) {
	const children = {};

	if (domNode) {
		log(`    Looping over ${domNode.childNodes.length} child DOM node${domNode.childNodes.length === 1 ? '' : 's'}:`);

		for (let i = 0, l = domNode.childNodes.length; i < l; i++) {
			const childNode = domNode.childNodes[i];
			const { localName, nodeName, nodeType } = childNode;
			if (nodeType === dom.ELEMENT_NODE) {
				log(`      Child ${i} is type ${dom.nodeTypes[nodeType] || 'unknown'} (${nodeType}) ${highlight(`<${nodeName}>`)}`);

				let dest = children[localName];
				if (!dest) {
					dest = children[localName] = {
						name: localName,
						tag: nodeName,
						parent: domNode
					};
				}

				if (!dest.domNodes) {
					dest.domNodes = [];
				}
				dest.domNodes.push(childNode);
			} else {
				log(`      Child ${i} is type ${dom.nodeTypes[nodeType] || 'unknown'} (${nodeType}), skipping...`);
			}
		}
	}

	return children;
}

/**
 * Unescapes whitespace escape sequences so they can be printed literally.
 *
 * @param {String} str - The string to unescape.
 * @returns {String}
 */
export function unescapeSequence(str) {
	return str.replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
}
