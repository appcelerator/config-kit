import Node from '../../node';
import snooplogg from 'snooplogg';
import { cast, createDOMNode, dom, getDOMNodeChildren } from './util';

const { log } = snooplogg('config-kit')('XNode');
const { highlight } = snooplogg.styles;

/**
 * Extends a store Node with additional metadata for the XML nodes.
 */
export default class XNode extends Node {
	/**
	 * Initializes the DOM node metaadata.
	 *
	 * @param {*} value - The initial value of this node.
	 * @param {XNode} [parent] - The node reference to the parent node.
	 * @access public
	 */
	constructor(value, parent) {
		super(value, parent);
		this[XNode.Meta].domNode = null;
		this[XNode.Meta].domNodes = Array.isArray(value) ? [] : {};
	}

	/**
	 * Called when a property is being set on an XNode so that we can link the DOM node to the
	 * XNode's metadata or create a DOM node if it doesn't exist.
	 *
	 * @param {Object} params - Various parameters.
	 * @param {Object} internal - The XNode's metadata object
	 * @param {String} prop - The property name being set.
	 * @param {*} value - The property value.
	 */
	static onSet({ internal, prop, value }) {
		if (value === undefined || value === null || prop[0] === '@' || prop === '#text') {
			return;
		}

		let { domNode } = internal;
		if (!domNode) {
			for (const parent of internal.parents) {
				domNode = createDOMNode(prop, undefined, parent);
				break;
			}
			if (!domNode) {
				return;
			}
		}

		if (Array.isArray(value)) {
			// check that value[XNode.Meta].domNodes[] has every value has a DOM node
			for (let i = 0; i < value.length; i++) {
				if (value[i]?.[XNode.Meta]?.domNode) {
					value[XNode.Meta].domNodes[i] = value[i][XNode.Meta].domNode;
				} else if (!value[XNode.Meta].domNodes[i]) {
					value[XNode.Meta].domNodes[i] = createDOMNode(prop, value[i], domNode);
				}
			}
			return;
		}

		if (typeof value === 'object') {
			if (value[XNode.Meta]) {
				const attrs = Object.keys(value).filter(p => p[0] === '@');
				const children = Object.keys(value).filter(p => p[0] !== '@' && p !== '#text');
				const text = Object.prototype.hasOwnProperty.call(value, '#text') ? value['#text'] : undefined;

				if (!value[XNode.Meta].domNode && (children.length || text === undefined)) {
					value[XNode.Meta].domNode = createDOMNode(prop, text, domNode);
				}
				if (value[XNode.Meta].domNode) {
					for (const attr of attrs) {
						if (value[attr] !== undefined) {
							value[XNode.Meta].domNode.setAttribute(attr.substring(1), String(value[attr]));
						}
					}
				}
			}
			return;
		}

		if (internal.domNodes[prop]) {
			return;
		}

		log(`Creating new DOM node ${highlight(`<${prop}>`)}`);
		if (!Array.isArray(internal.domNodes[prop])) {
			internal.domNodes[prop] = [];
		}

		internal.domNodes[prop].push(createDOMNode(prop, value, domNode));
	}

	static createNode({ domNode, existingNode, schema }) {
		log(`Creating node: domNode=${highlight(!!domNode)} existingNode=${highlight(!!existingNode)} schema=${highlight(!!schema)}`);

		if (schema) {
			log('  Have schema, but schema not done yet!');
		} else if (domNode) {
			log(`  No schema, auto-detecting DOM node of type ${dom.nodeTypes[domNode.nodeType] || 'unknown'} (${domNode.nodeType})`);
			switch (domNode.nodeType) {
				case dom.DOCUMENT_NODE:
				case dom.ELEMENT_NODE:
					const props = getDOMNodeChildren(domNode);
					if (!Object.keys(props).length) {
						// no child DOM nodes, so we either have an document object or an empty string
						if (domNode.nodeType !== dom.DOCUMENT_NODE && !domNode.attributes.length) {
							return cast(domNode.textContent || '');
						}

						const xnode = new XNode({});
						xnode[XNode.Meta].domNode = domNode;

						if (domNode.nodeType === dom.ELEMENT_NODE) {
							for (let i = 0; i < domNode.attributes.length; i++) {
								const attr = domNode.attributes[i];
								xnode[`@${attr.localName}`] = cast(attr.nodeValue || '');
							}
							xnode['#text'] = cast(domNode.textContent || '');
						}

						return xnode;
					}

					// we have at least 1 child DOM node, so treat this node as an object

					const xnode = new XNode({});
					const xnodeMeta = xnode[XNode.Meta];
					xnodeMeta.domNode = domNode;

					for (const prop of Object.keys(props)) {
						const { domNodes, name } = props[prop];
						let child;

						log(`    ${highlight(`<${name}>`)} ${domNodes.length} occurrence${domNodes.length === 1 ? '' : 's'}`);

						if (domNodes.length > 1) {
							child = new XNode([]);
							const childMeta = child[XNode.Meta];
							childMeta.domNode = domNode;
							let i = 0;
							for (const domNode of domNodes) {
								const value = XNode.createNode({ domNode, existingNode: existingNode?.[prop]?.[i] });
								if (!value?.[XNode.Meta]) {
									childMeta.domNodes[i] = domNode;
								}
								child[i++] = value;
							}
						} else {
							child = XNode.createNode({ domNode: domNodes[0], existingNode: existingNode?.[prop] });
							if (!child?.[XNode.Meta]) {
								xnodeMeta.domNodes[prop] = domNode;
							}
						}

						xnode[prop] = child;
					}

					return xnode;
			}
		} else if (existingNode !== undefined && existingNode !== null) {
			log('  Creating new node from existing node');
			return new XNode(existingNode);
		}

		log('  Returning null');
		return null;
	}
}
