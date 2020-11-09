/* istanbul ignore if */
if (!Error.prepareStackTrace) {
	require('source-map-support/register');
}

import Config from './config';
import Joi from 'joi';
import JSStore from './stores/js-store';
import JSONStore from './stores/json-store';
import Layer from './layer';
import Node from './node';
import Store from './store';

export default Config;
export {
	Config,
	Joi,
	JSStore,
	JSONStore,
	Layer,
	Node,
	Store
};
