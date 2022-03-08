import { detectLineEndings } from '../src/stores/xml/util.js';
import { expect } from 'chai';

describe('xml', () => {
	describe('util', () => {
		describe('detectLineEndings()', () => {
			it('should detect \\r', () => {
				expect(detectLineEndings('a\rb')).to.equal('\r');
				expect(detectLineEndings('a\rb\nc\rd')).to.equal('\r');
				expect(detectLineEndings('a\rb\nc\r\nd\re')).to.equal('\r');

				expect(detectLineEndings('\r')).to.equal('\r');
				expect(detectLineEndings('\n\r\r')).to.equal('\r');
			});

			it('should detect \\n', () => {
				expect(detectLineEndings('')).to.equal('\n');
				expect(detectLineEndings('a\nb')).to.equal('\n');
				expect(detectLineEndings('a\nb\rc\nd')).to.equal('\n');

				expect(detectLineEndings('\n')).to.equal('\n');
				expect(detectLineEndings('\n\n\r')).to.equal('\n');
			});

			it('should detect \\r\\n', () => {
				expect(detectLineEndings('a\r\nb')).to.equal('\r\n');
				expect(detectLineEndings('a\r\nb\r\nc\rd')).to.equal('\r\n');
				expect(detectLineEndings('a\rb\nc\r\nd')).to.equal('\r\n');
				expect(detectLineEndings('a\r\nb\r\nc\rd\re\rf\r\ng')).to.equal('\r\n');

				expect(detectLineEndings('\r\n')).to.equal('\r\n');
				expect(detectLineEndings('\r\n\r\n\r')).to.equal('\r\n');
				expect(detectLineEndings('\r\n\r\n')).to.equal('\r\n');
				expect(detectLineEndings('\r\n\r\n\r\r\r\r\n')).to.equal('\r\n');
			});
		});
	});
});
