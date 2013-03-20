/*
 * Copyright (c) 2012-2013 VMware, Inc. All Rights Reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

(function (buster, define) {
	'use strict';

	var assert, refute, fail, failOnThrow, undef;

	assert = buster.assertions.assert;
	refute = buster.assertions.refute;
	fail = buster.assertions.fail;
	failOnThrow = buster.assertions.failOnThrow;

	define('rest/interceptor/timeout-test', function (require) {

		var timeout, rest, when, delay;

		timeout = require('rest/interceptor/timeout');
		rest = require('rest');
		when = require('when');
		delay = require('when/delay');

		function hangClient(/* request */) {
			return when.defer().promise;
		}

		function immediateClient(request) {
			return { request: request };
		}

		function delayedClient(request) {
			var d, response;
			response = { request: request };
			d = when.defer();
			delay(50).then(function () {
				d.resolver.resolve(response);
			});
			return d.promise;
		}

		function cancelableClient(request) {
			var d = when.defer();
			request.canceled = false;
			request.cancel = function () {
				request.canceled = true;
				d.resolver.reject({ request: request });
			};
			return d.promise;
		}

		buster.testCase('rest/interceptor/timeout', {
			'should resolve if client responds immediately': function (done) {
				var client, request;
				client = timeout(immediateClient, { timeout: 20 });
				request = {};
				client(request).then(function (response) {
					assert.same(request, response.request);
					refute(response.error);
					return delay(40).then(function () {
						// delay to make sure timeout has fired, but not rejected the response
						refute(request.canceled);
					});
				}).then(undef, fail).always(done);
			},
			'should resolve if client responds before timeout': function (done) {
				var client, request;
				client = timeout(delayedClient, { timeout: 100 });
				request = {};
				client(request).then(function (response) {
					assert.same(request, response.request);
					refute(response.error);
					refute(request.canceled);
				}).then(undef, fail).always(done);
			},
			'should reject even if client responds after timeout': function (done) {
				var client, request;
				client = timeout(delayedClient, { timeout: 10 });
				request = {};
				client(request).then(
					fail,
					failOnThrow(function (response) {
						assert.same(request, response.request);
						assert.equals('timeout', response.error);
						assert(request.canceled);
					})
				).always(done);
			},
			'should reject if client hanges': function (done) {
				var client, request;
				client = timeout(hangClient, { timeout: 50 });
				request = {};
				client(request).then(
					fail,
					failOnThrow(function (response) {
						assert.same(request, response.request);
						assert.equals('timeout', response.error);
						assert(request.canceled);
					})
				).always(done);
			},
			'should use request timeout value in perference to interceptor value': function (done) {
				var client, request;
				client = timeout(delayedClient, { timeout: 10 });
				request = { timeout: 0 };
				client(request).then(function (response) {
					assert.same(request, response.request);
					refute(response.error);
					refute(request.canceled);
				}).then(undef, fail).always(done);
			},
			'should not reject without a configured timeout value': function (done) {
				var client, request;
				client = timeout(delayedClient);
				request = {};
				client(request).then(function (response) {
					assert.same(request, response.request);
					refute(response.error);
					refute(request.canceled);
				}).then(undef, fail).always(done);
			},
			'should cancel request if client support cancelation': function (done) {
				var client, request;
				client = timeout(cancelableClient, { timeout: 11 });
				request = {};
				client(request).then(
					fail,
					failOnThrow(function (response) {
						assert.same(request, response.request);
						assert.equals('timeout', response.error);
						assert(request.canceled);
					})
				).always(done);
				refute(request.canceled);
			},
			'should have the default client as the parent by default': function () {
				assert.same(rest, timeout().skip());
			},
			'should support interceptor chaining': function () {
				assert(typeof timeout().chain === 'function');
			}
		});

	});

}(
	this.buster || require('buster'),
	typeof define === 'function' && define.amd ? define : function (id, factory) {
		var packageName = id.split(/[\/\-]/)[0], pathToRoot = id.replace(/[^\/]+/g, '..');
		pathToRoot = pathToRoot.length > 2 ? pathToRoot.substr(3) : pathToRoot;
		factory(function (moduleId) {
			return require(moduleId.indexOf(packageName) === 0 ? pathToRoot + moduleId.substr(packageName.length) : moduleId);
		});
	}
	// Boilerplate for AMD and Node
));
