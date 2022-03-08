import { expect } from 'chai';
import { getSchemaInitialValues, unique } from '../src/util.js';

describe('Util', () => {
	describe('unique()', () => {
		it('should return an empty array if argument is undefined or null', () => {
			expect(unique()).to.deep.equal([]);
			expect(unique(null)).to.deep.equal([]);
		});

		it('should convert a non-array to an array', () => {
			expect(unique('foo')).to.deep.equal([ 'foo' ]);
			expect(unique(123)).to.deep.equal([ 123 ]);
		});

		it('should remove duplicates', () => {
			expect(unique([ 'a', 'b', undefined, 'a', 'c', null, 'a', 'd' ])).to.deep.equal([ 'a', 'b', 'c', 'd' ]);
		});
	});

	describe('getSchemaInitialValues()', () => {
		it('should error if schema is not an object type', () => {
			expect(() => {
				getSchemaInitialValues({});
			}).to.throw(Error, 'Expected schema root to be an object');

			expect(() => {
				getSchemaInitialValues({ type: 'string' });
			}).to.throw(Error, 'Expected schema root to be an object');
		});
	});
});
