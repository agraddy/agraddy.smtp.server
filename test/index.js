var tap = require('agraddy.test.tap')(__filename);
var events = require('events');
var net = require('net');
var path = require('path');
var stream = require('stream');

var emitter = new events.EventEmitter();

process.chdir('test');

var smtp = require('../');

var port;
var writable;

var server = smtp.createServer(function(req, res) {
	if(req.to == 'basic@example.com') {
		// Email should come in for one@example.com
		tap.assert(true, 'Message received.');

		res.accept();
	} else if(req.to == 'reject@example.com') {
		tap.assert(true, 'Message received.');

		res.reject();
	} else if(req.to == 'custom@example.com') {
		tap.assert(true, 'Message received.');

		res.write('523 Too large');
	} else if(req.to == 'exists@example.net') {
		tap.assert(true, 'Message received.');

		res.accept();
	} else if(req.to == 'stream@example.com') {
		writable = new stream.Writable();
		writable._content = '';
		writable._write = function(chunk, encoding, cb) {
			writable._content += chunk.toString();
			cb();
		};

		req.pipe(writable).on('finish', function() {
			tap.assert.equal(writable._content, 'From: from@example.com\r\nTo: stream@example.com\r\nSubject: Test Subject\r\n\r\nThis is a test message.\r\n', 'The req should be a readable stream of the entire email with headers.');
		});

		res.accept();
	}
});

server.on('listening', function() {
	port = server.address().port;

	basic();
});

function basic() {
	runCommands(port, 'basic.txt', noAccount);
}

function noAccount() {
	var emitter = runCommands(port, 'no_account.txt', manualRejection);

	emitter.on('data', function(data) {
		if(data.indexOf('550') !== -1) {
			tap.assert(true, 'Make sure a 550 response is sent when the email does not have an account.');
		}
	});
}

function manualRejection() {
	var emitter = runCommands(port, 'reject.txt', custom);

	emitter.on('data', function(data) {
		if(data.indexOf('550') !== -1) {
			tap.assert(true, 'Make sure a 550 response is sent when the listener calls res.reject().');
		}
	});
}

function custom() {
	var emitter = runCommands(port, 'custom.txt', regex);

	emitter.on('data', function(data) {
		if(data.indexOf('523') !== -1) {
			tap.assert(true, 'Make sure the custom error is sent from res.write().');
		}
	});
}

function regex() {
	runCommands(port, 'regex.txt', streamWorking);
}

function streamWorking() {
	runCommands(port, 'stream.txt', end);
}

function end() {
	tap.assert(true, 'Final function should be called.');

	process.exit();
}




function getCommands(file) {
	var fs = require('fs');
	var commands = new events.EventEmitter();
	commands.list = [];
	commands.cont = [];

	fs.readFile(file, function(err, data) {
		var lines = data.toString().split('\n').filter(function(item) {
			if(item.slice(0, 1) == '#') {
				return false;
			} else {
				return true;
			}
		});
		var i;

		for(i = 0; i < lines.length; i++) {
			if(lines[i].slice(0, 2) == '< ') {
				commands.list.push(lines[i].slice(2) + '\r\n');

				// Check if the command should wait for response or continue
				// Need to account for comments # Comment maybe filter() the array after the split()
				if(i > 0 && lines[i - 1].slice(0, 2) == '< ') {
					commands.cont.push(commands.list.length - 1);
				}
			}
		}

		commands.emit('loaded');
	});

	return commands;
}

function runCommands(port, file, cb) {
	var commands = getCommands(path.join('fixtures', file));
	var index = 0;

	commands.on('loaded', function() {
		run();
	});

	function run() {
		var client = net.createConnection(port);

		client.on('data', function(data) {
			//console.log('CLIENT RECEIVED: ' + data.toString());
			commands.emit('data', data.toString());
			if(index < commands.list.length) {
				client.write(commands.list[index]);
			}
			index++;

			while(commands.cont.indexOf(index) !== -1) {
				client.write(commands.list[index]);
				index++;
			}
		});

		client.on('end', function(data) {
			cb();
		});
	}

	return commands;
}

// Listen on an ephemeral port
server.listen(0, '127.0.0.1');



